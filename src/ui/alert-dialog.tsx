import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUi } from '../stores/ui';
import { Button } from './primitives';

/** Promise-based confirm to replace window.confirm. Await useConfirm() anywhere. */
export function useConfirm() {
  return useUi((s) => s.ask);
}

/** shadcn-style alert dialog. Render once inside the protected shell. */
export function ConfirmDialog() {
  const dialog = useUi((s) => s.dialog);
  const answer = useUi((s) => s.answer);

  useEffect(() => {
    if (!dialog) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answer(false);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [dialog, answer]);

  return (
    <AnimatePresence>
      {dialog && (
        <motion.div
          className="alert-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => answer(false)}
        >
          <motion.div
            className="alert-card"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <h3>{dialog.title}</h3>
            {dialog.description && <p>{dialog.description}</p>}
            <div className="alert-actions">
              <Button variant="outline" onClick={() => answer(false)}>
                {dialog.cancelLabel || 'Cancel'}
              </Button>
              <Button variant={dialog.danger ? 'danger' : 'default'} onClick={() => answer(true)}>
                {dialog.actionLabel || 'Continue'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
