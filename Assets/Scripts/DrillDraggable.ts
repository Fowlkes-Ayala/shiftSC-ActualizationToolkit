import { SIK } from "SpectaclesInteractionKit.lspkg/SIK"
import { HandInputData } from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData"
import { BaseHand } from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/BaseHand"
import { DrillTarget } from "./DrillTarget"

@component
export class DrillDraggable extends BaseScriptComponent {

    @input
    @hint("The RenderMeshVisual on this object")
    renderMesh: RenderMeshVisual

    @input
    @hint("Material to swap to when hand is in hover range (removed once picked up)")
    highlightMaterial: Material | null = null

    @input
    @hint("Distance (cm) the hand must be within to enter hover state / pick up")
    hoverRadius: number = 15

    @input
    @hint("Track left hand instead of right")
    useLeftHand: boolean = false

    @input
    @hint("How many fingers (out of 4) must be curled to count as a fist (1–4)")
    fistFingerThreshold: number = 3

    @input
    @hint("Euler offset in degrees applied after the grip rotation — use to align the drill model axis")
    rotationOffset: vec3 = new vec3(0, 0, 0)

    @input
    @hint("Audio to play while drilling a trait")
    audioComponent: AudioComponent | null = null

    @input
    @hint("Distance (cm) from a drillable trait that triggers drilling")
    drillRadius: number = 15

    @input
    @hint("Seconds the fist must be open before the drill is released (higher = more forgiving)")
    releaseDelay: number = 0.4
    private isDrillingAny: boolean = false

    private static anyDragging: boolean = false

    static isActive(): boolean { return DrillDraggable.anyDragging }

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
        this.createEvent("UpdateEvent").bind((e: UpdateEvent) => this.onUpdate(e.getDeltaTime()))
    }

    private getHand(): BaseHand | null {
        if (!this.handInputData) return null
        const hand = this.handInputData.getHand(this.useLeftHand ? "left" : "right")
        return hand && hand.isTracked() ? hand : null
    }

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

    // Derives a world-space grip rotation from hand keypoints.
    // forward = wrist→middleKnuckle, up = palm-outward normal.
    // Multiplied by an inspector-configurable offset for model alignment.
    private getGripRotation(hand: BaseHand): quat {
        const wristPos     = hand.wrist.position
        const midKnuckle   = hand.middleKnuckle.position
        const idxKnuckle   = hand.indexKnuckle.position
        const pinkyKnuckle = hand.pinkyKnuckle.position

        const forward    = midKnuckle.sub(wristPos).normalize()
        const knuckleRow = idxKnuckle.sub(pinkyKnuckle).normalize()
        const palmUp     = forward.cross(knuckleRow).normalize()

        const grip   = quat.lookAt(forward, palmUp)
        const offset = quat.fromEulerAngles(
            this.rotationOffset.x * (Math.PI / 180),
            this.rotationOffset.y * (Math.PI / 180),
            this.rotationOffset.z * (Math.PI / 180)
        )
        return grip.multiply(offset)
    }

    private onUpdate(dt: number): void {
        const hand = this.getHand()

        if (!hand) {
            if (this.isDragging) this.stopDrag()
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
                this.releaseTimer += dt
                if (this.releaseTimer >= this.releaseDelay) {
                    this.stopDrag()
                } else {
                    this.applyGrip(hand, palmPos, dt)
                }
            } else {
                this.releaseTimer = 0
                this.applyGrip(hand, palmPos, dt)
            }
            return
        }

        if (inRange && grabbing && !DrillDraggable.anyDragging) {
            this.dragOffset           = objectPos.sub(palmPos)
            this.releaseTimer         = 0
            this.isDragging           = true
            DrillDraggable.anyDragging = true
            this.isHovering           = false
            this.setHighlight(false)  // highlight off once picked up
            return
        }

        const shouldHighlight = inRange && !grabbing
        if (shouldHighlight !== this.isHovering) {
            this.setHighlight(shouldHighlight)
            this.isHovering = shouldHighlight
        }
    }

    private applyGrip(hand: BaseHand, palmPos: vec3, dt: number): void {
        const t = this.sceneObject.getTransform()
        t.setWorldPosition(palmPos.add(this.dragOffset))
        t.setWorldRotation(this.getGripRotation(hand))
        this.updateDrillTargets(t.getWorldPosition(), dt)
    }

    private updateDrillTargets(drillPos: vec3, dt: number): void {
        let anyActivelyDrilling = false
        for (const target of DrillTarget.getAll()) {
            const inRange = drillPos.sub(target.getPosition()).length <= this.drillRadius
            target.setInDrillRange(inRange)
            if (inRange && target.getIsDrillable()) {
                target.tickDrilling(dt)
                anyActivelyDrilling = true
            }
        }

        if (anyActivelyDrilling !== this.isDrillingAny) {
            this.isDrillingAny = anyActivelyDrilling
            if (this.audioComponent) {
                if (anyActivelyDrilling) this.audioComponent.play(0)
                else                     this.audioComponent.stop(false)
            }
        }
    }

    private stopDrag(): void {
        this.isDragging            = false
        this.releaseTimer          = 0
        DrillDraggable.anyDragging = false
        for (const dt of DrillTarget.getAll()) dt.setInDrillRange(false)
        if (this.isDrillingAny) {
            this.audioComponent?.stop(false)
            this.isDrillingAny = false
        }
    }

    private setHighlight(active: boolean): void {
        if (!this.renderMesh || !this.originalMat || !this.highlightMaterial) return
        this.renderMesh.mainMaterial = active ? this.highlightMaterial : this.originalMat
    }
}
