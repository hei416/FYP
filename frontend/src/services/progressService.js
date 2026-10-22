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

// localStorage keys per course
export const BASIC_ROADMAP_KEY    = 'java-roadmap-completed';
export const ENHANCED_ROADMAP_KEY = 'enhanced-roadmap-completed';
export const BASIC_PROGRESS_KEY   = 'codetutor_learning_progress';
export const ENHANCED_PROGRESS_KEY = 'enhanced-codetutor-learning-progress';
export const BASIC_MILESTONES_KEY    = 'dismissed_milestones';
export const ENHANCED_MILESTONES_KEY = 'enhanced-dismissed-milestones';

export function getCourseKeys(courseId = 'basic') {
  if (courseId === 'enhanced') {
    return {
      roadmapKey: ENHANCED_ROADMAP_KEY,
      progressKey: ENHANCED_PROGRESS_KEY,
      milestonesKey: ENHANCED_MILESTONES_KEY,
    };
  }
  return {
    roadmapKey: BASIC_ROADMAP_KEY,
    progressKey: BASIC_PROGRESS_KEY,
    milestonesKey: BASIC_MILESTONES_KEY,
  };
}

// All localStorage keys that belong to progress (both courses)
// NOTE: 'hasSeenDemoTour' is intentionally excluded — it's a persistent user preference
// and should survive login/logout/refresh cycles to avoid showing the tour too frequently.
export const ALL_PROGRESS_LOCAL_KEYS = [
  BASIC_ROADMAP_KEY,
  ENHANCED_ROADMAP_KEY,
  BASIC_PROGRESS_KEY,
  ENHANCED_PROGRESS_KEY,
  BASIC_MILESTONES_KEY,
  ENHANCED_MILESTONES_KEY,
  'codetutor_chat_history',
  'codetutor_active_sessions',
  'codetutor_active_session',
  'expectedOutput',
];

// Clear all progress-related localStorage keys (used on logout and page unload)
export function clearAllProgressLocalData() {
  // Clear all explicitly-defined keys from localStorage
  ALL_PROGRESS_LOCAL_KEYS.forEach(key => localStorage.removeItem(key));
  
  // Clear dynamically-created user-specific keys from localStorage matching patterns:
  // - quiz/milestone reminder dismissals: quiz_reminder_*, enhanced_quiz_reminder_*
  // - topic dismissals: *_dismissed_*, enhanced_*_dismissed_*
  // - classroom/session data: classroom_*, enrollment_*
  const localKeysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    
    const isUserPattern = 
      key.includes('reminder_dismissed') ||
      key.includes('_dismissed_') ||
      key.includes('classroom_') ||
      key.includes('enrollment_') ||
      key.includes('current_classroom') ||
      key.includes('lesson_') ||
      key.includes('topic_') ||
      key.includes('conversation_');
    
    if (isUserPattern) {
      localKeysToRemove.push(key);
    }
  }
  
  localKeysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Also clear sessionStorage keys that contain user-specific session/conversation data
  const sessionKeysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key) continue;
    
    // Remove session/conversation related keys from sessionStorage
    const isSessionUserData = 
      key.includes('codetutor') ||
      key.includes('session') ||
      key.includes('conversation') ||
      key.includes('active_');
    
    if (isSessionUserData) {
      sessionKeysToRemove.push(key);
    }
  }
  
  sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
}

/**
 * Fetch user progress from backend and merge with localStorage
 */
