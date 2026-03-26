import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ProgressTracker } from './ProgressTracker';
import { listWork } from './myWorkService';
import { TOPIC_GROUPS, JAVA_SUBTOPIC_IDS } from './HomePage';
import { colors, radii, shadows, spacing, font, transition } from './theme';

export default function ProgressDisplay() {
    const [progress, setProgress] = useState({ completed: 0, total: 1 });
    const [showModal, setShowModal] = useState(false);
    const [detailedProgress, setDetailedProgress] = useState(null);

    const tracker = useMemo(() => new ProgressTracker(), []);

    const updateProgress = useCallback(async () => {
        try {
            const current = tracker.getTotalCompletion();
            let detailed = tracker.getDetailedProgress();

            // Fetch saved works from backend to compute honest attempted/passed counts
            let savedWorks = [];
            try {
                const res = await listWork();
                savedWorks = Array.isArray(res) ? res : [];
            } catch (e) {
                savedWorks = [];
            }

            if (savedWorks.length > 0) {
                const scoreOf = (w) => {
                    if (w.result_data && typeof w.result_data.score === 'number') return w.result_data.score;
                    if (typeof w.score === 'number') return w.score;
                    return undefined;
                };

                // Quizzes
                const quizTotalAttempts = savedWorks.filter(w => w.work_type === 'quiz').length;
                const quizPassedAttempts = savedWorks.filter(w => w.work_type === 'quiz' && (scoreOf(w) !== undefined) && scoreOf(w) >= 70).length;
                const subtopicToGroupLabel = (subId) => {
                    if (!subId) return null;
                    if (JAVA_SUBTOPIC_IDS.includes(subId)) {
                        const g = TOPIC_GROUPS.find(gr => gr.subtopics.includes(subId));
                        return g ? g.label : null;
                    }
                    // if it's already a group label
                    const g2 = TOPIC_GROUPS.find(gr => gr.label === subId);
                    if (g2) return g2.label;
                    return null;
                };

                const normalizeWorkToMainTopic = (w) => {
                    // prefer result_data.topics if present
                    const topicsArr = w.result_data && Array.isArray(w.result_data.topics) ? w.result_data.topics : null;
                    if (topicsArr && topicsArr.length > 0) {
                        for (const t of topicsArr) {
                            const lbl = subtopicToGroupLabel(t) || (TOPIC_GROUPS.find(g => g.label === t) ? t : null);
                            if (lbl) return lbl;
                        }
                    }
                    const tid = w.topic_id || null;
                    const lbl = subtopicToGroupLabel(tid) || (TOPIC_GROUPS.find(g => g.label === tid) ? tid : null);
                    return lbl || null;
                };

                // Debug: show quiz savedWork rows (helpful to verify topic_id presence)
                try {
                    console.log('Quiz savedWorks:', savedWorks
                        .filter(w => w.work_type === 'quiz')
                        .map(w => ({ id: w.id, topic_id: w.topic_id, result_data: w.result_data, score: scoreOf(w) }))
                    );
                } catch (e) { /* ignore console errors in old browsers */ }

                // Parse result_data.review to collect which subtopics/main topics were tested and passed
                const quizWorks = savedWorks.filter(w => w.work_type === 'quiz');
                const quizTestedTopics = new Set();
                const quizPassedTopicsSet = new Set();
                quizWorks.forEach(w => {
                    // Prefer an explicit list of topics if the quiz generator saved them
                    const declaredTopics = Array.isArray(w.result_data?.topics) ? w.result_data.topics : (Array.isArray(w.result_data?.topics_covered) ? w.result_data.topics_covered : null);
                    const passedSession = (scoreOf(w) !== undefined) && scoreOf(w) >= 70;
                    if (declaredTopics && declaredTopics.length > 0) {
                        declaredTopics.forEach(t => {
                            const key = subtopicToGroupLabel(t) || (TOPIC_GROUPS.find(g => g.label === t) ? t : null) || t;
                            if (key) {
                                quizTestedTopics.add(key);
                                if (passedSession) quizPassedTopicsSet.add(key);
                            }
                        });
                    }

                    // Also scan per-question review as a fallback to capture subtopic-level metadata
                    const review = (w.result_data && Array.isArray(w.result_data.review)) ? w.result_data.review : [];
                    const questions = review.length > 0 ? review : (Array.isArray(w.result_data?.questions) ? w.result_data.questions : []);
                    questions.forEach(q => {
                        const tid = q.topic_id || q.subtopic || q.topic || null;
                        const normalized = tid ? (subtopicToGroupLabel(tid) || (TOPIC_GROUPS.find(g => g.label === tid) ? tid : null)) : null;
                        const key = normalized || tid || null;
                        if (key) quizTestedTopics.add(key);
                        const correct = (typeof q.is_correct === 'boolean') ? q.is_correct : (q.correct === true || q.isCorrect === true);
                        if (key && correct) quizPassedTopicsSet.add(key);
                    });
                });
                const quizPassedTopics = quizPassedTopicsSet.size;
                const quizTestedCount = quizTestedTopics.size;

                // Tests
                const testTotalAttempts = savedWorks.filter(w => w.work_type === 'test').length;
                const testPassedAttempts = savedWorks.filter(w => w.work_type === 'test' && (scoreOf(w) !== undefined) && scoreOf(w) >= 60).length;
                // Parse test result_data similarly to quizzes
                const testWorks = savedWorks.filter(w => w.work_type === 'test');
                const testPassedTopicsSet = new Set();
                const testTestedTopics = new Set();

                // Read `topics_covered` (or fallback to `topics`) saved at the session level
                testWorks.forEach(w => {
                    const topics = Array.isArray(w.result_data?.topics_covered) ? w.result_data.topics_covered : (Array.isArray(w.result_data?.topics) ? w.result_data.topics : []);
                    const passed = (scoreOf(w) ?? 0) >= 60;
                    topics.forEach(t => {
                        const key = subtopicToGroupLabel(t) || (TOPIC_GROUPS.find(g => g.label === t) ? t : null) || t;
                        if (key) {
                            testTestedTopics.add(key);
                            if (passed) testPassedTopicsSet.add(key);
                        }
                    });
                });
                const testPassedTopics = testPassedTopicsSet.size;
                const testTestedCount = testTestedTopics.size;

                detailed = {
                    ...detailed,
                    quizzes: {
                        ...detailed.quizzes,
                        attempted: quizTotalAttempts,
                        passedAttempts: quizPassedAttempts,
                        passed: quizPassedTopics,
                        testedTopics: quizTestedCount
                    },
                    tests: {
                        ...detailed.tests,
                        attempted: testTotalAttempts,
                        passedAttempts: testPassedAttempts,
                        passed: testPassedTopics,
                        testedTopics: testTestedCount
                    }
                };
            }

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
                data-tour="progress-display"
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
                                total={TOPIC_GROUPS.length}
                                subtitle={`${detailedProgress.quizzes.attempted} sessions · ${detailedProgress.quizzes.passedAttempts} passing sessions · ${detailedProgress.quizzes.testedTopics || 0} topics covered`}
                                passCriteria={`Pass score: ≥${detailedProgress.quizzes.passScore}% per quiz`}
                                passColor="#FF9800"
                                color="#FF9800"
                            />

                            <ProgressItem
                                icon="🎯" title="Practical Tests"
                                completed={detailedProgress.tests.passed}
                                total={TOPIC_GROUPS.length}
                                subtitle={`${detailedProgress.tests.attempted} sessions · ${detailedProgress.tests.passedAttempts} passing sessions · ${detailedProgress.tests.testedTopics || 0} topics covered`}
                                passCriteria={`Pass score: ≥${detailedProgress.tests.passScore}% per test`}
                                passColor="#F44336"
                                color="#F44336"
                            />

                            {/* Code Playground — show execution count, not 0/1 */}
                            <div style={{
                                padding: spacing.lg, background: colors.bg,
                                borderRadius: radii.sm, border: `1px solid ${colors.divider}`
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '24px' }}>💻</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: colors.text, marginBottom: '2px' }}>
                                            Code Playground
                                        </div>
                                        <div style={{ fontSize: font.sizeXs, color: colors.textSecondary }}>
                                            {detailedProgress.playground.executions} code execution{detailedProgress.playground.executions !== 1 ? 's' : ''} completed
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: font.sizeSm, fontWeight: font.weightBold,
                                        color: detailedProgress.playground.completed ? '#4CAF50' : colors.textSecondary
                                    }}>
                                        {detailedProgress.playground.completed
                                            ? '✓ Completed'
                                            : `${detailedProgress.playground.executions} / 3`}
                                    </div>
                                </div>
                                <div style={{
                                    marginTop: '10px',
                                    width: '100%', height: '8px',
                                    background: colors.divider, borderRadius: radii.sm, overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${Math.min(100, Math.round((detailedProgress.playground.executions / 3) * 100))}%`,
                                        height: '100%', background: '#4CAF50',
                                        transition: 'width 0.5s ease', borderRadius: radii.sm
                                    }} />
                                </div>
                            </div>

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
