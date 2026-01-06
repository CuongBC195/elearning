"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";

// Toast types
type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    showToast: (type: ToastType, message: string, duration?: number) => void;
    showConfirm: (message: string, onConfirm: () => void, onCancel?: () => void) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

interface ToastProviderProps {
    children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirmModal, setConfirmModal] = useState<{
        message: string;
        onConfirm: () => void;
        onCancel?: () => void;
    } | null>(null);

    const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
        const id = Date.now().toString();
        setToasts((prev) => [...prev, { id, type, message, duration }]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
    }, []);

    const showConfirm = useCallback((message: string, onConfirm: () => void, onCancel?: () => void) => {
        setConfirmModal({ message, onConfirm, onCancel });
    }, []);

    const handleConfirm = () => {
        confirmModal?.onConfirm();
        setConfirmModal(null);
    };

    const handleCancel = () => {
        confirmModal?.onCancel?.();
        setConfirmModal(null);
    };

    const getToastStyles = (type: ToastType) => {
        switch (type) {
            case "success":
                return "bg-green-600/90 border-green-500";
            case "error":
                return "bg-red-600/90 border-red-500";
            case "warning":
                return "bg-amber-600/90 border-amber-500";
            case "info":
                return "bg-blue-600/90 border-blue-500";
        }
    };

    const getToastIcon = (type: ToastType) => {
        switch (type) {
            case "success":
                return "check_circle";
            case "error":
                return "error";
            case "warning":
                return "warning";
            case "info":
                return "info";
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, showConfirm }}>
            {children}

            {/* Toast container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg text-white animate-slide-in ${getToastStyles(toast.type)}`}
                    >
                        <span className="material-symbols-outlined text-xl">
                            {getToastIcon(toast.type)}
                        </span>
                        <span className="text-sm font-medium">{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Confirm modal */}
            {confirmModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
                    <div className="bg-panel-dark rounded-2xl p-6 max-w-sm w-full border border-gray-700 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-amber-600/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-400">help</span>
                            </div>
                            <h3 className="text-lg font-semibold text-text-light">Xác nhận</h3>
                        </div>
                        <p className="text-gray-300 mb-6">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleCancel}
                                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Slide-in animation */}
            <style jsx global>{`
                @keyframes slide-in {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                .animate-slide-in {
                    animation: slide-in 0.3s ease-out;
                }
            `}</style>
        </ToastContext.Provider>
    );
}
