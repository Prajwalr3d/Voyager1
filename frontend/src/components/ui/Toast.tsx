import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { notifications, dismissNotification } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {notifications.map(n => {
        const icons = {
          success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
          error: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />,
          warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
          info: <Info className="w-4 h-4 text-sky-400 shrink-0" />,
        };

        const borderColors = {
          success: 'border-emerald-800/60',
          error: 'border-rose-800/60',
          warning: 'border-amber-800/60',
          info: 'border-sky-800/60',
        };

        return (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg bg-[#141418] border shadow-xl text-xs text-[#F4F4F5] animate-fade-in ${borderColors[n.type]}`}
          >
            {icons[n.type]}
            <div className="flex-1 leading-normal pr-1">{n.message}</div>
            <button
              onClick={() => dismissNotification(n.id)}
              className="text-[#71717A] hover:text-[#F4F4F5] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

