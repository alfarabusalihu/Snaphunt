import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Config as ConfigType, QueryResponse } from '../types';
import { BrainCircuit, Settings, FileText, Download, Eye, Sparkles, Filter, User } from 'lucide-react';
import { PdfViewer } from '../components/PdfViewer';

export const Home = () => {
    const navigate = useNavigate();
    const [config, setConfig] = useState<ConfigType | null>(null);
    const [jobDesc, setJobDesc] = useState('');
    const [results, setResults] = useState<QueryResponse | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<any>(null);
    const [pdfPath, setPdfPath] = useState<string | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('snap_config');
        if (!saved) {
            navigate('/config');
        } else {
            const parsed = JSON.parse(saved);
            setConfig(parsed);
            if (parsed.filterContext) {
                handleQuery(parsed.filterContext, parsed.apiKey);
            }
        }
    }, [navigate]);

    const handleQuery = async (query: string, key: string) => {
        try {
            const res = await api.query(query, key);
            setResults(res);
        } catch (e) {
            console.error(e);
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
                jobDesc || config.filterContext,
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

    const handleDownload = (path: string) => {
        window.open(`http://localhost:3200/download?path=${encodeURIComponent(path)}`, '_blank');
    };

    const candidates = results?.chunks.reduce((acc: any[], chunk: any) => {
        const source = chunk.payload.source;
        if (!acc.find(c => c.source === source)) {
            const analysisInfo = analysis?.candidates?.find((c: any) => c.source === source);
            acc.push({
                source,
                location: chunk.payload.location,
                score: chunk.score,
                analysis: analysisInfo
            });
        }
        return acc;
    }, []) || [];

    const suitableCandidates = analysis?.candidates
        ? candidates.filter(c => c.analysis?.suitable)
        : candidates;

    return (
        <div className="min-h-screen bg-[#f8fafc] flex">
            <div className="w-[450px] border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0">
                <header className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
                        <h1 className="font-black text-slate-800 tracking-tight">SNAPHUNT</h1>
                    </div>
                    <button
                        onClick={() => navigate('/config')}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                    >
                        <Settings size={18} />
                    </button>
                </header>

                <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Filter size={14} /> Requirement Context
                            </h3>
                        </div>
                        <textarea
                            className="w-full h-48 px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm leading-relaxed placeholder:text-slate-300 resize-none shadow-inner"
                            placeholder="Insert Job Description or specific filters here..."
                            value={jobDesc}
                            onChange={(e) => setJobDesc(e.target.value)}
                        />
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing || !results}
                            className="w-full bg-[#0f172a] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200"
                        >
                            {analyzing ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <BrainCircuit size={18} className="text-blue-400" />
                            )}
                            Perform Deep Analysis
                        </button>
                    </section>

                    {analysis && (
                        <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-2 text-blue-700 font-black text-xs uppercase tracking-wider mb-2">
                                <Sparkles size={14} /> Intelligence Summary
                            </div>
                            <p className="text-sm text-blue-900 leading-relaxed font-medium">
                                {typeof analysis === 'string' ? analysis : analysis.summary}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <main className="flex-1 p-12 overflow-y-auto">
                <header className="mb-12 flex justify-between items-end">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 mb-2">Talent Pool</h2>
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Filter size={14} />
                            {analysis?.candidates ? (
                                <span>Showing <strong>{suitableCandidates.length}</strong> Most Suitable Candidates</span>
                            ) : (
                                <span>Showing {candidates.length} Detected Profiles</span>
                            )}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {suitableCandidates.map((c: any, i) => (
                        <div key={i} className="group bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                            {c.analysis?.score && (
                                <div className="absolute top-6 right-6 w-12 h-12 rounded-full border-4 border-slate-50 flex items-center justify-center bg-white shadow-sm">
                                    <span className={`text-xs font-black ${c.analysis.score > 80 ? 'text-green-600' : 'text-slate-600'}`}>
                                        {c.analysis.score}%
                                    </span>
                                </div>
                            )}

                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                <User size={28} />
                            </div>

                            <h3 className="font-black text-xl text-slate-900 mb-2 truncate" title={c.source}>
                                {c.source.split('/').pop()}
                            </h3>

                            {c.analysis?.justification ? (
                                <p className="text-slate-500 text-sm leading-relaxed mb-8 line-clamp-3">
                                    {c.analysis.justification}
                                </p>
                            ) : (
                                <div className="flex items-center gap-3 text-slate-400 text-xs mb-8">
                                    <FileText size={14} />
                                    <span>Parsed from Vector Registry</span>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPdfPath(c.location)}
                                    className="flex-1 bg-slate-50 text-slate-900 py-3 rounded-xl font-bold text-xs hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Eye size={14} /> View CV
                                </button>
                                <button
                                    onClick={() => handleDownload(c.location)}
                                    className="px-4 bg-slate-50 text-slate-400 py-3 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-all"
                                    title="Download PDF"
                                >
                                    <Download size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {pdfPath && (
                <PdfViewer
                    url={`http://localhost:3200/file?path=${encodeURIComponent(pdfPath)}`}
                    onClose={() => setPdfPath(null)}
                />
            )}
        </div>
    );
};
