import { FileText, X } from 'lucide-react';

interface CandidateCardProps {
    file: {
        id: string;
        fileName: string;
        size?: number;
        status?: 'indexed' | 'new' | 'duplicate';
    };
    onRemove?: (id: string) => void;
    isRemovable?: boolean;
}

export const CandidateCard = ({ file, onRemove, isRemovable }: CandidateCardProps) => {
    const sizeMB = file.size ? (file.size / (1024 * 1024)).toFixed(2) : null;

    return (
        <div className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-500/30 hover:shadow-md transition-all relative overflow-hidden">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                    <FileText size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 truncate text-sm" title={file.fileName}>
                        {file.fileName}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                        {sizeMB && <span className="text-[10px] text-slate-400 font-medium">{sizeMB} MB</span>}
                        {file.status && (
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${file.status === 'indexed' ? 'bg-green-50 text-green-600' :
                                file.status === 'duplicate' ? 'bg-orange-50 text-orange-600' :
                                    'bg-blue-50 text-blue-600'
                                }`}>
                                {file.status}
                            </span>
                        )}
                    </div>
                </div>
                {isRemovable && onRemove && (
                    <button
                        onClick={() => onRemove(file.id)}
                        className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-300 transition-colors"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};
