import React from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SectionRestoreButtonProps {
  section: string;
  className?: string;
}

export const SectionRestoreButton: React.FC<SectionRestoreButtonProps> = ({ section, className = "" }) => {
  const { windows, setMinimized } = useWindowContext();
  
  const minimizedTasks = Object.values(windows).filter(w => w.section === section && w.isMinimized);
  
  if (minimizedTasks.length === 0) return null;
  
  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, scale: 0.9, x: 10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.9, x: 10 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          // Restore the first minimized task of this section
          setMinimized(minimizedTasks[0].id, false);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-lg shadow-teal-500/20 transition-all active:scale-95 group relative overflow-hidden border border-teal-500/50 ${className}`}
      >
        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        <Layers size={14} className="animate-pulse shrink-0" />
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-teal-700 text-[9px] font-bold shrink-0">
          {minimizedTasks.length}
        </span>
      </motion.button>
    </AnimatePresence>
  );
};
