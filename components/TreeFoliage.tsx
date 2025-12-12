import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TREE_CONFIG, CHAOS_RADIUS, PALETTE } from '../constants';
import { CursorData } from '../types';

// Custom Shader Material for the Foliage
const FoliageShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uDispersion: { value: 0 },
    uColorBase: { value: new THREE.Color(PALETTE.EMERALD_DEEP) },
    uColorTip: { value: new THREE.Color(PALETTE.EMERALD_LIGHT) },
    uColorGold: { value: new THREE.Color(PALETTE.GOLD_METALLIC) },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uProgress;
    uniform float uDispersion;
    attribute vec3 aChaosPos;
    attribute vec3 aTargetPos;
    attribute float aRandom;
    
    varying vec2 vUv;
    varying float vRandom;
    varying float vHeight;

    // Cubic easing out for smoother transition
    float easeOutCubic(float x) {
      return 1.0 - pow(1.0 - x, 3.0);
    }

    void main() {
      vUv = uv;
      vRandom = aRandom;
      
      // Interpolate between Chaos and Target
      // Add some noise to the start time based on particle index for "swirling" effect
      float localProgress = clamp((uProgress * 1.2) - (aRandom * 0.2), 0.0, 1.0);
      float easedProgress = easeOutCubic(localProgress);
      
      vec3 pos = mix(aChaosPos, aTargetPos, easedProgress);
      
      // Gentle wind sway when formed
      if (uProgress > 0.8) {
        float wind = sin(uTime * 2.0 + pos.y * 0.5) * 0.1 * (pos.y / 20.0);
        pos.x += wind;
        pos.z += wind * 0.5;
      }

      // --- DISPERSION (Hand Open Effect) ---
      // Explode outwards from center based on uDispersion
      // We add some noise to the direction so it doesn't look like a perfect shell expansion
      vec3 noiseDir = vec3(
          sin(aRandom * 100.0 + uTime),
          cos(aRandom * 50.0 + uTime),
          sin(aRandom * 20.0 + uTime)
      );
      vec3 explodeDir = normalize(pos) + (noiseDir * 0.5);
      
      // Dispersion strength expands the tree
      pos += explodeDir * uDispersion * 25.0;

      vHeight = pos.y; // Pass height for color gradient
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Size attenuation
      // Base size reduced to 12.0 (was 30.0), minimum 2.0
      gl_PointSize = (14.0 * aRandom + 4.0) * (1.0 / -mvPosition.z);
    }
  `,
  fragmentShader: `
    uniform vec3 uColorBase;
    uniform vec3 uColorTip;
    uniform vec3 uColorGold;
    
    varying float vRandom;
    varying float vHeight;

    void main() {
      // Circular particle
      vec2 xy = gl_PointCoord.xy - vec2(0.5);
      float ll = length(xy);
      if(ll > 0.5) discard;

      // Gradient from bottom (dark) to top (lighter)
      // Updated divider to 22.0 to match new HEIGHT
      float heightFactor = clamp(vHeight / 22.0, 0.0, 1.0);
      vec3 finalColor = mix(uColorBase, uColorTip, heightFactor);

      // Add "Gold Dust" sparkles randomly
      if (vRandom > 0.9) {
        finalColor = uColorGold;
        // Make gold particles brighter for Bloom
        gl_FragColor = vec4(finalColor * 2.0, 1.0); 
      } else {
        gl_FragColor = vec4(finalColor, 1.0);
      }
      
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }
  `
};

interface TreeFoliageProps {
  progress: React.MutableRefObject<number>;
  cursorRef: React.MutableRefObject<CursorData>;
}

const TreeFoliage: React.FC<TreeFoliageProps> = ({ progress, cursorRef }) => {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  
  // Local ref for smoothing dispersion value
  const dispersionValue = useRef(0);
  
  // Generate Geometry Data
  const { positions, chaosPositions, randoms } = useMemo(() => {
    const count = TREE_CONFIG.PARTICLE_COUNT;
    const pos = new Float32Array(count * 3);
    const chaos = new Float32Array(count * 3);
    const rands = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // 1. Target Position (Cone)
      // Height varies from 0 to MAX
      const h = Math.random() * TREE_CONFIG.HEIGHT;
      // Radius decreases as height increases
      const rMax = (1 - h / TREE_CONFIG.HEIGHT) * TREE_CONFIG.RADIUS_BASE;
      
      // Random angle
      const theta = Math.random() * Math.PI * 2;
      
      // Volume filling distribution
      const rad = Math.pow(Math.random(), 0.4) * rMax;

      const x = Math.cos(theta) * rad;
      const y = h;
      const z = Math.sin(theta) * rad;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // 2. Chaos Position (Sphere)
      // Random point on/in sphere
      const u = Math.random();
      const v = Math.random();
      const theta2 = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const rChaos = Math.cbrt(Math.random()) * CHAOS_RADIUS; // cbrt for uniform volume
      
      const cx = rChaos * Math.sin(phi) * Math.cos(theta2);
      const cy = rChaos * Math.sin(phi) * Math.sin(theta2) + (TREE_CONFIG.HEIGHT / 2); // Center chaos vertically
      const cz = rChaos * Math.cos(phi);

      chaos[i * 3] = cx;
      chaos[i * 3 + 1] = cy;
      chaos[i * 3 + 2] = cz;

      // 3. Random attr
      rands[i] = Math.random();
    }

    return { positions: pos, chaosPositions: chaos, randoms: rands };
  }, []);

  useFrame((state, delta) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      shaderRef.current.uniforms.uProgress.value = progress.current;
      
      // Smoothly interpolate dispersion
      const targetDispersion = cursorRef.current.dispersion;
      dispersionValue.current = THREE.MathUtils.lerp(dispersionValue.current, targetDispersion, delta * 3.0);
      
      shaderRef.current.uniforms.uDispersion.value = dispersionValue.current;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position" 
          count={positions.length / 3}
          array={positions} 
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aTargetPos"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aChaosPos"
          count={chaosPositions.length / 3}
          array={chaosPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={randoms.length}
          array={randoms}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderRef}
        attach="material"
        args={[FoliageShaderMaterial]}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default TreeFoliage;