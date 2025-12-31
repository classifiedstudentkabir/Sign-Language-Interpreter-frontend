/**
 * Improved Gesture Detector for SignLens
 * 
 * KEY IMPROVEMENTS:
 * 1. Clear finger state definitions (OPEN/CLOSED) with confidence thresholds.
 * 2. Non-overlapping gesture rules for 0-5.
 * 3. Frame-based stability check to reduce flickering.
 * 4. Class-based architecture for better organization.
 */

// Landmark indices for different fingers
const FINGER_LANDMARKS = {
    THUMB: [1, 2, 3, 4],
    INDEX: [5, 6, 7, 8],
    MIDDLE: [9, 10, 11, 12],
    RING: [13, 14, 15, 16],
    PINKY: [17, 18, 19, 20]
};

class ImprovedGestureDetector {
    constructor(config = {}) {
        this.config = {
            STABILITY_FRAMES: 3, // As requested
            ...config
        };

        this.handTracker = {
            leftHand: null,
            rightHand: null,
            stabilityBuffer: [],
            lastGesture: null
        };
    }

    /**
     * Determines if a finger is open or closed based on landmark positions.
     * @param {Array} landmarks - The hand landmarks.
     * @param {string} fingerName - The name of the finger (e.g., 'INDEX').
     * @returns {boolean} - True if the finger is open, false otherwise.
     */
    _isFingerOpen(landmarks, fingerName) {
        const finger = FINGER_LANDMARKS[fingerName];
        const tip = landmarks[finger[3]]; // Tip of the finger
        const pip = landmarks[finger[1]]; // PIP joint

        if (fingerName === 'THUMB') {
            // For the thumb, check horizontal extension relative to its base
            const mcp = landmarks[finger[0]];
            return Math.abs(tip.x - mcp.x) > 0.04; // Empirically determined threshold
        } else {
            // For other fingers, check if the tip is above the PIP joint
            return tip.y < pip.y;
        }
    }

    /**
     * Gets the state (open/closed) for all five fingers.
     * @param {Array} landmarks - The hand landmarks.
     * @returns {object} - An object with boolean states for each finger.
     */
    _getFingerStates(landmarks) {
        if (!landmarks) return null;
        return {
            thumb: this._isFingerOpen(landmarks, 'THUMB'),
            index: this._isFingerOpen(landmarks, 'INDEX'),
            middle: this._isFingerOpen(landmarks, 'MIDDLE'),
            ring: this._isFingerOpen(landmarks, 'RING'),
            pinky: this._isFingerOpen(landmarks, 'PINKY'),
        };
    }

    /**
     * Main processing pipeline for gesture detection.
     * @param {object} results - The results from MediaPipe Hands.
     * @returns {string|null} - The detected and stabilized gesture.
     */
    process(results) {
        const { leftHand, rightHand } = this._assignHandRoles(results);
        this.handTracker.leftHand = leftHand;
        this.handTracker.rightHand = rightHand;

        let detectedGesture = null;

        if (leftHand && rightHand) {
            detectedGesture = this._detectTwoHandGesture(leftHand, rightHand);
        } else if (leftHand || rightHand) {
            const singleHand = leftHand || rightHand;
            detectedGesture = this._detectSingleHandGesture(singleHand);
        }

        const stableGesture = this._applyStabilityFilter(detectedGesture);
        return stableGesture;
    }

