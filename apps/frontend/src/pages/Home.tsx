import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import type { InternalCandidate } from '../types';
import { PdfViewer } from '../components/PdfViewer';
import { useToast } from '../components/useToast';
import { Modal } from '../components/Modal';

// Components
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { AnalysisOverlay } from '../components/AnalysisOverlay';
import { CandidateGrid } from '../components/CandidateGrid';
import { Config } from './Config';

// State Management
import { useAppStore } from '../store/useStore';
import { AuthModal } from './AuthPage';

// ── Universal Timer Hook ──────────────────────────────────────────────────────
function useTimer(active: boolean) {
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startRef = useRef<number>(0);

    useEffect(() => {
        if (!active) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }
        startRef.current = Date.now();
        intervalRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [active]);

    const fmt = (s: number) => {
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const sec = (s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    return fmt(elapsed);
}

export const Home = () => {
    const { 
        config,
        results, setResults,
        analysis, setAnalysis,
        ingestStats,
        ingestTime,
        analysisTime, setAnalysisTime,
        hasAnalyzed, setHasAnalyzed,
        reset
    } = useAppStore();

    const [jobDesc, setJobDesc] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [pdfPath, setPdfPath] = useState<string | null>(null);
    const [showOnlySuitable, setShowOnlySuitable] = useState(false);
    const [showConfigOverlay, setShowConfigOverlay] = useState(false);
    const [retryTimer, setRetryTimer] = useState<number | null>(null);
    const [searchCooldown, setSearchCooldown] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
    const [showAuthModal, setShowAuthModal] = useState(false);
    
    const { showToast, ToastContainer } = useToast();
    const analysisTimer = useTimer(analyzing);

    const user = useAppStore(state => state.user);
    const logout = useAppStore(state => state.clearAuth);

    const handleLogout = () => {
        logout();
        window.location.reload();
    };

    // Initial check for config and clean up stale state
    useEffect(() => {
        if (!config) {
            setShowConfigOverlay(true);
        } else {
            // Clean up stale state from interrupted sessions
            // If we have config but no results, we're in an incomplete state
            if (!results) {
                // Clear analysis state since we have no results to analyze
                setAnalysis(null);
                setHasAnalyzed(false);
                setAnalysisTime(null);
            }
            // If we have analysis but analyzing flag would be false on reload,
            // and we have results but no hasAnalyzed, it means analysis was interrupted
            else if (results && !hasAnalyzed && analysis) {
                // Clear incomplete analysis
                setAnalysis(null);
            }
        }
    }, [config, results, hasAnalyzed, analysis, setAnalysis, setHasAnalyzed, setAnalysisTime]);

    // Load persisted starred locations on mount
    useEffect(() => {
        api.getStarredLocations()
            .then(res => setStarredIds(new Set(res.locations)))
            .catch(() => {}); // non-critical, silently ignore
    }, []);

    useEffect(() => {
        if (retryTimer && retryTimer > 0) {
            const timeout = setTimeout(() => setRetryTimer(retryTimer - 1), 1000);
            return () => clearTimeout(timeout);
        } else if (retryTimer === 0) {
            setRetryTimer(null);
        }
    }, [retryTimer]);

    const handleQuery = async (query: string, key: string, maxChunks?: number) => {
        if (!query || !key) return;
        setSearchCooldown(true);
        try {
            const res = await api.query(query, key, maxChunks, []);
            setResults(res);
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
        setAnalyzing(true);
        const startTime = Date.now();
        try {
            const res = await api.analyze(
                results.chunks,
                config.apiKey,
                config.model,
                jobDesc || config.filterContext,
                config.tier,
                undefined,
                config.maxChunks,
                config.provider,
                [] // Keywords removed
            );
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            setAnalysisTime(duration);
            setAnalysis(res.analysis);
            setHasAnalyzed(true);
            setShowOnlySuitable(true);
        } catch (err: unknown) {
            const fullMsg = err instanceof Error ? err.message : String(err);
            if (fullMsg.includes('RATE_LIMIT:')) {
                const match = fullMsg.match(/RATE_LIMIT:(\d+)/);
                const seconds = match ? parseInt(match[1]) : 60;
                setRetryTimer(seconds);
            } else {
                showToast(`Deep Analysis failed: ${fullMsg.substring(0, 50)}`, 'error');
            }
        } finally {
            setAnalyzing(false);
        }
    };

    const handleDownload = (path: string) => {
        const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3400';
        window.open(`${base}/download?path=${encodeURIComponent(path)}`, '_blank');
    };

    const handleStar = async (location: string, starred: boolean) => {
        const token = useAppStore.getState().token;
        if (!token) {
            showToast('Please Sign In to star candidates', 'error');
            setShowAuthModal(true);
            throw new Error('Unauthorized');
        }
        try {
            if (starred) {
                await api.starDocument(location);
                setStarredIds(prev => new Set([...prev, location]));
            } else {
                await api.unstarDocument(location);
                setStarredIds(prev => { const s = new Set(prev); s.delete(location); return s; });
            }
        } catch (e) {
            showToast('Failed to update starred status', 'error');
            throw e;
        }
    };

    const handleResetVector = async () => {
        setIsResetting(true);
        setShowResetModal(false);
        try {
            await api.reset();
            reset();
            setJobDesc('');
            setShowConfigOverlay(true);
            showToast('Vector index purged successfully.', 'success');
        } catch {
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

    const hasResults = candidates.length > 0;
    const isOverlayVisible = showConfigOverlay || analyzing;

    return (
        <div className="h-screen flex flex-col overflow-hidden relative">
            {/* Background Layer */}
            <div className={`flex flex-col h-full transition-all duration-500 ${isOverlayVisible ? 'blur-2xl scale-[0.98] pointer-events-none grayscale opacity-30' : ''}`}>
                <Header 
                    user={user}
                    onLogout={handleLogout}
                    onLoginClick={() => setShowAuthModal(true)}
                />

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    <CandidateGrid 
                        hasResults={hasResults}
                        analysisDone={hasAnalyzed}
                        candidates={filteredCandidates}
                        showOnlySuitable={showOnlySuitable}
                        setShowOnlySuitable={setShowOnlySuitable}
                        onView={setPdfPath}
                        onDownload={handleDownload}
                        ingestStats={ingestStats}
                        ingestTime={ingestTime}
                        analysisTime={analysisTime}
                        starredIds={starredIds}
                        onStar={handleStar}
                        onConfigure={() => setShowConfigOverlay(true)}
                        onClearRecords={() => setShowResetModal(true)}
                        isResetting={isResetting}
                    />

                    <Sidebar 
                        jobDesc={jobDesc}
                        setJobDesc={setJobDesc}
                        onRefresh={() => config && handleQuery(jobDesc || config.filterContext, config.apiKey, config.maxChunks)}
                        onAnalyze={handleAnalyze}
                        searchCooldown={searchCooldown}
                        analyzing={analyzing}
                        hasResults={hasResults}
                        retryTimer={retryTimer}
                        analysis={analysis}
                        showToast={showToast}
                    />
                </div>
            </div>

            {/* Overlays */}
            {showConfigOverlay && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-md animate-in fade-in duration-300">
                    <Config 
                        onComplete={() => setShowConfigOverlay(false)} 
                        onCancel={config ? () => setShowConfigOverlay(false) : undefined}
                    />
                </div>
            )}

            <AnalysisOverlay analyzing={analyzing} timer={analysisTimer} />

            {pdfPath && (
                <PdfViewer
                    url={pdfPath.startsWith('http') ? pdfPath : `${import.meta.env.VITE_API_URL ?? 'http://localhost:3400'}/file?path=${encodeURIComponent(pdfPath)}`}
                    onClose={() => setPdfPath(null)}
                />
            )}

            {showAuthModal && (
                <AuthModal 
                    onClose={() => setShowAuthModal(false)} 
                    onSuccess={() => {
                        setShowAuthModal(false);
                        window.location.reload();
                    }}
                />
            )}

            <Modal
                isOpen={showResetModal}
                title="Purge Vector Index"
                description="This will delete all embedded document chunks from the search database. You will need to re-configure to access the system. Proceed?"
                confirmText="Purge Now"
                variant="danger"
                onConfirm={handleResetVector}
                onCancel={() => setShowResetModal(false)}
            />

            <ToastContainer />
        </div>
    );
};
