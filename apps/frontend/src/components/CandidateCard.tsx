import React, { useState } from 'react';
import { FileText, X, User, Download, Star } from 'lucide-react';
import type { CandidateCardProps } from '../interfaces';

export const CandidateCard: React.FC<CandidateCardProps> = ({ 
    file, 
    onRemove, 
    isRemovable, 
    onView, 
    onDownload, 
    variant = 'summary',
    isStarred = false,
    onStar,
    analysisDone = false
}) => {
    const [starred, setStarred] = useState(isStarred);
    const [starrring, setStarring] = useState(false);

    const handleStar = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onStar || !location || starrring) return;
        setStarring(true);
        const next = !starred;
        setStarred(next);
        try {
            await onStar(location, next);
        } catch {
            setStarred(!next); // revert on error
        } finally {
            setStarring(false);
        }
    };
    // Safe property accessors
    const fileName = file.fileName;
    const location = file.location;
    const size = 'size' in file ? file.size : undefined;
    const status = 'status' in file ? file.status : undefined;
    const id = 'id' in file ? file.id : undefined;
    const analysis = 'analysis' in file ? file.analysis : undefined;

    const sizeMB = size ? (size / (1024 * 1024)).toFixed(2) : null;
    const isDetailed = variant === 'detailed';

    if (isDetailed) {
        return (
            <div
                onClick={() => onView && location && onView(location)}
                className="group bg-white rounded-md p-4 border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden cursor-pointer flex flex-col gap-3"
            >
                {/* Suitable badge */}
                {analysis?.suitable !== undefined && (
                    <div className={`absolute top-0 right-0 px-2.5 py-1 rounded-bl-md text-[9px] font-black uppercase tracking-widest ${
                        analysis.suitable ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                        {analysis.suitable ? 'Suitable' : 'Secondary'}
                    </div>
                )}

                {/* Top row — avatar + score */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-50 rounded-md flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shrink-0 shadow-inner">
                        <User size={18} aria-hidden="true" />
                    </div>
                    {analysis?.score !== undefined && (
                        <div className="ml-auto flex items-center gap-1">
                            <span className={`text-sm font-black ${analysis.score > 80 ? 'text-green-600' : 'text-blue-600'}`}>
                                {analysis.score}
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">match</span>
                        </div>
                    )}
                </div>

                {/* Filename — full, wrapping */}
                <h3 className="font-black text-[11px] text-slate-900 leading-snug break-words" title={fileName}>
                    {fileName}
                </h3>

                {/* Justification or pending */}
                {analysis?.justification ? (
                    <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2 italic flex-1">
                        "{analysis.justification}"
                    </p>
                ) : (
                    <div className="flex items-center gap-2 text-slate-400 text-[11px] flex-1">
                        <FileText size={12} aria-hidden="true" />
                        <span>Pending deep analysis</span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-1.5 mt-auto">
                    {analysisDone && onStar && location && (
                        <button
                            onClick={handleStar}
                            disabled={starrring}
                            className={`p-2 rounded transition-all border ${
                                starred
                                    ? 'bg-amber-50 border-amber-200 text-amber-500 hover:bg-amber-100'
                                    : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                            }`}
                            title={starred ? 'Unstar CV' : 'Star CV'}
                            aria-label={starred ? `Unstar ${fileName}` : `Star ${fileName}`}
                        >
                            <Star size={13} fill={starred ? 'currentColor' : 'none'} aria-hidden="true" />
                        </button>
                    )}
                    {onDownload && location && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDownload(location); }}
                            className="flex-1 bg-slate-50 border border-slate-100 text-slate-500 py-2 rounded hover:bg-slate-100 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5 font-bold text-[10px] uppercase tracking-widest"
                            aria-label={`Download ${fileName}`}
                        >
                            <Download size={12} aria-hidden="true" /> Download
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="group bg-white p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all relative overflow-hidden ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-50 rounded-md border border-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-slate-100 transition-colors">
                    <FileText size={18} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate text-[13px] tracking-tight" title={fileName}>
                        {fileName}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                        {sizeMB && <span className="text-[10px] text-slate-500 font-medium">{sizeMB} MB</span>}
                        {status && (
                            <span className={`text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-md border ${
                                status === 'indexed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                status === 'duplicate' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                                {status}
                            </span>
                        )}
                    </div>
                </div>
                {isRemovable && onRemove && id && (
                    <button
                        onClick={() => onRemove(id)}
                        className="p-1.5 hover:bg-slate-100 hover:text-slate-900 rounded-md text-slate-400 transition-colors"
                        aria-label={`Remove ${fileName}`}
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                )}
            </div>
        </div>
    );
};
