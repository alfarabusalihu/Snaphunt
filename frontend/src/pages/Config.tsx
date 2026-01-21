import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Config as ConfigType, PreviewFile } from '../types';
import {
    FileText, ShieldCheck, Zap, X, Sparkles, ChevronRight,
    Search, Trash2, RotateCcw, History, Upload, Cpu,
    AlertCircle, CheckCircle2
} from 'lucide-react';
import { getProviderByKey } from '../utils/provider';
import { CandidateCard } from '../components/CandidateCard';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

export const Config = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<PreviewFile[]>([]);

    const [formData, setFormData] = useState<ConfigType>(() => {
        const saved = localStorage.getItem('snap_config');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Ensure provider is present for backward compatibility
                if (!parsed.provider) {
                    parsed.provider = getProviderByKey(parsed.apiKey) || 'google';
                }
                return parsed;
            } catch (e) {
                console.error("Failed to parse saved config", e);
            }
        }
        return {
            apiKey: localStorage.getItem('snap_master_key') || '',
            model: 'gemini-2.5-flash',
            tier: 'basic',
            sourceType: 'file',
            sourceValue: '',
            filterContext: '',
            provider: (localStorage.getItem('snap_provider') as any) || 'google',
            maxChunks: Number(localStorage.getItem('snap_max_chunks')) || 5
        };
    });


    const detectedProvider = getProviderByKey(formData.apiKey);
    const [pastSources, setPastSources] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
    const [previewErrorModal, setPreviewErrorModal] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: '' });
    const [deleteCollectionModal, setDeleteCollectionModal] = useState<{ isOpen: boolean, sourceId: string | null }>({ isOpen: false, sourceId: null });

    const { showToast, ToastContainer } = useToast();

    const hasConfig = !!localStorage.getItem('snap_config');

    const handlePreview = async () => {
        if (!formData.sourceValue) return;
        setPreviewLoading(true);
        try {
            const res = await api.preview(formData.sourceType, formData.sourceValue);
            setSelectedFiles(res.files);
            setStep(2);
        } catch (error) {
            console.error(error);
            setPreviewErrorModal({ isOpen: true, message: 'Failed to scan source. Check path and permissions.' });
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleRemoveFile = (id: string) => {
        setSelectedFiles(prev => prev.filter(f => f.id !== id));
    };

    const handleClearConfig = () => {
        setShowResetModal(false);
        localStorage.removeItem('snap_config');
        localStorage.removeItem('snap_master_key');
        localStorage.removeItem('snap_last_results');
        setFormData({
            apiKey: '',
            model: 'gemini-2.5-flash',
            provider: 'google',
            tier: 'basic',
            sourceType: 'file',
            sourceValue: '',
            filterContext: '',
            maxChunks: 5
        });
        setSelectedFiles([]);
        setStep(1);
        showToast('Configurations cleared.', 'success');
    };

    const handleFetchSources = async () => {
        try {
            const res = await api.getSources();
            setPastSources(res.sources);
            setShowHistory(true);
        } catch (e) {
            showToast('Failed to fetch history', 'error');
        }
    };

    const handleSelectCollection = async (source: any) => {
        setLoading(true);
        try {
            const res = await api.getSourceDocuments(source.id);
            const previewFiles = res.documents.map((d: any) => ({
                id: d.id,
                fileName: d.file_name,
                location: d.location,
                size: 0,
                checksum: d.checksum
            }));
            setSelectedFiles(previewFiles);
            setFormData(prev => ({ ...prev, sourceValue: source.value, sourceType: source.type }));
            setStep(2);
            setShowHistory(false);
            showToast(`Loaded collection: ${source.value}`, 'success');
        } catch (e) {
            showToast('Failed to load collection documents', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCollection = (e: React.MouseEvent, sourceId: string) => {
        e.stopPropagation();
        setDeleteCollectionModal({ isOpen: true, sourceId });
    };

    const confirmDeleteCollection = async () => {
        if (!deleteCollectionModal.sourceId) return;
        try {
            await api.deleteSource(deleteCollectionModal.sourceId);
            setPastSources(prev => prev.filter(s => s.id !== deleteCollectionModal.sourceId));
            showToast('Collection removed from history', 'success');
        } catch (e) {
            showToast('Failed to delete collection', 'error');
        } finally {
            setDeleteCollectionModal({ isOpen: false, sourceId: null });
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        const file = files[0];
        if (!file) return;

        setLoading(true);
        try {
            const { path: uploadedPath } = await api.uploadFile(file);
            setFormData(prev => ({ ...prev, sourceType: 'file', sourceValue: uploadedPath }));
            showToast(`Uploaded: ${file.name}`, 'success');

            const res = await api.preview('file', uploadedPath);
            setSelectedFiles(res.files);
            setStep(2);
        } catch (e) {
            showToast('Failed to process dropped file.', 'error');
        } finally {
            setLoading(false);
        }
    };



    useEffect(() => {
        if (formData.apiKey) {
            localStorage.setItem('snap_master_key', formData.apiKey);
        }
        if (formData.provider) {
            localStorage.setItem('snap_provider', formData.provider);
        }
    }, [formData.apiKey, formData.provider]);

    const handleBatchSync = async () => {
        if (selectedFiles.length === 0) return;
        setLoading(true);
        try {
            await api.reset();
            await api.ingest(formData, selectedFiles);
            localStorage.setItem('snap_max_chunks', String(formData.maxChunks));
            localStorage.setItem('snap_config', JSON.stringify(formData));
            showToast('Batch sync complete!', 'success');
            setTimeout(() => navigate('/'), 1000);
        } catch (error) {
            console.error(error);
            showToast('Batch sync failed.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.reset();
            await api.ingest(formData, selectedFiles);

            localStorage.setItem('snap_master_key', formData.apiKey);
            localStorage.setItem('snap_provider', formData.provider || 'google');
            localStorage.setItem('snap_max_chunks', String(formData.maxChunks));
            localStorage.setItem('snap_config', JSON.stringify(formData));

            const initialResults = await api.query(formData.filterContext, formData.apiKey, formData.maxChunks);
            localStorage.setItem('snap_last_results', JSON.stringify(initialResults));
            showToast('Configurations saved and synced!', 'success');
            setTimeout(() => navigate('/', { state: { initialResults } }), 1000);
        } catch (error: any) {
            console.error(error);
            const msg = error.message || String(error);
            if (msg.includes('RATE_LIMIT:')) {
                const match = msg.match(/RATE_LIMIT:(\d+)/);
                const seconds = match ? parseInt(match[1]) : 60;
                localStorage.setItem('snap_retry_timer', seconds.toString());
                localStorage.setItem('snap_retry_timestamp', Date.now().toString());
                showToast(`Config saved, but Gemini quota reached. Wait ${seconds}s to see results.`, 'error');
                setTimeout(() => navigate('/'), 1500);
            } else {
                showToast('Configuration failed.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-0 bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200 relative">
                {hasConfig && (
                    <button
                        onClick={() => {
                            const currentConfig = JSON.stringify(formData);
                            const savedConfig = localStorage.getItem('snap_config');
                            if (currentConfig !== savedConfig) {
                                setPendingAction(() => () => navigate('/'));
                                setShowCloseConfirm(true);
                            } else {
                                navigate('/');
                            }
                        }}
                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-900 transition-colors z-10 p-2 hover:bg-slate-50 rounded-md"
                        aria-label="Back to Talent Pool"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                )}

                <div className="md:col-span-4 bg-slate-900 p-8 text-slate-50 flex flex-col justify-between hidden md:flex">
                    <div>
                        <div className="flex items-center gap-2 mb-10">
                            <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center text-slate-900 font-bold text-lg ring-1 ring-white/20" aria-hidden="true">
                                S
                            </div>
                            <h2 className="text-sm font-bold tracking-tight uppercase">Snaphunt</h2>
                        </div>

                        <nav className="space-y-6" aria-label="Setup Steps">
                            <div className={`flex items-start gap-3 transition-opacity ${step === 1 ? 'opacity-100' : 'opacity-40'}`} aria-current={step === 1 ? "step" : undefined}>
                                <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-bold">1</div>
                                <div>
                                    <h3 className="font-semibold text-xs tracking-tight">System Setup</h3>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Connect models & scan document sources.</p>
                                </div>
                            </div>
                            <div className={`flex items-start gap-3 transition-opacity ${step === 2 ? 'opacity-100' : 'opacity-40'}`} aria-current={step === 2 ? "step" : undefined}>
                                <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-bold">2</div>
                                <div>
                                    <h3 className="font-semibold text-xs tracking-tight">Prune & Rank</h3>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Select candidates & provide context.</p>
                                </div>
                            </div>
                        </nav>
                    </div>

                    <div className="pt-6 border-t border-white/10">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-semibold tracking-widest">
                            <ShieldCheck size={12} className="text-emerald-400" aria-hidden="true" />
                            <span>Enterprise Secured</span>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-8 p-10 max-h-[90vh] overflow-y-auto">
                    {step === 1 ? (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <header className="mb-4">
                                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Configurations</h1>
                                <p className="text-slate-500 text-sm mt-1">Set up your intelligence key and data sources.</p>
                            </header>

                            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                                <div className="space-y-3">
                                    <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Cpu size={14} aria-hidden="true" /> AI Provider & Key
                                    </h2>

                                    <div className="space-y-3">
                                        <span className="text-[13px] font-medium text-slate-700 block">Select Provider</span>
                                        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                                            {(['google', 'openai', 'anthropic', 'mistral'] as const).map(p => (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, provider: p })}
                                                    className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.provider === p ? 'bg-slate-900 text-white shadow-lg scale-[1.02]' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 pt-2">
                                        <label htmlFor="api-key" className="text-[13px] font-medium text-slate-700">Master {formData.provider?.toUpperCase()} Key</label>
                                        <div className="relative">
                                            <input
                                                id="api-key"
                                                type="password"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-slate-950/5 focus:border-slate-400 outline-none transition-all placeholder:text-slate-400 text-sm shadow-sm pr-24"
                                                value={formData.apiKey}
                                                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                                placeholder="Enter AIza... or sk-..."
                                            />
                                            {detectedProvider && detectedProvider !== formData.provider && (
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 bg-amber-500 text-white rounded text-[8px] font-black uppercase spacing-widest animate-pulse">
                                                    <AlertCircle size={10} /> Mis-match?
                                                </div>
                                            )}
                                            {detectedProvider === formData.provider && (
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 bg-emerald-500 text-white rounded text-[8px] font-black uppercase spacing-widest">
                                                    <CheckCircle2 size={10} /> Verified
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6 pt-6 border-t border-slate-100">
                                    <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Sparkles size={14} className="text-amber-500" aria-hidden="true" /> Analysis Configuration
                                    </h2>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <span id="tier-label" className="text-[13px] font-medium text-slate-700 block">Analysis Tier</span>
                                            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-md" role="radiogroup" aria-labelledby="tier-label">
                                                {(['basic', 'pro'] as const).map(t => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, tier: t })}
                                                        className={`py-1.5 px-3 rounded text-[11px] font-semibold transition-all capitalize ${formData.tier === t ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-950/5' : 'text-slate-500 hover:text-slate-900'}`}
                                                        role="radio"
                                                        aria-checked={formData.tier === t}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2 opacity-60">
                                            <label className="text-[13px] font-medium text-slate-700 block">Target Model</label>
                                            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-500 flex items-center gap-2">
                                                <Sparkles size={12} className="text-slate-400" />
                                                Auto-selected based on Provider
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-slate-100">
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <FileText size={14} aria-hidden="true" /> Knowledge Source
                                        </h2>
                                        <button
                                            type="button"
                                            onClick={handleFetchSources}
                                            className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
                                            aria-label="View history of scanned collections"
                                        >
                                            <History size={12} aria-hidden="true" /> View History
                                        </button>
                                    </div>
                                    <div
                                        className={`bg-slate-50/50 p-4 rounded-md border transition-all ${isDragging ? 'border-slate-900 ring-2 ring-slate-950/5 bg-white' : 'border-slate-200'}`}
                                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={handleDrop}
                                    >
                                        <div className="flex gap-1 mb-3" role="radiogroup" aria-label="Source Type">
                                            {(['file', 'url'] as const).map(t => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, sourceType: t })}
                                                    className={`px-3 py-1 rounded text-[10px] font-semibold uppercase tracking-tight transition-all ${formData.sourceType === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                                                    role="radio"
                                                    aria-checked={formData.sourceType === t}
                                                >
                                                    {t === 'file' ? 'Local System' : 'URL / Bucket'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="relative">
                                            <label htmlFor="source-value" className="sr-only">Source Path or URL</label>
                                            <input
                                                id="source-value"
                                                type="text"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-slate-950/5 focus:border-slate-400 outline-none transition-all text-sm pr-10 shadow-sm"
                                                value={formData.sourceValue}
                                                onChange={e => setFormData({ ...formData, sourceValue: e.target.value })}
                                                placeholder={formData.sourceType === 'file' ? "e.g. C:/Resumes or drop ZIP here" : "e.g. s3://bucket/data.xml"}
                                            />
                                            <Upload className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isDragging ? 'text-slate-900' : 'text-slate-300'}`} size={14} aria-hidden="true" />
                                        </div>
                                    </div>
                                </div>
                            </form>

                            <button
                                type="button"
                                onClick={handlePreview}
                                disabled={!formData.sourceValue || !formData.apiKey || previewLoading}
                                className="inline-flex items-center justify-center w-full rounded-md text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-11 px-4 py-2 bg-slate-900 text-slate-50 hover:bg-slate-800 shadow-sm gap-2"
                            >
                                {previewLoading ? <div className="w-3 h-3 border-2 border-slate-50/30 border-t-slate-50 rounded-full animate-spin" aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                                Scan & Preview Candidates
                            </button>

                            <section className="pt-8 border-t border-slate-100">
                                <div className="bg-rose-50/50 p-4 rounded-md border border-rose-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider flex items-center gap-2 mb-1">
                                            <RotateCcw size={12} aria-hidden="true" /> Clear Configuration
                                        </h3>
                                        <p className="text-[11px] text-rose-500/70 font-medium">Reset keys, models, and paths. Data remains secure.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowResetModal(true)}
                                        className="inline-flex items-center justify-center rounded-md text-xs font-semibold ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-rose-200 bg-white hover:bg-rose-50 text-rose-500 h-8 px-3"
                                    >
                                        Clear Config
                                    </button>
                                </div>
                            </section>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <header className="flex justify-between items-end mb-6">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-2">Prune Pool</h1>
                                    <p className="text-slate-500 text-sm">Refine your candidate collection before indexing.</p>
                                </div>
                                <div className="flex gap-2">
                                    {selectedFiles.length >= 10 && (
                                        <button
                                            type="button"
                                            onClick={handleBatchSync}
                                            disabled={loading}
                                            className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                                        >
                                            🚀 Express Ingest ({selectedFiles.length} files)
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="text-xs font-bold text-slate-400 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Modify Source
                                    </button>
                                </div>
                            </header>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-100">
                                {selectedFiles.map(file => (
                                    <CandidateCard
                                        key={file.id}
                                        file={file}
                                        isRemovable
                                        onRemove={handleRemoveFile}
                                    />
                                ))}
                            </div>

                            <section className="space-y-4 pt-6 border-t border-slate-50">
                                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Search size={14} aria-hidden="true" /> Initial Semantic Context
                                </h2>
                                <div>
                                    <label htmlFor="filter-context" className="block text-xs font-bold text-slate-500 mb-2">What are you looking for right now?</label>
                                    <textarea
                                        id="filter-context"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 text-sm h-24 resize-none"
                                        value={formData.filterContext}
                                        onChange={e => setFormData({ ...formData, filterContext: e.target.value })}
                                        placeholder="e.g. Senior Backend Engineers with 5+ years of Python and FastAPI experience..."
                                    />
                                </div>
                            </section>

                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading || selectedFiles.length === 0}
                                className="w-full bg-[#0f172a] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 hover:shadow-xl transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3 mt-10"
                            >
                                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" /> : <Zap size={18} className="text-blue-400" aria-hidden="true" />}
                                Sync & Match Talent
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <p className="mt-8 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]" aria-label="Version Info">
                Snaphunt Architecture • v2.6.0
            </p>

            <ToastContainer />

            <Modal
                isOpen={showResetModal}
                title="Clear Configuration"
                description="This will wipe your API keys and local settings. You will need to re-configure to access the system. Vector data is NOT affected. Proceed?"
                confirmText="Clear Everything"
                variant="danger"
                onConfirm={handleClearConfig}
                onCancel={() => setShowResetModal(false)}
            />

            <Modal
                isOpen={previewErrorModal.isOpen}
                title="Scan Failed"
                description={previewErrorModal.message}
                confirmText="Understood"
                onConfirm={() => setPreviewErrorModal({ isOpen: false, message: '' })}
                onCancel={() => setPreviewErrorModal({ isOpen: false, message: '' })}
            />

            <Modal
                isOpen={deleteCollectionModal.isOpen}
                title="Remove Collection"
                description="Are you sure you want to remove this collection from history? This action cannot be undone."
                confirmText="Remove Now"
                variant="danger"
                onConfirm={confirmDeleteCollection}
                onCancel={() => setDeleteCollectionModal({ isOpen: false, sourceId: null })}
            />

            <Modal
                isOpen={showCloseConfirm}
                title="Unsaved Changes"
                description="You have unsaved configuration changes. Moving back now will discard them. Proceed anyway?"
                confirmText="Discard Changes"
                variant="danger"
                onConfirm={() => {
                    setShowCloseConfirm(false);
                    if (pendingAction) pendingAction();
                }}
                onCancel={() => setShowCloseConfirm(false)}
            />

            {showHistory && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-labelledby="history-title">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowHistory(false)} />
                    <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in slide-in-from-top-2 duration-300 max-h-[80vh]">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                            <div>
                                <h3 id="history-title" className="text-xl font-black text-slate-900">Collection History</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select a past intelligence source</p>
                            </div>
                            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-300 transition-colors" aria-label="Close History">
                                <X size={20} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-2">
                            {pastSources.length > 0 ? pastSources.map(s => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => handleSelectCollection(s)}
                                    className="w-full p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex items-center justify-between group"
                                    aria-label={`Select collection ${s.value}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                            {s.type === 'file' ? <FileText size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-black text-slate-700 truncate max-w-[300px]">{s.value}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{new Date(s.created_at).toLocaleDateString()} • {s.type}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteCollection(e, s.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="Delete from history"
                                            aria-label={`Delete ${s.value} from history`}
                                        >
                                            <Trash2 size={16} aria-hidden="true" />
                                        </button>
                                        <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" aria-hidden="true" />
                                    </div>
                                </button>
                            )) : (
                                <div className="py-20 text-center">
                                    <History size={48} className="mx-auto text-slate-100 mb-4" aria-hidden="true" />
                                    <p className="text-slate-400 text-sm font-medium">No previous collections found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
