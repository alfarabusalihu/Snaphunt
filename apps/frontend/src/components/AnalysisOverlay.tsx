import React from 'react';
import type { AnalysisOverlayProps } from '../interfaces';

export const AnalysisOverlay: React.FC<AnalysisOverlayProps> = ({ analyzing, timer }) => {
    if (!analyzing) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xl" />
            <div className="relative flex flex-col items-center space-y-8">
                <div className="loading-diamond w-16 h-16 bg-slate-900 shadow-2xl shadow-slate-900/40" />
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Intelligence Reasoning</h3>
                    <div className="font-mono text-4xl font-black text-blue-600 tracking-tighter">
                        {timer}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] animate-pulse">Processing Candidate Context...</p>
                </div>
            </div>
        </div>
    );
};