export async function loadProgressFromBackend(courseId = 'basic') {
  if (!isAuthenticated()) return null;

  try {
    const res = await fetch(`${API_BASE}/progress/me?course_id=${courseId}`, {
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
export const pullProgressFromBackend = async (courseId = 'basic') => {
  if (!isAuthenticated()) return;
  try {
    const { roadmapKey, progressKey, milestonesKey } = getCourseKeys(courseId);
    const backend = await loadProgressFromBackend(courseId);
    if (!backend) return;

    // Merge roadmap completed topics into localStorage (union)
    const localRoadmap = JSON.parse(localStorage.getItem(roadmapKey) || '[]');
    const merged = Array.from(new Set([...(localRoadmap || []), ...(backend.completed_topics || [])]));
    localStorage.setItem(roadmapKey, JSON.stringify(merged));

    // Restore dismissed milestones if present
    if (backend.dismissed_milestones) {
      localStorage.setItem(milestonesKey, JSON.stringify(backend.dismissed_milestones));
    }

    // Use existing merge util to merge richer progress object
    mergeProgressWithLocal(backend, progressKey, roadmapKey);
  } catch (e) {
    console.warn('[ProgressService] pullProgressFromBackend failed', e);
  }
};

/**
 * Sync all local progress to backend
 */
export async function syncProgressToBackend(localProgress, roadmapCompleted, courseId = 'basic') {
  if (!isAuthenticated()) return;

  // Skip push when localStorage was just cleared (e.g. after a page-unload clear);
  // let the pull-from-backend step restore data instead of overwriting with empty.
  const hasData =
    (roadmapCompleted && roadmapCompleted.length > 0) ||
    (localProgress?.quizzes?.attempted > 0) ||
    (localProgress?.aiInteractions > 0);
  if (!hasData) {
    console.warn('[ProgressService] syncProgressToBackend: skipping — data appears empty');
    return;
  }

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

    await fetch(`${API_BASE}/progress/sync?course_id=${courseId}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('[ProgressService] Failed to sync progress:', err);
  }
}

// Push localStorage progress up to backend.
// Pass { keepalive: true } when calling from a beforeunload/pagehide handler so
// the browser completes the request even after the page is torn down.
export const pushProgressToBackend = async (courseId = 'basic', { keepalive = false } = {}) => {
  if (!isAuthenticated()) return;

  try {
    const { roadmapKey, progressKey, milestonesKey } = getCourseKeys(courseId);
    const completed = JSON.parse(localStorage.getItem(roadmapKey) || '[]');
    const dismissed = JSON.parse(localStorage.getItem(milestonesKey) || '[]');
    const local = JSON.parse(localStorage.getItem(progressKey) || '{}');

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

    await fetch(`${API_BASE}/progress/sync?course_id=${courseId}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
      keepalive,
    });
  } catch (e) {
    console.warn('[ProgressService] pushProgressToBackend failed', e);
  }
};

/**
 * Mark a topic as completed on the backend
 */
export async function markTopicCompleteOnBackend(topicId, courseId = 'basic') {
  if (!isAuthenticated()) return;

  try {
    await fetch(`${API_BASE}/progress/topic-complete?course_id=${courseId}`, {
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

/**
 * Fetch progress for a specific course (including weak topics calculation)
 * Used by StudentClassrooms to display progress analysis per classroom
 */
export async function getCourseProgress(courseId = 'basic') {
  if (!isAuthenticated()) return null;
  try {
    // Fetch progress AND weak topics (split by type) in parallel
    const [progressRes, weakRes] = await Promise.all([
      fetch(`${API_BASE}/progress/me?course_id=${courseId}`, { headers: authHeaders() }),
      fetch(`${API_BASE}/progress/weak-topics`, { headers: authHeaders() }),
    ]);

    if (!progressRes.ok) {
      if (progressRes.status === 401) localStorage.removeItem('authToken');
      return null;
    }

    const progress = await progressRes.json();
    const weakData = weakRes.ok ? await weakRes.json() : {};

    // Count passes from lists (unique topics passed)
    const quizzesPassed    = (progress.quizzes_completed || []).length;
    const testsPassed      = (progress.tests_passed || []).length;
    const quizzesAttempted = progress.quizzes_attempted || 0;
    const testsAttempted   = progress.tests_attempted  || 0;

    // Use max(attempted, passed) so passes never exceed attempts (prevents >100%)
    const effectiveQuizAttempted = Math.max(quizzesAttempted, quizzesPassed);
    const effectiveTestAttempted = Math.max(testsAttempted, testsPassed);

    const quizPassRate = effectiveQuizAttempted > 0
      ? Math.min(100, Math.round((quizzesPassed / effectiveQuizAttempted) * 100)) : null;
    const testPassRate = effectiveTestAttempted > 0
      ? Math.min(100, Math.round((testsPassed / effectiveTestAttempted) * 100)) : null;

    return {
      completion_percentage:    progress.completion_percentage || 0,
      quizzes_attempted:        effectiveQuizAttempted,
      quizzes_passed:           quizzesPassed,
      avg_quiz_score:           weakData.avg_quiz_score ?? null,  // from split weak-topics
      tests_attempted:          effectiveTestAttempted,
      tests_passed:             testsPassed,
      avg_test_score:           weakData.avg_test_score ?? null,  // from split weak-topics
      quiz_pass_rate:           quizPassRate,
      test_pass_rate:           testPassRate,
      ai_interactions:          progress.ai_interactions || 0,
      weak_topics:              weakData.weak_topics || [],
      most_common_weak_topics:  weakData.weak_topics || [],
      updated_at:               progress.updated_at || new Date().toISOString(),
    };
  } catch (err) {
    console.error('[ProgressService] Failed to get course progress:', err);
    return null;
  }
}