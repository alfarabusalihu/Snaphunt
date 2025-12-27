import { X, ExternalLink } from 'lucide-react';

interface PdfViewerProps {
    url: string;
    onClose: () => void;
}

export const PdfViewer = ({ url, onClose }: PdfViewerProps) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            <div className="relative w-full max-w-6xl h-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                            <ExternalLink size={18} />
                        </div>
                        <h3 className="font-bold text-slate-800 truncate max-w-[300px] md:max-w-md">
                            Resume Viewer
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors group"
                    >
                        <X size={20} className="text-slate-400 group-hover:text-slate-600" />
                    </button>
                </div>
                <div className="flex-1 bg-slate-50 relative">
                    <iframe
                        src={url}
                        className="w-full h-full border-none"
                        title="PDF Viewer"
                    />
                </div>
            </div>
        </div>
    );
};
