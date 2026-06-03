import React from 'react';
import { Sparkles, RotateCcw, BrainCircuit } from 'lucide-react';
import { formatJobDescriptionHeuristically } from '../utils/formatter';
import type { SidebarProps } from '../interfaces';

export const Sidebar: React.FC<SidebarProps> = ({
    jobDesc, 
    setJobDesc, 
    onRefresh, 
    onAnalyze,
    searchCooldown, 
    analyzing,
    hasResults, 
    retryTimer, 
    analysis,
    showToast
}) => {
    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        if (!pastedText) return;
        
        try {
            const formatted = formatJobDescriptionHeuristically(pastedText);
            setJobDesc(formatted);
            showToast('Job description automatically organized!', 'success');
        } catch (err) {
            console.error('Error formatting pasted text:', err);
            setJobDesc(pastedText);
        }
    };

    return (
        <aside className="w-full lg:w-[400px] border-l border-slate-200 bg-white flex flex-col h-full shadow-2xl z-20 overflow-y-auto shrink-0">
            <div className="p-8 space-y-10 flex-1">
                {/* Context & Tuning Section */}
                <section className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles size={12} className="text-amber-500" aria-hidden="true" /> Context Tuning
                            </h2>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setJobDesc('')}
                                    disabled={!jobDesc || analyzing}
                                    className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-widest flex items-center gap-1.5 transition-all disabled:opacity-30"
                                    title="Clear Job Description"
                                  >
                                    Clear
                                </button>
                                <button
                                    onClick={onRefresh}
                                    disabled={searchCooldown}
                                    className="text-[10px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest flex items-center gap-1.5 transition-all disabled:opacity-30 group"
                                >
                                    <RotateCcw size={11} className={`${searchCooldown ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                    Refresh Rank
                                </button>
                            </div>
                        </div>
                        <textarea
                            className="w-full h-48 px-5 py-4 bg-slate-50/50 border border-slate-200 rounded outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-400 transition-all text-xs leading-relaxed placeholder:text-slate-400 resize-none glass-input shadow-inner"
                            placeholder="Paste Job Description for deep alignment..."
                            value={jobDesc}
                            onChange={(e) => setJobDesc(e.target.value)}
                            onPaste={handlePaste}
                        />
                    </div>

                    <button
                        onClick={onAnalyze}
                        disabled={analyzing || !hasResults || retryTimer !== null || searchCooldown}
                        className="relative group inline-flex items-center justify-center w-full rounded text-xs font-bold uppercase tracking-widest transition-all disabled:pointer-events-none disabled:opacity-50 h-16 px-4 py-2 bg-slate-900 text-slate-50 hover:bg-slate-800 shadow-2xl shadow-slate-900/20 overflow-hidden"
                    >
                        <div className="flex items-center gap-2 relative z-10">
                            <BrainCircuit size={20} aria-hidden="true" />
                            <span>Perform Deep Analysis</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-white/10 to-blue-600/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    </button>
                </section>

                {/* Rate Limit Alert */}
                {retryTimer !== null && (
                    <div className="p-5 bg-rose-50 border border-rose-200 rounded flex items-center gap-4 text-rose-700 animate-pulse">
                        <RotateCcw size={20} className="animate-spin text-rose-500 flex-shrink-0" />
                        <div className="flex-1">
                            <div className="text-[10px] font-bold uppercase tracking-widest">Provider Throttling</div>
                            <div className="text-sm font-black">Retry allowed in {retryTimer}s</div>
                        </div>
                    </div>
                )}

                {/* Executive AI Summary */}
                {analysis?.summary && (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded animate-in fade-in zoom-in-95 duration-700 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full -mr-8 -mt-8" />
                        <div className="flex items-center gap-2 text-slate-900 font-black text-[10px] uppercase tracking-widest mb-4 relative z-10">
                            <div className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Sparkles size={12} className="text-amber-600" />
                            </div>
                            Executive Summary
                        </div>
                        <p className="text-[13px] text-slate-600 leading-relaxed italic relative z-10 pr-2">
                            {analysis.summary}
                        </p>
                    </div>
                )}
            </div>
        </aside>
    );
};
