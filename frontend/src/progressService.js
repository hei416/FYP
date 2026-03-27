/**
 * Progress Service
 * Syncs local progress to the backend when user is authenticated.
 * Falls back to localStorage-only mode when not logged in.
 */

import { QUIZ_PASS_SCORE } from './ProgressTracker';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

const getToken = () => localStorage.getItem('authToken');

const authHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const isAuthenticated = () => !!getToken();

/**
 * Fetch user progress from backend and merge with localStorage
 */
export async function loadProgressFromBackend() {
  if (!isAuthenticated()) return null;

  try {
    const res = await fetch(`${API_BASE}/progress/me`, {
      headers: authHeaders()
    });

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('authToken');
      }
      return null;
    }

    const backendProgress = await res.json();
    return backendProgress;
  } catch (err) {
    console.warn('[ProgressService] Failed to load backend progress:', err);
    return null;
  }
}

// Pull progress from backend into localStorage (merge, never downgrade)
export const pullProgressFromBackend = async () => {
  if (!isAuthenticated()) return;
  try {
    const backend = await loadProgressFromBackend();
    if (!backend) return;

    // Merge roadmap completed topics into localStorage (union)
    const localRoadmap = JSON.parse(localStorage.getItem('java-roadmap-completed') || '[]');
    const merged = Array.from(new Set([...(localRoadmap || []), ...(backend.completed_topics || [])]));
    localStorage.setItem('java-roadmap-completed', JSON.stringify(merged));

    // Restore dismissed milestones if present
    if (backend.dismissed_milestones) {
      localStorage.setItem('dismissed_milestones', JSON.stringify(backend.dismissed_milestones));
    }

    // Use existing merge util to merge richer progress object
    mergeProgressWithLocal(backend, 'codetutor_learning_progress', 'java-roadmap-completed');
  } catch (e) {
    console.warn('[ProgressService] pullProgressFromBackend failed', e);
  }
};

/**
 * Sync all local progress to backend
 */
export async function syncProgressToBackend(localProgress, roadmapCompleted) {
  if (!isAuthenticated()) return;

  try {
    const payload = {
      completed_topics: roadmapCompleted || [],
      quizzes_attempted: localProgress?.quizzes?.attempted || 0,
      quizzes_completed: localProgress?.quizzes?.passed || [],
      tests_attempted: localProgress?.tests?.attempted || 0,
      tests_passed: localProgress?.tests?.passed || [],
      playground_executions: localProgress?.playground?.codeExecutions || 0,
      playground_completed: localProgress?.playground?.completed || false,
      ai_interactions: localProgress?.aiInteractions || 0
    };

    await fetch(`${API_BASE}/progress/sync`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('[ProgressService] Failed to sync progress:', err);
  }
}

// Push localStorage progress up to backend
export const pushProgressToBackend = async () => {
  if (!isAuthenticated()) return;

  try {
    const completed = JSON.parse(localStorage.getItem('java-roadmap-completed') || '[]');
    const dismissed = JSON.parse(localStorage.getItem('dismissed_milestones') || '[]');
    const local = JSON.parse(localStorage.getItem('codetutor_learning_progress') || '{}');

    // ✅ Don't push if localStorage hasn't been loaded from backend yet
    if (completed.length === 0 && !(local?.quizzes?.attempted > 0) && !(local?.aiInteractions > 0)) {
      console.warn('[ProgressService] Skipping push — localStorage appears unloaded');
      return;
    }

    const payload = {
      completed_topics: completed,
      dismissed_milestones: dismissed,
      quizzes_attempted: local?.quizzes?.attempted || 0,
      quizzes_completed: local?.quizzes?.passed || [],
      tests_attempted: local?.tests?.attempted || 0,
      tests_passed: local?.tests?.passed || [],
      playground_executions: local?.playground?.codeExecutions || 0,
      playground_completed: local?.playground?.completed || false,
      ai_interactions: local?.aiInteractions || 0
    };

    await fetch(`${API_BASE}/progress/sync`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn('[ProgressService] pushProgressToBackend failed', e);
  }
};

/**
 * Mark a topic as completed on the backend
 */
export async function markTopicCompleteOnBackend(topicId) {
  if (!isAuthenticated()) return;

  try {
    await fetch(`${API_BASE}/progress/topic-complete`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ topic_id: topicId })
    });
  } catch (err) {
    console.warn('[ProgressService] Failed to mark topic complete:', err);
  }
}

/**
 * Record a quiz attempt on the backend
 */
