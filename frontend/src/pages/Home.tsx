import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Config as ConfigType, QueryResponse, InternalCandidate, AnalysisCandidate } from '../types';
import { BrainCircuit, Settings, FileText, Download, Eye, Sparkles, Filter, User, RotateCcw } from 'lucide-react';
import { PdfViewer } from '../components/PdfViewer';

export const Home = () => {
    const navigate = useNavigate();
    const [config, setConfig] = useState<ConfigType | null>(null);
    const [jobDesc, setJobDesc] = useState('');
    const [results, setResults] = useState<QueryResponse | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<{ candidates: AnalysisCandidate[], summary: string } | null>(null);
    const [pdfPath, setPdfPath] = useState<string | null>(null);
    const [showOnlySuitable, setShowOnlySuitable] = useState(true);
    const [retryTimer, setRetryTimer] = useState<number | null>(null);
    const [searchCooldown, setSearchCooldown] = useState(false);

    useEffect(() => {
        if (retryTimer && retryTimer > 0) {
            const timeout = setTimeout(() => setRetryTimer(retryTimer - 1), 1000);
            return () => clearTimeout(timeout);
        } else if (retryTimer === 0) {
            setRetryTimer(null);
        }
    }, [retryTimer]);

    useEffect(() => {
        const saved = localStorage.getItem('snap_config');
        if (!saved) {
            navigate('/config');
        } else {
            const parsed = JSON.parse(saved);
            setConfig(parsed);
            if (parsed.filterContext) {
                handleQuery(parsed.filterContext, parsed.apiKey, parsed.maxChunks);
            }
        }
    }, [navigate]);

    const handleQuery = async (query: string, key: string, maxChunks?: number) => {
        try {
            const res = await api.query(query, key, maxChunks);
            setResults(res);
            setSearchCooldown(true);
            setTimeout(() => setSearchCooldown(false), 3000);
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
                config.analysisModel,
                config.maxChunks
            );
            setAnalysis(res.analysis);
        } catch (e: any) {
            const msg = e.message || String(e);
            if (msg.includes('RATE_LIMIT:')) {
                const match = msg.match(/RATE_LIMIT:(\d+)/);
                setRetryTimer(match ? parseInt(match[1]) : 60);
            } else {
                console.error(e);
                alert('Analysis failed');
            }
        } finally {
            setAnalyzing(false);
        }
    };

    const handleDownload = (path: string) => {
        window.open(`http://localhost:3200/download?path=${encodeURIComponent(path)}`, '_blank');
    };

    const candidates = results?.chunks.reduce((acc: InternalCandidate[], chunk) => {
        const source = chunk.payload.source;
        const fileName = source.split(/[\\/]/).pop() || source;

        if (!acc.find(c => c.source === source)) {
            const analysisInfo = analysis?.candidates?.find((c) =>
                c.source === source || c.source === fileName || source.endsWith(c.source)
            );

            acc.push({
                source,
                fileName,
                location: chunk.payload.source,
                score: chunk.score,
                analysis: analysisInfo
            });
        }
        return acc;
    }, []) || [];

    const filteredCandidates = showOnlySuitable && analysis?.candidates
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
                            disabled={analyzing || !results || retryTimer !== null || searchCooldown}
                            className="w-full bg-[#0f172a] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-200"
                        >
                            {analyzing ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : searchCooldown ? (
                                <div className="flex items-center gap-2">
                                    <RotateCcw size={18} className="animate-spin-slow text-blue-400" />
                                    <span>Syncing...</span>
                                </div>
                            ) : (
                                <BrainCircuit size={18} className="text-blue-400" />
                            )}
                            {searchCooldown ? "" : "Perform Deep Analysis"}
                        </button>
                    </section>

                    {retryTimer !== null && (
                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3 text-orange-700 animate-pulse">
                            <RotateCcw size={18} className="animate-spin-slow" />
                            <div className="text-xs font-bold">
                                Quota Exceeded. Please retry in <span className="text-sm font-black underline">{retryTimer}s</span>
                            </div>
                        </div>
                    )}

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
                                <span>Showing <strong>{filteredCandidates.length}</strong> {showOnlySuitable ? 'Most Suitable' : 'Total'} Candidates</span>
                            ) : (
                                <span>Showing {candidates.length} Detected Profiles</span>
                            )}
                        </div>
                    </div>
                    {analysis?.candidates && (
                        <button
                            onClick={() => setShowOnlySuitable(!showOnlySuitable)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${showOnlySuitable ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                                }`}
                        >
                            <BrainCircuit size={14} /> {showOnlySuitable ? 'Viewing Suitable Only' : 'Show All Assessments'}
                        </button>
                    )}
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredCandidates.map((c, i) => (
                        <div key={i} className="group bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden">
                            {c.analysis?.suitable !== undefined && (
                                <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest ${c.analysis.suitable ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'
                                    } shadow-sm`}>
                                    {c.analysis.suitable ? 'Highly Suitable' : 'Secondary Match'}
                                </div>
                            )}

                            {c.analysis?.score && (
                                <div className="absolute top-10 right-8 w-14 h-14 rounded-full border-4 border-slate-50 flex items-center justify-center bg-white shadow-lg ring-4 ring-blue-50">
                                    <div className="text-center">
                                        <div className={`text-base font-black ${c.analysis.score > 80 ? 'text-green-600' : 'text-blue-600'}`}>
                                            {c.analysis.score}
                                        </div>
                                        <div className="text-[8px] font-bold text-slate-400 -mt-1 uppercase">MATCH</div>
                                    </div>
                                </div>
                            )}

                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-6 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner">
                                <User size={32} />
                            </div>

                            <h3 className="font-black text-xl text-slate-900 mb-2 truncate pr-16" title={c.source}>
                                {c.fileName}
                            </h3>

                            {c.analysis?.justification ? (
                                <div className="space-y-4 mb-8">
                                    <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 italic">
                                        "{c.analysis.justification}"
                                    </p>
                                    <div className="flex gap-2">
                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded-md border border-blue-100">Technical Match</span>
                                        <span className="px-2 py-1 bg-slate-50 text-slate-500 text-[9px] font-black uppercase rounded-md border border-slate-100">Phase 2 Analysis</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-slate-400 text-xs mb-8">
                                    <FileText size={14} />
                                    <span>Analysis Pending Deep Dive</span>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPdfPath(c.location)}
                                    className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <Eye size={16} /> View Profile
                                </button>
                                <button
                                    onClick={() => handleDownload(c.location)}
                                    className="px-5 bg-slate-100 text-slate-500 py-4 rounded-2xl hover:bg-slate-200 hover:text-slate-900 transition-all"
                                    title="Download PDF"
                                >
                                    <Download size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {pdfPath && (
                <PdfViewer
                    url={pdfPath.startsWith('http') ? pdfPath : `http://localhost:3200/file?path=${encodeURIComponent(pdfPath)}`}
                    onClose={() => setPdfPath(null)}
                />
            )}
        </div>
    );
};
