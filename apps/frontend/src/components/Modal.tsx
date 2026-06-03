import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ModalProps } from '../interfaces';

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
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-300"
                onClick={onCancel}
            />

            <div
                className="relative w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 fade-in duration-300"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                aria-describedby="modal-description"
            >
                <div className="p-6">
                    <div className="flex flex-col gap-2 mb-6">
                        <h3 id="modal-title" className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h3>
                        <p id="modal-description" className="text-sm text-slate-500 leading-relaxed font-normal">
                            {description}
                        </p>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-8">
                        <button
                            onClick={onCancel}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 h-10 px-4 py-2"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 text-slate-50 ${variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                            autoFocus
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>

                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors opacity-70 hover:opacity-100 rounded-sm"
                    aria-label="Close modal"
                >
                    <X size={15} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
};
