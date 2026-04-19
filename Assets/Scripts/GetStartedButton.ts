import { SceneManager } from "./SceneManager";
import { BaseButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/BaseButton";
import { VoiceoverManager } from "./VoiceoverManager";

@component
export class NewScript extends BaseScriptComponent {
    @input
    sceneManager: SceneManager;

    @input
    button: BaseButton;

    onAwake() {
        this.createEvent("OnStartEvent").bind(() => {
            this.button.onTriggerUp.add(() => {
                this.onPressed();
            });
        });
    }

    onPressed() {
        print("Button pressed!");
        this.sceneManager.disableObject("Onboarding");
        VoiceoverManager.getInstance()?.onGetStarted();
    }
}
