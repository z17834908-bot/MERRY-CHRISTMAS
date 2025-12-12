import React, { useEffect, useRef } from 'react';
import { OrbitControls, Environment, PerspectiveCamera, ContactShadows, Lightformer } from '@react-three/drei';
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
    // --- Unified Logic ---
    const isHandInputActive = cursorRef.current.isHandOpen;
    const isChaosState = treeState === TreeState.CHAOS;
    
    // Active means we want the particles to spread out completely.
    const isActive = isHandInputActive || isChaosState;

    // Target Dispersion: 1.0 when active (Explode/Spread)
    const targetDispersion = isActive ? 1.0 : 0.0;
    cursorRef.current.dispersion = targetDispersion;

    // Target Progress: 
    // If Active -> 0 (Chaos Shape / Random Sphere)
    // If Inactive -> 1 (Formed Tree)
    // This ensures we don't just "open the tree", but dissolve it into chaos.
    const targetProgress = isActive ? 0.0 : 1.0;
    const step = delta * ANIMATION_SPEED;
    progress.current = THREE.MathUtils.lerp(progress.current, targetProgress, step);

    // --- Rotation Logic ---
    // Apply rotation speed to the group
    if (groupRef.current) {
      groupRef.current.rotation.y += rotationSpeedRef.current * delta;
    }

    // Inertia: Smoothly return rotation speed to base speed
    rotationSpeedRef.current = THREE.MathUtils.lerp(rotationSpeedRef.current, BASE_SPEED, delta * 2);
  });

  return (
    <>
      {/* Moved camera back to see the larger tree/cloud (Z: 24 -> 38, Y: 2 -> 6) */}
      <PerspectiveCamera makeDefault position={[0, 6, 38]} fov={50} />
      <OrbitControls 
        enablePan={false} 
        minPolarAngle={Math.PI / 4} 
        maxPolarAngle={Math.PI / 1.8}
        minDistance={15}
        maxDistance={60}
        autoRotate={false} 
      />

      {/* Lighting & Environment */}
      <ambientLight intensity={0.2} />
      
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
          <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[10, 2, 1]} />
          <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={[10, 2, 1]} />
          <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[20, 10, 1]} />
          <Lightformer intensity={2} color="#D4AF37" rotation-y={-Math.PI / 2} position={[-10, -5, 0]} scale={[20, 10, 1]} />
        </group>
      </Environment>
      
      <spotLight 
        position={[10, 30, 10]} 
        angle={0.3} 
        penumbra={1} 
        intensity={2} 
        castShadow 
        color="#FFD700" 
      />
      
      {/* Main Rotating Group */}
      <group ref={groupRef} position={[0, -10, 0]}>
        <TreeFoliage progress={progress} cursorRef={cursorRef} />
        <Ornaments progress={progress} cursorRef={cursorRef} />
        <Star progress={progress} cursorRef={cursorRef} />
        {memories.length > 0 && (
          <PhotoStrip 
            progress={progress} 
            memories={memories} 
            cursorRef={cursorRef}
            onUpdateMessage={onUpdateMessage}
          />
        )}
        
        <ContactShadows 
          opacity={0.7} 
          scale={50} 
          blur={2.5} 
          far={10} 
          resolution={256} 
          color="#000000" 
        />
      </group>

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