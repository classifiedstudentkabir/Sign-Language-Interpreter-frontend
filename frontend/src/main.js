import { setupCamera } from "./camera.js";
import { detectHands } from "./handDetector.js";
import { detectOneHandGesture } from "./gestures/oneHand/index.js";
import { detectTwoHandGesture } from "./gestures/twoHand/index.js";

let lastGesture = null;
let sameGestureFrames = 0;

let lockedGesture = null;
let lockUntil = 0;

// tuning values
const REQUIRED_FRAMES = 7;     // how many frames to confirm
const LOCK_DURATION = 500;    // ms to lock gesture

const videoElement = document.getElementById("video");
const outputElement = document.getElementById("gestureText");

function stabilizeGesture(rawGesture) {
  const now = Date.now();

  // If gesture is locked, keep showing it
  if (lockedGesture && now < lockUntil) {
    return lockedGesture;
  }

  // Lock expired
  if (lockedGesture && now >= lockUntil) {
    lockedGesture = null;
  }

  // Same as previous frame
  if (rawGesture === lastGesture) {
    sameGestureFrames++;
  } else {
    lastGesture = rawGesture;
    sameGestureFrames = 1;
  }

  // Confirm gesture
  if (sameGestureFrames >= REQUIRED_FRAMES && rawGesture !== null) {
    lockedGesture = rawGesture;
    lockUntil = now + LOCK_DURATION;
    sameGestureFrames = 0;
    return rawGesture;
  }

  return null;
}

function onResults(results) {
  const detection = detectHands(results);

  if (detection.count === 0) {
    outputElement.innerText = "No hands detected";
    return;
  }

  if (detection.count === 1) {
    const raw = detectOneHandGesture(detection.hands[0].landmarks);
    const stable = stabilizeGesture(raw);

    if (stable) {
      outputElement.innerText = `Gesture: ${stable}`;
    }

    return;
  }

  if (detection.count === 2) {
    const raw = detectTwoHandGesture(detection.hands);
    const stable = stabilizeGesture(raw);

    if (stable) {
      outputElement.innerText = stable;
    }

    return;
  }
}

setupCamera(videoElement, onResults);