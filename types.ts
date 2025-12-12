import { Vector3, Color } from 'three';

// Add global declaration here to ensure R3F elements are recognized
// and to prevent "Duplicate index signature" errors by having it in one place.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [key: string]: any;
    }
  }
}

export enum TreeState {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED'
}

export interface OrnamentData {
  id: number;
  chaosPos: Vector3;
  targetPos: Vector3;
  color: string;
  type: 'GIFT' | 'BALL' | 'LIGHT';
  scale: number;
  speed: number; // For Lerp weighting
}

export interface FoliageUniforms {
  uTime: { value: number };
  uProgress: { value: number };
  uColor1: { value: Color };
  uColor2: { value: Color };
}

export interface PhotoMemory {
  id: string;
  url: string;
  message: string;
  date: number;
}

export interface CursorData {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  isPointing: boolean;
}