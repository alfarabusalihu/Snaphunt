import React, { useState } from 'react';
import { Mail, Lock, Sparkles, UserPlus, LogIn, ArrowRight, X, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { api } from '../api';
import type { AuthModalProps } from '../interfaces';

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Field-level error states for visual highlighting
    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const [confirmPasswordError, setConfirmPasswordError] = useState(false);

    const setAuth = useAppStore(state => state.setAuth);

    const validateForm = (): boolean => {
        setValidationError(null);
        setEmailError(false);
        setPasswordError(false);
        setConfirmPasswordError(false);

        // 1. Empty fields check
        if (!email.trim()) {
            setValidationError('Email address cannot be empty.');
            setEmailError(true);
            return false;
        }
        if (!password.trim()) {
            setValidationError('Password cannot be empty.');
            setPasswordError(true);
            return false;
        }

        // 2. Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setValidationError('Please enter a valid email address (e.g. name@company.com).');
            setEmailError(true);
            return false;
        }

        // 3. Password safety check (min 6 characters)
        if (password.length < 6) {
            setValidationError('Password must be at least 6 characters long.');
            setPasswordError(true);
            return false;
        }

        // 4. Confirm password check (register mode only)
        if (!isLogin) {
            if (!confirmPassword.trim()) {
                setValidationError('Please confirm your password.');
                setConfirmPasswordError(true);
                return false;
            }
            if (password !== confirmPassword) {
                setValidationError('Passwords do not match.');
                setPasswordError(true);
                setConfirmPasswordError(true);
                return false;
            }
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) return;

        setLoading(true);
        try {
            if (isLogin) {
                const res = await api.login(email.trim(), password);
                setAuth(res.token, res.user);
            } else {
                const res = await api.register(email.trim(), password);
                setAuth(res.token, res.user);
            }
            onSuccess();
        } catch (err: unknown) {
            setValidationError(err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300 font-sans">
            {/* Background Decor */}
            <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />

            <div className="w-full max-w-[420px] relative z-10 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Modal Container */}
                <div className="bg-slate-900 border border-slate-800 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    {/* Top Accent Gradient Border */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
                    
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all active:scale-95"
                    >
                        <X size={16} />
                    </button>

                    {/* Brand */}
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/10">
                            <Sparkles size={16} />
                        </div>
                        <div>
                            <h3 className="font-black text-sm text-white tracking-tight uppercase">
                                Snap<span className="text-blue-500">hunt</span> Auth
                            </h3>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-white mb-2">
                        {isLogin ? 'Welcome Back' : 'Get Started'}
                    </h2>
                    <p className="text-xs text-slate-400 mb-6">
                        {isLogin ? 'Sign in to access your starred CVs and history.' : 'Register to begin tracking candidates and collections.'}
                    </p>

                    {/* Error Alerts */}
                    {validationError && (
                        <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-semibold leading-relaxed flex items-start gap-2 animate-in fade-in duration-300">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{validationError}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email Address */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                                Email Address
                            </label>
                            <div className="relative group">
                                <Mail size={14} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                                    emailError ? 'text-rose-500' : 'text-slate-500 group-focus-within:text-blue-400'
                                }`} />
                                <input
                                    type="text"
                                    value={email}
                                    onChange={e => {
                                        setEmail(e.target.value);
                                        if (emailError) setEmailError(false);
                                    }}
                                    placeholder="name@company.com"
                                    className={`w-full bg-slate-950/40 border rounded-2xl py-3 pl-11 pr-4 text-slate-200 placeholder:text-slate-600 text-xs outline-none focus:ring-4 focus:ring-blue-500/5 transition-all ${
                                        emailError ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-blue-500/85'
                                    }`}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                                Password
                            </label>
                            <div className="relative group">
                                <Lock size={14} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                                    passwordError ? 'text-rose-500' : 'text-slate-500 group-focus-within:text-blue-400'
                                }`} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => {
                                        setPassword(e.target.value);
                                        if (passwordError) setPasswordError(false);
                                    }}
                                    placeholder="••••••••"
                                    className={`w-full bg-slate-950/40 border rounded-2xl py-3 pl-11 pr-4 text-slate-200 placeholder:text-slate-600 text-xs outline-none focus:ring-4 focus:ring-blue-500/5 transition-all ${
                                        passwordError ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-blue-500/85'
                                    }`}
                                />
                            </div>
                        </div>

                        {/* Confirm Password (Register Only) */}
                        {!isLogin && (
                            <div className="space-y-1.5 animate-in fade-in duration-300">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                                    Confirm Password
                                </label>
                                <div className="relative group">
                                    <Lock size={14} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                                        confirmPasswordError ? 'text-rose-500' : 'text-slate-500 group-focus-within:text-blue-400'
                                    }`} />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => {
                                            setConfirmPassword(e.target.value);
                                            if (confirmPasswordError) setConfirmPasswordError(false);
                                        }}
                                        placeholder="••••••••"
                                        className={`w-full bg-slate-950/40 border rounded-2xl py-3 pl-11 pr-4 text-slate-200 placeholder:text-slate-600 text-xs outline-none focus:ring-4 focus:ring-blue-500/5 transition-all ${
                                            confirmPasswordError ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-blue-500/85'
                                        }`}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/10 active:scale-[0.98]"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? (
                                        <>
                                            Sign In <LogIn size={14} />
                                        </>
                                    ) : (
                                        <>
                                            Register <UserPlus size={14} />
                                        </>
                                    )}
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Toggle Switch */}
                    <div className="mt-6 pt-5 border-t border-slate-800/40 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setValidationError(null);
                                setEmailError(false);
                                setPasswordError(false);
                                setConfirmPasswordError(false);
                            }}
                            className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 mx-auto"
                        >
                            {isLogin ? (
                                <>
                                    Need an account? <span className="text-blue-400 font-extrabold">Register</span> <ArrowRight size={10} />
                                </>
                            ) : (
                                <>
                                    Already registered? <span className="text-blue-400 font-extrabold">Sign In</span> <ArrowRight size={10} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
