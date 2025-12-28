import { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'primary';
}

export const Modal = ({
    isOpen,
    title,
    description,
    onConfirm,
    onCancel,
    confirmText = "Continue",
    cancelText = "Cancel",
    variant = 'primary'
}: ModalProps) => {
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onCancel}
            />

            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 fade-in duration-300">
                <div className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${variant === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                            {variant === 'danger' ? <AlertTriangle size={24} /> : <div className="w-3 h-3 rounded-full bg-current" />}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">{title}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Action Required</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-500 leading-relaxed mb-8">
                        {description}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={onCancel}
                            className="w-full py-3 rounded-xl text-sm font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all border border-slate-100"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`w-full py-3 rounded-xl text-sm font-black text-white transition-all shadow-lg ${variant === 'danger' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>

                <button
                    onClick={onCancel}
                    className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};
