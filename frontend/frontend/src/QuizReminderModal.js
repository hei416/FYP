import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { pushProgressToBackend } from './progressService';

const QuizReminderModal = ({ show, chapterCount, onClose, onDismiss }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (!show) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.iconWrapper}>🎯</div>
        <h2 style={styles.title}>Time to Test Your Knowledge!</h2>
        <p style={styles.body}>
          You've completed <strong>{chapterCount} chapters</strong> — great progress! 🚀
          <br /><br />
          Now tackle the <strong>Quiz</strong> and <strong>Practical Test</strong> designed
          for this milestone to check your understanding.
        </p>
        <div style={styles.buttonRow}>
          <button style={styles.quizBtn} onClick={() => { onClose(); navigate('/quiz'); }}>
            Go to Quiz
          </button>
          <button style={styles.testBtn} onClick={() => { onClose(); navigate('/practical-test'); }}>
            Go to Practical Test
          </button>
        </div>
        <button
          style={styles.dismissBtn}
          onClick={async () => {
            const dismissedKey = 'dismissed_milestones';
            const current = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
            if (!current.includes(chapterCount)) {
              current.push(chapterCount);
              localStorage.setItem(dismissedKey, JSON.stringify(current));
            }
            if (isAuthenticated) {
              try { await pushProgressToBackend(); } catch (e) { console.warn(e); }
            }
            onDismiss();
          }}
        >
          Remind me later
        </button>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  },
  modal: {
    background: '#1e1e2e', borderRadius: '16px', padding: '40px',
    maxWidth: '460px', width: '90%', textAlign: 'center',
    border: '1px solid #3d3d5c', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    color: '#fff',
  },
  iconWrapper: { fontSize: '48px', marginBottom: '12px' },
  title: { fontSize: '22px', fontWeight: '700', marginBottom: '12px', color: '#a78bfa' },
  body: { fontSize: '15px', lineHeight: '1.6', color: '#c4c4d4', marginBottom: '28px' },
  buttonRow: { display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' },
  quizBtn: {
    padding: '12px 24px', borderRadius: '8px', border: 'none',
    backgroundColor: '#7c3aed', color: '#fff', fontWeight: '600',
    cursor: 'pointer', fontSize: '14px',
  },
  testBtn: {
    padding: '12px 24px', borderRadius: '8px', border: 'none',
    backgroundColor: '#0ea5e9', color: '#fff', fontWeight: '600',
    cursor: 'pointer', fontSize: '14px',
  },
  dismissBtn: {
    background: 'none', border: 'none', color: '#888', cursor: 'pointer',
    fontSize: '13px', textDecoration: 'underline',
  },
};

export default QuizReminderModal;
