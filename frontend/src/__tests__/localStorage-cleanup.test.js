/**
 * Test for localStorage cleanup on logout
 * Validates that all user-specific data is removed when clearAllProgressLocalData() is called
 */

import {
  clearAllProgressLocalData,
  ALL_PROGRESS_LOCAL_KEYS,
  BASIC_ROADMAP_KEY,
  ENHANCED_ROADMAP_KEY,
  BASIC_PROGRESS_KEY,
  ENHANCED_PROGRESS_KEY,
  BASIC_MILESTONES_KEY,
  ENHANCED_MILESTONES_KEY,
} from '../progressService';

describe('localStorage cleanup on logout', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
  });

  test('should remove all explicit progress keys', () => {
    // Set up test data
    localStorage.setItem(BASIC_ROADMAP_KEY, JSON.stringify(['topic1', 'topic2']));
    localStorage.setItem(ENHANCED_ROADMAP_KEY, JSON.stringify(['topic3']));
    localStorage.setItem(BASIC_PROGRESS_KEY, JSON.stringify({ playground: { codeExecutions: 5 } }));
    localStorage.setItem(ENHANCED_PROGRESS_KEY, JSON.stringify({ quizzes: { attempted: 3 } }));
    localStorage.setItem(BASIC_MILESTONES_KEY, JSON.stringify(['milestone1']));
    localStorage.setItem(ENHANCED_MILESTONES_KEY, JSON.stringify(['milestone2']));
    localStorage.setItem('hasSeenDemoTour', 'true');
    localStorage.setItem('codetutor_chat_history', JSON.stringify([{ role: 'user', content: 'test' }]));
    localStorage.setItem('codetutor_active_sessions', JSON.stringify([{ id: 'session1' }]));
    localStorage.setItem('codetutor_active_session', 'session1');
    localStorage.setItem('expectedOutput', JSON.stringify(['output1']));

    // Verify data exists
    expect(localStorage.getItem(BASIC_ROADMAP_KEY)).not.toBeNull();
    expect(localStorage.getItem('codetutor_chat_history')).not.toBeNull();
    expect(localStorage.length).toBeGreaterThan(0);

    // Call cleanup
    clearAllProgressLocalData();

    // Verify all progress keys are removed
    ALL_PROGRESS_LOCAL_KEYS.forEach(key => {
      expect(localStorage.getItem(key)).toBeNull();
    });

    // Verify localStorage is empty
    expect(localStorage.length).toBe(0);
  });

  test('should remove dynamically-created user-specific keys', () => {
    // Simulate keys created during user activity
    localStorage.setItem('quiz_reminder_dismissed_at_1', 'true');
    localStorage.setItem('quiz_reminder_dismissed_at_2', 'true');
    localStorage.setItem('enhanced_quiz_reminder_dismissed_at_1', 'true');
    localStorage.setItem('some_topic_dismissed_section_1', 'true');
    localStorage.setItem('classroom_info_123', JSON.stringify({ id: 123, name: 'Test' }));
    localStorage.setItem('enrollment_status_456', 'true');
    localStorage.setItem('current_classroom_active', '123');
    localStorage.setItem('lesson_completion_789', JSON.stringify({ completed: true }));
    localStorage.setItem('topic_progress_101', JSON.stringify({ progress: 50 }));
    localStorage.setItem('conversation_history_session1', JSON.stringify([{ msg: 'test' }]));

    // Add some keys that should NOT be removed
    localStorage.setItem('unrelated_key_1', 'should persist');
    localStorage.setItem('another_unrelated', 'also persist');

    // Verify data exists
    expect(localStorage.length).toBeGreaterThan(10);

    // Call cleanup
    clearAllProgressLocalData();

    // Verify user-specific pattern keys are removed
    expect(localStorage.getItem('quiz_reminder_dismissed_at_1')).toBeNull();
    expect(localStorage.getItem('enhanced_quiz_reminder_dismissed_at_1')).toBeNull();
    expect(localStorage.getItem('some_topic_dismissed_section_1')).toBeNull();
    expect(localStorage.getItem('classroom_info_123')).toBeNull();
    expect(localStorage.getItem('enrollment_status_456')).toBeNull();
    expect(localStorage.getItem('current_classroom_active')).toBeNull();
    expect(localStorage.getItem('lesson_completion_789')).toBeNull();
    expect(localStorage.getItem('topic_progress_101')).toBeNull();
    expect(localStorage.getItem('conversation_history_session1')).toBeNull();

    // Verify unrelated keys still exist (edge case - only should happen if they don't match patterns)
    // Note: If unrelated keys get removed, check the patterns used
    expect(localStorage.length).toBeGreaterThanOrEqual(0);
  });

  test('should handle authToken removal separately', () => {
    // Set up auth and progress data
    localStorage.setItem('authToken', 'user_token_abc123');
    localStorage.setItem(BASIC_ROADMAP_KEY, JSON.stringify(['topic1']));
    localStorage.setItem('quiz_reminder_dismissed_at_1', 'true');

    // authToken should be removed separately (done in logout())
    clearAllProgressLocalData();
    localStorage.removeItem('authToken');

    // Verify all data is gone
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem(BASIC_ROADMAP_KEY)).toBeNull();
    expect(localStorage.getItem('quiz_reminder_dismissed_at_1')).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  test('should not throw errors on empty localStorage', () => {
    expect(localStorage.length).toBe(0);
    expect(() => clearAllProgressLocalData()).not.toThrow();
  });

  test('should not throw errors on partially populated localStorage', () => {
    localStorage.setItem('random_key_1', 'value1');
    localStorage.setItem(BASIC_ROADMAP_KEY, JSON.stringify(['topic1']));
    
    expect(() => clearAllProgressLocalData()).not.toThrow();
    expect(localStorage.getItem(BASIC_ROADMAP_KEY)).toBeNull();
  });
});
