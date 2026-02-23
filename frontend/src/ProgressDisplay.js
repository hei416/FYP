// ProgressDisplay.js - Complete version for homepage

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ProgressTracker } from './ProgressTracker';

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
                    gap: '12px',
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    borderRadius: '20px',
                    border: '2px solid #2196F3',
                    boxShadow: '0 2px 6px rgba(33, 150, 243, 0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.3)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(33, 150, 243, 0.2)';
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
                            stroke="#e0e7ff"
                            strokeWidth="4"
                        />
                        <circle
                            cx="20"
                            cy="20"
                            r="16"
                            fill="none"
                            stroke="#2196F3"
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
                        fontWeight: 'bold',
                        color: '#2196F3'
                    }}>
                        {percentage}%
                    </div>
                </div>

                {/* Progress Text */}
                <div>
                    <div style={{ 
                        fontSize: '12px', 
                        fontWeight: '500',
                        color: '#64748b',
                        lineHeight: '1.2'
                    }}>
                        Progress
                    </div>
                    <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold',
                        color: '#2196F3',
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
                            background: 'rgba(0, 0, 0, 0.6)',
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
                            background: 'white',
                            borderRadius: '16px',
                            padding: '32px',
                            maxWidth: '500px',
                            width: '90%',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            zIndex: 9998,
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
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
                                fontSize: '24px',
                                color: '#2196F3',
                                fontWeight: 'bold'
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
                                    color: '#9ca3af',
                                    padding: '0',
                                    lineHeight: 1
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Overall Progress */}
                        <div style={{
                            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                            padding: '20px',
                            borderRadius: '12px',
                            marginBottom: '24px',
                            border: '2px solid #2196F3'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '12px'
                            }}>
                                <span style={{ fontSize: '16px', fontWeight: '600', color: '#1976D2' }}>
                                    Overall Progress
                                </span>
                                <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#2196F3' }}>
                                    {progress.completed}/{progress.total}
                                </span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '12px',
                                background: '#e0e7ff',
                                borderRadius: '6px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${percentage}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #2196F3 0%, #1976D2 100%)',
                                    transition: 'width 0.5s ease',
                                    borderRadius: '6px'
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

                            {/* Playground */}
                            <ProgressItem
                                icon="💻"
                                title="Code Playground"
                                completed={detailedProgress.playground.completed ? 1 : 0}
                                total={1}
                                subtitle={`${detailedProgress.playground.executions} code executions`}
                                color="#4CAF50"
                            />

                            {/* Quizzes - only show if total > 0 */}
                            {detailedProgress.quizzes.total > 0 && (
                                <ProgressItem
                                    icon="📝"
                                    title="Quizzes"
                                    completed={detailedProgress.quizzes.completed}
                                    total={detailedProgress.quizzes.total}
                                    subtitle={`${detailedProgress.quizzes.attempted} attempted`}
                                    color="#FF9800"
                                />
                            )}

                            {/* Tests - only show if total > 0 */}
                            {detailedProgress.tests.total > 0 && (
                                <ProgressItem
                                    icon="🎯"
                                    title="Practical Tests"
                                    completed={detailedProgress.tests.passed}
                                    total={detailedProgress.tests.total}
                                    subtitle={`${detailedProgress.tests.attempted} attempted`}
                                    color="#F44336"
                                />
                            )}

                            {/* AI Interactions */}
                            <div style={{
                                padding: '16px',
                                background: '#f9fafb',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <span style={{ fontSize: '24px' }}>🤖</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                        AI Tutor Interactions
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
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
                                    padding: '12px',
                                    background: '#2196F3',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: 'white',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#1976D2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#2196F3'}
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
            padding: '16px',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
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
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: '#374151',
                        marginBottom: '2px'
                    }}>
                        {title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {subtitle}
                    </div>
                </div>
                <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold',
                    color: color
                }}>
                    {completed}/{total}
                </div>
            </div>
            <div style={{
                width: '100%',
                height: '8px',
                background: '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: color,
                    transition: 'width 0.5s ease',
                    borderRadius: '4px'
                }}></div>
            </div>
        </div>
    );
}