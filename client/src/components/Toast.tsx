import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Info, X } from 'lucide-react';
import type { Notice } from '../hooks/useGameSocket';

export function Toast({ notice, onDismiss, duration = 4200 }: { notice: Notice | null; onDismiss?: () => void; duration?: number }) {
  useEffect(() => {
    if (!notice || !onDismiss) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [notice, onDismiss, duration]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-4">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            role="status"
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl px-4 py-3 text-sm shadow-2xl ring-1 backdrop-blur ${
              notice.tone === 'error' ? 'bg-[#3a1414]/95 text-[#ffd0cb] ring-red-piece/40' : 'bg-panel/95 text-cream ring-white/10'
            }`}
            initial={{ y: -20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -16, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            {notice.tone === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{notice.message}</span>
            {onDismiss && (
              <button type="button" onClick={onDismiss} className="ml-1 rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
