import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { joinClassroom, getEnrolledClassrooms } from './classroomService';
import { colors, radii, font, spacing, card, btn } from './theme';

export default function StudentClassrooms() {
  const { isStudent, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [classCode, setClassCode] = useState('');
  const [classes, setClasses] = useState([]);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  useEffect(() => {
    if (!loading && (!isAuthenticated || !isStudent)) {
      navigate('/');
    }
  }, [loading, isAuthenticated, isStudent, navigate]);

  useEffect(() => {
    if (isAuthenticated && isStudent) loadClasses();
  }, [isAuthenticated, isStudent]);

  async function loadClasses() {
    try {
      const data = await getEnrolledClassrooms();
      setClasses(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!classCode.trim()) return;
    setJoining(true);
    setJoinError('');
    setJoinSuccess('');
    try {
      const result = await joinClassroom(classCode.trim().toUpperCase());
      setJoinSuccess(`✓ Joined "${result.classroom_name}" successfully!`);
      setClassCode('');
      await loadClasses();
    } catch (e) {
      setJoinError(e.message);
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: font.sizeXxl, fontWeight: font.weightBold, color: colors.primary, marginBottom: 4 }}>🎓 My Classrooms</h2>
      <p style={{ color: colors.textMuted, marginBottom: 32, marginTop: 0 }}>Enter a class code from your teacher to join a classroom.</p>

      {/* Join form */}
      <div style={{ ...card, padding: 24, marginBottom: 32 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: font.sizeLg }}>Join a Classroom</h3>
        <form onSubmit={handleJoin} style={{ display: 'flex', gap: 12 }}>
          <input
            value={classCode}
            onChange={(e) => setClassCode(e.target.value.toUpperCase())}
            placeholder="Enter class code (e.g. JAVA1A2B)"
            maxLength={10}
            style={{
              flex: 1, padding: '10px 14px',
              border: `1px solid ${colors.border}`, borderRadius: radii.sm,
              fontSize: font.sizeMd, letterSpacing: 2, fontWeight: 600,
              outline: 'none', textTransform: 'uppercase',
            }}
          />
          <button type="submit" disabled={joining || !classCode.trim()} style={{ ...btn.primary, ...btn.small, whiteSpace: 'nowrap' }}>
            {joining ? 'Joining...' : 'Join'}
          </button>
        </form>
        {joinError && <p style={{ color: colors.error || '#ef4444', marginTop: 10, fontSize: font.sizeSm }}>{joinError}</p>}
        {joinSuccess && <p style={{ color: '#16a34a', marginTop: 10, fontSize: font.sizeSm }}>{joinSuccess}</p>}
      </div>

      {/* Enrolled classrooms */}
      <h3 style={{ fontSize: font.sizeLg, color: colors.text, marginBottom: 16 }}>Enrolled Classrooms ({classes.length})</h3>
      {classes.length === 0 ? (
        <div style={{ ...card, padding: 32, textAlign: 'center', color: colors.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <p>You haven't joined any classrooms yet.</p>
          <p style={{ fontSize: font.sizeSm }}>Ask your teacher for the class code and enter it above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {classes.map((cls) => (
            <div 
              key={cls.id} 
              onClick={() => navigate(`/classrooms/${cls.id}`)}
              style={{ 
                ...card, 
                padding: 20, 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = card.boxShadow || '0 1px 3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <h4 style={{ margin: '0 0 4px 0', color: colors.primary }}>{cls.name}</h4>
                {cls.description && <p style={{ margin: 0, fontSize: font.sizeSm, color: colors.textSecondary }}>{cls.description}</p>}
              </div>
              <code style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radii.sm, padding: '4px 10px', fontSize: font.sizeSm, fontWeight: font.weightBold, letterSpacing: 2, color: colors.primary }}>
                {cls.class_code}
              </code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
