import React, { useState, useEffect } from 'react';

/**
 * NLIStatusBadge — Displays real-time NLI (Natural Language Inference) validation status
 * 
 * Polls the backend for faithfulness validation results and shows:
 * - "Validation in progress..." (gray) while checking
 * - "Response validated ✓ (92% grounded)" (green) if faithful
 * - "⚠️ Low confidence (65%) — check sources" (yellow) if low faithfulness
 * - "Validation error" (red) if check failed
 * 
 * Validation may take 10-30 seconds on first run (NLI model initialization).
 */
export default function NLIStatusBadge({ queryId, apiBase = 'http://localhost:8000' }) {
  const [status, setStatus] = useState('pending');
  const [score, setScore] = useState(null);
  const [message, setMessage] = useState('Validation in progress...');
  const [checkedAt, setCheckedAt] = useState(null);
  const [isSlowValidation, setIsSlowValidation] = useState(false);

  useEffect(() => {
    if (!queryId) return;

    let attempts = 0;
    const maxAttempts = 60; // Poll for up to 60 seconds (includes slower polling after 30s)
    const slowThreshold = 30; // After 30 seconds, assume it's a slow validation (model init)
    let pollTimer;

    const poll = async () => {
      attempts++;
      
      // Show message if validation is taking longer than expected
      if (attempts === slowThreshold) {
        setIsSlowValidation(true);
        setMessage('Validation in progress... (first-time model initialization)');
      }
      
      try {
        const response = await fetch(`${apiBase}/ragAI/status/${queryId}`);
        
        if (!response.ok) {
          console.error(`[NLI] Poll failed: HTTP ${response.status}`);
          if (attempts < maxAttempts) {
            // Slow down polling after slowThreshold to reduce backend load
            const interval = attempts > slowThreshold ? 2000 : 1000;
            pollTimer = setTimeout(poll, interval);
          } else {
            // Timeout: assume validation failed or is stuck
            setStatus('error');
            setMessage('Validation timed out — response may not have been checked');
          }
          return;
        }

        const data = await response.json();
        
        setStatus(data.status);
        setMessage(data.message);
        if (data.nli_score !== null && data.nli_score !== undefined) {
          setScore(data.nli_score);
        }
        if (data.checked_at) {
          setCheckedAt(data.checked_at);
        }

        // Stop polling if validation is complete (not pending)
        if (data.status !== 'pending') {
          console.log(`[NLI] Validation complete: ${data.status} (${data.nli_score?.toFixed(3) || '?'})`, data);
          setIsSlowValidation(false);
          return; // Stop polling
        }

        // Continue polling if still pending and haven't exceeded max attempts
        if (attempts < maxAttempts) {
          // Slow down polling after slowThreshold to reduce backend load
          const interval = attempts > slowThreshold ? 2000 : 1000;
          pollTimer = setTimeout(poll, interval);
        } else {
          // Timeout
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

    // Start polling
    poll();

    return () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, [queryId, apiBase]);

  // Map status to badge styling
  const badgeStyles = {
    'pending': {
      backgroundColor: '#f3f4f6', // gray-100
      borderColor: '#d1d5db',      // gray-300
      color: '#6b7280',             // gray-500
      icon: '⏳'
    },
    'pass': {
      backgroundColor: '#dcfce7',   // green-100
      borderColor: '#86efac',       // green-300
      color: '#166534',             // green-700
      icon: '✓'
    },
    'alert': {
      backgroundColor: '#fef3c7',   // yellow-100
      borderColor: '#fcd34d',       // yellow-300
      color: '#92400e',             // yellow-700
      icon: '⚠️'
    },
    'error': {
      backgroundColor: '#fee2e2',   // red-100
      borderColor: '#fca5a5',       // red-300
      color: '#991b1b',             // red-700
      icon: '❌'
    }
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
        userSelect: 'none'
      }}
      title={
        checkedAt
          ? `Last checked: ${new Date(checkedAt).toLocaleTimeString()}`
          : 'Checking response faithfulness...'
      }
    >
      <span style={{ marginRight: '6px' }}>{style.icon}</span>
      <span>{message}</span>
      {score !== null && status !== 'pending' && (
        <span style={{ marginLeft: '4px', opacity: 0.8 }}>
          ({(score * 100).toFixed(0)}%)
        </span>
      )}
    </div>
  );
}
