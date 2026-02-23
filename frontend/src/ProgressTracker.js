// Import the topic IDs from HomePage
import { JAVA_SUBTOPIC_IDS, JAVA_SUBTOPIC_COUNT } from './HomePage';

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
                    totalQuizzes: 0
                },
                tests: {
                    attempted: 0,
                    passed: [],
                    totalTests: 0
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
        const quizzesCompleted = progress.quizzes.completed.length;
        const testsCompleted = progress.tests.passed.length;
        const playgroundCompleted = progress.playground.completed ? 1 : 0;
        
        const completed = roadmapCompleted + quizzesCompleted + testsCompleted + playgroundCompleted;
        const total = 
            this.totalTopics + // Same as HomePage's totalTopics
            progress.quizzes.totalQuizzes +
            progress.tests.totalTests +
            1; // playground
        
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
    }

    // Mark quiz as completed
    markQuizCompleted(quizId, score = 0) {
        const progress = this.getProgress();
        if (!progress.quizzes.completed.includes(quizId)) {
            progress.quizzes.completed.push(quizId);
        }
        progress.quizzes.attempted++;
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
    }

    // Mark test as passed
    markTestPassed(testId, score = 0) {
        const progress = this.getProgress();
        if (!progress.tests.passed.includes(testId)) {
            progress.tests.passed.push(testId);
        }
        progress.tests.attempted++;
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
    }

    // Track AI interaction
    trackAIInteraction() {
        const progress = this.getProgress();
        progress.aiInteractions++;
        localStorage.setItem(this.storageKey, JSON.stringify(progress));
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
                completed: progress.quizzes.completed.length,
                total: progress.quizzes.totalQuizzes,
                attempted: progress.quizzes.attempted
            },
            tests: {
                passed: progress.tests.passed.length,
                total: progress.tests.totalTests,
                attempted: progress.tests.attempted
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
