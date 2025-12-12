import React from 'react';
import { TreeState } from '../types';
import { PALETTE } from '../constants';

interface OverlayProps {
  treeState: TreeState;
  onToggle: () => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  hasPhotos: boolean;
}

const Overlay: React.FC<OverlayProps> = ({ treeState, onToggle, onUpload, hasPhotos }) => {
  const isFormed = treeState === TreeState.FORMED;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 md:p-12 z-10">
      
      {/* Header */}
      <header className="flex flex-col items-center justify-center text-center space-y-2 pointer-events-auto">
        <h1 
          className="text-4xl md:text-6xl font-bold tracking-widest uppercase drop-shadow-lg"
          style={{ 
            color: PALETTE.GOLD_METALLIC, 
            fontFamily: 'Cinzel, serif',
            textShadow: `0 0 20px ${PALETTE.GOLD_HIGHLIGHT}40`
          }}
        >
          Merry Christmas
        </h1>
        <div className="h-px w-32 bg-yellow-500 opacity-50 my-4" />
        <p className="text-white text-sm md:text-base tracking-[0.2em] uppercase opacity-80 font-serif">
          The Most Spectacular Celebration
        </p>
      </header>

      {/* Controls Container */}
      <footer className="flex flex-col items-center pb-8 pointer-events-auto space-y-6">
        
        {/* Upload Button */}
        <div className="relative group overflow-hidden rounded-full transition-transform duration-300 hover:scale-105">
            <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={onUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
            <button className="px-10 py-3 bg-[#001a0f] border border-[#D4AF37] text-[#D4AF37] font-serif uppercase tracking-widest text-xs md:text-sm hover:bg-[#D4AF37] hover:text-[#001a0f] transition-colors duration-500 shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                Upload Memories
            </button>
        </div>

        {/* Toggle Button (Fallback/Manual) */}
        <button 
          onClick={onToggle}
          className="px-8 py-2 bg-transparent border border-[#D4AF37]/30 text-[#D4AF37]/70 font-serif uppercase tracking-widest text-[10px] md:text-xs hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all duration-500 hover:shadow-[0_0_15px_rgba(212,175,55,0.1)]"
        >
          {isFormed ? 'Release to Chaos' : 'Gather to Form'}
        </button>

        {!hasPhotos && (
          <p className="text-[#D4AF37]/50 text-[10px] font-serif italic mt-2 animate-pulse">
            Upload photos to begin your legacy
          </p>
        )}
      </footer>
    </div>
  );
};

export default Overlay;