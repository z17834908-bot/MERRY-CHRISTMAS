import React, { useState, Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import Experience from './components/Experience';
import Overlay from './components/Overlay';
import HandControl from './components/HandControl';
import { TreeState, PhotoMemory, CursorData } from './types';

const App: React.FC = () => {
  const [treeState, setTreeState] = useState<TreeState>(TreeState.CHAOS);
  const [memories, setMemories] = useState<PhotoMemory[]>([]);
  
  // Shared ref for cursor data
  // Removed isMouseDown tracking
  const cursorRef = useRef<CursorData>({ 
    x: 0, 
    y: 0, 
    isPointing: false, 
    isPinching: false, 
    dispersion: 0,
    isHandOpen: false
  });
  
  // Ref to control rotation speed shared between HandControl and Experience
  const rotationSpeedRef = useRef<number>(0.2);

  // Load memories from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('xmas-tree-memories');
      if (saved) {
        setMemories(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load memories", e);
    }
  }, []);

  // Save memories to localStorage whenever they change
  useEffect(() => {
    try {
      if (memories.length > 0) {
        localStorage.setItem('xmas-tree-memories', JSON.stringify(memories));
      }
    } catch (e) {
      console.warn("Storage quota exceeded or error saving memories. Some data may not persist.", e);
    }
  }, [memories]);

  const toggleState = () => {
    setTreeState((prev) => (prev === TreeState.CHAOS ? TreeState.FORMED : TreeState.CHAOS));
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newMemories: PhotoMemory[] = [];
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newMemories.push({
              id: crypto.randomUUID(),
              url: e.target.result as string,
              message: "",
              date: Date.now()
            });
            
            if (newMemories.length === files.length) {
                setMemories(prev => [...prev, ...newMemories]);
            }
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const updateMemoryMessage = (id: string, message: string) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, message } : m));
  };

  return (
    <div className="relative w-full h-screen bg-black">
      <Canvas
        shadows
        camera={{ position: [0, 4, 25], fov: 45 }}
        dpr={[1, 2]} 
        gl={{ 
          antialias: false,
          toneMapping: 3, 
          toneMappingExposure: 1.5
        }}
      >
        <color attach="background" args={['#000502']} />
        
        <Suspense fallback={null}>
          <Experience 
            treeState={treeState} 
            memories={memories} 
            rotationSpeedRef={rotationSpeedRef}
            cursorRef={cursorRef}
            onUpdateMessage={updateMemoryMessage}
          />
        </Suspense>
      </Canvas>
      
      <Loader 
        containerStyles={{ background: '#001a0f' }} 
        innerStyles={{ background: '#333', width: 200 }} 
        barStyles={{ background: '#D4AF37', height: 5 }}
        dataStyles={{ color: '#D4AF37', fontFamily: 'serif' }}
      />
      
      <HandControl 
        setTreeState={setTreeState} 
        currentTreeState={treeState} 
        rotationSpeedRef={rotationSpeedRef}
        cursorRef={cursorRef}
      />
      
      {/* Visual Debug Cursor for Pointing Mode (Optional, adds feedback) */}
      <CursorOverlay cursorRef={cursorRef} />

      <Overlay treeState={treeState} onToggle={toggleState} onUpload={handlePhotoUpload} hasPhotos={memories.length > 0} />
    </div>
  );
};

// Simple visual feedback for the hand cursor
const CursorOverlay: React.FC<{ cursorRef: React.MutableRefObject<CursorData> }> = ({ cursorRef }) => {
  const [pos, setPos] = useState({ x: 0, y: 0, active: false, pinching: false });
  const requestRef = useRef<number>(0);

  const animate = () => {
    if (cursorRef.current.isPointing) {
      setPos({ 
        x: cursorRef.current.x * 100, 
        y: cursorRef.current.y * 100, 
        active: true,
        pinching: cursorRef.current.isPinching
      });
    } else {
      setPos(p => p.active ? { ...p, active: false } : p);
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  if (!pos.active) return null;

  return (
    <div 
      className={`absolute w-6 h-6 border-2 rounded-full pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${pos.pinching ? 'bg-red-500 scale-75 border-red-500' : 'border-[#D4AF37]'}`}
      style={{ 
        left: `${pos.x}%`, 
        top: `${pos.y}%`,
        boxShadow: pos.pinching ? '0 0 15px red' : '0 0 10px #D4AF37'
      }}
    >
      <div className={`absolute inset-0 opacity-30 rounded-full animate-ping ${pos.pinching ? 'bg-red-500' : 'bg-[#D4AF37]'}`} />
    </div>
  );
};

export default App;