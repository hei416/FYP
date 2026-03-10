// Import the topic IDs from HomePage
import { JAVA_SUBTOPIC_IDS, JAVA_SUBTOPIC_COUNT } from './HomePage';
import {
    recordQuizAttempt,
    recordTestAttempt,
    recordPlaygroundUse,
    recordAIInteraction,
} from './progressService';

// Fixed targets for quiz and test completion (one per every 2 chapter groups = 6 milestones)
export const QUIZ_TARGET    = 6;  // need 6 quizzes with passing score
export const TEST_TARGET    = 6;  // need 6 practical tests with passing score
export const QUIZ_PASS_SCORE = 70; // minimum % to count a quiz as passed
export const TEST_PASS_SCORE = 60; // minimum % to count a test as passed

// Progress Tracker that perfectly syncs with HomePage
export class ProgressTracker {
    constructor() {
        this.storageKey = 'codetutor_learning_progress';
        this.roadmapKey = 'java-roadmap-completed'; // YOUR existing key
        
        // Use the EXACT same topic list as HomePage
        this.allTopicIds = JAVA_SUBTOPIC_IDS;
        this.totalTopics = JAVA_SUBTOPIC_COUNT;
        
        this.initializeProgress();
    }

    // Get completed topics from YOUR roadmap system (same as HomePage)
    getRoadmapCompleted() {
        const saved = localStorage.getItem(this.roadmapKey);
        return saved ? JSON.parse(saved) : [];
    }

    // Filter completed topics (same logic as HomePage)
    getValidCompletedTopics() {
        const completed = this.getRoadmapCompleted();
        // Only count topics that exist in subtopicContent (same as HomePage)
        return completed.filter(id => this.allTopicIds.includes(id));
    }

    initializeProgress() {
        if (!localStorage.getItem(this.storageKey)) {
            const defaultProgress = {
                playground: {
                    codeExecutions: 0,
                    completed: false
                },
                quizzes: {
                    attempted: 0,
                    completed: [],
                    passed: [],
                    totalQuizzes: QUIZ_TARGET
                },
                tests: {
                    attempted: 0,
                    passed: [],
                    totalTests: TEST_TARGET
                },
                roadmapTopics: {
                    total: this.totalTopics,
                    completed: []
                },
                aiInteractions: 0,
                lastSynced: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(defaultProgress));
        }
    }

    getProgress() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : null;
    }

    // Sync with your roadmap system
    syncWithRoadmap() {
        const progress = this.getProgress();
        const validCompleted = this.getValidCompletedTopics();
        
        // Update our tracker with roadmap data
        progress.roadmapTopics.completed = validCompleted;
        progress.roadmapTopics.total = this.totalTopics;
        progress.lastSynced = Date.now();
        
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
        
        return progress;
    }

    getTotalCompletion() {
        // Always sync first
        const progress = this.syncWithRoadmap();
        
        // Use EXACT same calculation as HomePage
        const roadmapCompleted = progress.roadmapTopics.completed.length;
        const quizzesPassed = Math.min((progress.quizzes.passed || []).length, QUIZ_TARGET);
        const testsPassed = Math.min(progress.tests.passed.length, TEST_TARGET);
        
        const completed = roadmapCompleted + quizzesPassed + testsPassed;
        const total = this.totalTopics + QUIZ_TARGET + TEST_TARGET; // roadmap + quizzes + tests
        
        return { completed, total };
    }

    // Get completed topics from roadmap
    getCompletedTopics() {
        return this.getValidCompletedTopics();
    }

    // Get not started topics
    getNotStartedTopics() {
        const completed = this.getValidCompletedTopics();
        return this.allTopicIds.filter(id => !completed.includes(id));
    }

    // Generate progress summary for AI
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
            testsPassed: progress.tests.passed.length,
            playgroundUsed: progress.playground.completed,
            aiInteractions: progress.aiInteractions
        };
    }

    // Mark playground as used
    markPlaygroundUsed() {
        const progress = this.getProgress();
        progress.playground.codeExecutions++;
        if (progress.playground.codeExecutions >= 3) {
            progress.playground.completed = true;
        }
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
        // Sync to backend (non-blocking)
        recordPlaygroundUse().catch(() => {});
    }

    // Mark quiz as completed (score is 0–100 percentage)
    markQuizCompleted(quizId, score = 0) {
        const progress = this.getProgress();
        if (!progress.quizzes.completed.includes(quizId)) {
            progress.quizzes.completed.push(quizId);
        }
        progress.quizzes.attempted++;
        // Track as "passed" only when score meets threshold
        if (score >= QUIZ_PASS_SCORE) {
            if (!progress.quizzes.passed) progress.quizzes.passed = [];
            if (!progress.quizzes.passed.includes(quizId)) {
                progress.quizzes.passed.push(quizId);
            }
        }
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
        // Sync to backend (non-blocking)
        recordQuizAttempt(quizId, score).catch(() => {});
    }

    // Mark test as attempted; adds to passed[] only if score meets threshold
    markTestPassed(testId, score = 0) {
        const progress = this.getProgress();
        progress.tests.attempted++;
        const didPass = score >= TEST_PASS_SCORE;
        if (didPass && !progress.tests.passed.includes(testId)) {
            progress.tests.passed.push(testId);
        }
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
        // Sync to backend (non-blocking)
        recordTestAttempt(testId, score, didPass).catch(() => {});
    }

    // Track AI interaction
    trackAIInteraction() {
        const progress = this.getProgress();
        progress.aiInteractions++;
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
        // Sync to backend (non-blocking)
        recordAIInteraction().catch(() => {});
    }

    // Check if topic is completed
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
                passed: Math.min((progress.quizzes.passed || []).length, QUIZ_TARGET),
                target: QUIZ_TARGET,
                attempted: progress.quizzes.attempted,
                passScore: QUIZ_PASS_SCORE
            },
            tests: {
                passed: Math.min(progress.tests.passed.length, TEST_TARGET),
                target: TEST_TARGET,
                attempted: progress.tests.attempted,
                passScore: TEST_PASS_SCORE
            },
            aiInteractions: progress.aiInteractions
        };
    }

    // Manual sync (for testing)
    forceSync() {
        this.syncWithRoadmap();
        return this.getTotalCompletion();
    }
}
