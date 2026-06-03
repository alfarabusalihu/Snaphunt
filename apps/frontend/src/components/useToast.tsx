import { useState } from 'react';
import { Toast } from './Toast';
import type { ToastType } from '../interfaces';

export const useToast = () => {
    const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);

    const showToast = (message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const ToastContainer = () => (
        <div className="fixed bottom-0 right-0 p-6 z-[20000] flex flex-col gap-3 pointer-events-none">
            {toasts.map(toast => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                />
            ))}
        </div>
    );

    return { showToast, ToastContainer };
};
