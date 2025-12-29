// ========================================
// SIGNLENS - GESTURE DETECTION SYSTEM
// ========================================

// Configuration
const GESTURE_CONFIG = {
  STABILITY_FRAMES: 5,
  CONFIDENCE_THRESHOLD: 0.7,
  MIN_HAND_DISTANCE: 0.15
};

// Hand tracking state
let handTracker = {
  leftHand: null,
  rightHand: null,
  frameCount: 0,
  stabilityBuffer: [],
  lastGesture: null
};

// ========================================
// 1. HAND ROLE ASSIGNMENT
// ========================================
function assignHandRoles(results) {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    return { leftHand: null, rightHand: null };
  }

  if (results.multiHandLandmarks.length === 1) {
    const hand = results.multiHandLandmarks[0];
    const handLabel = results.multiHandedness[0].label;
    
    if (handLabel === "Right") {
      return { leftHand: hand, rightHand: null };
    } else {
      return { leftHand: null, rightHand: hand };
    }
  }

  const hand1 = results.multiHandLandmarks[0];
  const hand2 = results.multiHandLandmarks[1];
  
  const x1 = hand1[0].x;
  const x2 = hand2[0].x;

  if (x1 < x2) {
    return { leftHand: hand1, rightHand: hand2 };
  } else {
    return { leftHand: hand2, rightHand: hand1 };
  }
}

// ========================================
// 2. HAND GESTURE DETECTION (ONE HAND)
// ========================================
function detectSingleHandGesture(landmarks) {
  if (!landmarks) return null;

  const fingers = getFingerStates(landmarks);
  
  if (isOpenPalm(fingers)) return "OPEN_PALM";
  if (isFist(fingers)) return "FIST";
  if (isThumbsUp(fingers, landmarks)) return "THUMBS_UP";
  if (isThumbsDown(fingers, landmarks)) return "THUMBS_DOWN";
  if (isPointingUp(fingers, landmarks)) return "POINTING_UP";
  
  const numberCount = fingers.filter(f => f).length;
  if (numberCount >= 0 && numberCount <= 5) {
    return `NUMBER_${numberCount}`;
  }

  return null;
}

function getFingerStates(landmarks) {
  const fingers = [];
  
  // Thumb
  const thumbTip = landmarks[4];
  const thumbBase = landmarks[2];
  fingers.push(Math.abs(thumbTip.x - thumbBase.x) > 0.05);
  
  // Other fingers
  const fingerTips = [8, 12, 16, 20];
  const fingerBases = [6, 10, 14, 18];
  
  for (let i = 0; i < 4; i++) {
    const tip = landmarks[fingerTips[i]];
    const base = landmarks[fingerBases[i]];
    fingers.push(tip.y < base.y);
  }
  
  return fingers;
}

function isOpenPalm(fingers) {
  return fingers.filter(f => f).length === 5;
}

function isFist(fingers) {
  return fingers.filter(f => f).length === 0;
}

function isThumbsUp(fingers, landmarks) {
  return fingers[0] && !fingers[1] && !fingers[2] && !fingers[3] && !fingers[4] 
         && landmarks[4].y < landmarks[8].y;
}

function isThumbsDown(fingers, landmarks) {
  return fingers[0] && !fingers[1] && !fingers[2] && !fingers[3] && !fingers[4]
         && landmarks[4].y > landmarks[8].y;
}

function isPointingUp(fingers, landmarks) {
  return !fingers[0] && fingers[1] && !fingers[2] && !fingers[3] && !fingers[4]
         && landmarks[8].y < landmarks[6].y;
}

