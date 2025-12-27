import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Config as ConfigType, PreviewFile } from '../types';
import { FileText, ShieldCheck, Zap, X, Sparkles, ChevronRight, Search, Trash2, RotateCcw } from 'lucide-react';
import { CandidateCard } from '../components/CandidateCard';

export const Config = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<PreviewFile[]>([]);

    const [formData, setFormData] = useState<ConfigType>({
        apiKey: localStorage.getItem('snap_rag_key') || '',
        model: 'gemini-2.0-flash',
        analysisProvider: 'gemini',
        analysisApiKey: localStorage.getItem('snap_analysis_key') || '',
        analysisModel: 'gemini-2.0-flash',
        sourceType: 'file',
        sourceValue: '',
        filterContext: '',
        maxChunks: Number(localStorage.getItem('snap_max_chunks')) || 5
    });

    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);

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
        if (!window.confirm("WARNING: This will purge the entire vector database and clear all document registries. This action cannot be undone. Continue?")) return;
        setLoading(true);
        try {
            await api.reset();
            localStorage.removeItem('snap_config');
            setSelectedFiles([]);
            setStep(1);
            alert('System reset successful.');
        } catch (error) {
            console.error(error);
            alert('Reset failed.');
        } finally {
            setLoading(false);
        }
    };

    const fetchModels = async (provider: string, key: string) => {
        if (!key) {
            setAvailableModels([]);
            return;
        }
        setFetchingModels(true);
        try {
            const { models } = await api.listModels(provider, key);
            setAvailableModels(models);
            if (models.length > 0 && !models.includes(formData.analysisModel || '')) {
                setFormData(prev => ({ ...prev, analysisModel: models[0], model: models[0] }));
            }
        } catch (e) {
            console.error(e);
            setAvailableModels([]);
        } finally {
            setFetchingModels(false);
        }
    };

    useEffect(() => {
        const key = formData.analysisProvider === 'gemini' ? formData.apiKey : formData.analysisApiKey;
        if (key) {
            fetchModels(formData.analysisProvider, key);
        } else {
            setAvailableModels([]);
        }
    }, [formData.analysisProvider, formData.apiKey, formData.analysisApiKey]);

    const handleBatchSync = async () => {
        if (selectedFiles.length === 0) return;
        setLoading(true);
        try {
            await api.reset();
            await api.ingest(formData, selectedFiles);
            localStorage.setItem('snap_max_chunks', String(formData.maxChunks));
            localStorage.setItem('snap_config', JSON.stringify(formData));
            navigate('/');
        } catch (error) {
            console.error(error);
            alert('Batch sync failed.');
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

            localStorage.setItem('snap_rag_key', formData.apiKey);
            if (formData.analysisApiKey) {
                localStorage.setItem('snap_analysis_key', formData.analysisApiKey);
            }
            localStorage.setItem('snap_max_chunks', String(formData.maxChunks));
            localStorage.setItem('snap_config', JSON.stringify(formData));

            navigate('/');
        } catch (error) {
            console.error(error);
            alert('Configuration failed.');
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

                <div className="md:col-span-8 p-10 lg:p-14 max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-100">
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
                                        <label className="block text-xs font-bold text-slate-500 mb-2">Master Gemini API Key</label>
                                        <input
                                            type="password"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 text-sm"
                                            value={formData.apiKey}
                                            onChange={e => setFormData({ ...formData, apiKey: e.target.value, analysisApiKey: formData.analysisProvider === 'gemini' ? e.target.value : formData.analysisApiKey })}
                                            placeholder="Enter Google AI Studio Key"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-50">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Sparkles size={14} className="text-orange-400" /> Analysis Provider
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        {(['gemini', 'openai'] as const).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setFormData({ ...formData, analysisProvider: p })}
                                                className={`py-3 px-4 rounded-xl text-xs font-black transition-all capitalize border ${formData.analysisProvider === p ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="animate-in slide-in-from-top-2 duration-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2">Target Model</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none text-sm font-medium"
                                                    value={formData.analysisModel}
                                                    onChange={e => setFormData({ ...formData, analysisModel: e.target.value, model: e.target.value })}
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
                                                    ) : (
                                                        <Sparkles size={14} />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center justify-between">
                                                Sustainability Depth
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${formData.maxChunks && formData.maxChunks > 7 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                    {formData.maxChunks} chunks
                                                </span>
                                            </label>
                                            <input
                                                type="range"
                                                min="1"
                                                max="15"
                                                value={formData.maxChunks}
                                                onChange={e => setFormData({ ...formData, maxChunks: parseInt(e.target.value) })}
                                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-4"
                                            />
                                            <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                <span>Eco (Fast)</span>
                                                <span>Balanced</span>
                                                <span>Deep (Costly)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {formData.analysisProvider === 'openai' && (
                                        <div className="animate-in slide-in-from-top-2 duration-200">
                                            <label className="block text-xs font-bold text-slate-500 mb-2">OpenAI Secret Key</label>
                                            <input
                                                type="password"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 text-sm"
                                                value={formData.analysisApiKey}
                                                onChange={e => setFormData({ ...formData, analysisApiKey: e.target.value })}
                                                placeholder="sk-..."
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-50">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <FileText size={14} /> Knowledge Source
                                    </h3>
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col gap-4 shadow-inner">
                                        <div className="flex gap-2">
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
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm"
                                            value={formData.sourceValue}
                                            onChange={e => setFormData({ ...formData, sourceValue: e.target.value })}
                                            placeholder={formData.sourceType === 'file' ? "e.g. C:/Resumes or MyFiles.zip" : "e.g. s3://bucket/data.xml"}
                                        />
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
                                        onClick={handleReset}
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
        </div>
    );
};
