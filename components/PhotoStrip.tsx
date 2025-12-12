import React, { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Image, Html } from '@react-three/drei';
import * as THREE from 'three';
import { TREE_CONFIG, PALETTE } from '../constants';
import { PhotoMemory, CursorData } from '../types';

interface PhotoStripProps {
  progress: React.MutableRefObject<number>;
  memories: PhotoMemory[];
  cursorRef: React.MutableRefObject<CursorData>;
  onUpdateMessage: (id: string, message: string) => void;
}

const PhotoStrip: React.FC<PhotoStripProps> = ({ progress, memories, cursorRef, onUpdateMessage }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lockedId, setLockedId] = useState<string | null>(null); 
  const { camera, raycaster } = useThree();
  const dispersionValue = useRef(0);

  // Pre-calculate positions for both states
  const photoData = useMemo(() => {
    return memories.map((memory, i) => {
      const ratio = i / Math.max(memories.length, 1); 
      
      // --- TARGET STATE (Spiral on Tree) ---
      const hTarget = (i / memories.length) * (TREE_CONFIG.HEIGHT * 0.8) + 1; 
      const rTarget = ((1 - hTarget / TREE_CONFIG.HEIGHT) * TREE_CONFIG.RADIUS_BASE) + 1.5;
      const thetaTarget = ratio * Math.PI * 6; 
      
      const targetPos = new THREE.Vector3(
        Math.cos(thetaTarget) * rTarget,
        hTarget,
        Math.sin(thetaTarget) * rTarget
      );
      
      // --- CHAOS STATE (Carousel Cylinder) ---
      const rChaos = 20.0; 
      const thetaChaos = ratio * Math.PI * 2; 
      const yChaos = 8.0 + Math.sin(thetaChaos * 3) * 2.0; 
      const xChaos = Math.sin(thetaChaos) * rChaos;
      const zChaos = Math.cos(thetaChaos) * rChaos;

      const chaosPos = new THREE.Vector3(xChaos, yChaos, zChaos);

      return { targetPos, chaosPos, ...memory, thetaChaos };
    });
  }, [memories]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    const p = progress.current;
    const smoothP = THREE.MathUtils.smoothstep(p, 0.1, 0.9);
    
    // Dispersion
    const targetDispersion = cursorRef.current.dispersion;
    dispersionValue.current = THREE.MathUtils.lerp(dispersionValue.current, targetDispersion, delta * 3.0);
    const d = dispersionValue.current;
    
    // Animate children
    groupRef.current.children.forEach((child, i) => {
      const data = photoData[i];
      if (!data) return;

      // Determine active state
      const isHovered = hoveredId === data.id;
      const isLocked = lockedId === data.id;
      const isActive = isHovered || isLocked;

      // Interpolate position
      child.position.lerpVectors(data.chaosPos, data.targetPos, smoothP);
      
      // Apply Dispersion
      if (d > 0.001) {
          const dir = child.position.clone().normalize();
          // Photos fly out horizontally mostly
          dir.y *= 0.2; 
          dir.normalize();
          
          // Reduced distance from 35.0 to 15.0 to avoid clipping camera at Z=38
          // R=20 + 15 = 35. Close to camera but visible.
          child.position.addScaledVector(dir, d * 15.0); 
          
          // Face Camera for clarity during dispersion
          child.lookAt(state.camera.position);
      } else {
        // LookAt Logic (Only when not fully dispersed)
        const lookAtCenter = new THREE.Vector3(0, child.position.y, 0);
        const lookOutwards = new THREE.Vector3(child.position.x * 2, child.position.y, child.position.z * 2);
        
        // When hovered or locked, force look at camera for better readability
        const lookAtCamera = state.camera.position;
        
        let targetLook = new THREE.Vector3().lerpVectors(lookOutwards, lookAtCenter, smoothP);
        if (isActive) {
            targetLook = lookAtCamera;
        }
        child.lookAt(targetLook);
      }
      
      const currentScale = THREE.MathUtils.lerp(2.5, 1.0, smoothP);
      // Scale up if hovered OR locked
      const hoverScale = isActive ? 1.2 : 1.0;
      
      // Dispersion Scale: Reduced multiplier from 3.0 to 1.5 to prevent massive overlap
      // Max scale becomes ~2.5 * 2.5 = 6.25 (still huge, but manageable)
      const dispersionScale = 1.0 + (d * 1.5); 

      child.scale.setScalar(currentScale * hoverScale * dispersionScale);

      // Bobbing animation
      child.position.y += Math.sin(state.clock.elapsedTime * 1.5 + i) * 0.02;
    });

    // --- Manual Hand Cursor Raycasting ---
    if (cursorRef.current.isPointing) {
        const x = (cursorRef.current.x * 2) - 1;
        const y = -(cursorRef.current.y * 2) + 1;

        raycaster.setFromCamera({ x, y }, camera);
        
        const photoMeshes = groupRef.current.children.map(g => g.children[0]); // The gold frame mesh
        const intersects = raycaster.intersectObjects(photoMeshes, false);

        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            const parentGroup = hitObject.parent;
            const index = groupRef.current.children.indexOf(parentGroup as THREE.Object3D);
            if (index !== -1 && photoData[index]) {
                const id = photoData[index].id;
                setHoveredId(id);
                
                // --- PINCH TO LOCK LOGIC ---
                if (cursorRef.current.isPinching) {
                    setLockedId(id);
                }
            }
        } else {
            setHoveredId(null);
            // We do NOT clear lockedId here, user must click close button or select another
        }
    }
  });

  return (
    <group ref={groupRef}>
      {photoData.map((data, i) => {
        const isActive = (hoveredId === data.id) || (lockedId === data.id);
        
        return (
          <group 
              key={data.id}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId(data.id); }}
              onPointerOut={() => setHoveredId(null)}
              onDoubleClick={(e) => { e.stopPropagation(); setLockedId(data.id); }}
          >
            {/* Gold Frame (Hit Target) */}
            <mesh position={[0, 0, -0.05]}>
              <boxGeometry args={[2.2, 2.2, 0.1]} />
              <meshStandardMaterial 
                color={PALETTE.GOLD_METALLIC} 
                metalness={0.9} 
                roughness={0.2} 
              />
            </mesh>
            
            {/* Black Backing */}
            <mesh position={[0, 0, -0.04]}>
              <boxGeometry args={[2.05, 2.05, 0.11]} />
              <meshBasicMaterial color="#111" />
            </mesh>

            {/* Photo */}
            <Image 
              url={data.url} 
              scale={[1.9, 1.9]} 
              position={[0, 0, 0.06]}
              transparent
              opacity={0.95} 
            />

            {/* Text Input Overlay */}
            {isActive && (
              <Html position={[0, -1.2, 0.2]} center transform distanceFactor={5} style={{ pointerEvents: 'none' }}>
                 <div 
                    className="p-4 rounded-lg backdrop-blur-md border border-[#D4AF37] flex flex-col gap-2 shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all duration-300"
                    style={{ 
                        background: 'rgba(0, 20, 10, 0.90)',
                        width: '280px',
                        pointerEvents: 'auto' // Re-enable pointer events for interaction
                    }}
                    onPointerDown={(e) => e.stopPropagation()} 
                 >
                    <div className="flex justify-between items-center border-b border-[#D4AF37]/30 pb-2">
                      <h3 className="text-[#D4AF37] font-serif text-sm uppercase tracking-wider">
                         Christmas Memory
                      </h3>
                      {/* Close / Unlock Button */}
                      {lockedId === data.id && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setLockedId(null);
                          }}
                          className="text-[#D4AF37] hover:text-white transition-colors font-bold text-xs border border-[#D4AF37]/50 rounded-full w-5 h-5 flex items-center justify-center"
                          title="Close"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    
                    <textarea 
                      value={data.message}
                      onChange={(e) => onUpdateMessage(data.id, e.target.value)}
                      placeholder="Pinch to lock & write..."
                      className="w-full bg-transparent text-white font-serif text-sm resize-none outline-none placeholder-white/30 h-20 mt-1"
                    />
                    <div className="text-[10px] text-[#D4AF37]/60 text-right flex justify-between">
                      <span>{lockedId === data.id ? "Locked" : "Pinch to lock"}</span>
                      <span>{new Date(data.date).toLocaleDateString()}</span>
                    </div>
                 </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};

export default PhotoStrip;