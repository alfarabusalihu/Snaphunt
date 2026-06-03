import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Config, QueryResponse, AnalysisResult, IngestStats, InternalCandidate, CvCollection } from '../types';

interface User {
    id: string;
    email: string;
}

interface AppState {
    // App data
    config: Config | null;
    results: QueryResponse | null;
    analysis: AnalysisResult | null;
    ingestStats: IngestStats | null;
    ingestTime: string | null;
    analysisTime: string | null;
    hasAnalyzed: boolean;
    keywords: string[];
    provider: string | null;
    // CV collection history (only persisted for authenticated users)
    cvCollections: CvCollection[];
    // Auth (persisted in localStorage)
    token: string | null;
    user: User | null;
    anonId: string;
    sessionId: string; // Unique per browser session

    // Actions
    setConfig: (config: Config | null) => void;
    setResults: (results: QueryResponse | null) => void;
    setAnalysis: (analysis: AnalysisResult | null) => void;
    setIngestStats: (stats: IngestStats | null) => void;
    setIngestTime: (time: string | null) => void;
    setAnalysisTime: (time: string | null) => void;
    setHasAnalyzed: (val: boolean) => void;
    setKeywords: (keywords: string[]) => void;
    setProvider: (provider: string | null) => void;
    saveCollection: (candidates: InternalCandidate[], keywords: string[], filterContext: string, name: string) => void;
    deleteCollection: (id: string) => void;
    setToken: (token: string | null) => void;
    setUser: (user: User | null) => void;
    setAnonId: (anonId: string) => void;
    setAuth: (token: string, user: User) => void;
    clearAuth: () => void;
    reset: () => void;
}

// Custom storage that partitions data: auth in localStorage, sessions are unique
const customStorage = createJSONStorage(() => ({
    getItem: (name: string) => {
        // Try to get auth from localStorage
        const authData = localStorage.getItem(`${name}-auth`);
        
        // For anonymous users, don't persist anything - fresh start each time
        if (!authData) {
            return null;
        }
        
        // For authenticated users, get their persisted data from localStorage
        const userData = localStorage.getItem(name);
        if (userData) {
            const parsed = JSON.parse(userData);
            const auth = JSON.parse(authData);
            return JSON.stringify({ ...parsed, ...auth });
        }
        
        return authData;
    },
    setItem: (name: string, value: string) => {
        try {
            const state = JSON.parse(value);
            
            // Always persist auth data
            const authData = {
                token: state.token,
                user: state.user,
                anonId: state.anonId
            };
            localStorage.setItem(`${name}-auth`, JSON.stringify(authData));
            
            // Only persist work data for authenticated users
            if (state.token && state.user) {
                const workData = {
                    cvCollections: state.cvCollections
                };
                localStorage.setItem(name, JSON.stringify(workData));
            } else {
                // Clear work data for anonymous users
                localStorage.removeItem(name);
            }
        } catch (e) {
            console.error('Failed to persist state:', e);
        }
    },
    removeItem: (name: string) => {
        localStorage.removeItem(name);
        localStorage.removeItem(`${name}-auth`);
    }
}));

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            config: null,
            results: null,
            analysis: null,
            ingestStats: null,
            ingestTime: null,
            analysisTime: null,
            hasAnalyzed: false,
            keywords: [],
            provider: null,
            cvCollections: [],
            token: null,
            user: null,
            anonId: crypto.randomUUID(),
            sessionId: crypto.randomUUID(), // New unique session ID

            setConfig: (config) => set({ config }),
            setResults: (results) => set({ results }),
            setAnalysis: (analysis) => set({ analysis }),
            setIngestStats: (ingestStats) => set({ ingestStats }),
            setIngestTime: (ingestTime) => set({ ingestTime }),
            setAnalysisTime: (analysisTime) => set({ analysisTime }),
            setHasAnalyzed: (hasAnalyzed) => set({ hasAnalyzed }),
            setKeywords: (keywords) => set({ keywords }),
            setProvider: (provider) => set({ provider }),

            saveCollection: (candidates, keywords, filterContext, name) =>
                set((state) => ({
                    cvCollections: [
                        {
                            id: crypto.randomUUID(),
                            name,
                            createdAt: new Date().toISOString(),
                            candidates,
                            keywords,
                            filterContext,
                        },
                        // Keep last 20 collections max
                        ...state.cvCollections.slice(0, 19),
                    ],
                })),

            deleteCollection: (id) =>
                set((state) => ({
                    cvCollections: state.cvCollections.filter((c) => c.id !== id),
                })),

            setToken: (token) => set({ token }),
            setUser: (user) => set({ user }),
            setAnonId: (anonId) => set({ anonId }),
            setAuth: (token, user) => set({ token, user }),
            clearAuth: () => set({ 
                token: null, 
                user: null,
                // Clear anonymous work data on logout
                config: null,
                results: null,
                analysis: null,
                ingestStats: null,
                ingestTime: null,
                analysisTime: null,
                hasAnalyzed: false,
            }),

            reset: () =>
                set((state) => ({
                    config: null,
                    results: null,
                    analysis: null,
                    ingestStats: null,
                    ingestTime: null,
                    analysisTime: null,
                    hasAnalyzed: false,
                    keywords: [],
                    provider: null,
                    cvCollections: state.user ? state.cvCollections : [], // Keep collections for authenticated users
                    token: state.token,
                    user: state.user,
                    anonId: state.anonId,
                    sessionId: crypto.randomUUID(), // Generate new session ID on reset
                })),
        }),
        {
            name: 'snaphunt-session',
            storage: customStorage,
            // Only persist auth data, not work data for anonymous users
            partialize: (state) => ({
                token: state.token,
                user: state.user,
                anonId: state.anonId,
                cvCollections: state.user ? state.cvCollections : [] // Only persist collections for authenticated users
            })
        }
    )
);
