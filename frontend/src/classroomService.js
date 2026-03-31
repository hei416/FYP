const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

function authHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || ''}`,
  };
}

function getToken() {
  return localStorage.getItem('authToken') || '';
}

// ---------------------------------------------------------------------------
// Classroom CRUD
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Legacy document management (kept for backwards compatibility)
// ---------------------------------------------------------------------------

export const uploadDocument = async (classroomId, file, token) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json();
};

export const listDocuments = async (classroomId, token) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

export const deleteDocument = async (classroomId, docId, token) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/documents/${docId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

export const askClassroomRAG = async (classroomId, question, token) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }),
  });
  return res.json();
};

// ---------------------------------------------------------------------------
// NEW: DB-backed file endpoints
// ---------------------------------------------------------------------------

/**
 * Upload a file to a classroom (teacher only).
 * The file is stored in the DB and immediately indexed for RAG.
 */
export const uploadClassroomFile = async (classroomId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    // Do NOT set Content-Type — browser sets multipart/form-data boundary automatically
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/**
 * List file metadata for a classroom (no binary data returned).
 */
export const listClassroomFiles = async (classroomId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/files`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/**
 * Trigger a browser download for a classroom file.
 */
export const downloadClassroomFile = (classroomId, fileId, filename) => {
  const a = document.createElement('a');
  a.href = `${API_BASE}/classrooms/${classroomId}/files/${fileId}/download`;
  // Inject auth header via fetch+blob for protected routes
  fetch(a.href, { headers: { Authorization: `Bearer ${getToken()}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    })
    .catch(console.error);
};

/**
 * View a classroom file in the browser (inline viewing).
 */
export const viewClassroomFile = (classroomId, fileId, filename) => {
  const a = document.createElement('a');
  a.href = `${API_BASE}/classrooms/${classroomId}/files/${fileId}/view`;
  a.target = '_blank';
  // Inject auth header via fetch+blob for protected routes
  fetch(a.href, { headers: { Authorization: `Bearer ${getToken()}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.target = '_blank';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    })
    .catch(console.error);
};

/**
 * Delete a classroom file (teacher only). Chunks are cascade-deleted.
 */
export const deleteClassroomFile = async (classroomId, fileId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/**
 * Ask a question scoped to a classroom's uploaded documents.
 */
export const askClassroom = async (classroomId, question) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ question, mode: 'classroom' }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ [ASK] HTTP ${res.status}: ${text.substring(0, 200)}`);
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  console.log(`✅ [ASK] Response:`, data);
  return data;
};
