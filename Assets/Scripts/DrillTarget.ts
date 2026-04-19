import { VoiceoverManager } from "./VoiceoverManager"

@component
export class DrillTarget extends BaseScriptComponent {

    @input
    @hint("The RenderMeshVisual on this object")
    renderMesh: RenderMeshVisual

    @input
    @hint("Material to show when the drill is in range")
    purpleMaterial: Material | null = null

    @input
    @hint("Audio on this trait to play while the drill is in range")
    audioComponent: AudioComponent | null = null

    @input
    @hint("Audio to play once drilling completes (one-shot success sound)")
    successAudio: AudioComponent | null = null

    @input
    @hint("Seconds of continuous drilling required to complete this trait")
    drillDuration: number = 3.0

    @input
    @hint("If true, this trait can be drilled immediately without being snapped first")
    startDrillable: boolean = false

    private static registry: DrillTarget[] = []

    private originalMat: Material | null = null
    private isDrillable: boolean = false
    private isHighlighted: boolean = false
    private drillTimer: number = 0

    onAwake() {
        DrillTarget.registry.push(this)
        if (this.renderMesh && this.renderMesh.getMaterialsCount() > 0) {
            this.originalMat = this.renderMesh.getMaterial(0)
        }
        this.isDrillable = this.startDrillable
    }

    onDestroy() {
        DrillTarget.registry = DrillTarget.registry.filter(dt => dt !== this)
    }

    static getAll(): DrillTarget[] {
        return DrillTarget.registry
    }

    static findForObject(obj: SceneObject): DrillTarget | null {
        for (const dt of DrillTarget.registry) {
            if (dt.sceneObject === obj) return dt
        }
        return null
    }

    getIsDrillable(): boolean {
        return this.isDrillable
    }

    // Called by HandDraggable when this trait snaps into place.
    setDrillable(value: boolean): void {
        this.isDrillable = value
        if (!value && this.isHighlighted) this.applyHighlight(false)
    }

    // Called by DrillDraggable each frame based on proximity.
    setInDrillRange(active: boolean): void {
        if (!this.isDrillable) return
        if (active === this.isHighlighted) return
        if (!active) this.drillTimer = 0
        this.applyHighlight(active)
    }

    // Called every frame by DrillDraggable while this target is in range.
    tickDrilling(dt: number): void {
        if (!this.isDrillable || !this.isHighlighted) return
        this.drillTimer += dt
        if (this.drillTimer >= this.drillDuration) {
            this.onDrillComplete()
        }
    }

    getPosition(): vec3 {
        return this.sceneObject.getTransform().getWorldPosition()
    }

    private onDrillComplete(): void {
        this.applyHighlight(false)
        this.isDrillable = false
        this.drillTimer = 0
        this.successAudio?.play(0)
        VoiceoverManager.getInstance()?.onTraitDrilled()
    }

    private applyHighlight(active: boolean): void {
        this.isHighlighted = active

        if (this.renderMesh && this.originalMat && this.purpleMaterial) {
            this.renderMesh.mainMaterial = active ? this.purpleMaterial : this.originalMat
        }

        if (this.audioComponent) {
            if (active) this.audioComponent.play(0)
            else        this.audioComponent.stop(false)
        }
    }
}
