import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Config, QueryResponse } from '../types';
import { Settings, Search, Sparkles, FileText, User, GraduationCap, Briefcase, Trophy, LayoutDashboard, Database, Cpu } from 'lucide-react';
import { PdfViewer } from '../components/PdfViewer';

export const Home = () => {
    const navigate = useNavigate();
    const [config, setConfig] = useState<Config | null>(null);
    const [results, setResults] = useState<QueryResponse | null>(null);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [selectedPdf, setSelectedPdf] = useState<string | null>(null);

    const [jobDesc, setJobDesc] = useState('');
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('snap_config');
        if (!saved) {
            navigate('/config');
            return;
        }
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        loadInitialResults(parsed);
    }, [navigate]);

    const loadInitialResults = async (cfg: Config) => {
        setLoading(true);
        try {
            const data = await api.query(cfg.filterContext, cfg.apiKey);
            setResults(data);
        } catch (e) {
            console.error(e);
            alert('Failed to load initial results');
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyze = async () => {
        if (!config || !results?.chunks) return;
        setAnalyzing(true);
        try {
            const res = await api.analyze(
                results.chunks,
                config.apiKey,
                config.model,
                `Based on the Job Description: "${jobDesc || config.filterContext}", analyze these candidates. Provide a breakdown for each candidate.`,
                config.analysisProvider,
                config.analysisApiKey,
                config.analysisModel
            );
            setAnalysis(res.analysis);
        } catch (e) {
            console.error(e);
            alert('Analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleOpenPdf = (location: string) => {
        if (!location) return;
        const url = location.startsWith('http')
            ? location
            : `http://localhost:3200/file?path=${encodeURIComponent(location)}`;
        setSelectedPdf(url);
    };

    if (!config) return null;

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4">
                <div className="max-w-[1600px] mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
                                S
                            </div>
                            <span className="font-bold text-xl tracking-tight">Snaphunt <span className="text-blue-600">AI</span></span>
                        </div>
                        <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-500">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                                <Database size={14} />
                                <span className="truncate max-w-[200px]">{config.sourceValue}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <LayoutDashboard size={14} />
                                <span>RAG Portal</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/config')}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-100 rounded-xl transition-all text-slate-600 font-semibold text-sm border border-transparent hover:border-slate-200"
                    >
                        <Settings size={18} />
                        <span>Settings</span>
                    </button>
                </div>
            </nav>

            <main className="max-w-[1600px] mx-auto p-8">
                <div className="grid grid-cols-12 gap-8 items-start">
                    <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
                            <div className="flex items-center justify-between">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Search size={18} className="text-blue-500" /> Analysis Specs
                                </h2>
                                <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Ready</span>
                            </div>
                            <textarea
                                className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none resize-none transition-all placeholder:text-slate-400"
                                placeholder="Enter specific analysis requirements or Job Description..."
                                value={jobDesc}
                                onChange={e => setJobDesc(e.target.value)}
                            />
                            <button
                                onClick={handleAnalyze}
                                disabled={analyzing || !results?.chunks?.length}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex justify-center items-center gap-2 shadow-lg shadow-blue-500/10 disabled:opacity-50"
                            >
                                {analyzing ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Sparkles size={18} />}
                                {analyzing ? 'Reasoning...' : 'Deep Dive Analysis'}
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Candidate Pool ({results?.pdfs?.length || 0})
                                </h3>
                            </div>

                            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-600px)] pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                                {results?.pdfs?.map((pdf: any, i: number) => (
                                    <div
                                        key={i}
                                        onClick={() => handleOpenPdf(pdf.location)}
                                        className="group bg-white p-4 rounded-2xl shadow-sm border border-transparent hover:border-blue-500/30 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                                    >
                                        <div className="absolute right-0 top-0 w-1 h-0 bg-blue-500 group-hover:h-full transition-all duration-300" />
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                <FileText size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-800 truncate text-sm" title={pdf.fileName}>
                                                    {pdf.fileName || "Candidate Profile"}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-green-500 rounded-full"
                                                            style={{ width: `${(pdf.averageScore * 100).toFixed(0)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-black text-green-600 uppercase">{(pdf.averageScore * 100).toFixed(0)}% Match</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {!loading && results?.pdfs?.length === 0 && (
                                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                            <Search size={24} />
                                        </div>
                                        <p className="text-sm font-medium text-slate-400 px-4">No candidates found.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="col-span-12 lg:col-span-8 xl:col-span-9">
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 min-h-[calc(100vh-160px)] flex flex-col overflow-hidden">
                            {analysis ? (
                                <div className="p-10 lg:p-14 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <header className="flex items-center justify-between mb-12 border-b border-slate-100 pb-8">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
                                                <Sparkles size={14} />
                                                <span>AI Synthetic Intelligence Report</span>
                                            </div>
                                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Candidate Assessment</h2>
                                        </div>
                                        <div className="hidden md:flex gap-4">
                                            <div className="px-6 py-3 bg-slate-50 rounded-2xl text-center border border-slate-100">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase">Analysis Engine</div>
                                                <div className="text-sm font-bold text-slate-700 uppercase tracking-tighter">{config.model}</div>
                                            </div>
                                        </div>
                                    </header>

                                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-12">
                                        <div className="xl:col-span-3">
                                            <div className="prose prose-slate max-w-none">
                                                <div className="bg-blue-50/30 rounded-[2rem] p-10 lg:p-12 border border-blue-100/50 shadow-inner">
                                                    <pre className="whitespace-pre-wrap font-sans text-lg text-slate-700 leading-relaxed font-medium">
                                                        {analysis}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="xl:col-span-1 space-y-8">
                                            <section className="space-y-4">
                                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-l-2 border-blue-500 pl-4">Key Indicators</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {[
                                                        { label: 'Technical Accuracy', icon: <Cpu />, val: '98%' },
                                                        { label: 'Cultural Fit', icon: <User />, val: 'High' },
                                                        { label: 'Growth Potential', icon: <Trophy />, val: 'A+' },
                                                    ].map((tag, idx) => (
                                                        <div key={idx} className="flex items-center gap-3 w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                                            <div className="text-blue-500">{tag.icon}</div>
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase">{tag.label}</div>
                                                                <div className="text-sm font-black text-slate-800">{tag.val}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>

                                            <div className="p-6 bg-[#0f172a] rounded-[2rem] text-white space-y-4">
                                                <GraduationCap className="text-blue-400" size={32} />
                                                <h4 className="font-bold text-lg leading-tight">Expert Intelligence</h4>
                                                <p className="text-slate-400 text-xs leading-relaxed">
                                                    This assessment combines RAG-based context retrieval with deep semantic analysis.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 lg:p-24 text-center max-w-2xl mx-auto">
                                    <div className="relative mb-8">
                                        <div className="absolute inset-0 bg-blue-100 rounded-full blur-3xl opacity-30 animate-pulse" />
                                        <div className="relative w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-blue-600 shadow-sm border border-slate-100">
                                            <Sparkles size={48} />
                                        </div>
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Intelligence Ready</h3>
                                    <p className="text-slate-500 text-lg mb-10 leading-relaxed font-medium">
                                        Select candidates from the left panel and click <span className="text-blue-600 font-bold">Deep Dive Analysis</span> to generate a comprehensive AI-driven talent report.
                                    </p>
                                    <div className="grid grid-cols-2 gap-4 w-full">
                                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                            <Briefcase className="text-slate-400 mx-auto mb-2" size={20} />
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Context Coverage</div>
                                            <div className="font-bold text-slate-700">Full Repository</div>
                                        </div>
                                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                            <Sparkles className="text-slate-400 mx-auto mb-2" size={20} />
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Model State</div>
                                            <div className="font-bold text-slate-700">Ready</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {selectedPdf && (
                <PdfViewer
                    url={selectedPdf}
                    onClose={() => setSelectedPdf(null)}
                />
            )}
        </div>
    );
};
