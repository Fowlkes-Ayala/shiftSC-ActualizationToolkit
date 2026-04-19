// SceneManager.ts
// Allows other scripts to enable/disable components by string name

@component
export class SceneManager extends BaseScriptComponent {

    // Assign these in the Inspector
    @input
    names: string[];

    @input
    targets: SceneObject[];

    private lookup: { [key: string]: SceneObject } = {};

    onAwake() {
        // Build lookup table
        if (this.names.length !== this.targets.length) {
            print("SceneManager ERROR: names and targets length mismatch");
            return;
        }

        for (let i = 0; i < this.names.length; i++) {
            this.lookup[this.names[i]] = this.targets[i];
        }
    }

    // Enable a SceneObject by name
    enableObject(name: string): void {
        const obj = this.lookup[name];
        if (!obj) {
            print("SceneManager ERROR: No object found with name " + name);
            return;
        }

        obj.enabled = true;
    }

    // Disable a SceneObject by name
    disableObject(name: string): void {
        const obj = this.lookup[name];
        if (!obj) {
            print("SceneManager ERROR: No object found with name " + name);
            return;
        }

        obj.enabled = false;
    }

    // Optional: toggle
    toggleObject(name: string): void {
        const obj = this.lookup[name];
        if (!obj) {
            print("SceneManager ERROR: No object found with name " + name);
            return;
        }

        obj.enabled = !obj.enabled;
    }
}