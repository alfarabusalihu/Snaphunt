import React from 'react';
import type { DiamondLoaderProps } from '../interfaces';

export const DiamondLoader: React.FC<DiamondLoaderProps> = ({ 
  size = 'md', 
  label, 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Outer Glow Ring */}
        <div className={`absolute rounded-full bg-blue-500/10 blur-xl animate-pulse ${
          size === 'lg' ? 'w-16 h-16' : size === 'md' ? 'w-10 h-10' : 'w-6 h-6'
        }`} />
        
        {/* The Diamond */}
        <div className={`loading-diamond ${sizeClasses[size]}`} />
      </div>
      
      {label && (
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
};
