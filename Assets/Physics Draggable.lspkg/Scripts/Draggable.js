// Draggable.js
// Version: 0.1.0
// Event: Initialized
// Description: This script demonstrates how to implement a draggable body interface. It does so by
// performing a raycast on-touch to locate a body from screen position, then attaching
// a point constraint with kinematic target collider to move the body around.

// @input Component.Camera camera

//@input string physicsFilterObjectsBy = "None" { "values": [{"value": "None", "label": "None (allow all)"}, {"value": "Other object", "label": "Other object"}, {"value": "Other name", "label": "Other name"}], "widget": "combobox", "label": "Filter Objects By..."}

//@input Physics.ColliderComponent[] physicsAllowedObjects {"showIf": "physicsFilterObjectsBy", "showIfValue": "Other object", "label": "Allowed Objects"}
//@input string physicsNameMatchType = "Equals" {"showIf": "physicsFilterObjectsBy", "showIfValue": "Other name", "values": [{"value": "Equals", "label": "Equals"}, {"value": "Starts With", "label": "Starts With"}, {"value": "Regex", "label": "Regex"}], "widget": "combobox", "label": "Name Match Type"}
//@input string[] physicsAllowedNames {"showIf": "physicsFilterObjectsBy", "showIfValue": "Other name", "label": "Allowed Names"}

// Override the Snapchat app's default touch events
global.touchSystem.touchBlocking = true;

// The physics probe exposes the rayCast() function, as well as collision filter settings.
// We can create probes that raycast across all worlds, or a single world with:
// * Physics.createGlobalProbe(): Raycast across all worlds.
// * Physics.createRootProbe(): Raycast in just the implicit root world.
// * worldComponent.createProbe(): Raycast within the give world, from its component.
var probe = Physics.createGlobalProbe();
//probe.debugDrawEnabled = true; // Show ray casts as debug lines and spheres.

// Create a collider that we'll use as the target for the draggable constraint.
var targetObj = scene.createSceneObject("DragConstraintTarget");
var targetColliderComponent = targetObj.createComponent("Physics.ColliderComponent");
// Mark the collider as intangible so it doesn't collide with the dragged body.
targetColliderComponent.intangible = true;

// Current drag state. These are used while a touch drag is active.
var dragBodyComponent = null;
var sourceConstraintComponent = null;
var dragDepth = 0.0;
var dragTouchId = -1;

// Form a ray starting at the camera through the touch position into the world.
function getRayEnd(touchPos, rayStart, rayLen) {
    var touchWorldPos = script.camera.screenSpaceToWorldSpace(touchPos, 0.0);
    var rayDir = touchWorldPos.sub(rayStart).normalize();
    return rayStart.add(rayDir.uniformScale(rayLen));
}

// On touch, cast a ray into the world to find a draggable body.
var touchStartEvent = script.createEvent("TouchStartEvent");
touchStartEvent.bind(function(e) {
    if (dragTouchId != -1) { // Ignore new touches while drag in progress.
        return;
    } 
    dragTouchId = e.getTouchId();
    var rayStart = script.camera.getTransform().getWorldPosition();
    var rayEnd = getRayEnd(e.getTouchPosition(), rayStart, 10000.0);
    probe.rayCast(rayStart, rayEnd, function(hit) {
        if (hit == null) { // Indicates a miss.
            return;
        }        
        
        // We can only drag dynamic bodies, so check if the object is a dynamic BodyComponent.
        var colliderObj = hit.collider.getSceneObject();
        var bodyComponent = colliderObj.getComponent("Physics.BodyComponent");
        if (bodyComponent == null || !bodyComponent.dynamic) {
            return;
        }
        
        if (!filterDragObject(bodyComponent)) {
            return;
        }
        
        // Start the drag, using the initial distance as camera depth.
        dragBodyComponent = bodyComponent;
        dragDepth = hit.distance;
        
        // Move the target collider to the hit position.
        targetObj.getTransform().setWorldPosition(hit.position);
        
        // The target motion will effectively apply an impulse to the constraint, so clear it to
        // prevent this from affecting the grabbed body.
        // Alternatively, we could create the target at the start of each drag, but this is simpler.
        targetColliderComponent.clearMotion();
        
        // Attach a point constraint between the source and target.
        sourceConstraintComponent = dragBodyComponent.addPointConstraint(targetColliderComponent, hit.position);
    });
});


function filterDragObject(collider) {
    switch (script.physicsFilterObjectsBy) {
        case "None":
        default:
            return true;

        case "Other object":
            for (var i = 0; i < script.physicsAllowedObjects.length; i++) {
                if (collider.isSame(script.physicsAllowedObjects[i])) {
                    return true;
                }
            }
            return false;

        case "Other name":
            var nameMatchFunc;
            switch (script.physicsNameMatchType) {
                case "Equals":
                default:
                    nameMatchFunc = function(objName, targName) {
                        return objName == targName;
                    };
                    break;
                case "Starts With":
                    nameMatchFunc = function(objName, targName) {
                        return objName.startsWith(targName);
                    };
                    break;
                case "Regex":
                    nameMatchFunc = function(objName, targName) {
                        return !!objName.match(new RegExp(targName));
                    };
                    break;
            }

            var otherName = collider.getSceneObject().name;
            for (var j = 0; j < script.physicsAllowedNames.length; j++) {
                if (nameMatchFunc(otherName, script.physicsAllowedNames[j])) {
                    return true;
                }
            }

    }
}

// While dragging, move the target collider to match the touch position.
var touchMoveEvent = script.createEvent("TouchMoveEvent");
touchMoveEvent.bind(function(e) {
    if (!dragBodyComponent || e.getTouchId() != dragTouchId) {
        return;
    }
    var rayStart = script.camera.getTransform().getWorldPosition();
    var rayEnd = getRayEnd(e.getTouchPosition(), rayStart, dragDepth);
    targetObj.getTransform().setWorldPosition(rayEnd);
});

// On release, remove the constraint.
var touchEndEvent = script.createEvent("TouchEndEvent");
touchEndEvent.bind(function(e) {
    if (e.getTouchId() != dragTouchId) {
        return;
    }
    dragTouchId = -1;
    if (!dragBodyComponent) {
        return;
    }
    dragBodyComponent.removeConstraint(sourceConstraintComponent);
    dragBodyComponent = null;
    sourceConstraintComponent = null;
});
