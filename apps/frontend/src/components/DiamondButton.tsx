import React from 'react';
import type { DiamondButtonProps } from '../interfaces';

export const DiamondButton: React.FC<DiamondButtonProps> = ({
    loading,
    loadingText,
    children,
    className = "",
    disabled,
    ...props
}) => {
    return (
        <button
            disabled={loading || disabled}
            className={`inline-flex items-center justify-center gap-2 transition-all disabled:pointer-events-none disabled:opacity-50 ${className}`}
            {...props}
        >
            {loading ? (
                <>
                    <div
                        className="loading-diamond"
                        aria-hidden="true"
                        style={{ backgroundColor: '#60a5fa' }}
                    />
                    {loadingText && <span>{loadingText}</span>}
                </>
            ) : (
                children
            )}
        </button>
    );
};
