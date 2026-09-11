import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { motion } from 'motion/react';

export interface WindowState {
  id: string;
  title: string;
  isMinimized: boolean;
  zIndex: number;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  pillPosition?: { x: number; y: number };
  section?: string;
}

interface WindowContextProps {
  windows: Record<string, WindowState>;
  registerWindow: (id: string, title: string, section?: string) => void;
  unregisterWindow: (id: string) => void;
  setMinimized: (id: string, isMinimized: boolean) => void;
  bringToFront: (id: string) => void;
  updateWindowPosition: (id: string, x: number, y: number) => void;
  updateWindowSize: (id: string, width: number, height: number) => void;
  updatePillPosition: (id: string, x: number, y: number) => void;
  getTopZIndex: () => number;
}

const WindowContext = createContext<WindowContextProps | undefined>(undefined);

export const WindowProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [windows, setWindows] = useState<Record<string, WindowState>>({});
  const isDraggingPillRef = useRef<Record<string, boolean>>({});

  const registerWindow = useCallback((id: string, title: string, section?: string) => {
    setWindows(prev => {
      if (prev[id]) {
        if (prev[id].title !== title || prev[id].section !== section) {
          return { ...prev, [id]: { ...prev[id], title, section } };
        }
        return prev;
      }
      const currentMaxZ = Object.values(prev).reduce((max, w) => Math.max(max, w.zIndex), 100);
      return {
        ...prev,
        [id]: { id, title, section, isMinimized: false, zIndex: currentMaxZ + 1 }
      };
    });
  }, []);

  const unregisterWindow = useCallback((id: string) => {
    setWindows(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const bringToFront = useCallback((id: string) => {
    setWindows(prev => {
      if (!prev[id]) return prev;
      const currentMaxZ = Object.values(prev).reduce((max, w) => Math.max(max, w.zIndex), 100);
      // Already at top if it's the only window or its zIndex is already max
      if (prev[id].zIndex === currentMaxZ && Object.keys(prev).length > 1) {
        // Double check if it's truly the max (no other window has same zIndex)
        const othersWithSameZ = Object.values(prev).filter(w => w.id !== id && w.zIndex === currentMaxZ);
        if (othersWithSameZ.length === 0) return prev;
      }
      
      return {
        ...prev,
        [id]: { ...prev[id], zIndex: currentMaxZ + 1 }
      };
    });
  }, []);

  const setMinimized = useCallback((id: string, isMinimized: boolean) => {
    setWindows(prev => {
      if (!prev[id]) return prev;
      
      const currentMaxZ = Object.values(prev).reduce((max, w) => Math.max(max, w.zIndex), 100);
      const newZIndex = !isMinimized ? currentMaxZ + 1 : prev[id].zIndex;
      
      return { 
        ...prev, 
        [id]: { 
          ...prev[id], 
          isMinimized,
          zIndex: newZIndex
        } 
      };
    });
  }, []);

  const updateWindowPosition = useCallback((id: string, x: number, y: number) => {
    setWindows(prev => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], position: { x, y } } };
    });
  }, []);

  const updateWindowSize = useCallback((id: string, width: number, height: number) => {
    setWindows(prev => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], size: { width, height } } };
    });
  }, []);

  const updatePillPosition = useCallback((id: string, x: number, y: number) => {
    setWindows(prev => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], pillPosition: { x, y } } };
    });
  }, []);

  const getTopZIndex = useCallback(() => {
    return Object.values(windows).reduce((max, w) => Math.max(max, w.zIndex), 100);
  }, [windows]);

  const contextValue = React.useMemo(() => ({
    windows,
    registerWindow,
    unregisterWindow,
    setMinimized,
    bringToFront,
    updateWindowPosition,
    updateWindowSize,
    updatePillPosition,
    getTopZIndex
  }), [windows, registerWindow, unregisterWindow, setMinimized, bringToFront, updateWindowPosition, updateWindowSize, updatePillPosition, getTopZIndex]);

  return (
    <WindowContext.Provider value={contextValue}>
      {children}
      {/* Render Minimized Pills Container */}
      <div className="fixed bottom-6 right-6 flex flex-col-reverse gap-3 z-[9999] pointer-events-none items-end">
        {Object.values(windows).filter(w => w.isMinimized).map(w => (
          <motion.div 
            key={w.id} 
            drag
            dragMomentum={false}
            dragElastic={0}
            whileDrag={{ scale: 1.05, zIndex: 10000, cursor: 'grabbing' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            initial={w.pillPosition ? { x: w.pillPosition.x, y: w.pillPosition.y } : { x: 0, y: 0 }}
            animate={w.pillPosition ? { x: w.pillPosition.x, y: w.pillPosition.y } : { x: 0, y: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            onDragStart={() => {
              isDraggingPillRef.current[w.id] = true;
            }}
            onDragEnd={(_, info) => {
              const currentX = w.pillPosition?.x || 0;
              const currentY = w.pillPosition?.y || 0;
              updatePillPosition(w.id, currentX + info.offset.x, currentY + info.offset.y);
              // Small delay to ensure onTap knows we were dragging
              setTimeout(() => {
                isDraggingPillRef.current[w.id] = false;
              }, 100);
            }}
            onTap={() => {
              if (isDraggingPillRef.current[w.id]) return;
              setMinimized(w.id, false);
            }}
            className="pointer-events-auto group relative flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 pl-4 pr-2 py-2 rounded-2xl shadow-2xl shadow-teal-500/5 dark:shadow-black/40 cursor-grab active:cursor-grabbing hover:border-teal-500/30 dark:hover:border-teal-500/30 transition-colors duration-300"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/></svg>
            </div>
            <div className="flex flex-col min-w-[120px] max-w-[180px] select-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Minimized Task</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{w.title}</span>
            </div>
            <button 
              className="ml-2 p-2 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
              onClick={(e) => { e.stopPropagation(); setMinimized(w.id, false); }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Restore Window"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
            </button>
          </motion.div>
        ))}
      </div>
    </WindowContext.Provider>
  );
};

export const useWindowContext = () => {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindowContext must be used within WindowProvider');
  }
  return context;
};
