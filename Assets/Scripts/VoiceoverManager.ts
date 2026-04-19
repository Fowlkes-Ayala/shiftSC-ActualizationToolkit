@component
export class VoiceoverManager extends BaseScriptComponent {

    @input
    @hint("Voiceover clips in order: [0] intro (button press), [1] first snap, [2] third snap, [3] second drill complete")
    audioSources: AudioComponent[] = []

    private static instance: VoiceoverManager | null = null

    private snapCount: number = 0
    private drillCount: number = 0
    private queue: number[] = []
    private currentIndex: number = -1

    onAwake() {
        VoiceoverManager.instance = this
        this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    }

    onDestroy() {
        if (VoiceoverManager.instance === this) VoiceoverManager.instance = null
    }

    static getInstance(): VoiceoverManager | null {
        return VoiceoverManager.instance
    }

    // Called by GetStartedButton on press.
    onGetStarted(): void {
        this.enqueue(0)
    }

    // Called by HandDraggable each time a trait snaps into place.
    onTraitSnapped(): void {
        this.snapCount++
        if (this.snapCount === 1) this.enqueue(1)
        if (this.snapCount === 3) this.enqueue(2)
    }

    // Called by DrillTarget when a trait is fully drilled.
    onTraitDrilled(): void {
        this.drillCount++
        if (this.drillCount === 2) this.enqueue(3)
    }

    private enqueue(index: number): void {
        if (index >= this.audioSources.length) return
        if (this.currentIndex === -1) {
            this.playIndex(index)
        } else if (!this.queue.includes(index)) {
            this.queue.push(index)
        }
    }

    private playIndex(index: number): void {
        this.currentIndex = index
        this.audioSources[index].play(0)
    }

    private onUpdate(): void {
        if (this.currentIndex < 0) return
        // Cast to any to avoid TypeScript type errors on isPlaying() across Lens Studio versions.
        if ((this.audioSources[this.currentIndex] as any).isPlaying?.() === true) return

        this.currentIndex = -1
        if (this.queue.length > 0) {
            this.playIndex(this.queue.shift()!)
        }
    }
}
