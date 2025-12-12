import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TREE_CONFIG, PALETTE } from '../constants';
import { CursorData } from '../types';

interface StarProps {
  progress: React.MutableRefObject<number>;
  cursorRef: React.MutableRefObject<CursorData>;
}

const Star: React.FC<StarProps> = ({ progress, cursorRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const dispersionValue = useRef(0);

  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const points = 5;
    const outerRadius = 1.2;
    const innerRadius = 0.5;

    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }, []);

  const extrudeSettings = {
    steps: 1,
    depth: 0.4,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 2,
  };

  useFrame((state, delta) => {
    if (meshRef.current && glowRef.current) {
      const t = state.clock.getElapsedTime();
      const p = progress.current;
      
      // Dispersion
      const targetDispersion = cursorRef.current.dispersion;
      dispersionValue.current = THREE.MathUtils.lerp(dispersionValue.current, targetDispersion, delta * 3.0);
      const d = dispersionValue.current;

      // Position: Moves up slightly when formed
      const targetY = TREE_CONFIG.HEIGHT + 0.5;
      const chaosY = TREE_CONFIG.HEIGHT + 5;
      
      // Interpolate Position
      let currentY = THREE.MathUtils.lerp(chaosY, targetY, p);
      
      // Apply Dispersion (Star shoots up to the heavens)
      currentY += d * 30.0;
      
      meshRef.current.position.set(0, currentY, 0);
      glowRef.current.position.set(0, currentY, 0);

      // Rotation: Spins faster in chaos or dispersion
      const rotationSpeed = THREE.MathUtils.lerp(2.0, 0.5, p) + (d * 5.0);
      meshRef.current.rotation.y = t * rotationSpeed;
      meshRef.current.rotation.z = Math.sin(t) * 0.1 + (d * Math.sin(t * 10) * 0.5); // Slight tilt, crazy tilt on dispersion
      
      glowRef.current.rotation.y = t * rotationSpeed;
      
      // Scale: Expands when formed
      const scale = THREE.MathUtils.lerp(0, 1, p);
      meshRef.current.scale.setScalar(scale);
      glowRef.current.scale.setScalar(scale * 1.5);

      // Pulse the glow
      const pulse = 1 + Math.sin(t * 3) * 0.2 + (d * 1.0); // Intense pulse on dispersion
      glowRef.current.scale.multiplyScalar(pulse);
    }
  });

  return (
    <>
      <mesh ref={meshRef} castShadow>
        <extrudeGeometry args={[starShape, extrudeSettings]} />
        <meshStandardMaterial
          color={PALETTE.GOLD_HIGHLIGHT}
          emissive={PALETTE.GOLD_METALLIC}
          emissiveIntensity={0.5}
          metalness={1}
          roughness={0.1}
        />
      </mesh>
      {/* Glow Halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial 
          color={PALETTE.GOLD_HIGHLIGHT} 
          transparent 
          opacity={0.2} 
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  );
};

export default Star;