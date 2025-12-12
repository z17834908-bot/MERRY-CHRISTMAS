import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TREE_CONFIG, CHAOS_RADIUS, ORNAMENT_TYPES } from '../constants';
import { OrnamentData, CursorData } from '../types';

interface OrnamentsProps {
  progress: React.MutableRefObject<number>;
  cursorRef: React.MutableRefObject<CursorData>;
}

const Ornaments: React.FC<OrnamentsProps> = ({ progress, cursorRef }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lightMeshRef = useRef<THREE.InstancedMesh>(null);
  const dispersionValue = useRef(0);

  // Separate data generation for heavy ornaments (mesh) and lights (emissive mesh)
  const { ornaments, lights } = useMemo(() => {
    const items: OrnamentData[] = [];
    const lightItems: OrnamentData[] = [];

    // Helper to generate items
    const generate = (count: number, isLight: boolean) => {
      for (let i = 0; i < count; i++) {
        // Target: Surface of cone (mostly)
        const h = Math.random() * TREE_CONFIG.HEIGHT * 0.9 + 0.5; // Avoid very bottom/top
        const rMax = (1 - h / TREE_CONFIG.HEIGHT) * TREE_CONFIG.RADIUS_BASE;
        const r = isLight ? rMax * 0.95 : rMax + 0.2; // Lights inside, Ornaments outside
        const theta = Math.random() * Math.PI * 2;

        const tx = Math.cos(theta) * r;
        const ty = h;
        const tz = Math.sin(theta) * r;

        // Chaos
        const cr = Math.cbrt(Math.random()) * CHAOS_RADIUS;
        const cTheta = Math.random() * Math.PI * 2;
        const cPhi = Math.acos(2 * Math.random() - 1);
        const cx = cr * Math.sin(cPhi) * Math.cos(cTheta);
        const cy = cr * Math.sin(cPhi) * Math.sin(cTheta) + 6;
        const cz = cr * Math.cos(cPhi);

        // Type determination
        let typeConf;
        let typeStr: 'GIFT' | 'BALL' | 'LIGHT';

        if (isLight) {
          typeConf = ORNAMENT_TYPES.LIGHT;
          typeStr = 'LIGHT';
        } else {
           // 30% Gifts, 70% Balls
           if (Math.random() < 0.3) {
             typeConf = ORNAMENT_TYPES.GIFT;
             typeStr = 'GIFT';
           } else {
             typeConf = ORNAMENT_TYPES.BALL;
             typeStr = 'BALL';
           }
        }

        const color = typeConf.colors[Math.floor(Math.random() * typeConf.colors.length)];

        const data: OrnamentData = {
          id: i,
          chaosPos: new THREE.Vector3(cx, cy, cz),
          targetPos: new THREE.Vector3(tx, ty, tz),
          color,
          type: typeStr,
          scale: typeConf.scale * (0.8 + Math.random() * 0.4), // Variance
          speed: typeConf.weight // Heavier objects have lower weight param in logic below? No, let's treat weight as 'inertia'. 
          // Actually, let's map 'speed' to interpolation alpha multiplier.
          // Light = Fast (High Multiplier), Heavy = Slow (Low Multiplier)
        };
        
        // Inverse logic: Light weight = 0.1 -> fast? 
        // Let's manually set speeds:
        if(typeStr === 'GIFT') data.speed = 1.0; 
        if(typeStr === 'BALL') data.speed = 2.0; 
        if(typeStr === 'LIGHT') data.speed = 3.5;

        if (isLight) lightItems.push(data);
        else items.push(data);
      }
    };

    generate(TREE_CONFIG.ORNAMENT_COUNT, false); // Balls/Gifts
    generate(TREE_CONFIG.ORNAMENT_COUNT * 0.8, true); // Lights

    return { ornaments: items, lights: lightItems };
  }, []);

  // Temporary objects for matrix calculation
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const tempDir = useMemo(() => new THREE.Vector3(), []); // For dispersion direction

  useLayoutEffect(() => {
    // Initial color setting
    if (meshRef.current) {
      ornaments.forEach((data, i) => {
        tempColor.set(data.color);
        meshRef.current!.setColorAt(i, tempColor);
      });
      meshRef.current.instanceColor!.needsUpdate = true;
    }
    if (lightMeshRef.current) {
      lights.forEach((data, i) => {
        tempColor.set(data.color);
        lightMeshRef.current!.setColorAt(i, tempColor);
      });
      lightMeshRef.current.instanceColor!.needsUpdate = true;
    }
  }, [ornaments, lights, tempColor]);

  useFrame((state, delta) => {
    const p = progress.current; // 0 to 1
    
    // Smoothly interpolate dispersion value
    const targetDispersion = cursorRef.current.dispersion;
    dispersionValue.current = THREE.MathUtils.lerp(dispersionValue.current, targetDispersion, delta * 3.0);
    const d = dispersionValue.current;

    // Update Ornaments (Balls/Gifts)
    if (meshRef.current) {
      ornaments.forEach((data, i) => {
        // 1. Calculate Base Position (Chaos <-> Formed)
        let localP = 0;
        if (data.type === 'GIFT') {
           localP = THREE.MathUtils.smoothstep(p, 0.2, 1.0);
        } else {
           localP = THREE.MathUtils.smoothstep(p, 0.0, 0.9);
        }
        
        tempPos.lerpVectors(data.chaosPos, data.targetPos, localP);

        // 2. Apply Dispersion (Explode outwards)
        if (d > 0.001) {
            tempDir.copy(tempPos).normalize();
            // Add noise to direction so it doesn't look too uniform
            tempDir.x += Math.sin(i + state.clock.elapsedTime) * 0.2;
            tempDir.z += Math.cos(i + state.clock.elapsedTime) * 0.2;
            tempDir.normalize();
            
            // Push out by dispersion factor * magnitude (25 matches foliage)
            tempPos.addScaledVector(tempDir, d * 25.0);
        }
        
        // Rotate gifts/balls slowly
        dummy.position.copy(tempPos);
        dummy.rotation.x = state.clock.elapsedTime * 0.2 + data.id;
        dummy.rotation.y = state.clock.elapsedTime * 0.3 + data.id;
        dummy.scale.setScalar(data.scale * (localP * 0.5 + 0.5)); // Shrink slightly in chaos

        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update Lights
    if (lightMeshRef.current) {
      lights.forEach((data, i) => {
        const localP = THREE.MathUtils.smoothstep(p, 0.0, 0.8); // Lights arrive fast
        
        tempPos.lerpVectors(data.chaosPos, data.targetPos, localP);

        // Apply Dispersion to Lights too
        if (d > 0.001) {
            tempDir.copy(tempPos).normalize();
            tempDir.y += Math.sin(i) * 0.5; // Lights fly a bit more erratically
            tempDir.normalize();
            tempPos.addScaledVector(tempDir, d * 30.0); // Lights fly slightly further
        }
        
        dummy.position.copy(tempPos);
        // Lights pulse
        const scalePulse = data.scale + Math.sin(state.clock.elapsedTime * 5 + data.id) * 0.05;
        dummy.scale.setScalar(scalePulse * localP); // Lights disappear in chaos (scale 0)

        dummy.updateMatrix();
        lightMeshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      lightMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Heavy Ornaments (Standard Material with Reflections) */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, ornaments.length]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial 
          roughness={0.1} 
          metalness={0.8} 
          envMapIntensity={1.5}
        />
      </instancedMesh>

      {/* Lights (Emissive, high bloom) */}
      <instancedMesh
        ref={lightMeshRef}
        args={[undefined, undefined, lights.length]}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial 
          toneMapped={false}
          emissive="white"
          emissiveIntensity={4} // Super bright for Bloom
          color="white"
        />
      </instancedMesh>
    </>
  );
};

export default Ornaments;