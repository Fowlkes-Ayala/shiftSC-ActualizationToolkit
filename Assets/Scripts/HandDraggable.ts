import { SIK } from "SpectaclesInteractionKit.lspkg/SIK"
import { HandInputData } from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData"
import { BaseHand } from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/BaseHand"
import { ConstructingManager } from "./ConstructingManager"
import { DrillTarget } from "./DrillTarget"
import { DrillDraggable } from "./DrillDraggable"
import { VoiceoverManager } from "./VoiceoverManager"

@component
export class HandDraggable extends BaseScriptComponent {

    @input
    @hint("The RenderMeshVisual on this object")
    renderMesh: RenderMeshVisual

    @input
    @hint("ConstructingManager that holds the snap points")
    constructingManager: ConstructingManager | null = null

    @input
    @hint("Distance (cm) from a snap point at which the object snaps into place")
    snapRadius: number = 20

    private drillTarget: DrillTarget | null = null

    @input
    @hint("Material to swap to when hovering (create an Unlit material, set it yellow/transparent)")
    highlightMaterial: Material | null = null

    @input
    @hint("Distance (cm) the hand must be within to enter hover state")
    hoverRadius: number = 15

    @input
    @hint("Track left hand instead of right")
    useLeftHand: boolean = false

    @input
    @hint("How many fingers (out of 4) must be curled to count as a fist (1–4)")
    fistFingerThreshold: number = 3

    private readonly RELEASE_DELAY = 0.1

    private static anyDragging: boolean = false

    private handInputData: HandInputData | null = null
    private originalMat: Material | null = null
    private dragOffset: vec3 = new vec3(0, 0, 0)
    private isDragging: boolean = false
    private isHovering: boolean = false
    private releaseTimer: number = 0

    onAwake() {
        this.handInputData = SIK.HandInputData
        if (this.renderMesh && this.renderMesh.getMaterialsCount() > 0) {
            this.originalMat = this.renderMesh.getMaterial(0)
        }
        try { this.drillTarget = DrillTarget.findForObject(this.sceneObject) } catch (_) {}
        this.createEvent("UpdateEvent").bind((e: UpdateEvent) => this.onUpdate(e.getDeltaTime()))
        print("HandDraggable awake on: " + this.sceneObject.name + " | constructingManager: " + (this.constructingManager ? "OK" : "NULL"))
    }

    private getHand(): BaseHand | null {
        if (!this.handInputData) return null
        const hand = this.handInputData.getHand(this.useLeftHand ? "left" : "right")
        return hand && hand.isTracked() ? hand : null
    }

    // Fist detection: fingertips curled close to their knuckles.
    // Uses wrist-to-middle-knuckle distance as a per-hand scale reference.
    private isFist(hand: BaseHand): boolean {
        const refDist = hand.middleKnuckle.position.sub(hand.wrist.position).length
        if (refDist < 0.001) return false

        const curlThreshold = refDist * 0.85
        const fingersCurled = [
            hand.indexTip.position.sub(hand.indexKnuckle.position).length,
            hand.middleTip.position.sub(hand.middleKnuckle.position).length,
            hand.ringTip.position.sub(hand.ringKnuckle.position).length,
            hand.pinkyTip.position.sub(hand.pinkyKnuckle.position).length,
        ].filter(d => d < curlThreshold).length

        return fingersCurled >= this.fistFingerThreshold
    }

    private onUpdate(dt: number): void {
        const hand = this.getHand()

        if (!hand) {
            if (this.isDragging) {
                this.constructingManager?.clearPreview()
                this.stopDrag()
            }
            if (this.isHovering) this.setHighlight(false)
            return
        }

        const palmPos = hand.getPalmCenter()
        if (!palmPos) return

        const objectPos = this.sceneObject.getTransform().getWorldPosition()
        const distance  = palmPos.sub(objectPos).length
        const inRange   = distance <= this.hoverRadius
        const grabbing  = this.isFist(hand)

        if (this.isDragging) {
            if (!grabbing) {
                // Accumulate time since fist opened; only release after the delay
                this.releaseTimer += dt
                if (this.releaseTimer >= this.RELEASE_DELAY) {
                    this.stopDrag()
                } else {
                    // Still within delay window — keep moving with hand
                    this.sceneObject.getTransform().setWorldPosition(palmPos.add(this.dragOffset))
                    this.constructingManager?.previewSnap(this.sceneObject.getTransform().getWorldPosition(), this.snapRadius)
                }
            } else {
                // Fist re-closed within the delay window — cancel pending release
                this.releaseTimer = 0
                this.sceneObject.getTransform().setWorldPosition(palmPos.add(this.dragOffset))
                this.constructingManager?.previewSnap(this.sceneObject.getTransform().getWorldPosition(), this.snapRadius)
            }
            return
        }

        if (inRange && grabbing && !HandDraggable.anyDragging && !DrillDraggable.isActive()) {
            this.dragOffset        = objectPos.sub(palmPos)
            this.releaseTimer      = 0
            this.isDragging        = true
            HandDraggable.anyDragging = true
            this.isHovering        = false
            this.setHighlight(true)
            return
        }

        const shouldHighlight = inRange && !grabbing
        if (shouldHighlight !== this.isHovering) {
            this.setHighlight(shouldHighlight)
            this.isHovering = shouldHighlight
        }
    }

    private stopDrag(): void {
        this.isDragging           = false
        this.releaseTimer         = 0
        HandDraggable.anyDragging = false
        this.setHighlight(false)
        this.constructingManager?.clearPreview()

        if (this.constructingManager) {
            const t    = this.sceneObject.getTransform()
            const pos  = t.getWorldPosition()
            const snap = this.constructingManager.trySnap(pos, this.snapRadius)
            print("stopDrag on: " + this.sceneObject.name + " | pos: " + pos + " | snapped: " + (snap ? "YES" : "NO"))
            if (snap) {
                t.setWorldPosition(snap.position)
                t.setWorldRotation(snap.rotation)
                this.drillTarget?.setDrillable(true)
                VoiceoverManager.getInstance()?.onTraitSnapped()
            }
        } else {
            print("stopDrag on: " + this.sceneObject.name + " | constructingManager is NULL — snap skipped")
        }
    }

    private setHighlight(active: boolean): void {
        if (!this.renderMesh || !this.originalMat || !this.highlightMaterial) return
        this.renderMesh.mainMaterial = active ? this.highlightMaterial : this.originalMat
    }
}
