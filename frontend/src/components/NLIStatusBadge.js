import React, { useState, useEffect } from 'react';

/**
 * NLIStatusBadge — Displays real-time NLI (Natural Language Inference) validation status
 *
 * Polls the backend for faithfulness validation results and shows:
 * - "Validation in progress..." (gray) while checking
 * - "Response validated ✓ (92% grounded)" (green) if faithful
 * - "⚠️ Low confidence (23%) — check sources" (yellow) if low faithfulness
 * - "Validation error" (red) if check failed
 *
 * NOTE ON SCORE DISPLAY:
 * The backend returns both `nli_score` (raw DeBERTa entailment, 0–1) and
 * `display_score` (scaled relative to the model's practical ceiling for
 * paraphrased RAG answers). Always show `display_score` to the user.
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

        // Prefer display_score (scaled); fall back to raw nli_score if absent
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

  const badgeStyles = {
    pending: {
      backgroundColor: '#f3f4f6',
      borderColor: '#d1d5db',
      color: '#6b7280',
      icon: '⏳',
    },
    pass: {
      backgroundColor: '#dcfce7',
      borderColor: '#86efac',
      color: '#166534',
      icon: '✓',
    },
    alert: {
      backgroundColor: '#fef3c7',
      borderColor: '#fcd34d',
      color: '#92400e',
      icon: '⚠️',
    },
    error: {
      backgroundColor: '#fee2e2',
      borderColor: '#fca5a5',
      color: '#991b1b',
      icon: '❌',
    },
  };

  const style = badgeStyles[status] || badgeStyles.pending;

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
      {/* message already contains the score from the backend — no need to append again */}
      <span>{message}</span>
    </div>
  );
}