export async function recordQuizAttempt(quizId, score, answers = null) {
  // Update local progress immediately so UI doesn't depend on backend availability
  try {
    const local = JSON.parse(localStorage.getItem('codetutor_learning_progress') || '{}');
    local.quizzes = local.quizzes || { attempted: 0, completed: [], passed: [], totalQuizzes: 0 };
    local.quizzes.attempted = (local.quizzes.attempted || 0) + 1;
    if (score >= QUIZ_PASS_SCORE && !local.quizzes.completed.includes(quizId)) {
      local.quizzes.completed.push(quizId);
    }
    localStorage.setItem('codetutor_learning_progress', JSON.stringify(local));
  } catch (e) {
    console.warn('[ProgressService] Failed to update local progress for quiz attempt:', e);
  }

  // Then attempt to sync to backend if authenticated
  if (!isAuthenticated()) return;

  try {
    await fetch(`${API_BASE}/progress/quiz-attempt`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ quiz_id: quizId, score, answers })
    });
  } catch (err) {
    console.warn('[ProgressService] Failed to record quiz attempt:', err);
  }
}

/**
 * Record a test attempt on the backend
 */
export async function recordTestAttempt(testId, score, passed, feedback = null) {
  if (!isAuthenticated()) return;

  try {
    await fetch(`${API_BASE}/progress/test-attempt`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ test_id: testId, score, passed, feedback })
    });
  } catch (err) {
    console.warn('[ProgressService] Failed to record test attempt:', err);
  }
}

/**
 * Record playground code execution on the backend
 */
export async function recordPlaygroundUse() {
  if (!isAuthenticated()) return;

  try {
    await fetch(`${API_BASE}/progress/playground-use`, {
      method: 'POST',
      headers: authHeaders()
    });
  } catch (err) {
    console.warn('[ProgressService] Failed to record playground use:', err);
  }
}

/**
 * Record AI tutor interaction on the backend
 */
export async function recordAIInteraction() {
  if (!isAuthenticated()) return;

  try {
    await fetch(`${API_BASE}/progress/ai-interaction`, {
      method: 'POST',
      headers: authHeaders()
    });
  } catch (err) {
    console.warn('[ProgressService] Failed to record AI interaction:', err);
  }
}

/**
 * Merge backend progress into localStorage (backend wins for conflicts)
 */
export function mergeProgressWithLocal(backendProgress, localStorageKey, roadmapKey) {
  if (!backendProgress) return;

  const backendTopics = backendProgress.completed_topics || [];
  if (backendTopics.length > 0) {
    const localTopics = JSON.parse(localStorage.getItem(roadmapKey) || '[]');
    const merged = Array.from(new Set([...localTopics, ...backendTopics]));
    localStorage.setItem(roadmapKey, JSON.stringify(merged));
  }

  const stored = localStorage.getItem(localStorageKey);
  const local = stored ? JSON.parse(stored) : {};

  const merged = {
    playground: {
      codeExecutions: Math.max(
        local?.playground?.codeExecutions || 0,
        backendProgress.playground_executions || 0
      ),
      completed: local?.playground?.completed || backendProgress.playground_completed || false
    },
    quizzes: {
      attempted: Math.max(
        local?.quizzes?.attempted || 0,
        backendProgress.quizzes_attempted || 0
      ),
      completed: Array.from(new Set([
        ...(local?.quizzes?.completed || []),
        ...(backendProgress.quizzes_completed || [])
      ])),
      passed: Array.from(new Set([
        ...(local?.quizzes?.passed || []),
        ...(backendProgress.quizzes_completed || [])
      ])),
      totalQuizzes: local?.quizzes?.totalQuizzes || 0
    },
    tests: {
      attempted: Math.max(
        local?.tests?.attempted || 0,
        backendProgress.tests_attempted || 0
      ),
      completed: Array.from(new Set([
        ...(local?.tests?.completed || []),
        ...(backendProgress.tests_passed || [])
      ])),
      passed: Array.from(new Set([
        ...(local?.tests?.passed || []),
        ...(backendProgress.tests_passed || [])
      ])),
      totalTests: local?.tests?.totalTests || 0
    },
    roadmapTopics: local?.roadmapTopics || { total: 0, completed: [] },
    aiInteractions: Math.max(
      local?.aiInteractions || 0,
      backendProgress.ai_interactions || 0
    ),
    lastSynced: Date.now()
  };

  localStorage.setItem(localStorageKey, JSON.stringify(merged));
}
