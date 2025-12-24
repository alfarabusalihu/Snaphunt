import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Config as ConfigType } from '../types';
import { FileText, ShieldCheck, Zap, X, Sparkles, ChevronRight, Search } from 'lucide-react';
import { CandidateCard } from '../components/CandidateCard';

export const Config = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<any[]>([]);

    const [formData, setFormData] = useState<ConfigType>({
        apiKey: localStorage.getItem('snap_rag_key') || '',
        model: 'gemini-1.5-flash',
        analysisProvider: 'gemini',
        analysisApiKey: localStorage.getItem('snap_analysis_key') || '',
        analysisModel: 'gemini-1.5-flash',
        sourceType: 'file',
        sourceValue: '',
        filterContext: ''
    });

    const hasConfig = !!localStorage.getItem('snap_config');

    const handlePreview = async () => {
        if (!formData.sourceValue) return;
        setPreviewLoading(true);
        try {
            const res = await api.preview(formData.sourceType, formData.sourceValue);
            setSelectedFiles(res.files);
            setStep(2);
        } catch (error) {
            console.error('Preview failed:', error);
            alert('Failed to scan source. Check path and permissions.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleRemoveFile = (id: string) => {
        setSelectedFiles(prev => prev.filter(f => f.id !== id));
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
            localStorage.setItem('snap_config', JSON.stringify(formData));

            navigate('/');
        } catch (error) {
            console.error('Configuration failed:', error);
            alert('Failed to configure system.');
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
                                                onClick={() => setFormData({ ...formData, analysisProvider: p, analysisModel: p === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini' })}
                                                className={`py-3 px-4 rounded-xl text-xs font-black transition-all capitalize border ${formData.analysisProvider === p ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
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
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <header className="flex justify-between items-end mb-6">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-2">Prune Pool</h1>
                                    <p className="text-slate-500 text-sm">Refine your candidate collection before indexing.</p>
                                </div>
                                <button
                                    onClick={() => setStep(1)}
                                    className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Modify Source
                                </button>
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
                Snaphunt Architecture • v2.5.0
            </p>
        </div>
    );
};
