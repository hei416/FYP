// ProgressDisplay.js - Complete version for homepage

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ProgressTracker } from './ProgressTracker';
import { colors, radii, shadows, spacing, font, transition } from './theme';

export default function ProgressDisplay() {
    const [progress, setProgress] = useState({ completed: 0, total: 1 });
    const [showModal, setShowModal] = useState(false);
    const [detailedProgress, setDetailedProgress] = useState(null);

    const tracker = useMemo(() => new ProgressTracker(), []);

    const updateProgress = useCallback(() => {
        try {
            const current = tracker.getTotalCompletion();
            const detailed = tracker.getDetailedProgress();
            setProgress(current);
            setDetailedProgress(detailed);
        } catch (error) {
            console.error('Error updating progress:', error);
            tracker.resetProgress();
            const current = tracker.getTotalCompletion();
            const detailed = tracker.getDetailedProgress();
            setProgress(current);
            setDetailedProgress(detailed);
        }
    }, [tracker]);

    useEffect(() => {
        updateProgress();
        const handleProgressUpdate = () => updateProgress();
        window.addEventListener('progress-updated', handleProgressUpdate);
        window.addEventListener('storage', handleProgressUpdate);
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

    const closeModal = useCallback(() => setShowModal(false), []);

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
                <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                    <svg width="40" height="40" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="20" cy="20" r="16" fill="none" stroke={colors.primaryBorder} strokeWidth="4" />
                        <circle
                            cx="20" cy="20" r="16" fill="none"
                            stroke={colors.primary} strokeWidth="4"
                            strokeDasharray={`${2 * Math.PI * 16}`}
                            strokeDashoffset={`${2 * Math.PI * 16 * (1 - percentage / 100)}`}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        />
                    </svg>
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '10px', fontWeight: font.weightBold, color: colors.primary
                    }}>
                        {percentage}%
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: font.sizeXs, fontWeight: font.weightMedium, color: colors.textSecondary, lineHeight: '1.2' }}>
                        Progress
                    </div>
                    <div style={{ fontSize: font.sizeMd, fontWeight: font.weightBold, color: colors.primary, lineHeight: '1.2' }}>
                        {progress.completed}/{progress.total}
                    </div>
                </div>
            </button>

            {/* Modal */}
            {showModal && detailedProgress && (
                <>
                    <div onClick={closeModal} style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: colors.backdrop, zIndex: 9997
                    }} />

                    <div style={{
                        position: 'fixed', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: colors.surface, borderRadius: radii.lg,
                        padding: spacing.xxl, maxWidth: '500px', width: '90%',
                        maxHeight: '80vh', overflowY: 'auto',
                        zIndex: 9998, boxShadow: shadows.xl
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: font.sizeXxl, color: colors.primary, fontWeight: font.weightBold }}>
                                📊 Learning Progress
                            </h2>
                            <button onClick={closeModal} style={{
                                background: 'none', border: 'none', fontSize: '28px',
                                cursor: 'pointer', color: colors.textMuted, padding: '0', lineHeight: 1
                            }}>×</button>
                        </div>

                        {/* Overall Progress */}
                        <div style={{
                            background: colors.primaryLight, padding: spacing.xl,
                            borderRadius: radii.md, marginBottom: spacing.xl,
                            border: `2px solid ${colors.primary}`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                                <span style={{ fontSize: font.sizeMd, fontWeight: font.weightSemibold, color: colors.primary }}>Overall Progress</span>
                                <span style={{ fontSize: font.sizeXl, fontWeight: font.weightBold, color: colors.primary }}>{progress.completed}/{progress.total}</span>
                            </div>
                            <div style={{ width: '100%', height: '12px', background: colors.primaryBorder, borderRadius: radii.sm, overflow: 'hidden' }}>
                                <div style={{ width: `${percentage}%`, height: '100%', background: colors.primary, transition: 'width 0.5s ease', borderRadius: radii.sm }} />
                            </div>
                        </div>

                        {/* Detailed Breakdown — order: Roadmap → Quizzes → Practical Tests → Playground → AI */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <ProgressItem
                                icon="🗺️" title="Learning Roadmap"
                                completed={detailedProgress.roadmap.completed}
                                total={detailedProgress.roadmap.total}
                                subtitle={`${detailedProgress.roadmap.percentage}% complete`}
                                color="#6366F1"
                            />
                            <ProgressItem
                                icon="📝" title="Quizzes"
                                completed={detailedProgress.quizzes.passed}
                                total={detailedProgress.quizzes.target}
                                subtitle={`${detailedProgress.quizzes.attempted} attempted`}
                                passCriteria={`Pass score: ≥${detailedProgress.quizzes.passScore}% per quiz`}
                                passColor="#FF9800"
                                color="#FF9800"
                            />
                            <ProgressItem
                                icon="🎯" title="Practical Tests"
                                completed={detailedProgress.tests.passed}
                                total={detailedProgress.tests.target}
                                subtitle={`${detailedProgress.tests.attempted} attempted`}
                                passCriteria={`Pass score: ≥${detailedProgress.tests.passScore}% per test`}
                                passColor="#F44336"
                                color="#F44336"
                            />
                            <ProgressItem
                                icon="💻" title="Code Playground"
                                completed={detailedProgress.playground.completed ? 1 : 0}
                                total={1}
                                subtitle={`${detailedProgress.playground.executions} code executions`}
                                color="#4CAF50"
                            />

                            {/* AI Interactions */}
                            <div style={{
                                padding: spacing.lg, background: colors.bg,
                                borderRadius: radii.sm, display: 'flex',
                                alignItems: 'center', gap: spacing.md
                            }}>
                                <span style={{ fontSize: '24px' }}>🤖</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: colors.text }}>AI Tutor Interactions</div>
                                    <div style={{ fontSize: font.sizeXs, color: colors.textSecondary }}>{detailedProgress.aiInteractions} questions asked</div>
                                </div>
                            </div>
                        </div>

                        {/* Close Button */}
                        <div style={{ marginTop: '24px' }}>
                            <button
                                onClick={closeModal}
                                style={{
                                    width: '100%', padding: `${spacing.md}px`,
                                    background: colors.primary, border: 'none',
                                    borderRadius: radii.sm, cursor: 'pointer',
                                    fontSize: font.sizeSm, fontWeight: font.weightSemibold,
                                    color: colors.surface, transition
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

function ProgressItem({ icon, title, completed, total, subtitle, passCriteria, passColor, color }) {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div style={{
            padding: spacing.lg, background: colors.bg,
            borderRadius: radii.sm, border: `1px solid ${colors.divider}`
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px', marginTop: '2px' }}>{icon}</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: colors.text, marginBottom: '2px' }}>
                        {title}
                    </div>
                    <div style={{ fontSize: font.sizeXs, color: colors.textSecondary }}>
                        {subtitle}
                    </div>
                    {passCriteria && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            marginTop: '5px', padding: '2px 8px',
                            borderRadius: '999px',
                            background: `${passColor}18`,
                            border: `1px solid ${passColor}55`,
                            fontSize: '10px', fontWeight: font.weightSemibold,
                            color: passColor, letterSpacing: '0.01em'
                        }}>
                            <span style={{ fontSize: '9px' }}>✓</span>
                            {passCriteria}
                        </div>
                    )}
                </div>
                <div style={{ fontSize: font.sizeMd, fontWeight: font.weightBold, color, flexShrink: 0 }}>
                    {completed}/{total}
                </div>
            </div>
            <div style={{ width: '100%', height: '8px', background: colors.divider, borderRadius: radii.sm, overflow: 'hidden' }}>
                <div style={{
                    width: `${percentage}%`, height: '100%',
                    background: color, transition: 'width 0.5s ease', borderRadius: radii.sm
                }} />
            </div>
        </div>
    );
}
