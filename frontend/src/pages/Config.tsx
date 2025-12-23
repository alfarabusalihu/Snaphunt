import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Config as ConfigType } from '../types';
import { FileText, Link, ShieldCheck, Zap, X, Sparkles } from 'lucide-react';

export const Config = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<ConfigType>({
        apiKey: '',
        model: 'gemini-1.5-flash',
        analysisProvider: 'gemini',
        analysisApiKey: '',
        analysisModel: 'gemini-1.5-flash',
        sourceType: 'url',
        sourceValue: '',
        filterContext: ''
    });

    const hasConfig = !!localStorage.getItem('snap_config');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.reset();
            await api.ingest(formData);
            localStorage.setItem('snap_config', JSON.stringify(formData));
            navigate('/');
        } catch (error) {
            console.error('Configuration failed:', error);
            alert('Failed to configure system. Check console.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-5 gap-8 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden border border-slate-100 relative">
                {hasConfig && (
                    <button
                        onClick={() => navigate('/')}
                        className="absolute right-6 top-6 text-slate-300 hover:text-slate-600 transition-colors z-10"
                        title="Cancel"
                    >
                        <X size={24} />
                    </button>
                )}
                <div className="md:col-span-2 bg-[#0f172a] p-8 text-white flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
                                S
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">Snaphunt AI</h2>
                        </div>

                        <div className="space-y-6">
                            <h1 className="text-3xl font-extrabold leading-tight">
                                Intelligence <span className="text-blue-400">Streamlined</span>
                            </h1>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Professional RAG-based recruitment. Keep your knowledge on Gemini, analyze with any model.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <ShieldCheck className="text-blue-400" size={18} />
                            <span>Unified Vector Registry</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <Zap className="text-blue-400" size={18} />
                            <span>Multi-Provider Logic</span>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-3 p-8 lg:p-12 max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-100">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <section className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Knowledge Engine (Gemini)</h3>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Gemini API Key <span className="text-[10px] text-blue-500 ml-2 font-bold">REQUIRED FOR RAG</span></label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        required
                                        className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        value={formData.apiKey}
                                        onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                                        placeholder="Enter Gemini key for search/indexing"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                                        <ShieldCheck size={18} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4 pt-4 border-t border-slate-50">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                                <Sparkles size={14} className="text-orange-400" /> Deep Reasoner
                            </h3>

                            <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                {(['gemini', 'openai'] as const).map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setFormData({
                                            ...formData,
                                            analysisProvider: p,
                                            analysisModel: p === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini'
                                        })}
                                        className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all capitalize ${formData.analysisProvider === p ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2 capitalize">{formData.analysisProvider} Key</label>
                                    <input
                                        type="password"
                                        required={formData.analysisProvider === 'openai'}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                        value={formData.analysisApiKey}
                                        onChange={e => setFormData({ ...formData, analysisApiKey: e.target.value })}
                                        placeholder={formData.analysisProvider === 'gemini' ? "Optional (will use RAG key if empty)" : "Enter OpenAI Secret Key"}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Analysis Model</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer text-sm"
                                        value={formData.analysisModel}
                                        onChange={e => setFormData({ ...formData, analysisModel: e.target.value })}
                                    >
                                        {formData.analysisProvider === 'gemini' ? (
                                            <>
                                                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="gpt-4o-mini">GPT-4o Mini</option>
                                                <option value="gpt-4o">GPT-4o</option>
                                                <option value="o1-mini">o1 Mini</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4 pt-4 border-t border-slate-50">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Session Tuning</h3>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Global Context Filter</label>
                                <p className="text-[10px] text-slate-500 mb-2 italic">Initial focus for candidate ranking</p>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                    value={formData.filterContext}
                                    onChange={e => setFormData({ ...formData, filterContext: e.target.value })}
                                    placeholder="e.g. Senior Frontend Engineers with React expertise"
                                />
                            </div>
                        </section>

                        <section className="space-y-4 pt-4 border-t border-slate-50">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Knowledge Source</h3>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${formData.sourceType === 'url' ? 'bg-[#0f172a] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                        onClick={() => setFormData({ ...formData, sourceType: 'url' })}
                                    >
                                        <Link size={14} /> URL / Bucket
                                    </button>
                                    <button
                                        type="button"
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${formData.sourceType === 'file' ? 'bg-[#0f172a] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                        onClick={() => setFormData({ ...formData, sourceType: 'file' })}
                                    >
                                        <FileText size={14} /> Local Disk
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                    value={formData.sourceValue}
                                    onChange={e => setFormData({ ...formData, sourceValue: e.target.value })}
                                    placeholder={formData.sourceType === 'url' ? "https://example.com/data.xml" : "C:/Users/HR/Resumes"}
                                />
                            </div>
                        </section>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 flex justify-center items-center gap-3 text-lg"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Syncing Intelligence...</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={20} />
                                    <span>Initialize System</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            <p className="mt-8 text-slate-400 text-xs font-medium">
                Snaphunt AI v2.4 • Powered by Google Gemini
            </p>
        </div>
    );
};
