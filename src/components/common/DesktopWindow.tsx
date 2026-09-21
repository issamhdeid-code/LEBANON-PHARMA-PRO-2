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
  maxWidth?: number;
  maxHeight?: number;
  extraHeader?: React.ReactNode;
  section?: string;
  startMaximized?: boolean;
  hideResetButton?: boolean;
  hideMaximizeButton?: boolean;
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

type ResizeDirection = 'se' | 'e' | 's' | 'w' | 'sw' | 'n' | 'ne' | 'nw';

export const DesktopWindow: React.FC<DesktopWindowProps> = ({
  id: propId,
  title,
  isOpen,
  onClose,
  children,
  width = '800px',
  height = '600px',
  minWidth = 320,
  minHeight = 180,
  maxWidth,
  maxHeight,
  extraHeader,
  section,
  startMaximized = false,
  hideResetButton = false,
  hideMaximizeButton = false,
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

  const [isMaximized, setIsMaximized] = useState(startMaximized);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const registeredRef = useRef(false);

  // Compute default target dimensions
  const getInitialDimensions = useCallback(() => {
    const rawW = parseInitialDimension(width, window.innerWidth, 800);
    const rawH = height === 'auto'
      ? Math.min(720, Math.max(380, Math.round(window.innerHeight * 0.82)))
      : parseInitialDimension(height, window.innerHeight, 580);

    const effMaxW = maxWidth || Math.max(minWidth, window.innerWidth - 24);
    const effMaxH = maxHeight || Math.max(minHeight, window.innerHeight - 24);

    const clampedW = Math.min(Math.max(minWidth, rawW), effMaxW);
    const clampedH = Math.min(Math.max(minHeight, rawH), effMaxH);
    return { width: clampedW, height: clampedH };
  }, [width, height, minWidth, minHeight, maxWidth, maxHeight]);

  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    const saved = getSavedWindowPref(id);
    if (saved && typeof saved.width === 'number' && typeof saved.height === 'number') {
      const clampedW = Math.min(Math.max(minWidth, saved.width), Math.max(minWidth, window.innerWidth - 24));
      const clampedH = Math.min(Math.max(minHeight, saved.height), Math.max(minHeight, window.innerHeight - 24));
      return { width: clampedW, height: clampedH };
    }
    return windowState?.size || getInitialDimensions();
  });

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const saved = getSavedWindowPref(id);
    const initialDims = getInitialDimensions();
    const currentW = (saved && typeof saved.width === 'number') ? saved.width : initialDims.width;
    const currentH = (saved && typeof saved.height === 'number') ? saved.height : initialDims.height;
    
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      const maxX = Math.max(12, window.innerWidth - currentW - 12);
      const maxY = Math.max(12, window.innerHeight - currentH - 12);
      const clampedX = Math.max(12, Math.min(maxX, saved.x));
      const clampedY = Math.max(12, Math.min(maxY, saved.y));
      return { x: clampedX, y: clampedY };
    }
    if (windowState?.position) return windowState.position;
    const initX = Math.max(12, Math.round((window.innerWidth - initialDims.width) / 2));
    const initY = Math.max(12, Math.min(Math.max(12, window.innerHeight - initialDims.height - 16), Math.round((window.innerHeight - initialDims.height) / 2)));
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
        let currentW = sizeRef.current.width;
        let currentH = sizeRef.current.height;
        if (typeof saved.width === 'number' && typeof saved.height === 'number') {
          currentW = Math.min(Math.max(minWidth, saved.width), Math.max(minWidth, window.innerWidth - 24));
          currentH = Math.min(Math.max(minHeight, saved.height), Math.max(minHeight, window.innerHeight - 24));
          setSize({ width: currentW, height: currentH });
          updateWindowSize(id, currentW, currentH);
        }
        if (typeof saved.x === 'number' && typeof saved.y === 'number') {
          const maxX = Math.max(12, window.innerWidth - currentW - 12);
          const maxY = Math.max(12, window.innerHeight - currentH - 12);
          const clampedX = Math.max(12, Math.min(maxX, saved.x));
          const clampedY = Math.max(12, Math.min(maxY, saved.y));
          setPosition({ x: clampedX, y: clampedY });
          updateWindowPosition(id, clampedX, clampedY);
        }
      } else {
        // Enforce visible bottom edge on first open
        const initDims = getInitialDimensions();
        const maxX = Math.max(12, window.innerWidth - initDims.width - 12);
        const maxY = Math.max(12, window.innerHeight - initDims.height - 12);
        const initX = Math.max(12, Math.min(maxX, Math.round((window.innerWidth - initDims.width) / 2)));
        const initY = Math.max(12, Math.min(maxY, Math.round((window.innerHeight - initDims.height) / 2)));
        setPosition({ x: initX, y: initY });
      }
    }
  }, [isOpen, id, minWidth, minHeight, updateWindowPosition, updateWindowSize, getInitialDimensions]);

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

      // Keep entire window within viewport bounds
      const maxX = Math.max(12, window.innerWidth - sizeRef.current.width - 12);
      const maxY = Math.max(12, window.innerHeight - sizeRef.current.height - 12);

      currentX = Math.max(12, Math.min(maxX, startPosX + deltaX));
      currentY = Math.max(12, Math.min(maxY, startPosY + deltaY));

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

  // Resize handler supporting all corners and edges
  const handleResizeStart = (e: React.PointerEvent, direction: ResizeDirection) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    bringToFront(id);

    const handleEl = e.currentTarget as HTMLElement;
    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch (_) {}

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startWidth = sizeRef.current.width;
    const startHeight = sizeRef.current.height;
    const startPosX = positionRef.current.x;
    const startPosY = positionRef.current.y;

    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';

    const resizeCursor =
      direction === 'se' ? 'se-resize'
      : direction === 'sw' ? 'sw-resize'
      : direction === 'ne' ? 'ne-resize'
      : direction === 'nw' ? 'nw-resize'
      : direction === 'e' || direction === 'w' ? 'ew-resize'
      : 'ns-resize';
    document.body.style.cursor = resizeCursor;

    let currentW = startWidth;
    let currentH = startHeight;
    let currentX = startPosX;
    let currentY = startPosY;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startPointerX;
      const deltaY = moveEvent.clientY - startPointerY;

      const effectiveMinWidth = Math.min(minWidth, window.innerWidth - 32);
      const effectiveMinHeight = Math.min(minHeight, window.innerHeight - 32);
      const maxPossibleWidth = maxWidth || Math.max(2400, window.innerWidth * 2);
      const maxPossibleHeight = maxHeight || Math.max(2400, window.innerHeight * 2);

      // Horizontal resize
      if (direction.includes('e')) {
        const proposedW = startWidth + deltaX;
        currentW = Math.max(effectiveMinWidth, Math.min(maxPossibleWidth, proposedW));
        if (startPosX + currentW > window.innerWidth - 12) {
          currentX = Math.max(12, window.innerWidth - 12 - currentW);
        } else {
          currentX = startPosX;
        }
      } else if (direction.includes('w')) {
        const maxLeftExpansion = startPosX + startWidth - 12;
        const proposedW = startWidth - deltaX;
        currentW = Math.max(effectiveMinWidth, Math.min(maxLeftExpansion, Math.min(maxPossibleWidth, proposedW)));
        currentX = startPosX + (startWidth - currentW);
      }

      // Vertical resize
      if (direction.includes('s')) {
        const proposedH = startHeight + deltaY;
        currentH = Math.max(effectiveMinHeight, Math.min(maxPossibleHeight, proposedH));
        if (startPosY + currentH > window.innerHeight - 12) {
          currentY = Math.max(12, window.innerHeight - 12 - currentH);
        } else {
          currentY = startPosY;
        }
      } else if (direction.includes('n')) {
        const maxTopExpansion = startPosY + startHeight - 12;
        const proposedH = startHeight - deltaY;
        currentH = Math.max(effectiveMinHeight, Math.min(maxTopExpansion, Math.min(maxPossibleHeight, proposedH)));
        currentY = startPosY + (startHeight - currentH);
      }

      setSize({ width: currentW, height: currentH });
      setPosition({ x: currentX, y: currentY });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
      try {
        handleEl.releasePointerCapture(upEvent.pointerId);
      } catch (_) {}
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
            onDoubleClick={() => setIsMaximized((prev: boolean) => !prev)}
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

              {!hideResetButton && (
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
              )}

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

              {!hideMaximizeButton && (
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
              )}

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
                className="absolute top-6 bottom-6 -right-1 w-3.5 cursor-e-resize z-20 hover:bg-teal-500/20 active:bg-teal-500/30 transition-colors touch-none select-none"
                title="Resize width"
              />

              {/* Bottom Edge Handle */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 's')}
                className="absolute -bottom-1 left-6 right-6 h-3.5 cursor-s-resize z-20 hover:bg-teal-500/20 active:bg-teal-500/30 transition-colors touch-none select-none"
                title="Resize height"
              />

              {/* Left Edge Handle */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 'w')}
                className="absolute top-6 bottom-6 -left-1 w-3.5 cursor-w-resize z-20 hover:bg-teal-500/20 active:bg-teal-500/30 transition-colors touch-none select-none"
                title="Resize width"
              />

              {/* Bottom-Left Corner Handle */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 'sw')}
                className="absolute bottom-0 left-0 w-7 h-7 cursor-sw-resize z-30 touch-none select-none hover:bg-teal-500/10 active:bg-teal-500/20 rounded-bl-xl transition-colors"
                title="Drag to resize"
              />

              {/* Bottom-Right Corner Grip Handle (nth-of-type 7) */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 'se')}
                className="absolute bottom-0 right-0 w-7 h-7 z-30 cursor-se-resize flex items-end justify-end p-1.5 select-none touch-none group/resize hover:bg-teal-500/10 active:bg-teal-500/20 rounded-br-xl transition-colors"
                title="Drag to resize window"
              >
                <svg
                  className="w-4 h-4 text-slate-400 group-hover/resize:text-teal-600 dark:text-slate-500 dark:group-hover/resize:text-teal-400 transition-colors pointer-events-none"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M10 2L2 10M10 5.5L5.5 10M10 9L9 10"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Top Edge Handle */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 'n')}
                className="absolute -top-1 left-6 right-6 h-3 cursor-n-resize z-20 hover:bg-teal-500/20 active:bg-teal-500/30 transition-colors touch-none select-none"
                title="Resize height"
              />

              {/* Top-Right Corner Handle */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 'ne')}
                className="absolute top-0 right-0 w-7 h-7 cursor-ne-resize z-30 touch-none select-none hover:bg-teal-500/10 active:bg-teal-500/20 rounded-tr-xl transition-colors"
                title="Drag to resize"
              />

              {/* Top-Left Corner Handle */}
              <div
                onPointerDown={(e) => handleResizeStart(e, 'nw')}
                className="absolute top-0 left-0 w-7 h-7 cursor-nw-resize z-30 touch-none select-none hover:bg-teal-500/10 active:bg-teal-500/20 rounded-tl-xl transition-colors"
                title="Drag to resize"
              />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