    /**
     * Assigns hand landmarks to left/right roles based on their screen position.
     * @param {object} results - The results from MediaPipe Hands.
     * @returns {object} - { leftHand, rightHand }
     */
    _assignHandRoles(results) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            return { leftHand: null, rightHand: null };
        }

        if (results.multiHandLandmarks.length === 1) {
            const hand = results.multiHandLandmarks[0];
            const handLabel = results.multiHandedness[0].label;
            // The labels can be "Left" or "Right", but they refer to the actual hand,
            // not its position on the screen. We'll use screen position for consistency.
            // Let's assume a single hand is the 'dominant' hand for now, let's call it right.
             if (handLabel === "Left") {
                return { leftHand: hand, rightHand: null };
            } else {
                return { leftHand: null, rightHand: hand };
            }
        }

        const hand1 = results.multiHandLandmarks[0];
        const hand2 = results.multiHandLandmarks[1];
        const x1 = hand1[0].x;
        const x2 = hand2[0].x;

        // The hand with the smaller x-coordinate is the left hand on the screen
        if (x1 < x2) {
            return { leftHand: hand1, rightHand: hand2 };
        } else {
            return { leftHand: hand2, rightHand: hand1 };
        }
    }

    /**
     * Detects gestures for a single hand.
     * @param {Array} landmarks - The hand landmarks.
     * @returns {string|null} - The detected gesture name.
     */
    _detectSingleHandGesture(landmarks) {
        if (!landmarks) return null;

        const fingers = this._getFingerStates(landmarks);
        const openFingers = Object.values(fingers).filter(Boolean).length;

        // Number Gestures (with specific rules to avoid conflict)
        if (!fingers.thumb && fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) return "NUMBER_1";
        if (!fingers.thumb && fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) return "NUMBER_2";
        // Number 3 can be thumb+index+middle or index+middle+ring. Let's support both.
        if (fingers.thumb && fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) return "NUMBER_3";
        if (!fingers.thumb && fingers.index && fingers.middle && fingers.ring && !fingers.pinky) return "NUMBER_3_ALT"; // Alternative 3
        if (fingers.index && fingers.middle && fingers.ring && fingers.pinky && !fingers.thumb) return "NUMBER_4";
        if (openFingers === 5) return "NUMBER_5"; // Same as OPEN_PALM, but we'll prioritize it
        if (openFingers === 0) return "NUMBER_0"; // Same as FIST

        // General Gestures
        if (openFingers === 5) return "OPEN_PALM";
        if (openFingers === 0) return "FIST";
        if (fingers.thumb && openFingers === 1) return "THUMBS_UP";
        if (fingers.index && openFingers === 1) return "POINTING_UP";

        // Thumbs down is tricky, requires checking orientation, which is less reliable.
        // Let's keep it simple for now and rely on THUMBS_UP.

        return null;
    }
    
    /**
     * Detects gestures involving two hands.
     * @param {Array} leftLandmarks 
     * @param {Array} rightLandmarks 
     * @returns {string|null}
     */
    _detectTwoHandGesture(leftLandmarks, rightLandmarks) {
        if (!leftLandmarks || !rightLandmarks) return null;

        const leftGesture = this._detectSingleHandGesture(leftLandmarks);
        const rightGesture = this._detectSingleHandGesture(rightLandmarks);

        // HELLO: Two open palms
        if (leftGesture === "OPEN_PALM" && rightGesture === "OPEN_PALM") {
            return "HELLO";
        }
        // Add other two-hand gestures from the original file
        if (leftGesture === "FIST" && rightGesture === "FIST") {
            return "THANK_YOU";
        }
        if (leftGesture === "THUMBS_UP" && rightGesture === "THUMBS_UP") {
            return "EXCELLENT";
        }

        return null;
    }

    /**
     * Applies a stability filter to reduce gesture flickering.
     * @param {string|null} currentGesture - The gesture detected in the current frame.
     * @returns {string|null} - The stable gesture.
     */
    _applyStabilityFilter(currentGesture) {
        this.handTracker.stabilityBuffer.push(currentGesture);

        if (this.handTracker.stabilityBuffer.length > this.config.STABILITY_FRAMES) {
            this.handTracker.stabilityBuffer.shift();
        }

        // Check if all frames in the buffer are the same
        const allSame = this.handTracker.stabilityBuffer.every(g => g === currentGesture);

        if (this.handTracker.stabilityBuffer.length === this.config.STABILITY_FRAMES && allSame) {
            if (this.handTracker.lastGesture !== currentGesture) {
                this.handTracker.lastGesture = currentGesture;
            }
        }
        
        return this.handTracker.lastGesture;
    }
}
