import { FileText, X, User, Eye, Download } from 'lucide-react';

interface CandidateCardProps {
    file: {
        id?: string;
        fileName: string;
        size?: number;
        status?: 'indexed' | 'new' | 'duplicate';
        source?: string;
        location?: string;
        score?: number;
        analysis?: {
            suitable?: boolean;
            score?: number;
            justification?: string;
        };
    };
    onRemove?: (id: string) => void;
    isRemovable?: boolean;
    onView?: (location: string) => void;
    onDownload?: (location: string) => void;
    variant?: 'summary' | 'detailed';
}

export const CandidateCard = ({ file, onRemove, isRemovable, onView, onDownload, variant = 'summary' }: CandidateCardProps) => {
    const sizeMB = file.size ? (file.size / (1024 * 1024)).toFixed(2) : null;
    const isDetailed = variant === 'detailed';

    if (isDetailed) {
        return (
            <div className="group bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden">
                {file.analysis?.suitable !== undefined && (
                    <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest ${file.analysis.suitable ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'
                        } shadow-sm`}>
                        {file.analysis.suitable ? 'Highly Suitable' : 'Secondary Match'}
                    </div>
                )}

                {file.analysis?.score !== undefined && (
                    <div className="absolute top-10 right-8 w-14 h-14 rounded-full border-4 border-slate-50 flex items-center justify-center bg-white shadow-lg ring-4 ring-blue-50">
                        <div className="text-center">
                            <div className={`text-base font-black ${file.analysis.score > 80 ? 'text-green-600' : 'text-blue-600'}`}>
                                {file.analysis.score}
                            </div>
                            <div className="text-[8px] font-bold text-slate-400 -mt-1 uppercase">MATCH</div>
                        </div>
                    </div>
                )}

                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-6 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner">
                    <User size={32} aria-hidden="true" />
                </div>

                <h3 className="font-black text-xl text-slate-900 mb-2 truncate pr-16" title={file.source || file.fileName}>
                    {file.fileName}
                </h3>

                {file.analysis?.justification ? (
                    <div className="space-y-4 mb-8">
                        <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 italic">
                            "{file.analysis.justification}"
                        </p>
                        <div className="flex gap-2">
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded-md border border-blue-100">Technical Match</span>
                            <span className="px-2 py-1 bg-slate-50 text-slate-500 text-[9px] font-black uppercase rounded-md border border-slate-100">Phase 2 Analysis</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 text-slate-400 text-xs mb-8">
                        <FileText size={14} aria-hidden="true" />
                        <span>Analysis Pending Deep Dive</span>
                    </div>
                )}

                <div className="flex gap-2">
                    {onView && file.location && (
                        <button
                            onClick={() => onView(file.location!)}
                            className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center gap-2"
                        >
                            <Eye size={16} aria-hidden="true" /> View Profile
                        </button>
                    )}
                    {onDownload && file.location && (
                        <button
                            onClick={() => onDownload(file.location!)}
                            className="px-5 bg-slate-100 text-slate-500 py-4 rounded-2xl hover:bg-slate-200 hover:text-slate-900 transition-all"
                            title="Download PDF"
                            aria-label={`Download ${file.fileName}`}
                        >
                            <Download size={18} aria-hidden="true" />
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
                    <h4 className="font-semibold text-slate-900 truncate text-[13px] tracking-tight" title={file.fileName}>
                        {file.fileName}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                        {sizeMB && <span className="text-[10px] text-slate-500 font-medium">{sizeMB} MB</span>}
                        {file.status && (
                            <span className={`text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-md border ${file.status === 'indexed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                file.status === 'duplicate' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                    'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>
                                {file.status}
                            </span>
                        )}
                    </div>
                </div>
                {isRemovable && onRemove && file.id && (
                    <button
                        onClick={() => onRemove(file.id!)}
                        className="p-1.5 hover:bg-slate-100 hover:text-slate-900 rounded-md text-slate-400 transition-colors"
                        aria-label={`Remove ${file.fileName}`}
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                )}
            </div>
        </div>
    );
};
