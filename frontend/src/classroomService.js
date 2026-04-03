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

export async function createClassroom({ name, description, category = 'Official Lessons', enrolled_courses = ['basic'] }) {
  const res = await fetch(`${API_BASE}/classrooms`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, description, category, enrolled_courses }),
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

export async function getOfficialClassrooms() {
  const res = await fetch(`${API_BASE}/classrooms/official/list`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load official classrooms');
  return res.json();
}

export async function updateClassroom(classroomId, updates) {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update classroom');
  }
  return res.json();
}

export async function updateClassroomCategory(classroomId, category) {
  return updateClassroom(classroomId, { category });
}

export async function toggleClassroomPublic(classroomId, is_public) {
  return updateClassroom(classroomId, { is_public });
}

export async function getPublicClassrooms() {
  const token = localStorage.getItem('authToken');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}/classrooms/public`, { headers });
  if (!res.ok) throw new Error('Failed to load public classrooms');
  return res.json();
}

export async function getClassroomAnalytics(classroomId) {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/analytics`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}

export async function getClassroomCourseProgress(classroomId, courseId = null) {
  const query = courseId ? `?course_id=${encodeURIComponent(courseId)}` : '';
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/course-progress${query}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load course progress');
  return res.json();
}

export async function getClassroomStudentWork(classroomId, studentId, workType = null) {
  const query = workType ? `?work_type=${encodeURIComponent(workType)}` : '';
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/students/${studentId}/work${query}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load student work');
  return res.json();
}

export async function getOfficialAggregateCourseProgress(courseId = 'basic') {
  const res = await fetch(`${API_BASE}/classrooms/official-aggregate/course-progress?course_id=${encodeURIComponent(courseId)}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load aggregate course progress');
  return res.json();
}

export async function getOfficialClassroomList() {
  const res = await fetch(`${API_BASE}/classrooms/official-aggregate/by-classroom`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load classroom list');
  return res.json();
}

export async function getOfficialAggregateStudentWork(studentId, workType = null) {
  const query = workType ? `?work_type=${encodeURIComponent(workType)}` : '';
  const res = await fetch(`${API_BASE}/classrooms/official-aggregate/students/${studentId}/work${query}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load student work');
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

export const askClassroomRAG = async (classroomId, question, token, conversationId = null, userId = null) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question, conversation_id: conversationId, user_id: userId }),
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
 * Upload a file to a classroom, optionally into a section.
 */
export const uploadClassroomFileToSection = async (classroomId, file, sectionId = null) => {
  const formData = new FormData();
  formData.append('file', file);
  if (sectionId != null) formData.append('section_id', String(sectionId));
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
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
export const askClassroom = async (classroomId, question, conversationId = null, userId = null) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ question, mode: 'classroom', conversation_id: conversationId, user_id: userId }),
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

// ---------------------------------------------------------------------------
// Section endpoints
// ---------------------------------------------------------------------------

export const createSection = async (classroomId, { name, description = null, order = 0 }) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/sections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ name, description, order }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const listSections = async (classroomId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/sections`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const renameSection = async (classroomId, sectionId, name) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/sections/${sectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const deleteSection = async (classroomId, sectionId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/sections/${sectionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const moveFileToSection = async (classroomId, fileId, sectionId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/files/${fileId}/section`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ section_id: sectionId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// ---------------------------------------------------------------------------
// Quiz endpoints
// ---------------------------------------------------------------------------

/**
 * Generate MCQ draft questions using classroom RAG context.
 * Returns { questions: [...], context_chunks_used: n } — nothing is saved.
 */
export const generateClassroomQuiz = async (classroomId, { topic_prompt, num_questions = 5, section_id = null, file_ids = null, source = 'classroom', course_path = null }) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/quizzes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({
      topic_prompt, num_questions, section_id,
      file_ids: source === 'classroom' && file_ids && file_ids.length > 0 ? file_ids : null,
      source,
      course_path: source === 'course' ? course_path : null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to generate exercise');
  }
  return res.json();
};

/** Save a quiz (draft or published). */
export const saveClassroomQuiz = async (classroomId, { title, topic_prompt, questions, section_id, status }) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ title, topic_prompt, questions, section_id, status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to save quiz');
  }
  return res.json();
};

