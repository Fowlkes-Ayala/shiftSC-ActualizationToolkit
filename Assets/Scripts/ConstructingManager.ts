@component
export class ConstructingManager extends BaseScriptComponent {
    @input points: SceneObject[]

    @input
    @hint("Same yellow highlight material used on HandDraggable — assigned to snap points when in range")
    highlightMaterial: Material | null = null

    private positions: vec3[] = []
    private rotations: quat[] = []
    private meshVisuals: (RenderMeshVisual | null)[] = []
    private originalMats: (Material | null)[] = []
    private activePreviewIndex: number = -1

    onAwake() {
        this.positions   = this.points.map(obj => obj.getTransform().getWorldPosition())
        this.rotations   = this.points.map(obj => obj.getTransform().getWorldRotation())
        this.meshVisuals = this.points.map(obj =>
            obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null
        )
        this.originalMats = this.meshVisuals.map(mv =>
            mv && mv.getMaterialsCount() > 0 ? mv.getMaterial(0) : null
        )
        print("ConstructingManager: " + this.positions.length + " snap points loaded")
        for (let i = 0; i < this.positions.length; i++) {
            print("  point[" + i + "] = " + this.positions[i])
        }
    }

    // Called every frame while dragging. Highlights the nearest in-range snap point.
    previewSnap(pos: vec3, snapRadius: number): void {
        let foundIndex = -1
        for (let i = 0; i < this.positions.length; i++) {
            if (pos.sub(this.positions[i]).length <= snapRadius) {
                foundIndex = i
                break
            }
        }

        if (foundIndex === this.activePreviewIndex) return

        if (this.activePreviewIndex >= 0) this.setPointHighlight(this.activePreviewIndex, false)
        if (foundIndex >= 0)             this.setPointHighlight(foundIndex, true)

        this.activePreviewIndex = foundIndex
    }

    // Called when dragging ends (released or tracking lost).
    clearPreview(): void {
        if (this.activePreviewIndex >= 0) {
            this.setPointHighlight(this.activePreviewIndex, false)
            this.activePreviewIndex = -1
        }
    }

    // Returns the snap transform if pos is within snapRadius of any point, else null.
    trySnap(pos: vec3, snapRadius: number): { position: vec3, rotation: quat } | null {
        for (let i = 0; i < this.positions.length; i++) {
            if (pos.sub(this.positions[i]).length <= snapRadius) {
                return { position: this.positions[i], rotation: this.rotations[i] }
            }
        }
        return null
    }

    private setPointHighlight(index: number, active: boolean): void {
        const mv = this.meshVisuals[index]
        if (!mv || !this.highlightMaterial) return
        if (active) {
            mv.mainMaterial = this.highlightMaterial
        } else {
            const original = this.originalMats[index]
            if (original) mv.mainMaterial = original
        }
    }
}
