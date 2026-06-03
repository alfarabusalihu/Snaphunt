import React from 'react';
import { Filter, Clock, CheckCircle2, AlertCircle, Settings2, Trash2, RotateCcw } from 'lucide-react';
import { CandidateCard } from './CandidateCard';
import type { CandidateGridProps } from '../interfaces';

export const CandidateGrid: React.FC<CandidateGridProps> = ({
    hasResults, 
    analysisDone,
    candidates, 
    showOnlySuitable, 
    setShowOnlySuitable, 
    onView, 
    onDownload,
    ingestStats,
    ingestTime,
    analysisTime,
    starredIds,
    onStar,
    onConfigure,
    onClearRecords,
    isResetting,
}) => {
    return (
        <main className="flex-1 p-6 overflow-y-auto relative bg-transparent">
            {hasResults ? (
                <>
                    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Left — title + count */}
                        <div className="space-y-0.5">
                            <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase">
                                {analysisDone ? 'Analyzed Talent' : 'Qualified Talent'}
                            </h2>
                            <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                                <Filter size={11} className="text-blue-500" />
                                <span>Showing <strong>{candidates.length}</strong> {showOnlySuitable ? 'Top Picks' : 'Total Profiles'}</span>
                            </div>
                        </div>

                        {/* Right — stats + controls inline */}
                        <div className="flex items-center gap-4 flex-wrap">
                            {/* Ingest stats */}
                            {ingestStats && (
                                <div className="flex items-center gap-4 pr-4 border-r border-slate-100">
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={12} className="text-slate-400" />
                                        <div className="flex flex-col leading-none">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Time</span>
                                            <span className="text-[11px] font-black text-slate-900">{ingestTime}s</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <CheckCircle2 size={12} className="text-blue-500" />
                                        <div className="flex flex-col leading-none">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Qualified</span>
                                            <span className="text-[11px] font-black text-blue-600">{ingestStats.indexed + ingestStats.skipped}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <AlertCircle size={12} className="text-rose-500" />
                                        <div className="flex flex-col leading-none">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Rejected</span>
                                            <span className="text-[11px] font-black text-rose-600">{ingestStats.rejected}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Analysis stats */}
                            {analysisDone && (
                                <div className="flex items-center gap-4 pr-4 border-r border-slate-100 animate-in fade-in slide-in-from-left-2 duration-500">
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={12} className="text-amber-500" />
                                        <div className="flex flex-col leading-none">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Analysis</span>
                                            <span className="text-[11px] font-black text-slate-900">{analysisTime}s</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <CheckCircle2 size={12} className="text-emerald-500" />
                                        <div className="flex flex-col leading-none">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Suitable</span>
                                            <span className="text-[11px] font-black text-emerald-600">
                                                {candidates.filter(c => c.analysis?.suitable).length}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Suitable filter toggle */}
                            {analysisDone && (
                                <button
                                    onClick={() => setShowOnlySuitable(!showOnlySuitable)}
                                    className={`px-3.5 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all border ${
                                        showOnlySuitable 
                                        ? 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/20' 
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                                    }`}
                                >
                                    {showOnlySuitable ? 'Show All' : 'Suitable Only'}
                                </button>
                            )}

                            {/* Controls — inline with stats */}
                            <div className="flex items-center gap-1 pl-2 border-l border-slate-100">
                                <button
                                    onClick={onConfigure}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200 text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    <Settings2 size={12} />
                                    Config
                                </button>
                                <button
                                    onClick={onClearRecords}
                                    disabled={isResetting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    {isResetting ? <RotateCcw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    Clear Records
                                </button>
                            </div>
                        </div>
                    </header>

                    {candidates.length > 0 ? (
                        <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                            {candidates.map((c, i) => (
                                <CandidateCard
                                    key={c.source || i}
                                    file={c}
                                    variant="detailed"
                                    analysisDone={analysisDone}
                                    isStarred={starredIds.has(c.source)}
                                    onStar={onStar}
                                    onView={(path) => onView(path)}
                                    onDownload={onDownload}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-md">
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No candidates match filters</p>
                        </div>
                    )}
                </>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-8 opacity-40">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 shadow-inner">
                        <Filter size={40} />
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Analysis Pending</h2>
                        <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
                            Ingest data first to see candidates here.
                        </p>
                    </div>
                </div>
            )}
        </main>
    );
};
