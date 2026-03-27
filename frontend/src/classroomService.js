const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

function authHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || ''}`,
  };
}

export async function createClassroom({ name, description }) {
  const res = await fetch(`${API_BASE}/classrooms`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create classroom');
  }
  return res.json();
}

export async function getMyClassrooms() {
  const res = await fetch(`${API_BASE}/classrooms/my`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load classrooms');
  return res.json();
}

export async function getClassroomAnalytics(classroomId) {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/analytics`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}

export async function joinClassroom(class_code) {
  const res = await fetch(`${API_BASE}/classrooms/join`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ class_code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to join classroom');
  }
  return res.json();
}

export async function getEnrolledClassrooms() {
  const res = await fetch(`${API_BASE}/classrooms/enrolled`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load enrolled classrooms');
  return res.json();
}
