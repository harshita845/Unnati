import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { Check, AlertCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const toastTypeConfig = {
  success: {
    container: 'bg-emerald-50 text-emerald-900 border border-emerald-200/90 shadow-lg shadow-emerald-950/5',
    iconBg: 'bg-emerald-100 text-emerald-700',
    Icon: Check,
  },
  error: {
    container: 'bg-rose-50 text-rose-900 border border-rose-200/90 shadow-lg shadow-rose-950/5',
    iconBg: 'bg-rose-100 text-rose-700',
    Icon: AlertCircle,
  },
  info: {
    container: 'bg-blue-50 text-blue-900 border border-blue-200/90 shadow-lg shadow-blue-950/5',
    iconBg: 'bg-blue-100 text-blue-700',
    Icon: Info,
  },
};

export default function Toast({
  message,
  type = 'success',
  isVisible,
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const config = toastTypeConfig[type] || toastTypeConfig.success;
  const { Icon } = config;

  return (
    <AnimatePresence>
      {isVisible && (
        <div
          className="fixed top-3 sm:top-4 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4"
          style={{ top: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))' }}
        >
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-full flex items-center gap-2.5 pointer-events-auto max-w-[92vw] sm:max-w-md ${config.container}`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${config.iconBg}`}>
              <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <span className="font-semibold text-xs sm:text-sm leading-tight">
              {message}
            </span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}



