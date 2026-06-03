/**
 * Component prop interfaces.
 * All UI component contracts live here — keep data/domain types in types.ts.
 */

import type React from 'react';
import type { InternalCandidate, PreviewFile, AnalysisResult, IngestStats } from './types';

// ── Header ────────────────────────────────────────────────────────────────────
export interface HeaderProps {
    user: { email: string } | null;
    onLogout: () => void;
    onLoginClick: () => void;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export interface SidebarProps {
    jobDesc: string;
    setJobDesc: (val: string) => void;
    onRefresh: () => void;
    onAnalyze: () => void;
    searchCooldown: boolean;
    analyzing: boolean;
    hasResults: boolean;
    retryTimer: number | null;
    analysis: AnalysisResult | null;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

// ── CandidateCard ─────────────────────────────────────────────────────────────
export interface CandidateCardProps {
    file: InternalCandidate | PreviewFile;
    onRemove?: (id: string) => void;
    isRemovable?: boolean;
    onView?: (location: string) => void;
    onDownload?: (location: string) => void;
    variant?: 'summary' | 'detailed';
    isStarred?: boolean;
    onStar?: (location: string, starred: boolean) => void;
    analysisDone?: boolean;
}

// ── CandidateGrid ─────────────────────────────────────────────────────────────
export interface CandidateGridProps {
    hasResults: boolean;
    analysisDone: boolean;
    candidates: InternalCandidate[];
    showOnlySuitable: boolean;
    setShowOnlySuitable: (val: boolean) => void;
    onView: (path: string | null) => void;
    onDownload: (path: string) => void;
    ingestStats: IngestStats | null;
    ingestTime: string | null;
    analysisTime: string | null;
    starredIds: Set<string>;
    onStar: (location: string, starred: boolean) => void;
    onConfigure: () => void;
    onClearRecords: () => void;
    isResetting: boolean;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export interface ModalProps {
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'primary';
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
}

// ── PdfViewer ─────────────────────────────────────────────────────────────────
export interface PdfViewerProps {
    url: string;
    onClose: () => void;
}

// ── KeywordInput ──────────────────────────────────────────────────────────────
export interface KeywordInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
}

// ── AnalysisOverlay ───────────────────────────────────────────────────────────
export interface AnalysisOverlayProps {
    analyzing: boolean;
    timer: string;
}

// ── DiamondLoader ─────────────────────────────────────────────────────────────
export interface DiamondLoaderProps {
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    className?: string;
}

// ── DiamondButton ─────────────────────────────────────────────────────────────
export interface DiamondButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
    loadingText?: string;
}

// ── AuthModal ─────────────────────────────────────────────────────────────────
export interface AuthModalProps {
    onClose: () => void;
    onSuccess: () => void;
}
