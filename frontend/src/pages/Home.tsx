import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import type { Config as ConfigType, QueryResponse, InternalCandidate, AnalysisCandidate } from '../types';
import { BrainCircuit, Settings, Sparkles, Filter, RotateCcw, Trash2 } from 'lucide-react';
import { PdfViewer } from '../components/PdfViewer';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { CandidateCard } from '../components/CandidateCard';
import { getProviderByKey } from '../utils/provider';

export const Home = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [config, setConfig] = useState<ConfigType | null>(null);
    const [jobDesc, setJobDesc] = useState('');
    const [results, setResults] = useState<QueryResponse | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<{ candidates: AnalysisCandidate[], summary: string } | null>(null);
    const [pdfPath, setPdfPath] = useState<string | null>(null);
    const [showOnlySuitable, setShowOnlySuitable] = useState(true);
    const [retryTimer, setRetryTimer] = useState<number | null>(() => {
        const saved = localStorage.getItem('snap_retry_timer');
        const savedTime = localStorage.getItem('snap_retry_timestamp');
        if (saved && savedTime) {
            const elapsed = Math.floor((Date.now() - parseInt(savedTime)) / 1000);
            const remaining = parseInt(saved) - elapsed;
            return remaining > 0 ? remaining : null;
        }
        return null;
    });

    const [searchCooldown, setSearchCooldown] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const { showToast, ToastContainer } = useToast();

    useEffect(() => {
        if (retryTimer !== null) {
            localStorage.setItem('snap_retry_timer', retryTimer.toString());
            localStorage.setItem('snap_retry_timestamp', Date.now().toString());
        } else {
            localStorage.removeItem('snap_retry_timer');
            localStorage.removeItem('snap_retry_timestamp');
        }
    }, [retryTimer]);

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
            if (!parsed.provider) {
                parsed.provider = getProviderByKey(parsed.apiKey) || 'google';
            }
            setConfig(parsed);

            if (location.state?.initialResults) {
                setResults(location.state.initialResults);
            } else {
                const lastResults = localStorage.getItem('snap_last_results');
                if (lastResults) {
                    setResults(JSON.parse(lastResults));
                }
            }
        }
    }, [navigate, location.state]);

    const handleQuery = async (query: string, key: string, maxChunks?: number) => {
        if (!query || !key) return;
        setSearchCooldown(true);
        try {
            const res = await api.query(query, key, maxChunks);
            setResults(res);
            localStorage.setItem('snap_last_results', JSON.stringify(res));
            showToast('Ranking updated successfully', 'success');
        } catch (e) {
            console.error(e);
            showToast('Failed to refresh ranking', 'error');
        } finally {
            setTimeout(() => setSearchCooldown(false), 2000);
        }
    };

    const handleAnalyze = async () => {
        if (!config || !results?.chunks || analyzing || retryTimer !== null) return;
        const now = new Date().toISOString();
        setAnalyzing(true);
        console.log("🛠️ [Home] Triggering Analysis with config:", config);
        try {
            const res = await api.analyze(
                results.chunks,
                config.apiKey,
                config.model,
                jobDesc || config.filterContext,
                config.tier,
                undefined,
                config.maxChunks,
                config.provider
            );
            setAnalysis(res.analysis);
        } catch (e: any) {
            const fullMsg = e.message || String(e);
            console.error(`❌ [Frontend] Analysis error:`, fullMsg);

            if (fullMsg.includes('RATE_LIMIT:')) {
                const match = fullMsg.match(/RATE_LIMIT:(\d+)/);
                const seconds = match ? parseInt(match[1]) : 60;
                console.log(`⏱️ [Frontend] Setting retry timer to ${seconds}s`);
                setRetryTimer(seconds);
            } else {
                console.error(`❌ [Frontend] Critical Analysis error:`, fullMsg);
                showToast(`Deep Analysis failed: ${fullMsg.substring(0, 50)}${fullMsg.length > 50 ? '...' : ''}`, 'error');
            }
        } finally {
            setAnalyzing(false);
        }
    };

    const handleDownload = (path: string) => {
        window.open(`http://localhost:3400/download?path=${encodeURIComponent(path)}`, '_blank');
    };

    const handleResetVector = async () => {
        setIsResetting(true);
        setShowResetModal(false);
        try {
            await api.reset();
            setResults(null);
            setAnalysis(null);
            localStorage.removeItem('snap_last_results');
            showToast('Vector index purged successfully.', 'success');
        } catch (e) {
            showToast('Failed to reset vector index.', 'error');
        } finally {
            setIsResetting(false);
        }
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
        <div className="min-h-screen bg-slate-50/50 flex flex-col lg:flex-row">
            <div className="w-full lg:w-[420px] border-r border-slate-200 bg-white flex flex-col h-auto lg:h-screen lg:sticky lg:top-0">
                <header className="h-16 px-6 border-b border-slate-200 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center text-white font-bold text-xs ring-1 ring-slate-950" aria-hidden="true">S</div>
                        <h1 className="font-bold text-slate-900 tracking-tight text-sm uppercase">Snaphunt</h1>
                    </div>
                    <button
                        onClick={() => navigate('/config')}
                        className="p-2 hover:bg-slate-100 rounded-md text-slate-500 transition-colors border border-transparent hover:border-slate-200"
                        aria-label="System Settings"
                    >
                        <Settings size={16} aria-hidden="true" />
                    </button>
                </header>

                <div className="p-6 space-y-8 flex-1 overflow-y-auto">
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Filter size={13} aria-hidden="true" /> Context
                            </h2>
                            <button
                                onClick={() => config && handleQuery(jobDesc || config.filterContext, config.apiKey, config.maxChunks)}
                                disabled={searchCooldown || !config}
                                className="text-[10px] font-medium text-slate-600 hover:text-slate-900 uppercase tracking-tight flex items-center gap-1.5 transition-all disabled:opacity-30"
                                aria-label="Refresh ranking"
                            >
                                <RotateCcw size={11} className={searchCooldown ? 'animate-spin' : ''} aria-hidden="true" />
                                Refresh
                            </button>
                        </div>
                        <textarea
                            className="w-full h-40 px-4 py-3 bg-white border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-slate-950/5 focus:border-slate-400 transition-all text-sm leading-relaxed placeholder:text-slate-400 resize-none shadow-sm"
                            placeholder="Insert Job Description or specific filters here..."
                            value={jobDesc}
                            onChange={(e) => setJobDesc(e.target.value)}
                            aria-label="Job description or filter context"
                        />
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing || !results || retryTimer !== null || searchCooldown}
                            className="inline-flex items-center justify-center w-full rounded-md text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-11 px-4 py-2 bg-slate-900 text-slate-50 hover:bg-slate-800 shadow-sm gap-2"
                        >
                            {analyzing ? (
                                <div className="w-3 h-3 border-2 border-slate-50/30 border-t-slate-50 rounded-full animate-spin" aria-hidden="true" />
                            ) : searchCooldown ? (
                                <RotateCcw size={15} className="animate-spin" aria-hidden="true" />
                            ) : (
                                <BrainCircuit size={15} aria-hidden="true" />
                            )}
                            Perform Deep Analysis
                        </button>
                    </section>

                    {retryTimer !== null && (
                        <div role="alert" className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-4 text-rose-700 animate-in fade-in slide-in-from-top-2">
                            <RotateCcw size={20} className="animate-spin-slow text-rose-500 flex-shrink-0" aria-hidden="true" />
                            <div className="flex-1">
                                <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5">Quota Limit</div>
                                <div className="text-sm font-semibold tracking-tight">
                                    Retry in <span className="font-bold underline">{retryTimer}s</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {analysis && (
                        <div className="p-5 bg-slate-50/50 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs mb-2">
                                <Sparkles size={14} className="text-amber-500" aria-hidden="true" /> AI Insights
                            </div>
                            <p className="text-[13px] text-slate-600 leading-relaxed font-normal">
                                {typeof analysis === 'string' ? analysis : analysis.summary}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <main className="flex-1 p-6 md:p-12 overflow-y-auto">
                <header className="mb-12 flex justify-between items-start">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 mb-2">Talent Pool</h2>
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Filter size={14} aria-hidden="true" />
                            {analysis?.candidates ? (
                                <span>Showing <strong>{filteredCandidates.length}</strong> {showOnlySuitable ? 'Most Suitable' : 'Total'} Candidates</span>
                            ) : (
                                <span>Showing {candidates.length} Detected Profiles</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowResetModal(true)}
                            disabled={isResetting}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-rose-100 hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50"
                            title="Reset Vector Index"
                            aria-label="Purge Vector Index"
                        >
                            {isResetting ? (
                                <RotateCcw size={12} className="animate-spin" aria-hidden="true" />
                            ) : (
                                <Trash2 size={12} aria-hidden="true" />
                            )}
                            Purge Index
                        </button>
                        {analysis?.candidates && (
                            <button
                                onClick={() => setShowOnlySuitable(!showOnlySuitable)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${showOnlySuitable ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                aria-pressed={showOnlySuitable}
                            >
                                <BrainCircuit size={14} aria-hidden="true" /> {showOnlySuitable ? 'Suitable Only' : 'Show All'}
                            </button>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredCandidates.map((c, i) => (
                        <CandidateCard
                            key={i}
                            file={c}
                            variant="detailed"
                            onView={setPdfPath}
                            onDownload={handleDownload}
                        />
                    ))}
                </div>
            </main>

            {pdfPath && (
                <PdfViewer
                    url={pdfPath.startsWith('http') ? pdfPath : `http://localhost:3400/file?path=${encodeURIComponent(pdfPath)}`}
                    onClose={() => setPdfPath(null)}
                />
            )}

            <Modal
                isOpen={showResetModal}
                title="Purge Vector Index"
                description="This will delete all embedded document chunks from the search database. You will need to re-ingest your collections to perform analysis. History will be kept. Proceed?"
                confirmText="Purge Now"
                variant="danger"
                onConfirm={handleResetVector}
                onCancel={() => setShowResetModal(false)}
            />

            <ToastContainer />
        </div>
    );
};
