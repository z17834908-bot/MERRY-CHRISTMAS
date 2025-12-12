import React, { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { TreeState, CursorData } from '../types';
import { PALETTE } from '../constants';

interface HandControlProps {
  setTreeState: (state: TreeState) => void;
  currentTreeState: TreeState;
  rotationSpeedRef: React.MutableRefObject<number>;
  cursorRef: React.MutableRefObject<CursorData>;
}

const HandControl: React.FC<HandControlProps> = ({ setTreeState, currentTreeState, rotationSpeedRef, cursorRef }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  
  // Throttling ref
  const lastPredictionTime = useRef<number>(0);
  const DETECTION_INTERVAL = 30; // Faster detection for smooth cursor

  // Gesture tracking
  const lastWristX = useRef<number | null>(null);

  useEffect(() => {
    const initHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        startWebcam();
        setLoading(false);
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        setLoading(false);
      }
    };

    initHandLandmarker();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 320, height: 240, facingMode: "user" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
        setCameraActive(true);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      setCameraActive(false);
    }
  };

  const predictWebcam = () => {
    const video = videoRef.current;
    const landmarker = handLandmarkerRef.current;

    requestRef.current = requestAnimationFrame(predictWebcam);

    const now = performance.now();
    if (now - lastPredictionTime.current < DETECTION_INTERVAL) {
        return;
    }

    if (video && landmarker && video.videoWidth > 0 && video.videoHeight > 0) {
      lastPredictionTime.current = now;
      
      try {
          const startTimeMs = performance.now();
          const results = landmarker.detectForVideo(video, startTimeMs);

          if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0]; 
            const wrist = landmarks[0];

            // --- Rotation Gesture Logic (only if not pointing) ---
            if (lastWristX.current !== null) {
                const dx = wrist.x - lastWristX.current;
                if (Math.abs(dx) > 0.01) {
                    rotationSpeedRef.current += dx * 30;
                    rotationSpeedRef.current = Math.max(Math.min(rotationSpeedRef.current, 5), -5);
                }
            }
            lastWristX.current = wrist.x;

            // --- State Switching & Pointing Logic ---
            
            // Finger indices: [Thumb, Index, Middle, Ring, Pinky]
            // Tips: 4, 8, 12, 16, 20
            // PIPs: 2, 6, 10, 14, 18
            const fingerTips = [8, 12, 16, 20];
            const fingerPips = [6, 10, 14, 18];
            
            let openFingersCount = 0;
            // Check non-thumb fingers
            for(let i=0; i<4; i++) {
                const tip = landmarks[fingerTips[i]];
                const pip = landmarks[fingerPips[i]];
                // Simple distance check from wrist for robustness
                const distTip = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
                const distPip = Math.sqrt(Math.pow(pip.x - wrist.x, 2) + Math.pow(pip.y - wrist.y, 2));
                if (distTip > distPip) {
                    openFingersCount++;
                }
            }

            // Check thumb separately (tip vs IP joint)
            const thumbTip = landmarks[4];
            const thumbIp = landmarks[3];
             // x-axis check is better for thumb depending on hand side, but simple distance from pinky base (17) works too
             // Simplified: just check if thumb is extended away from palm center
             // Let's stick to the main 4 fingers for state mainly
            
             const isIndexOpen = (Math.sqrt(Math.pow(landmarks[8].x - wrist.x, 2) + Math.pow(landmarks[8].y - wrist.y, 2)) > 
                                  Math.sqrt(Math.pow(landmarks[6].x - wrist.x, 2) + Math.pow(landmarks[6].y - wrist.y, 2)));


            // 1. CHAOS: Open Hand (>= 4 fingers open)
            if (openFingersCount >= 3) {
              setTreeState(TreeState.CHAOS);
              cursorRef.current.isPointing = false;
            } 
            // 2. FORMED: Fist (0 fingers open) -> User must make a fist
            else if (openFingersCount === 0) {
              setTreeState(TreeState.FORMED);
              cursorRef.current.isPointing = false;
            }
            // 3. POINTING: Index Open ONLY (roughly)
            else if (openFingersCount === 1 && isIndexOpen) {
                // Do NOT change tree state
                cursorRef.current.isPointing = true;
                
                // Map coordinates
                // MediaPipe X is flipped for mirror effect usually, but here we want screen coords.
                // Video is mirrored in CSS (-scale-x-100).
                // Raw landmark x: 0 (left of image) -> 1 (right of image).
                // Since we mirror via CSS, visual left is x=1.
                // We want Cursor X=0 (Left) to X=1 (Right).
                // If I move hand to visual Left, raw X is near 1 (if mirrored).
                
                // Let's assume standard webcam:
                // User moves Right -> Hand in video moves Right (if mirrored).
                // Landmark X increases. 
                // We need to invert X for CSS mirroring match?
                // Let's try 1 - x.
                
                cursorRef.current.x = 1 - landmarks[8].x; 
                cursorRef.current.y = landmarks[8].y; 
            } else {
                cursorRef.current.isPointing = false;
            }

          } else {
              lastWristX.current = null;
              cursorRef.current.isPointing = false;
          }
      } catch (e) {
          console.error("Detection error:", e);
      }
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
       <div className="mb-2 bg-black/80 backdrop-blur border border-[#D4AF37] px-3 py-1 text-xs text-[#D4AF37] font-serif uppercase tracking-widest">
         {loading ? "Loading AI..." : cameraActive ? "Camera Active" : "Camera Access Denied"}
       </div>

      <div 
        className="relative overflow-hidden shadow-2xl transition-all duration-500"
        style={{
            width: '200px',
            height: '150px',
            border: `2px solid ${PALETTE.GOLD_METALLIC}`,
            boxShadow: `0 0 20px ${PALETTE.EMERALD_DEEP}`,
            background: '#000'
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100" 
        />
        
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{ 
                 backgroundImage: `linear-gradient(${PALETTE.GOLD_METALLIC} 1px, transparent 1px), linear-gradient(90deg, ${PALETTE.GOLD_METALLIC} 1px, transparent 1px)`,
                 backgroundSize: '20px 20px'
             }} 
        />
        
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2 text-center">
             <p className="text-[10px] text-white/90 font-sans tracking-wide">
               <span className="text-[#D4AF37]">Wave</span> Rotate • <span className="text-[#D4AF37]">Index</span> Point • <span className="text-[#D4AF37]">Fist</span> Form
             </p>
        </div>
      </div>
    </div>
  );
};

export default HandControl;