import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Config as ConfigType, PreviewFile } from '../types';
import {
    FileText, ShieldCheck, Zap, X, Sparkles, ChevronRight,
    Search, Trash2, RotateCcw, History, Upload
} from 'lucide-react';
import { CandidateCard } from '../components/CandidateCard';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { debounce } from '../utils';

export const Config = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<PreviewFile[]>([]);

    const [formData, setFormData] = useState<ConfigType>({
        apiKey: localStorage.getItem('snap_master_key') || '',
        model: 'gemini-2.5-flash',
        tier: 'basic',
        sourceType: 'file',
        sourceValue: '',
        filterContext: '',
        maxChunks: Number(localStorage.getItem('snap_max_chunks')) || 5
    });

    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);
    const [pastSources, setPastSources] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
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
            alert('Failed to scan source. Check path and permissions.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleRemoveFile = (id: string) => {
        setSelectedFiles(prev => prev.filter(f => f.id !== id));
    };

    const handleReset = async () => {
        setShowResetModal(false);
        setLoading(true);
        try {
            await api.reset();
            localStorage.removeItem('snap_config');
            setSelectedFiles([]);
            setStep(1);
            showToast('System reset successful.', 'success');
        } catch (error) {
            console.error(error);
            showToast('Reset failed.', 'error');
        } finally {
            setLoading(false);
        }
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

    const handleDeleteCollection = async (e: React.MouseEvent, sourceId: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to remove this collection from history?')) return;

        try {
            await api.deleteSource(sourceId);
            setPastSources(prev => prev.filter(s => s.id !== sourceId));
            showToast('Collection removed from history', 'success');
        } catch (e) {
            showToast('Failed to delete collection', 'error');
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

            // Trigger preview automatically for dropped files
            const res = await api.preview('file', uploadedPath);
            setSelectedFiles(res.files);
            setStep(2);
        } catch (e) {
            showToast('Failed to process dropped file.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchModels = React.useCallback(async (apiKey: string, signal?: AbortSignal) => {
        if (!apiKey || apiKey.length < 10) {
            setAvailableModels([]);
            setModelError(null);
            setFetchingModels(false);
            return;
        }

        const provider = apiKey.startsWith('AIza') ? 'gemini' : (apiKey.startsWith('sk-') ? 'openai' : 'unknown');
        if (provider === 'unknown') return;

        console.log(`🔍 [Frontend] Requesting models for ${provider}...`);
        setFetchingModels(true);
        setModelError(null);

        try {
            const { models } = await api.listModels(provider, apiKey, signal);
            setAvailableModels(models);

            setFormData(prev => {
                const currentModel = prev.model;
                if (models.length > 0 && !models.includes(currentModel)) {
                    return { ...prev, model: models[0] };
                }
                return prev;
            });
        } catch (e: any) {
            if (e.name === 'AbortError') return;
            setModelError(e.message || 'Failed to fetch models');
        } finally {
            setFetchingModels(false);
        }
    }, []);

    const debouncedFetchRef = React.useRef(
        debounce((key: string, signal: AbortSignal) => {
            fetchModels(key, signal);
        }, 800)
    );

    useEffect(() => {
        const controller = new AbortController();
        if (formData.apiKey) {
            debouncedFetchRef.current(formData.apiKey, controller.signal);
        } else {
            setAvailableModels([]);
            setFetchingModels(false);
            setModelError(null);
        }
        return () => controller.abort();
    }, [formData.apiKey, fetchModels]);

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
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
            <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-0 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden border border-slate-100 relative">
                {hasConfig && (
                    <button
                        onClick={() => navigate('/')}
                        className="absolute right-6 top-6 text-slate-300 hover:text-slate-600 transition-colors z-10"
                    >
                        <X size={24} />
                    </button>
                )}

                <div className="md:col-span-4 bg-[#0f172a] p-10 text-white flex flex-col justify-between hidden md:flex">
                    <div>
                        <div className="flex items-center gap-3 mb-10">
                            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
                                S
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">Snaphunt AI</h2>
                        </div>

                        <div className="space-y-8">
                            <div className={`flex items-start gap-4 transition-opacity ${step === 1 ? 'opacity-100' : 'opacity-40'}`}>
                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold">1</div>
                                <div>
                                    <h4 className="font-bold text-sm">System Setup</h4>
                                    <p className="text-xs text-slate-400 mt-1">Connect models and scan document sources.</p>
                                </div>
                            </div>
                            <div className={`flex items-start gap-4 transition-opacity ${step === 2 ? 'opacity-100' : 'opacity-40'}`}>
                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold">2</div>
                                <div>
                                    <h4 className="font-bold text-sm">Prune & Rank</h4>
                                    <p className="text-xs text-slate-400 mt-1">Select candidates and provide initial context.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-10 border-t border-slate-800">
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 uppercase font-black tracking-widest">
                            <ShieldCheck size={14} className="text-blue-500" />
                            <span>Enterprise Secured</span>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-8 p-6 sm:p-10 lg:p-14 max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-100">
                    {step === 1 ? (
                        <div className="space-y-8">
                            <header className="mb-10">
                                <h1 className="text-3xl font-black text-slate-900 mb-2">Configurations</h1>
                                <p className="text-slate-500 text-sm">Initialize your talent intelligence environment.</p>
                            </header>

                            <section className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <ShieldCheck size={14} /> Intelligence Key
                                    </h3>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2">Master AI Key (Gemini or OpenAI)</label>
                                        <input
                                            type="password"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 text-sm"
                                            value={formData.apiKey}
                                            onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                            placeholder="Enter AIza... or sk-..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6 pt-6 border-t border-slate-50">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Sparkles size={14} className="text-orange-400" /> Analysis Configuration
                                    </h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center justify-between">
                                                Analysis Tier
                                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${formData.tier === 'pro' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    {formData.tier} Plan
                                                </span>
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {(['basic', 'pro'] as const).map(t => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, tier: t })}
                                                        className={`py-2 px-3 rounded-xl text-[10px] font-black transition-all capitalize border ${formData.tier === t ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-[9px] text-slate-400 mt-1 italic">
                                                {formData.tier === 'pro' ? 'Higher token limits & deeper analysis depth.' : 'Standard analysis speed and limits.'}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold text-slate-500 mb-2">Target Model</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none text-sm font-medium"
                                                    value={formData.model}
                                                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                                                >
                                                    {availableModels.length > 0 ? (
                                                        availableModels.map(m => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))
                                                    ) : (
                                                        <option disabled>
                                                            {fetchingModels ? 'Loading models...' : 'Enter API Key to see models'}
                                                        </option>
                                                    )}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                    {fetchingModels ? (
                                                        <div className="w-3 h-3 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                                                    ) : modelError ? (
                                                        <span className="text-red-500 text-[10px] font-bold">!</span>
                                                    ) : (
                                                        <Sparkles size={14} />
                                                    )}
                                                </div>
                                            </div>
                                            {modelError && (
                                                <p className="text-[10px] text-red-500 mt-1 font-medium animate-in fade-in slide-in-from-top-1">
                                                    {modelError}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-50">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <FileText size={14} /> Knowledge Source
                                        </h3>
                                        <button
                                            onClick={handleFetchSources}
                                            className="text-[10px] font-black text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors"
                                        >
                                            <History size={12} /> View History
                                        </button>
                                    </div>
                                    <div
                                        className={`bg-slate-50 p-6 rounded-2xl border transition-all ${isDragging ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' : 'border-slate-100 shadow-inner'}`}
                                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={handleDrop}
                                    >
                                        <div className="flex gap-2 mb-4">
                                            {(['file', 'url'] as const).map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => setFormData({ ...formData, sourceType: t })}
                                                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${formData.sourceType === t ? 'bg-[#0f172a] text-white' : 'bg-white text-slate-400 border border-slate-200'}`}
                                                >
                                                    {t === 'file' ? 'Local System' : 'URL / Bucket'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm pr-10"
                                                value={formData.sourceValue}
                                                onChange={e => setFormData({ ...formData, sourceValue: e.target.value })}
                                                placeholder={formData.sourceType === 'file' ? "e.g. C:/Resumes or drop ZIP here" : "e.g. s3://bucket/data.xml"}
                                            />
                                            <Upload className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isDragging ? 'text-blue-500' : 'text-slate-300'}`} size={16} />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <button
                                onClick={handlePreview}
                                disabled={!formData.sourceValue || !formData.apiKey || previewLoading}
                                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/20 transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3 mt-10"
                            >
                                {previewLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ChevronRight size={18} />}
                                Scan & Preview Candidates
                            </button>

                            <section className="pt-10 border-t border-slate-50">
                                <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2 mb-1">
                                            <Trash2 size={12} /> System Management
                                        </h4>
                                        <p className="text-[10px] text-red-500/70 font-medium">Purge all vector data and reset registry.</p>
                                    </div>
                                    <button
                                        onClick={() => setShowResetModal(true)}
                                        disabled={loading}
                                        className="p-3 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                        title="Factory Reset"
                                    >
                                        <RotateCcw size={16} />
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
                                            onClick={handleBatchSync}
                                            disabled={loading}
                                            className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                                        >
                                            🚀 Express Ingest ({selectedFiles.length} files)
                                        </button>
                                    )}
                                    <button
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
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Search size={14} /> Initial Semantic Context
                                </h3>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2">What are you looking for right now?</label>
                                    <textarea
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 text-sm h-24 resize-none"
                                        value={formData.filterContext}
                                        onChange={e => setFormData({ ...formData, filterContext: e.target.value })}
                                        placeholder="e.g. Senior Backend Engineers with 5+ years of Python and FastAPI experience..."
                                    />
                                </div>
                            </section>

                            <button
                                onClick={handleSubmit}
                                disabled={loading || selectedFiles.length === 0}
                                className="w-full bg-[#0f172a] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 hover:shadow-xl transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3 mt-10"
                            >
                                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap size={18} className="text-blue-400" />}
                                Sync & Match Talent
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <p className="mt-8 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                Snaphunt Architecture • v2.6.0
            </p>

            <ToastContainer />

            <Modal
                isOpen={showResetModal}
                title="Cleansing Reset"
                description="This will purge the current vector database and clear active configurations. Collection history will remain intact. Proceed?"
                confirmText="Reset Session"
                variant="danger"
                onConfirm={handleReset}
                onCancel={() => setShowResetModal(false)}
            />

            {showHistory && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowHistory(false)} />
                    <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in slide-in-from-top-2 duration-300 max-h-[80vh]">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Collection History</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select a past intelligence source</p>
                            </div>
                            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-300 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-2">
                            {pastSources.length > 0 ? pastSources.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => handleSelectCollection(s)}
                                    className="w-full p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                            {s.type === 'file' ? <FileText size={18} /> : <Search size={18} />}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-black text-slate-700 truncate max-w-[300px]">{s.value}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{new Date(s.created_at).toLocaleDateString()} • {s.type}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => handleDeleteCollection(e, s.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="Delete from history"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                </button>
                            )) : (
                                <div className="py-20 text-center">
                                    <History size={48} className="mx-auto text-slate-100 mb-4" />
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
