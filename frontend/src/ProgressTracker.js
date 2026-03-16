// Import the topic IDs from HomePage
import { JAVA_SUBTOPIC_IDS, JAVA_SUBTOPIC_COUNT } from './HomePage';
import {
    syncProgressToBackend,
    recordQuizAttempt,
    recordTestAttempt,
    recordPlaygroundUse,
    recordAIInteraction,
    markTopicCompleteOnBackend
} from './progressService';

export const QUIZ_TARGET = 6;
export const TEST_TARGET = 6;
export const QUIZ_PASS_SCORE = 70;
export const TEST_PASS_SCORE = 60;

// Progress Tracker that perfectly syncs with HomePage
export class ProgressTracker {
    constructor() {
        this.storageKey = 'codetutor_learning_progress';
        this.roadmapKey = 'java-roadmap-completed';

        this.allTopicIds = JAVA_SUBTOPIC_IDS;
        this.totalTopics = JAVA_SUBTOPIC_COUNT;

        this.initializeProgress();
    }

    getRoadmapCompleted() {
        const saved = localStorage.getItem(this.roadmapKey);
        return saved ? JSON.parse(saved) : [];
    }

    getValidCompletedTopics() {
        const completed = this.getRoadmapCompleted();
        return completed.filter(id => this.allTopicIds.includes(id));
    }

    initializeProgress() {
        if (!localStorage.getItem(this.storageKey)) {
            const defaultProgress = {
                playground: { codeExecutions: 0, completed: false },
                quizzes: {
                    attempted: 0,
                    completed: [],
                    passed: [],
                    totalQuizzes: QUIZ_TARGET
                },
                tests: {
                    attempted: 0,
                    completed: [],
                    passed: [],
                    totalTests: TEST_TARGET
                },
                roadmapTopics: { total: this.totalTopics, completed: [] },
                aiInteractions: 0,
                lastSynced: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(defaultProgress));
        } else {
            // Migration guard: ensure passed/completed arrays exist
            const progress = this.getProgress();
            let dirty = false;
            if (!Array.isArray(progress.quizzes.passed)) { progress.quizzes.passed = []; dirty = true; }
            if (!Array.isArray(progress.tests.passed)) { progress.tests.passed = []; dirty = true; }
            if (!Array.isArray(progress.tests.completed)) { progress.tests.completed = []; dirty = true; }
            if (dirty) localStorage.setItem(this.storageKey, JSON.stringify(progress));
        }
    }

    getProgress() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : null;
    }

    syncWithRoadmap() {
        const progress = this.getProgress();
        const validCompleted = this.getValidCompletedTopics();
        progress.roadmapTopics.completed = validCompleted;
        progress.roadmapTopics.total = this.totalTopics;
        progress.lastSynced = Date.now();
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
        return progress;
    }

    getTotalCompletion() {
        const progress = this.syncWithRoadmap();
        const roadmapCompleted = progress.roadmapTopics.completed.length;
        const quizzesPassed = (progress.quizzes.passed || []).length;
        const testsPassed = (progress.tests.passed || []).length;
        const playgroundCompleted = progress.playground.completed ? 1 : 0;
        const completed = roadmapCompleted + quizzesPassed + testsPassed + playgroundCompleted;
        const total = this.totalTopics + QUIZ_TARGET + TEST_TARGET + 1;
        return { completed, total };
    }

    getCompletedTopics() {
        return this.getValidCompletedTopics();
    }

    getNotStartedTopics() {
        const completed = this.getValidCompletedTopics();
        return this.allTopicIds.filter(id => !completed.includes(id));
    }

    getProgressSummaryForAI() {
        const completed = this.getCompletedTopics();
        const notStarted = this.getNotStartedTopics();
        const progress = this.getProgress();
        return {
            completedTopics: completed,
            notStartedTopics: notStarted,
            totalTopics: this.totalTopics,
            completionPercentage: Math.round((completed.length / this.totalTopics) * 100),
            quizzesTaken: progress.quizzes.attempted,
            quizzesPassed: (progress.quizzes.passed || []).length,
            testsPassed: (progress.tests.passed || []).length,
            playgroundUsed: progress.playground.completed,
            aiInteractions: progress.aiInteractions
        };
    }

    markPlaygroundUsed() {
        const progress = this.getProgress();
        progress.playground.codeExecutions++;
        if (progress.playground.codeExecutions >= 3) {
            progress.playground.completed = true;
        }
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
        recordPlaygroundUse().catch(() => {});
    }

    markQuizCompleted(quizId, score = 0) {
        const progress = this.getProgress();
        if (!progress.quizzes.completed.includes(quizId)) {
            progress.quizzes.completed.push(quizId);
        }
        progress.quizzes.attempted++;
        if (score >= QUIZ_PASS_SCORE) {
            if (!Array.isArray(progress.quizzes.passed)) progress.quizzes.passed = [];
            if (!progress.quizzes.passed.includes(quizId)) {
                progress.quizzes.passed.push(quizId);
            }
        }
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
        recordQuizAttempt(quizId, score).catch(() => {});
    }

    markTestPassed(testId, score = 0) {
        const progress = this.getProgress();
        if (!Array.isArray(progress.tests.completed)) progress.tests.completed = [];
        if (!progress.tests.completed.includes(testId)) {
            progress.tests.completed.push(testId);
        }
        progress.tests.attempted++;
        if (score >= TEST_PASS_SCORE) {
            if (!Array.isArray(progress.tests.passed)) progress.tests.passed = [];
            if (!progress.tests.passed.includes(testId)) {
                progress.tests.passed.push(testId);
            }
        }
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
        recordTestAttempt(testId, score, score >= TEST_PASS_SCORE).catch(() => {});
    }

    trackAIInteraction() {
        const progress = this.getProgress();
        progress.aiInteractions++;
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
        recordAIInteraction().catch(() => {});
    }

    isTopicCompleted(topicId) {
        const completed = this.getRoadmapCompleted();
        return completed.includes(topicId);
    }

    resetProgress() {
        localStorage.removeItem(this.storageKey);
        this.initializeProgress();
    }

    getDetailedProgress() {
        const progress = this.syncWithRoadmap();
        return {
            roadmap: {
                completed: progress.roadmapTopics.completed.length,
                total: progress.roadmapTopics.total,
                percentage: Math.round((progress.roadmapTopics.completed.length / progress.roadmapTopics.total) * 100)
            },
            playground: {
                completed: progress.playground.completed,
                executions: progress.playground.codeExecutions
            },
            quizzes: {
                passed: (progress.quizzes.passed || []).length,
                target: QUIZ_TARGET,
                attempted: progress.quizzes.attempted,
                passScore: QUIZ_PASS_SCORE
            },
            tests: {
                passed: (progress.tests.passed || []).length,
                target: TEST_TARGET,
                attempted: progress.tests.attempted,
                passScore: TEST_PASS_SCORE
            },
            aiInteractions: progress.aiInteractions
        };
    }

    forceSync() {
        this.syncWithRoadmap();
        return this.getTotalCompletion();
    }
}