// ========================================
// 3. TWO-HAND GESTURE DETECTION
// ========================================
function detectTwoHandGesture(leftLandmarks, rightLandmarks) {
  if (!leftLandmarks || !rightLandmarks) return null;

  const leftGesture = detectSingleHandGesture(leftLandmarks);
  const rightGesture = detectSingleHandGesture(rightLandmarks);
  const distance = getHandDistance(leftLandmarks, rightLandmarks);

  // DEMO: HELLO - Two open palms
  if (leftGesture === "OPEN_PALM" && rightGesture === "OPEN_PALM") {
    return "HELLO";
  }

  // ADD MORE TWO-HAND GESTURES HERE:
  
  // Two fists = "THANK YOU"
  if (leftGesture === "FIST" && rightGesture === "FIST") {
    return "THANK_YOU";
  }

  // Two thumbs up = "EXCELLENT"
  if (leftGesture === "THUMBS_UP" && rightGesture === "THUMBS_UP") {
    return "EXCELLENT";
  }

  // Left fist + Right open palm = "PLEASE"
  if (leftGesture === "FIST" && rightGesture === "OPEN_PALM") {
    return "PLEASE";
  }

  // Two open palms close together = "SORRY"
  if (leftGesture === "OPEN_PALM" && rightGesture === "OPEN_PALM" && distance < 0.2) {
    return "SORRY";
  }

  return null;
}

function getHandDistance(leftLandmarks, rightLandmarks) {
  const leftWrist = leftLandmarks[0];
  const rightWrist = rightLandmarks[0];
  
  const dx = leftWrist.x - rightWrist.x;
  const dy = leftWrist.y - rightWrist.y;
  
  return Math.sqrt(dx * dx + dy * dy);
}

// ========================================
// 4. GESTURE STABILITY & FRAME SMOOTHING
// ========================================
function applyStabilityFilter(currentGesture) {
  handTracker.stabilityBuffer.push(currentGesture);
  
  if (handTracker.stabilityBuffer.length > GESTURE_CONFIG.STABILITY_FRAMES) {
    handTracker.stabilityBuffer.shift();
  }

  if (handTracker.stabilityBuffer.length < GESTURE_CONFIG.STABILITY_FRAMES) {
    return handTracker.lastGesture;
  }

  const gestureCounts = {};
  handTracker.stabilityBuffer.forEach(gesture => {
    if (gesture) {
      gestureCounts[gesture] = (gestureCounts[gesture] || 0) + 1;
    }
  });

  let mostCommon = null;
  let maxCount = 0;
  
  for (const gesture in gestureCounts) {
    if (gestureCounts[gesture] > maxCount) {
      maxCount = gestureCounts[gesture];
      mostCommon = gesture;
    }
  }

  const threshold = Math.ceil(GESTURE_CONFIG.STABILITY_FRAMES * 0.8);
  if (maxCount >= threshold) {
    handTracker.lastGesture = mostCommon;
    return mostCommon;
  }

  return handTracker.lastGesture;
}

// ========================================
// 5. MAIN GESTURE RECOGNITION PIPELINE
// ========================================
function processGestureDetection(results) {
  const { leftHand, rightHand } = assignHandRoles(results);
  
  handTracker.leftHand = leftHand;
  handTracker.rightHand = rightHand;
  handTracker.frameCount++;

  let detectedGesture = null;

  if (leftHand && rightHand) {
    detectedGesture = detectTwoHandGesture(leftHand, rightHand);
  } else if (leftHand || rightHand) {
    const singleHand = leftHand || rightHand;
    detectedGesture = detectSingleHandGesture(singleHand);
  } else {
    detectedGesture = null;
  }

  const stableGesture = applyStabilityFilter(detectedGesture);

  return stableGesture;
}

// ========================================
// 6. UI UPDATE FUNCTION
// ========================================
function updateGestureUI(gesture) {
  const gestureTextElement = document.getElementById('gesture-text');
  
  if (!gestureTextElement) {
    console.error('Gesture text element not found!');
    return;
  }
  
  if (!gesture) {
    gestureTextElement.textContent = "No gesture detected";
    gestureTextElement.style.color = "#999";
    return;
  }

  const displayName = formatGestureName(gesture);
  gestureTextElement.textContent = displayName;
  gestureTextElement.style.color = "#00ff00";

  gestureTextElement.classList.add('gesture-detected');
  setTimeout(() => {
    gestureTextElement.classList.remove('gesture-detected');
  }, 300);
}

function formatGestureName(gesture) {
  return gesture
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

// ========================================
// 7. UTILITY: RESET TRACKER
// ========================================
function resetHandTracker() {
  handTracker = {
    leftHand: null,
    rightHand: null,
    frameCount: 0,
    stabilityBuffer: [],
    lastGesture: null
  };
}