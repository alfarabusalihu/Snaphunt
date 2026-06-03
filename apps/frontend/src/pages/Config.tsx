import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import type { Config as ConfigType, PreviewFile } from '../types';
import type { SourceDocument } from '../api';
import {
    FileText, ShieldCheck, Zap, X, Sparkles,
    Search, Upload, Cpu,
    CheckCircle2
} from 'lucide-react';
import { getProviderByKey } from '../utils/provider';
import { CandidateCard } from '../components/CandidateCard';
import { Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import { useAppStore } from '../store/useStore';
import { KeywordInput } from '../components/KeywordInput';

// ── Live elapsed-time hook ────────────────────────────────────────────────────
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

    const fmt = useCallback((s: number) => {
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const sec = (s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    }, []);

    return fmt(elapsed);
}

export const Config = ({ onComplete, onCancel }: { onComplete: () => void, onCancel?: () => void }) => {
    const { 
        config, setConfig, 
        setResults, setIngestStats, setIngestTime, 
        reset 
    } = useAppStore();

    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<PreviewFile[]>([]);
    const previewTimer = useTimer(previewLoading);
    const syncTimer = useTimer(loading);

    const [formData, setFormData] = useState<ConfigType>(config || {
        apiKey: '',
        model: 'gemini-2.5-flash',
        tier: 'pro',
        sourceType: 'file',
        sourceValue: '',
        filterContext: '',
        keywords: [],
        provider: 'google',
        maxChunks: 5
    });

    const detectedProvider = getProviderByKey(formData.apiKey);
    const [showResetModal, setShowResetModal] = useState(false);

    const { showToast, ToastContainer } = useToast();

    const handlePreview = async () => {
        if (!formData.sourceValue) return;
        setPreviewLoading(true);
        try {
            const res = await api.preview(formData.sourceType, formData.sourceValue);
            const files = res.files || [];
            setSelectedFiles(files);
            if (files.length === 0) {
                showToast('No PDF documents found in the specified source.', 'error');
            } else {
                setStep(2);
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to scan source. Check path and permissions.', 'error');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleRemoveFile = (id: string) => {
        setSelectedFiles(prev => prev.filter(f => f.id !== id));
    };

    const handleClearConfig = () => {
        setShowResetModal(false);
        reset();
        setFormData({
            apiKey: '',
            model: 'gemini-2.5-flash',
            provider: 'google',
            tier: 'pro',
            sourceType: 'file',
            sourceValue: '',
            filterContext: '',
            keywords: [],
            maxChunks: 5
        });
        setSelectedFiles([]);
        setStep(1);
        showToast('Configurations cleared.', 'success');
    };



    const handleFetchStarred = async () => {
        setLoading(true);
        try {
            const res = await api.getStarredDocuments();
            if (res.documents.length === 0) {
                showToast('You have no Starred CVs yet.', 'error');
                return;
            }
            const previewFiles = res.documents.map((d: SourceDocument) => ({
                id: d.id,
                fileName: d.file_name,
                location: d.location,
                size: 0,
                checksum: d.checksum
            }));
            setSelectedFiles(previewFiles);
            setFormData(prev => ({ ...prev, sourceValue: 'Starred CVs', sourceType: 'file' }));
            setStep(2);
            showToast(`Loaded ${previewFiles.length} Starred CVs`, 'success');
        } catch {
            showToast('Failed to load Starred CVs', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const startTime = Date.now();
            const res = await api.ingest(formData, selectedFiles);
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);

            // Stitch keywords into a semantic query for the initial phase
            const stitchedQuery = (formData.keywords || []).join(", ");
            const updatedFormData = { ...formData, filterContext: stitchedQuery };

            setConfig(updatedFormData);
            setIngestStats(res.stats);
            setIngestTime(duration);

            const initialResults = await api.query(stitchedQuery, updatedFormData.apiKey, updatedFormData.maxChunks);
            setResults(initialResults);
            showToast('Configurations saved and synced!', 'success');
            setTimeout(() => onComplete(), 1000);
        } catch (err: unknown) {
            console.error(err);
            showToast('Configuration failed.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-0 bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 relative animate-in zoom-in-95 duration-500">
            {onCancel && (
                <button
                    onClick={onCancel}
                    className="absolute right-6 top-6 text-slate-400 hover:text-slate-900 transition-colors z-10 p-2 hover:bg-slate-50 rounded-xl"
                    aria-label="Close"
                >
                    <X size={20} aria-hidden="true" />
                </button>
            )}

            <div className="md:col-span-4 bg-slate-900 p-8 text-slate-50 flex flex-col justify-between hidden md:flex">
                <div>
                    <div className="flex items-center gap-2 mb-10">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-900 font-bold text-lg ring-1 ring-white/20" aria-hidden="true">
                            S
                        </div>
                        <h2 className="text-sm font-bold tracking-tight uppercase">Snaphunt</h2>
                    </div>

                    <nav className="space-y-6" aria-label="Setup Steps">
                        <div className={`flex items-start gap-3 transition-opacity ${step === 1 ? 'opacity-100' : 'opacity-40'}`}>
                            <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-bold">1</div>
                            <div>
                                <h3 className="font-semibold text-xs tracking-tight">System Setup</h3>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Connect models & scan document sources.</p>
                            </div>
                        </div>
                        <div className={`flex items-start gap-3 transition-opacity ${step === 2 ? 'opacity-100' : 'opacity-40'}`}>
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

            <div className="md:col-span-8 p-10 max-h-[85vh] overflow-y-auto">
                {step === 1 ? (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <header className="mb-4">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Configurations</h1>
                            <p className="text-slate-500 text-sm mt-1">Set up your intelligence key and data sources.</p>
                        </header>

                        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                            <div className="space-y-3">
                                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Cpu size={14} aria-hidden="true" /> AI Provider & Key
                                </h2>

                                <div className="space-y-3">
                                    <span className="text-[13px] font-medium text-slate-700 block">Select Provider</span>
                                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                                        {(['google'] as const).map(p => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, provider: p })}
                                                className={`flex-1 py-2.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.provider === p ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}
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
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-slate-950/5 focus:border-slate-400 outline-none transition-all placeholder:text-slate-400 text-sm shadow-sm pr-24"
                                            value={formData.apiKey}
                                            onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                            placeholder="Enter AIza... or sk-..."
                                        />
                                        {detectedProvider === formData.provider && formData.apiKey && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 bg-emerald-500 text-white rounded text-[8px] font-black uppercase spacing-widest">
                                                <CheckCircle2 size={10} /> Verified
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-slate-100">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <FileText size={14} aria-hidden="true" /> Knowledge Source
                                    </h2>
                                    {useAppStore.getState().token && (
                                        <div className="flex gap-4">
                                            <button
                                                type="button"
                                                onClick={handleFetchStarred}
                                                className="text-[10px] font-bold text-amber-500 hover:text-amber-600 flex items-center gap-1.5 transition-colors uppercase tracking-widest"
                                            >
                                                ⭐ Starred CVs
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                                    <div className="flex gap-1 mb-4">
                                        {(['file', 'url'] as const).map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, sourceType: t })}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${formData.sourceType === t ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
                                            >
                                                {t === 'file' ? 'Local' : 'Remote URL'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-slate-950/5 focus:border-slate-400 outline-none transition-all text-sm pr-10 shadow-sm"
                                            value={formData.sourceValue}
                                            onChange={e => setFormData({ ...formData, sourceValue: e.target.value })}
                                            placeholder={formData.sourceType === 'file' ? "e.g. C:/Resumes" : "e.g. s3://bucket/resumes"}
                                        />
                                        <Upload className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                    </div>
                                </div>
                            </div>
                        </form>

                        <button
                            type="button"
                            onClick={handlePreview}
                            disabled={!formData.sourceValue || !formData.apiKey || previewLoading}
                            className="relative group inline-flex items-center justify-center w-full rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 h-16 px-4 py-2 bg-slate-900 text-slate-50 hover:bg-slate-800 shadow-2xl shadow-slate-900/20 overflow-hidden"
                        >
                            {previewLoading ? (
                                <div className="flex items-center gap-3">
                                    <div className="loading-diamond w-3 h-3 bg-white" />
                                    <span>Scanning... {previewTimer}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Search size={18} aria-hidden="true" />
                                    <span>Preview Candidates</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-white/10 to-blue-600/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <header className="flex justify-between items-end mb-6">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Prune Results</h1>
                                <p className="text-slate-500 text-sm">Select candidates before ranking.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest px-3 py-2 rounded-lg transition-colors"
                            >
                                Back
                            </button>
                        </header>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
                            {selectedFiles.map(file => (
                                <CandidateCard
                                    key={file.id}
                                    file={file}
                                    isRemovable
                                    onRemove={handleRemoveFile}
                                />
                            ))}
                        </div>

                        <section className="space-y-4 pt-6 border-t border-slate-100">
                            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles size={14} className="text-blue-500" aria-hidden="true" /> Mandatory Skills
                            </h2>
                            <div className="pt-2">
                                <KeywordInput 
                                    tags={formData.keywords || []} 
                                    onChange={(tags) => setFormData({ ...formData, keywords: tags })} 
                                />
                            </div>
                        </section>

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || selectedFiles.length === 0}
                            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 hover:shadow-2xl transition-all disabled:opacity-30 flex items-center justify-center gap-3 mt-10 h-16 shadow-xl shadow-slate-900/20"
                        >
                            {loading ? (
                                <div className="flex items-center gap-3">
                                    <div className="loading-diamond w-4 h-4 bg-white" />
                                    <span>Syncing... {syncTimer}</span>
                                </div>
                            ) : (
                                <>
                                    <Zap size={20} className="text-blue-400" aria-hidden="true" />
                                    <span>Sync & Match talent</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            <Modal
                isOpen={showResetModal}
                title="Reset Config"
                description="This will clear your local settings. Proceed?"
                confirmText="Reset"
                variant="danger"
                onConfirm={handleClearConfig}
                onCancel={() => setShowResetModal(false)}
            />


            <ToastContainer />
        </div>
    );
};
