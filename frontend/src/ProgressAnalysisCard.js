import React from 'react';
import { colors, radii, font, spacing } from './theme';

/**
 * ProgressAnalysisCard
 * Displays progress analytics for a student in a classroom
 * Shows: completion %, weak areas, quiz/test stats, last updated
 */
export default function ProgressAnalysisCard({ progress, classroomName, isLoading = false }) {
  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: `1px solid ${colors.border}`,
          borderRadius: radii.md,
          padding: 16,
          marginTop: 12,
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: font.sizeSm, color: colors.textMuted, margin: 0 }}>Loading progress...</p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: `1px solid ${colors.border}`,
          borderRadius: radii.md,
          padding: 16,
          marginTop: 12,
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: font.sizeSm, color: colors.textMuted, margin: 0 }}>No progress data available</p>
      </div>
    );
  }

  const completionPct = Math.round(progress.completion_percentage || 0);
  const weakTopics = progress.weak_topics || [];
  const quizzesAttempted = progress.quizzes_attempted || 0;
  const testsPassed = progress.tests_passed?.length || 0;
  const updatedAt = progress.updated_at ? new Date(progress.updated_at) : null;

  // Determine the progress color
  const getProgressColor = (pct) => {
    if (pct < 30) return '#ef4444'; // red
    if (pct < 60) return '#f97316'; // orange
    if (pct < 100) return '#eab308'; // yellow
    return '#22c55e'; // green
  };

  const progressColor = getProgressColor(completionPct);

  return (
    <div
      style={{
        backgroundColor: '#f8fafc',
        border: `1px solid ${colors.border}`,
        borderRadius: radii.md,
        padding: 16,
        marginTop: 12,
        marginBottom: 16,
        fontSize: font.sizeSm,
      }}
    >
      {/* Header: Completion percentage with progress bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontWeight: font.weightMedium, color: colors.text }}>📊 Progress</span>
          <span style={{ fontWeight: font.weightBold, color: progressColor }}>{completionPct}%</span>
        </div>
        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: 6,
            backgroundColor: colors.background,
            borderRadius: radii.full,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${completionPct}%`,
              height: '100%',
              backgroundColor: progressColor,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Weak Areas */}
      {weakTopics.length > 0 && (
        <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ fontWeight: font.weightMedium, color: colors.text, marginBottom: 6 }}>⚠️ Weak Areas</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {weakTopics.slice(0, 3).map((topic, idx) => (
              <span
                key={idx}
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  padding: '2px 8px',
                  borderRadius: radii.sm,
                  fontSize: '0.75rem',
                  fontWeight: font.weightMedium,
                }}
              >
                {topic.name} ({Math.round(topic.score)}%)
              </span>
            ))}
            {weakTopics.length > 3 && (
              <span
                style={{
                  color: colors.textMuted,
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                }}
              >
                +{weakTopics.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 0,
        }}
      >
        <div style={{ backgroundColor: '#eff6ff', padding: 8, borderRadius: radii.sm, textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginBottom: 2 }}>Quizzes</div>
          <div style={{ fontWeight: font.weightBold, color: colors.primary, fontSize: font.sizeMd }}>
            {quizzesAttempted}
          </div>
        </div>
        <div style={{ backgroundColor: '#f0fdf4', padding: 8, borderRadius: radii.sm, textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginBottom: 2 }}>Tests Passed</div>
          <div style={{ fontWeight: font.weightBold, color: '#16a34a', fontSize: font.sizeMd }}>
            {testsPassed}
          </div>
        </div>
      </div>

      {/* Last updated */}
      {updatedAt && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: `1px solid ${colors.border}`,
            fontSize: '0.7rem',
            color: colors.textMuted,
            textAlign: 'center',
          }}
        >
          Updated {updatedAt.toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
