import React, { useState, useEffect } from 'react';

/**
 * NLIStatusBadge — 4-tier faithfulness display
 *
 * Tiers (score = faithful_claims / total_claims):
 *   >= 0.90  Highly Grounded  ✅  dark green
 *   0.70–0.89  Pass           ✓   green
 *   0.50–0.69  Partial        ⚠️  amber
 *   < 0.50   Alert            🔴  red
 *
 * Validation may take 10-30 seconds on first run (NLI model initialization).
 */
export default function NLIStatusBadge({ queryId, apiBase = 'http://localhost:8000' }) {
  const [status, setStatus] = useState('pending');
  const [displayScore, setDisplayScore] = useState(null);
  const [message, setMessage] = useState('Validation in progress...');
  const [checkedAt, setCheckedAt] = useState(null);
  const [isSlowValidation, setIsSlowValidation] = useState(false);

  useEffect(() => {
    if (!queryId) return;

    let attempts = 0;
    const maxAttempts = 60;
    const slowThreshold = 30;
    let pollTimer;

    const poll = async () => {
      attempts++;

      if (attempts === slowThreshold) {
        setIsSlowValidation(true);
        setMessage('Validation in progress... (first-time model initialization)');
      }

      try {
        const response = await fetch(`${apiBase}/ragAI/status/${queryId}`);

        if (!response.ok) {
          console.error(`[NLI] Poll failed: HTTP ${response.status}`);
          if (attempts < maxAttempts) {
            const interval = attempts > slowThreshold ? 2000 : 1000;
            pollTimer = setTimeout(poll, interval);
          } else {
            setStatus('error');
            setMessage('Validation timed out — response may not have been checked');
          }
          return;
        }

        const data = await response.json();

        setStatus(data.status);
        setMessage(data.message);

        const scored = data.display_score ?? data.nli_score;
        if (scored !== null && scored !== undefined) {
          setDisplayScore(scored);
        }
        if (data.checked_at) {
          setCheckedAt(data.checked_at);
        }

        if (data.status !== 'pending') {
          console.log(
            `[NLI] Validation complete: ${data.status}`,
            `raw=${data.nli_score?.toFixed(3) ?? '?'}`,
            `display=${scored?.toFixed(3) ?? '?'}`,
            data
          );
          setIsSlowValidation(false);
          return;
        }

        if (attempts < maxAttempts) {
          const interval = attempts > slowThreshold ? 2000 : 1000;
          pollTimer = setTimeout(poll, interval);
        } else {
          setStatus('error');
          setMessage('Validation timed out — response may not have been checked');
          setIsSlowValidation(false);
        }
      } catch (error) {
        console.error('[NLI] Poll error:', error);
        if (attempts < maxAttempts) {
          const interval = attempts > slowThreshold ? 2000 : 1000;
          pollTimer = setTimeout(poll, interval);
        } else {
          setStatus('error');
          setMessage('Validation failed to complete');
          setIsSlowValidation(false);
        }
      }
    };

    poll();

    return () => {
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [queryId, apiBase]);

  /**
   * Map a 0-1 faithfulness score to one of four visual tiers.
   * When still pending or score unavailable, falls back to status-based styling.
   */
  const getTier = (score, baseStatus) => {
    if (baseStatus === 'pending') return 'pending';
    if (baseStatus === 'error')   return 'error';
    if (score === null || score === undefined) {
      // backend returned pass/alert without a score — honour it
      return baseStatus === 'pass' ? 'pass' : 'alert';
    }
    if (score >= 0.90) return 'highly_grounded';
    if (score >= 0.70) return 'pass';
    if (score >= 0.50) return 'partial';
    return 'alert';
  };

  const tierStyles = {
    pending: {
      backgroundColor: '#f3f4f6',
      borderColor: '#d1d5db',
      color: '#6b7280',
      icon: '⏳',
      label: 'Validating…',
    },
    highly_grounded: {
      backgroundColor: '#dcfce7',
      borderColor: '#16a34a',
      color: '#14532d',
      icon: '✅',
      label: 'Highly Grounded',
    },
    pass: {
      backgroundColor: '#dcfce7',
      borderColor: '#86efac',
      color: '#166534',
      icon: '✓',
      label: 'Grounded',
    },
    partial: {
      backgroundColor: '#fef3c7',
      borderColor: '#fcd34d',
      color: '#92400e',
      icon: '⚠️',
      label: 'Partially Grounded',
    },
    alert: {
      backgroundColor: '#fee2e2',
      borderColor: '#fca5a5',
      color: '#991b1b',
      icon: '🔴',
      label: 'Low Grounding — check sources',
    },
    error: {
      backgroundColor: '#fee2e2',
      borderColor: '#fca5a5',
      color: '#991b1b',
      icon: '❌',
      label: 'Validation error',
    },
  };

  const tier = getTier(displayScore, status);
  const style = tierStyles[tier];
  const pct = displayScore !== null && displayScore !== undefined
    ? `${Math.round(displayScore * 100)}%`
    : null;

  return (
    <div
      style={{
        display: 'inline-block',
        padding: '8px 12px',
        marginTop: '8px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '500',
        backgroundColor: style.backgroundColor,
        borderLeft: `3px solid ${style.borderColor}`,
        color: style.color,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
      }}
      title={
        checkedAt
          ? `Last checked: ${new Date(checkedAt).toLocaleTimeString()}`
          : 'Checking response faithfulness...'
      }
    >
      <span style={{ marginRight: '6px' }}>{style.icon}</span>
      <span>
        {tier === 'pending'
          ? message
          : tier === 'error'
            ? (message || style.label)
            : pct
              ? `${style.label} (${pct} grounded)`
              : style.label
        }
      </span>
    </div>
  );
}
