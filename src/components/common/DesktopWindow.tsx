import React, { useEffect, useState, useId, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useWindowContext } from '../../context/WindowContext';
import { Maximize2, Minimize2, Minus, RotateCcw, X } from 'lucide-react';

interface DesktopWindowProps {
  id?: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  height?: string;
  minWidth?: number;
  minHeight?: number;
  extraHeader?: React.ReactNode;
  section?: string;
}

const STORAGE_KEY = 'lebanon_pharma_window_prefs';

interface SavedWindowPref {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadSavedWindowPrefs(): Record<string, SavedWindowPref> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getSavedWindowPref(id: string): SavedWindowPref | null {
  const all = loadSavedWindowPrefs();
  return all[id] || null;
}

function saveSavedWindowPref(id: string, pref: SavedWindowPref): void {
  try {
    const all = loadSavedWindowPrefs();
    all[id] = { ...pref };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('Could not save window preference:', e);
  }
}

function removeSavedWindowPref(id: string): void {
  try {
    const all = loadSavedWindowPrefs();
    if (all[id]) {
      delete all[id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }
  } catch (e) {
    console.warn('Could not remove window preference:', e);
  }
}

function parseInitialDimension(val: string | undefined, basis: number, fallback: number): number {
  if (!val || val === 'auto') return fallback;
  const str = String(val).trim();
  if (str.endsWith('px')) return parseInt(str, 10) || fallback;
  if (str.endsWith('vw')) return Math.round((parseFloat(str) / 100) * window.innerWidth);
  if (str.endsWith('vh')) return Math.round((parseFloat(str) / 100) * window.innerHeight);
  if (str.endsWith('%')) return Math.round((parseFloat(str) / 100) * basis);
  const num = parseFloat(str);
  return !isNaN(num) ? num : fallback;
}

type ResizeDirection = 'se' | 'e' | 's' | 'w' | 'sw';

export const DesktopWindow: React.FC<DesktopWindowProps> = ({
  id: propId,
  title,
  isOpen,
  onClose,
  children,
  width = '800px',
  height = '600px',
  minWidth = 340,
  minHeight = 220,
  extraHeader,
  section
}) => {
  const fallbackId = useId();
  const [initialSection] = useState(section);
  // Generate deterministic ID if propId is omitted
  const id = useMemo(() => {
    if (propId && propId.trim()) return propId.trim();
    const cleanTitle = title
      .replace(/[:\-#]\s*[A-Za-z0-9_\-\/]+$/i, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return initialSection ? `${initialSection}_${cleanTitle}` : cleanTitle || fallbackId;
  }, [propId, title, initialSection, fallbackId]);

  const {
    registerWindow,
    unregisterWindow,
    setMinimized,
    bringToFront,
    updateWindowPosition,
    updateWindowSize,
    windows,
  } = useWindowContext();

  const windowState = windows[id];
  const isMinimized = windowState?.isMinimized || false;
  const zIndex = windowState?.zIndex || 100;

  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const registeredRef = useRef(false);

  // Compute default target dimensions
  const getInitialDimensions = useCallback(() => {
    const rawW = parseInitialDimension(width, window.innerWidth, 800);
    const rawH = height === 'auto'
      ? Math.min(580, Math.max(360, Math.round(window.innerHeight * 0.72)))
      : parseInitialDimension(height, window.innerHeight, 580);

    const clampedW = Math.min(Math.max(minWidth, rawW), Math.max(minWidth, window.innerWidth - 32));
    const clampedH = Math.min(Math.max(minHeight, rawH), Math.max(minHeight, window.innerHeight - 32));
    return { width: clampedW, height: clampedH };
  }, [width, height, minWidth, minHeight]);

  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    const saved = getSavedWindowPref(id);
    if (saved && typeof saved.width === 'number' && typeof saved.height === 'number') {
      const clampedW = Math.min(Math.max(minWidth, saved.width), Math.max(minWidth, window.innerWidth - 32));
      const clampedH = Math.min(Math.max(minHeight, saved.height), Math.max(minHeight, window.innerHeight - 32));
      return { width: clampedW, height: clampedH };
    }
    return windowState?.size || getInitialDimensions();
  });

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const saved = getSavedWindowPref(id);
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      const currentW = (saved.width && typeof saved.width === 'number') ? saved.width : getInitialDimensions().width;
      const minX = Math.min(0, window.innerWidth - currentW);
      const maxX = Math.max(0, window.innerWidth - 80);
      const maxY = Math.max(0, window.innerHeight - 50);
      const clampedX = Math.max(10, Math.min(maxX, saved.x));
      const clampedY = Math.max(10, Math.min(maxY, saved.y));
      return { x: clampedX, y: clampedY };
    }
    if (windowState?.position) return windowState.position;
    const initialDims = getInitialDimensions();
    const initX = Math.max(16, Math.round((window.innerWidth - initialDims.width) / 2));
    const initY = Math.max(16, Math.round((window.innerHeight - initialDims.height) / 2));
    return { x: initX, y: initY };
  });

  // Keep live refs to avoid stale closures in event listeners
  const positionRef = useRef(position);
  positionRef.current = position;

  const sizeRef = useRef(size);
  sizeRef.current = size;

  // On open or ID change, check if there are saved preferences
  useEffect(() => {
    if (isOpen) {
      const saved = getSavedWindowPref(id);
      if (saved) {
        if (typeof saved.width === 'number' && typeof saved.height === 'number') {
          const clampedW = Math.min(Math.max(minWidth, saved.width), Math.max(minWidth, window.innerWidth - 32));
          const clampedH = Math.min(Math.max(minHeight, saved.height), Math.max(minHeight, window.innerHeight - 32));
          setSize({ width: clampedW, height: clampedH });
          updateWindowSize(id, clampedW, clampedH);
        }
        if (typeof saved.x === 'number' && typeof saved.y === 'number') {
          const currentW = saved.width || sizeRef.current.width;
          const minX = Math.min(0, window.innerWidth - currentW);
          const maxX = Math.max(0, window.innerWidth - 80);
          const maxY = Math.max(0, window.innerHeight - 50);
          const clampedX = Math.max(10, Math.min(maxX, saved.x));
          const clampedY = Math.max(10, Math.min(maxY, saved.y));
          setPosition({ x: clampedX, y: clampedY });
          updateWindowPosition(id, clampedX, clampedY);
        }
      }
    }
  }, [isOpen, id, minWidth, minHeight, updateWindowPosition, updateWindowSize]);

  // Sync with context if available
  useEffect(() => {
    if (windowState?.size) {
      setSize(windowState.size);
    }
  }, [windowState?.size]);

  useEffect(() => {
    if (windowState?.position) {
      setPosition(windowState.position);
    }
  }, [windowState?.position]);

  // Keep window on-screen if viewport resizes
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.max(0, Math.min(Math.max(0, window.innerWidth - 80), prev.x)),
        y: Math.max(0, Math.min(Math.max(0, window.innerHeight - 60), prev.y)),
      }));
      setSize(prev => ({
        width: Math.min(window.innerWidth - 24, Math.max(minWidth, prev.width)),
        height: Math.min(window.innerHeight - 24, Math.max(minHeight, prev.height)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minWidth, minHeight]);

  useEffect(() => {
    if (isOpen) {
      registerWindow(id, title, section);
      registeredRef.current = true;
    }
  }, [isOpen, id, title, section, registerWindow]);

  useEffect(() => {
    if (!isOpen && registeredRef.current) {
      unregisterWindow(id);
      registeredRef.current = false;
    }
  }, [isOpen, id, unregisterWindow]);

  useEffect(() => {
    return () => {
      if (registeredRef.current) {
        unregisterWindow(id);
        registeredRef.current = false;
      }
    };
  }, [id, unregisterWindow]);

  // Reset window to default centered geometry
  const handleResetLayout = useCallback(() => {
    removeSavedWindowPref(id);
    const defaultDims = getInitialDimensions();
    const defaultX = Math.max(16, Math.round((window.innerWidth - defaultDims.width) / 2));
    const defaultY = Math.max(16, Math.round((window.innerHeight - defaultDims.height) / 2));
    setSize(defaultDims);
    setPosition({ x: defaultX, y: defaultY });
    setIsMaximized(false);
    updateWindowSize(id, defaultDims.width, defaultDims.height);
    updateWindowPosition(id, defaultX, defaultY);
  }, [id, getInitialDimensions, updateWindowPosition, updateWindowSize]);

  // Window drag handler via pointer events
  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    if (isMaximized) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) return;

    bringToFront(id);
    e.preventDefault();

    setIsDragging(true);

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startPosX = positionRef.current.x;
    const startPosY = positionRef.current.y;

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    let currentX = startPosX;
    let currentY = startPosY;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startPointerX;
      const deltaY = moveEvent.clientY - startPointerY;

      // Keep window within reachable bounds
      const minX = Math.min(0, window.innerWidth - sizeRef.current.width);
      const maxX = Math.max(0, window.innerWidth - 80);
      const maxY = Math.max(0, window.innerHeight - 50);

      currentX = Math.max(minX, Math.min(maxX, startPosX + deltaX));
      currentY = Math.max(0, Math.min(maxY, startPosY + deltaY));

      setPosition({ x: currentX, y: currentY });
    };

    const onPointerUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      updateWindowPosition(id, currentX, currentY);
      saveSavedWindowPref(id, {
        x: currentX,
        y: currentY,
        width: sizeRef.current.width,
        height: sizeRef.current.height,
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Resize handler supporting corner and edges
  const handleResizeStart = (e: React.PointerEvent, direction: ResizeDirection) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    bringToFront(id);

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startWidth = sizeRef.current.width;
    const startHeight = sizeRef.current.height;
    const startPosX = positionRef.current.x;
    const startPosY = positionRef.current.y;

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    let currentW = startWidth;
    let currentH = startHeight;
    let currentX = startPosX;
    let currentY = startPosY;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startPointerX;
      const deltaY = moveEvent.clientY - startPointerY;

      const effectiveMinWidth = Math.min(minWidth, window.innerWidth - 32);
      const effectiveMinHeight = Math.min(minHeight, window.innerHeight - 32);

      // Horizontal resize
      if (direction.includes('e')) {
        const maxWidth = window.innerWidth - startPosX - 12;
        currentW = Math.max(effectiveMinWidth, Math.min(maxWidth, startWidth + deltaX));
      } else if (direction.includes('w')) {
        const maxLeftExpansion = startPosX + startWidth - 12;
        const proposedW = startWidth - deltaX;
        currentW = Math.max(effectiveMinWidth, Math.min(maxLeftExpansion, proposedW));
        currentX = startPosX + (startWidth - currentW);
      }

      // Vertical resize
      if (direction.includes('s')) {
        const maxHeight = window.innerHeight - startPosY - 12;
        currentH = Math.max(effectiveMinHeight, Math.min(maxHeight, startHeight + deltaY));
      }

      setSize({ width: currentW, height: currentH });
      if (currentX !== positionRef.current.x || currentY !== positionRef.current.y) {
        setPosition({ x: currentX, y: currentY });
      }
    };

    const onPointerUp = () => {
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      updateWindowSize(id, currentW, currentH);
      updateWindowPosition(id, currentX, currentY);
      saveSavedWindowPref(id, {
        x: currentX,
        y: currentY,
        width: currentW,
        height: currentH,
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {!isMinimized && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          onMouseDown={() => bringToFront(id)}
          className={`fixed flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden ${
            isDragging
              ? 'shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] ring-2 ring-teal-500/40'
              : 'shadow-2xl'
          } ${
            isMaximized ? 'inset-3 sm:inset-4 z-[999] rounded-xl' : ''
          }`}
          style={
            isMaximized
              ? { zIndex }
              : {
                  width: `${size.width}px`,
                  height: `${size.height}px`,
                  top: `${position.y}px`,
                  left: `${position.x}px`,
                  zIndex,
                }
          }
        >
          {/* Window Header */}
          <div
            onPointerDown={handleHeaderPointerDown}
            onDoubleClick={() => setIsMaximized(prev => !prev)}
            className={`flex items-center justify-between px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 select-none touch-none shrink-0 ${
              isMaximized ? 'cursor-default' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex-1 truncate pr-4 text-sm">
              {title}
            </h3>

            <div className="flex items-center gap-1.5 shrink-0">
              {extraHeader && (
                <div
                  className="flex items-center gap-2 mr-2"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {extraHeader}
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetLayout();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:text-teal-400 dark:hover:bg-teal-950/40 rounded transition-colors cursor-pointer"
                title="Reset window size and position to default"
              >
                <RotateCcw size={14} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMinimized(id, true);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 dark:hover:text-slate-200 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
                title="Minimize Window"
              >
                <Minus size={15} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMaximized(!isMaximized);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 dark:hover:text-slate-200 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer"
                title={isMaximized ? 'Restore Window' : 'Maximize Window'}
              >
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded transition-colors cursor-pointer"
                title="Close Window"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Window Content */}
          <div className="flex-1 min-h-0 overflow-auto relative flex flex-col">
            {children}
          </div>

          {/* Resize Handles (Only active when not maximized) */}
          {!isMaximized && (
            <>
              {/* Right Edge Handle */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 'e')}
                className="absolute top-0 right-0 w-2.5 h-full cursor-e-resize z-20 hover:bg-teal-500/20 active:bg-teal-500/30 transition-colors touch-none select-none"
                title="Resize width"
              />

              {/* Bottom Edge Handle */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 's')}
                className="absolute bottom-0 left-0 h-2.5 w-full cursor-s-resize z-20 hover:bg-teal-500/20 active:bg-teal-500/30 transition-colors touch-none select-none"
                title="Resize height"
              />

              {/* Left Edge Handle */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 'w')}
                className="absolute top-0 left-0 w-2.5 h-full cursor-w-resize z-20 hover:bg-teal-500/20 active:bg-teal-500/30 transition-colors touch-none select-none"
                title="Resize width"
              />

              {/* Bottom-Left Corner Handle */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 'sw')}
                className="absolute bottom-0 left-0 w-5 h-5 cursor-sw-resize z-30 touch-none select-none"
              />

              {/* Bottom-Right Corner Grip Handle */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 'se')}
                className="absolute bottom-0 right-0 w-6 h-6 z-30 cursor-se-resize flex items-end justify-end p-1 select-none touch-none group/resize"
                title="Drag to resize window"
              >
                <svg
                  className="w-3.5 h-3.5 text-slate-400 group-hover/resize:text-teal-600 dark:text-slate-500 dark:group-hover/resize:text-teal-400 transition-colors pointer-events-none"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M10 3L3 10M10 6.5L6.5 10M10 10L10 10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

