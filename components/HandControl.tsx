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
  const DETECTION_INTERVAL = 30; 

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

            // Update Cursor Position: Use midpoint between Thumb Tip (4) and Index Tip (8)
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const midX = (thumbTip.x + indexTip.x) / 2;
            const midY = (thumbTip.y + indexTip.y) / 2;

            // Invert X for mirror effect
            cursorRef.current.x = 1 - midX;
            cursorRef.current.y = midY;
            cursorRef.current.isPointing = true;

            // --- 1. DETECT PINCH (Selection) ---
            const pinchDist = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) + 
                Math.pow(thumbTip.y - indexTip.y, 2)
            );
            // Threshold for pinch (0.05 is relatively close in normalized coords)
            cursorRef.current.isPinching = pinchDist < 0.05;


            // --- 2. DETECT FINGERS OPEN/CLOSED ---
            // Tips: [Thumb:4, Index:8, Middle:12, Ring:16, Pinky:20]
            // PIPs: [Thumb:2, Index:6, Middle:10, Ring:14, Pinky:18]
            
            const isFingerOpen = (tipIdx: number, pipIdx: number) => {
                 const distTip = Math.sqrt(Math.pow(landmarks[tipIdx].x - wrist.x, 2) + Math.pow(landmarks[tipIdx].y - wrist.y, 2));
                 const distPip = Math.sqrt(Math.pow(landmarks[pipIdx].x - wrist.x, 2) + Math.pow(landmarks[pipIdx].y - wrist.y, 2));
                 return distTip > distPip;
            };

            const indexOpen = isFingerOpen(8, 6);
            const middleOpen = isFingerOpen(12, 10);
            const ringOpen = isFingerOpen(16, 14);
            const pinkyOpen = isFingerOpen(20, 18);
            
            // Thumb open check
            const thumbOpen = Math.sqrt(Math.pow(landmarks[4].x - landmarks[17].x, 2)) > 0.15; // Distance from pinky base
            
            const openCount = (indexOpen?1:0) + (middleOpen?1:0) + (ringOpen?1:0) + (pinkyOpen?1:0) + (thumbOpen?1:0);

            // --- 3. DISPERSION (OPEN PALM) ---
            // If all fingers are open, update isHandOpen state
            const isOpenPalm = openCount === 5;
            cursorRef.current.isHandOpen = isOpenPalm;

            // --- 4. STATE LOGIC ---

            // SCISSORS (Victory) -> Index & Middle Open, Ring & Pinky Closed (Thumb can be whatever)
            // Action: Gallery Mode (Chaos + Rotation)
            const isScissors = indexOpen && middleOpen && !ringOpen && !pinkyOpen;
            
            // FIST -> All fingers closed (0 or 1 if thumb is weird)
            // Action: Form Tree
            const isFist = openCount <= 1;

            if (isScissors) {
                if (currentTreeState !== TreeState.CHAOS) {
                    setTreeState(TreeState.CHAOS);
                }
                // Add spin to browse gallery
                rotationSpeedRef.current = 1.0; 
            } else if (isFist) {
                 if (currentTreeState !== TreeState.FORMED) {
                    setTreeState(TreeState.FORMED);
                 }
            } else {
                // Rotation logic using wrist movement (Standard wave)
                if (lastWristX.current !== null) {
                    const dx = wrist.x - lastWristX.current;
                    if (Math.abs(dx) > 0.01) {
                        rotationSpeedRef.current += dx * 30;
                        rotationSpeedRef.current = Math.max(Math.min(rotationSpeedRef.current, 5), -5);
                    }
                }
            }
            lastWristX.current = wrist.x;

          } else {
              lastWristX.current = null;
              cursorRef.current.isPointing = false;
              cursorRef.current.isPinching = false;
              cursorRef.current.isHandOpen = false;
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
             <p className="text-[9px] text-white/90 font-sans tracking-wide leading-tight">
               <span className="text-[#D4AF37] font-bold">✌️ SCISSORS</span> Gallery <br/>
               <span className="text-[#D4AF37] font-bold">✊ FIST</span> Tree <br/>
               <span className="text-[#D4AF37] font-bold">✋ PALM</span> Disperse
             </p>
        </div>
      </div>
    </div>
  );
};

export default HandControl;