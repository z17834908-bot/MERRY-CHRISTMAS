import React, { useEffect, useRef } from 'react';
import { OrbitControls, Environment, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeState, PhotoMemory, CursorData } from '../types';
import TreeFoliage from './TreeFoliage';
import Ornaments from './Ornaments';
import Star from './Star';
import PhotoStrip from './PhotoStrip';
import { ANIMATION_SPEED } from '../constants';

interface ExperienceProps {
  treeState: TreeState;
  memories: PhotoMemory[];
  rotationSpeedRef: React.MutableRefObject<number>;
  cursorRef: React.MutableRefObject<CursorData>;
  onUpdateMessage: (id: string, message: string) => void;
}

const Experience: React.FC<ExperienceProps> = ({ treeState, memories, rotationSpeedRef, cursorRef, onUpdateMessage }) => {
  // Shared progress value: 0 (Chaos) -> 1 (Formed)
  const progress = useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  
  // Base auto-rotation speed
  const BASE_SPEED = 0.2;

  useFrame((state, delta) => {
    // Smooth damp towards target state
    const step = delta * ANIMATION_SPEED;
    if (treeState === TreeState.FORMED) {
       progress.current = THREE.MathUtils.lerp(progress.current, 1, step);
    } else {
       progress.current = THREE.MathUtils.lerp(progress.current, 0, step);
    }

    // --- Rotation Logic ---
    // Apply rotation speed to the group
    if (groupRef.current) {
      groupRef.current.rotation.y += rotationSpeedRef.current * delta;
    }

    // Inertia: Smoothly return rotation speed to base speed
    // If user swipes, speed increases. This gradually brings it back to auto-rotate.
    rotationSpeedRef.current = THREE.MathUtils.lerp(rotationSpeedRef.current, BASE_SPEED, delta * 2);
  });

  return (
    <>
      {/* Moved camera back to see the larger tree (Z: 24 -> 38, Y: 2 -> 6) */}
      <PerspectiveCamera makeDefault position={[0, 6, 38]} fov={50} />
      <OrbitControls 
        enablePan={false} 
        minPolarAngle={Math.PI / 4} 
        maxPolarAngle={Math.PI / 1.8}
        minDistance={15}
        maxDistance={60}
        // Disable autoRotate in OrbitControls because we rotate the group manually
        autoRotate={false} 
      />

      {/* Lighting & Environment */}
      <ambientLight intensity={0.2} />
      <Environment preset="lobby" />
      
      <spotLight 
        position={[10, 30, 10]} 
        angle={0.3} 
        penumbra={1} 
        intensity={2} 
        castShadow 
        color="#FFD700" 
      />
      
      {/* Main Rotating Group */}
      {/* Moved group down to keep tree centered (Y: -6 -> -10) */}
      <group ref={groupRef} position={[0, -10, 0]}>
        {/* The Tree Components */}
        <TreeFoliage progress={progress} />
        <Ornaments progress={progress} />
        <Star progress={progress} />
        {memories.length > 0 && (
          <PhotoStrip 
            progress={progress} 
            memories={memories} 
            cursorRef={cursorRef}
            onUpdateMessage={onUpdateMessage}
          />
        )}
        
        {/* Floor Reflections */}
        <ContactShadows 
          opacity={0.7} 
          scale={50} 
          blur={2.5} 
          far={10} 
          resolution={256} 
          color="#000000" 
        />
      </group>

      {/* Post Processing for Cinematic Luxury */}
      <EffectComposer disableNormalPass>
        <Bloom 
          luminanceThreshold={0.8} 
          mipmapBlur 
          intensity={1.2} 
          radius={0.6}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.6} />
      </EffectComposer>
    </>
  );
};

export default Experience;