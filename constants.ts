import * as THREE from 'three';

// "Trump-style" Luxury Palette
export const PALETTE = {
  EMERALD_DEEP: '#002E18',
  EMERALD_LIGHT: '#006B3C',
  GOLD_METALLIC: '#D4AF37', // Metallic Gold
  GOLD_HIGHLIGHT: '#FFDF00', // Bright Gold
  RED_VELVET: '#800020', // Deep Burgundy/Red
  WHITE_PEARL: '#F0F0F0',
};

// Tree Dimensions
export const TREE_CONFIG = {
  HEIGHT: 22, // Increased from 14 to 22
  RADIUS_BASE: 9, // Increased from 5 to 9
  PARTICLE_COUNT: 55000, // Increased from 25000 to 55000 for denser shape
  ORNAMENT_COUNT: 700, 
};

// Animation settings
export const ANIMATION_SPEED = 1.5; // Speed of transition
export const CHAOS_RADIUS = 50; // Increased from 35 to 50 to accommodate larger tree

export const ORNAMENT_TYPES = {
  GIFT: { weight: 0.02, scale: 0.25, colors: [PALETTE.GOLD_METALLIC, PALETTE.RED_VELVET] }, // Smaller scale
  BALL: { weight: 0.05, scale: 0.18, colors: [PALETTE.GOLD_HIGHLIGHT, PALETTE.EMERALD_LIGHT, PALETTE.WHITE_PEARL] }, // Smaller scale
  LIGHT: { weight: 0.1, scale: 0.08, colors: [PALETTE.GOLD_HIGHLIGHT] }, // Smaller scale
};