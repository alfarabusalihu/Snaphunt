import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

export const Toast = ({ message, type, onClose, duration = 5000 }: ToastProps) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const icons = {
        success: <CheckCircle2 className="text-emerald-500" size={18} />,
        error: <AlertCircle className="text-rose-500" size={18} />,
        info: <Info className="text-blue-500" size={18} />
    };

    const colors = {
        success: 'border-emerald-100 bg-emerald-50/50',
        error: 'border-rose-100 bg-rose-50/50',
        info: 'border-blue-100 bg-blue-50/50'
    };

    return (
        <div className={`
            fixed top-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 
            rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 transform
            ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'}
            ${colors[type]}
        `}>
            {icons[type]}
            <p className="text-xs font-bold text-slate-700 pr-4">{message}</p>
            <button
                onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
            >
                <X size={14} />
            </button>
        </div>
    );
};

export const useToast = () => {
    const [toasts, setToasts] = useState<{ id: string, message: string, type: ToastType }[]>([]);

    const showToast = (message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const ToastContainer = () => (
        <>
            {toasts.map(t => (
                <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
            ))}
        </>
    );

    return { showToast, ToastContainer };
};
