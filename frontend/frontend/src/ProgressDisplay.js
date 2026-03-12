// ProgressDisplay.js - Complete version for homepage

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ProgressTracker } from './ProgressTracker';
import { colors, radii, shadows, spacing, font, transition } from './theme';

export default function ProgressDisplay() {
    const [progress, setProgress] = useState({ completed: 0, total: 1 });
    const [showModal, setShowModal] = useState(false);
    const [detailedProgress, setDetailedProgress] = useState(null);

    // Create tracker instance once
    const tracker = useMemo(() => new ProgressTracker(), []);

    const updateProgress = useCallback(() => {
        try {
            const current = tracker.getTotalCompletion();
            const detailed = tracker.getDetailedProgress();
            setProgress(current);
            setDetailedProgress(detailed);
        } catch (error) {
            console.error('Error updating progress:', error);
            // Reset if there's an error
            tracker.resetProgress();
            const current = tracker.getTotalCompletion();
            const detailed = tracker.getDetailedProgress();
            setProgress(current);
            setDetailedProgress(detailed);
        }
    }, [tracker]);

    useEffect(() => {
        updateProgress();

        const handleProgressUpdate = () => {
            updateProgress();
        };

        // Listen for progress updates
        window.addEventListener('progress-updated', handleProgressUpdate);
        window.addEventListener('storage', handleProgressUpdate);

        // Poll every 2 seconds to catch roadmap updates
        const interval = setInterval(updateProgress, 2000);

        return () => {
            window.removeEventListener('progress-updated', handleProgressUpdate);
            window.removeEventListener('storage', handleProgressUpdate);
            clearInterval(interval);
        };
    }, [updateProgress]);

    const percentage = progress.total > 0 
        ? Math.round((progress.completed / progress.total) * 100) 
        : 0;

    const handleClick = useCallback(() => {
        try {
            // Sync before opening modal
            if (tracker && typeof tracker.syncWithRoadmap === 'function') {
                tracker.syncWithRoadmap();
            }
            updateProgress();
            setShowModal(true);
        } catch (error) {
            console.error('Error syncing:', error);
            updateProgress();
            setShowModal(true);
        }
    }, [tracker, updateProgress]);

    const closeModal = useCallback(() => {
        setShowModal(false);
    }, []);

    return (
        <>
            {/* Progress Display Button */}
            <button
                onClick={handleClick}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: `${spacing.sm}px ${spacing.lg}px`,
                    background: colors.primaryLight,
                    borderRadius: radii.xl,
                    border: `2px solid ${colors.primary}`,
                    boxShadow: shadows.sm,
                    cursor: 'pointer',
                    transition
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = shadows.md;
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = shadows.sm;
                }}
            >
                {/* Progress Circle */}
                <div style={{
                    position: 'relative',
                    width: '40px',
                    height: '40px'
                }}>
                    <svg width="40" height="40" style={{ transform: 'rotate(-90deg)' }}>
                        <circle
                            cx="20"
                            cy="20"
                            r="16"
                            fill="none"
                            stroke={colors.primaryBorder}
                            strokeWidth="4"
                        />
                        <circle
                            cx="20"
                            cy="20"
                            r="16"
                            fill="none"
                            stroke={colors.primary}
                            strokeWidth="4"
                            strokeDasharray={`${2 * Math.PI * 16}`}
                            strokeDashoffset={`${2 * Math.PI * 16 * (1 - percentage / 100)}`}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        />
                    </svg>
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '10px',
                        fontWeight: font.weightBold,
                        color: colors.primary
                    }}>
                        {percentage}%
                    </div>
                </div>

                {/* Progress Text */}
                <div>
                    <div style={{ 
                        fontSize: font.sizeXs, 
                        fontWeight: font.weightMedium,
                        color: colors.textSecondary,
                        lineHeight: '1.2'
                    }}>
                        Progress
                    </div>
                    <div style={{ 
                        fontSize: font.sizeMd, 
                        fontWeight: font.weightBold,
                        color: colors.primary,
                        lineHeight: '1.2'
                    }}>
                        {progress.completed}/{progress.total}
                    </div>
                </div>
            </button>

            {/* Modal */}
            {showModal && detailedProgress && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={closeModal}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: colors.backdrop,
                            zIndex: 9997
                        }}
                    />

                    {/* Modal Content */}
                    <div
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: colors.surface,
                            borderRadius: radii.lg,
                            padding: spacing.xxl,
                            maxWidth: '500px',
                            width: '90%',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            zIndex: 9998,
                            boxShadow: shadows.xl
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '24px'
                        }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: font.sizeXxl,
                                color: colors.primary,
                                fontWeight: font.weightBold
                            }}>
                                📊 Learning Progress
                            </h2>
                            <button
                                onClick={closeModal}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '28px',
                                    cursor: 'pointer',
                                    color: colors.textMuted,
                                    padding: '0',
                                    lineHeight: 1
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Overall Progress */}
                        <div style={{
                            background: colors.primaryLight,
                            padding: spacing.xl,
                            borderRadius: radii.md,
                            marginBottom: spacing.xl,
                            border: `2px solid ${colors.primary}`
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: spacing.md
                            }}>
                                <span style={{ fontSize: font.sizeMd, fontWeight: font.weightSemibold, color: colors.primary }}>
                                    Overall Progress
                                </span>
                                <span style={{ fontSize: font.sizeXl, fontWeight: font.weightBold, color: colors.primary }}>
                                    {progress.completed}/{progress.total}
                                </span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '12px',
                                background: colors.primaryBorder,
                                borderRadius: radii.sm,
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${percentage}%`,
                                    height: '100%',
                                    background: colors.primary,
                                    transition: 'width 0.5s ease',
                                    borderRadius: radii.sm
                                }}></div>
                            </div>
                        </div>

                        {/* Detailed Breakdown */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Roadmap Topics */}
                            <ProgressItem
                                icon="🗺️"
                                title="Learning Roadmap"
                                completed={detailedProgress.roadmap.completed}
                                total={detailedProgress.roadmap.total}
                                subtitle={`${detailedProgress.roadmap.percentage}% complete`}
                                color="#6366F1"
                            />

                            {/* Quizzes - always shown with fixed target */}
                            <ProgressItem
                                icon="📝"
                                title="Quizzes"
                                completed={detailedProgress.quizzes.passed}
                                total={detailedProgress.quizzes.target}
                                subtitle={`${detailedProgress.quizzes.attempted} attempted · aim for ≥${detailedProgress.quizzes.passScore}% per quiz`}
                                color="#FF9800"
                            />

                            {/* Practical Tests - always shown with fixed target */}
                            <ProgressItem
                                icon="🎯"
                                title="Practical Tests"
                                completed={detailedProgress.tests.passed}
                                total={detailedProgress.tests.target}
                                subtitle={`${detailedProgress.tests.attempted} attempted · aim for ≥${detailedProgress.tests.passScore}%`}
                                color="#F44336"
                            />

                            {/* Playground */}
                            <div style={{
                                padding: spacing.lg,
                                background: colors.bg,
                                borderRadius: radii.sm,
                                display: 'flex',
                                alignItems: 'center',
                                gap: spacing.md
                            }}>
                                <span style={{ fontSize: '24px' }}>💻</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: colors.text }}>
                                        Code Playground
                                    </div>
                                    <div style={{ fontSize: font.sizeXs, color: colors.textSecondary }}>
                                        {detailedProgress.playground.executions} code executions
                                    </div>
                                </div>
                            </div>

                            {/* AI Interactions */}
                            <div style={{
                                padding: spacing.lg,
                                background: colors.bg,
                                borderRadius: radii.sm,
                                display: 'flex',
                                alignItems: 'center',
                                gap: spacing.md
                            }}>
                                <span style={{ fontSize: '24px' }}>🤖</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: colors.text }}>
                                        AI Tutor Interactions
                                    </div>
                                    <div style={{ fontSize: font.sizeXs, color: colors.textSecondary }}>
                                        {detailedProgress.aiInteractions} questions asked
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Close Button */}
                        <div style={{ marginTop: '24px' }}>
                            <button
                                onClick={closeModal}
                                style={{
                                    width: '100%',
                                    padding: `${spacing.md}px`,
                                    background: colors.primary,
                                    border: 'none',
                                    borderRadius: radii.sm,
                                    cursor: 'pointer',
                                    fontSize: font.sizeSm,
                                    fontWeight: font.weightSemibold,
                                    color: colors.surface,
                                    transition
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = colors.primaryDark}
                                onMouseLeave={(e) => e.currentTarget.style.background = colors.primary}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

// Helper Component for Progress Items
function ProgressItem({ icon, title, completed, total, subtitle, color }) {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div style={{
            padding: spacing.lg,
            background: colors.bg,
            borderRadius: radii.sm,
            border: `1px solid ${colors.divider}`
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px'
            }}>
                <span style={{ fontSize: '24px' }}>{icon}</span>
                <div style={{ flex: 1 }}>
                    <div style={{ 
                        fontSize: font.sizeSm, 
                        fontWeight: font.weightSemibold, 
                        color: colors.text,
                        marginBottom: '2px'
                    }}>
                        {title}
                    </div>
                    <div style={{ fontSize: font.sizeXs, color: colors.textSecondary }}>
                        {subtitle}
                    </div>
                </div>
                <div style={{ 
                    fontSize: font.sizeMd, 
                    fontWeight: font.weightBold,
                    color: color
                }}>
                    {completed}/{total}
                </div>
            </div>
            <div style={{
                width: '100%',
                height: '8px',
                background: colors.divider,
                borderRadius: radii.sm,
                overflow: 'hidden'
            }}>
                <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: color,
                    transition: 'width 0.5s ease',
                    borderRadius: radii.sm
                }}></div>
            </div>
        </div>
    );
}