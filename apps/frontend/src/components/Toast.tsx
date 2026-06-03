import { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ToastProps } from '../interfaces';

export const Toast = ({ message, type, onClose }: ToastProps) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`
            min-w-[320px] p-4 rounded-lg border shadow-lg pointer-events-auto
            animate-in slide-in-from-right-5 fade-in duration-300
            flex items-center justify-between gap-4
            ${type === 'success' ? 'bg-white border-slate-200 text-slate-950' :
                type === 'error' ? 'bg-rose-600 border-rose-600 text-white' :
                    'bg-white border-slate-200 text-slate-900'}
        `}>
            <div className="flex items-center gap-3">
                {type === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                ) : type === 'error' ? (
                    <AlertCircle size={16} className="text-white" />
                ) : (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                )}
                <p className="text-sm font-medium tracking-tight">{message}</p>
            </div>
            <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
                <X size={14} />
            </button>
        </div>
    );
};