/** List quizzes for a classroom (teachers: all; students: published only). */
export const listClassroomQuizzes = async (classroomId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/quizzes`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/** Update title, questions, section, or status of an existing quiz. */
export const updateClassroomQuiz = async (classroomId, quizId, updates) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/quizzes/${quizId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update quiz');
  }
  return res.json();
};

/** Delete a quiz. */
export const deleteClassroomQuiz = async (classroomId, quizId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/quizzes/${quizId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/** Submit a quiz attempt with score and answers. */
export const submitClassroomQuizAttempt = async (classroomId, quizId, { score, answers = null }) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/quizzes/${quizId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ score, answers }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to submit quiz attempt');
  }
  return res.json();
};

/** Get quiz attempt results (student or teacher view). */
export const getClassroomQuizStudentResults = async (classroomId, quizId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/quizzes/${quizId}/student-results`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to load quiz results');
  return res.json();
};

// ─────────────────────────────────────────────────────────────────────────────
// Material Reads tracking
// ─────────────────────────────────────────────────────────────────────────────

export async function markMaterialAsRead(classroomId, fileId) {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/materials/${fileId}/mark-read`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to mark as read');
  return res.json();
}

export async function getClassroomMaterialsWithProgress(classroomId) {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/materials-with-progress`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load materials progress');
  return res.json();
}

export async function getClassroomQuizzesWithProgress(classroomId) {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/quizzes-with-progress`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load quizzes progress');
  return res.json();
}

// ---------------------------------------------------------------------------
// Practical Challenge endpoints — Teacher-managed classroom coding challenges
// ---------------------------------------------------------------------------

/**
 * Generate a practical coding challenge with model solution for teacher preview.
 * Returns { question, base_code, model_solution, topic_prompt } — nothing is saved yet.
 */
export const generateClassroomPracticalChallenge = async (classroomId, { topic_prompt, section_id = null }) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/practical-challenges/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ topic_prompt, section_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to generate challenge');
  }
  return res.json();
};

/** Save a practical challenge (draft or published). */
export const saveClassroomPracticalChallenge = async (classroomId, { title, topic_prompt, question, base_code, model_solution, section_id, status }) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/practical-challenges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ title, topic_prompt, question, base_code, model_solution, section_id, status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to save challenge');
  }
  return res.json();
};

/** List practical challenges for a classroom (teachers: all; students: published only). */
export const listClassroomPracticalChallenges = async (classroomId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/practical-challenges`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/** Update title, question, base_code, model_solution, section, or status of an existing challenge. */
export const updateClassroomPracticalChallenge = async (classroomId, challengeId, updates) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/practical-challenges/${challengeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update challenge');
  }
  return res.json();
};

/** Delete a practical challenge. */
export const deleteClassroomPracticalChallenge = async (classroomId, challengeId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/practical-challenges/${challengeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/**
 * Submit a student's solution code and execution result for a practical challenge.
 * Called after student evaluates code via /practical-tests/evaluate-ai.
 * Saves the attempt to database for teacher dashboard and student history.
 */
export const submitPracticalChallengeAttempt = async (classroomId, challengeId, submittedCode, executionOutput) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/practical-challenges/${challengeId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ submitted_code: submittedCode, execution_output: executionOutput }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to submit challenge attempt');
  }
  return res.json();
};

/** Get all attempts for a challenge (teachers: all students, students: own only). */
export const getClassroomPracticalChallengeAttempts = async (classroomId, challengeId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/practical-challenges/${challengeId}/attempts`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/** Get the best (most recent passed, or latest) attempt for current student. */
export const getClassroomPracticalChallengeBestAttempt = async (classroomId, challengeId) => {
  const res = await fetch(`${API_BASE}/classrooms/${classroomId}/practical-challenges/${challengeId}/best-attempt`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/** Get student results for a challenge (aggregated for teacher, detailed for student). */
export const getClassroomPracticalChallengeStudentResults = async (classroomId, challengeId, studentId = null) => {
  let url = `${API_BASE}/classrooms/${classroomId}/practical-challenges/${challengeId}/student-results`;
  if (studentId) url += `?student_id=${studentId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};
