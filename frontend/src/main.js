// ========================================
// SIGNLENS - MAIN APPLICATION
// ========================================

// DOM Elements
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const gestureText = document.getElementById('gesture-text');
const debugText = document.getElementById('debug-text');

// Speech Recognition (Optional)
let recognition = null;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            }
        }
        if (finalTranscript) {
            document.getElementById('speech-output').textContent = finalTranscript;
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
    };
}

// Speech Buttons
document.getElementById('start-listening')?.addEventListener('click', () => {
    if (recognition) {
        recognition.start();
        document.getElementById('speech-output').textContent = 'Listening...';
    }
});

document.getElementById('stop-listening')?.addEventListener('click', () => {
    if (recognition) {
        recognition.stop();
        document.getElementById('speech-output').textContent = 'Stopped listening.';
    }
});

// ========================================
// GESTURE DETECTOR SETUP
// ========================================
const gestureDetector = new ImprovedGestureDetector();

// ========================================
// MEDIAPIPE HANDS SETUP
// ========================================

// Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

// Configure Hands
hands.setOptions({
    maxNumHands: 2,              // Detect up to 2 hands
    modelComplexity: 1,          // 0 = lite, 1 = full (better accuracy)
    minDetectionConfidence: 0.5, // Lower = more sensitive
    minTrackingConfidence: 0.5   // Lower = more sensitive
});

// ========================================
// MEDIAPIPE RESULTS CALLBACK
// ========================================
hands.onResults((results) => {
    // Clear canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw video frame
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Draw hand landmarks if detected
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (const landmarks of results.multiHandLandmarks) {
            // Draw connections (lines between landmarks)
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: '#00FF00',
                lineWidth: 2
            });
            
            // Draw landmarks (points)
            drawLandmarks(canvasCtx, landmarks, {
                color: '#FF0000',
                lineWidth: 1,
                radius: 3
            });
        }

        // Debug: Show number of hands detected
        if (debugText) {
            debugText.textContent = `Hands: ${results.multiHandLandmarks.length}`;
        }
    } else {
        if (debugText) {
            debugText.textContent = 'No hands detected';
        }
    }

    canvasCtx.restore();

    // ========================================
    // GESTURE DETECTION (INTEGRATED)
    // ========================================
    try {
        const gesture = gestureDetector.process(results);
        updateGestureUI(gesture);
    } catch (error) {
        console.error('Gesture detection error:', error);
        gestureText.textContent = 'Detection Error';
        gestureText.style.color = '#ff0000';
    }
});

// ========================================
// UI UPDATE FUNCTION
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
// CAMERA SETUP
// ========================================
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

// ========================================
// INITIALIZE APPLICATION
// ========================================
async function initializeApp() {
    try {
        console.log('Starting SignLens...');
        
        // Start camera
        await camera.start();
        console.log('Camera started successfully');

        // Set canvas size to match video
        canvasElement.width = 640;
        canvasElement.height = 480;

        console.log('SignLens initialized successfully!');
    } catch (error) {
        console.error('Initialization error:', error);
        gestureText.textContent = 'Error: ' + error.message;
        gestureText.style.color = '#ff0000';
    }
}

// ========================================
// START APPLICATION
// ========================================
// Wait for page to load, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// ========================================
// WINDOW RESIZE HANDLER
// ========================================
window.addEventListener('resize', () => {
    // Optionally adjust canvas size on window resize
    const videoRect = videoElement.getBoundingClientRect();
    canvasElement.width = videoRect.width;
    canvasElement.height = videoRect.height;
});

// ========================================
// CLEANUP ON PAGE UNLOAD
// ========================================
window.addEventListener('beforeunload', () => {
    if (camera) {
        camera.stop();
    }
    if (recognition) {
        recognition.stop();
    }
    console.log('SignLens stopped');
});