import React, { useState, useRef, useEffect } from 'react';
import { UserCircle2, LogOut, LogIn, UserPlus } from 'lucide-react';
import type { HeaderProps } from '../interfaces';

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onLoginClick }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <header className="h-16 px-8 border-b border-slate-200 bg-white flex justify-between items-center z-30 shadow-sm shrink-0 relative font-sans select-none">
            {/* Left — Brand */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-900 rounded-md flex items-center justify-center text-white font-bold text-base shadow-xl shadow-slate-900/20" aria-hidden="true">S</div>
                <div>
                    <div className="font-black text-slate-900 tracking-tight text-base uppercase leading-none">Snaphunt</div>
                    <div className="text-[9px] font-bold text-blue-500 tracking-[0.2em] uppercase opacity-80">Intelligence V2</div>
                </div>
            </div>

            {/* Right — Profile */}
            <div ref={ref} className="relative flex items-center gap-2.5">
                {/* Avatar */}
                <button
                    onClick={() => setOpen(v => !v)}
                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${
                        user
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-500'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    aria-label="Account menu"
                >
                    {user ? (
                        <span className="text-[11px] font-black uppercase">{user.email.charAt(0)}</span>
                    ) : (
                        <UserCircle2 size={16} />
                    )}
                </button>

                {/* Username label */}
                {user && (
                    <button
                        onClick={() => setOpen(v => !v)}
                        className="text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors max-w-[160px] truncate"
                    >
                        {user.email}
                    </button>
                )}

                {/* Dropdown */}
                {open && (
                    <div className="absolute right-0 top-11 w-64 bg-white border border-slate-200 rounded shadow-xl shadow-slate-900/10 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {user ? (
                            <>
                                <div className="px-4 py-3.5 border-b border-slate-100">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Signed in as</div>
                                    <div className="text-xs font-bold text-slate-800 truncate">{user.email}</div>
                                </div>
                                <button
                                    onClick={() => { setOpen(false); onLogout(); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-rose-600 hover:bg-rose-50 text-xs font-bold uppercase tracking-widest transition-colors"
                                >
                                    <LogOut size={14} />
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="px-4 py-3.5 border-b border-slate-100">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Account</div>
                                    <div className="text-xs text-slate-500 mt-0.5">Sign in to star candidates & save history</div>
                                </div>
                                <button
                                    onClick={() => { setOpen(false); onLoginClick(); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-50 text-xs font-bold uppercase tracking-widest transition-colors"
                                >
                                    <LogIn size={14} />
                                    Sign In
                                </button>
                                <button
                                    onClick={() => { setOpen(false); onLoginClick(); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-blue-600 hover:bg-blue-50 text-xs font-bold uppercase tracking-widest transition-colors border-t border-slate-100"
                                >
                                    <UserPlus size={14} />
                                    Register
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
};
