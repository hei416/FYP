/**
 * Utility functions to detect and manage the user's current learning path (Basic or Enhanced)
 */

export const BASIC_ROADMAP_KEY = 'java-roadmap-completed';
export const ENHANCED_ROADMAP_KEY = 'enhanced-roadmap-completed';

/**
 * Detect the user's current learning path based on which roadmap they're working on.
 * Returns 'basic', 'enhanced', or 'unknown' if no progress found
 */
export function detectCurrentLearningPath() {
  const basicCompleted = JSON.parse(localStorage.getItem(BASIC_ROADMAP_KEY) || '[]');
  const enhancedCompleted = JSON.parse(localStorage.getItem(ENHANCED_ROADMAP_KEY) || '[]');

  // If user has completed topics in Enhanced, they're on Enhanced path
  if (enhancedCompleted.length > 0) {
    return 'enhanced';
  }

  // If user has completed topics in Basic, they're on Basic path
  if (basicCompleted.length > 0) {
    return 'basic';
  }

  // If no progress found, default to basic (safest default)
  return 'unknown';
}

/**
 * Get the appropriate TOPIC_GROUPS based on current learning path
 */
export async function getTopicGroupsForCurrentPath() {
  const path = detectCurrentLearningPath();

  if (path === 'enhanced') {
    const { ENHANCED_TOPIC_GROUPS } = await import('./EnhancedJavaPage');
    return ENHANCED_TOPIC_GROUPS;
  }

  // Default to Basic (including 'unknown' case)
  const { TOPIC_GROUPS } = await import('./BasicJavaPage');
  return TOPIC_GROUPS;
}

/**
 * Get topic labels for the current learning path
 */
export async function getTopicLabelsForCurrentPath() {
  const groups = await getTopicGroupsForCurrentPath();
  return groups.map(g => g.label);
}

/**
 * Get TOPIC_GROUPS for an explicitly chosen path ('basic' or 'enhanced')
 */
export async function getTopicGroupsForPath(path) {
  if (path === 'enhanced') {
    const { ENHANCED_TOPIC_GROUPS } = await import('./EnhancedJavaPage');
    return ENHANCED_TOPIC_GROUPS;
  }
  const { TOPIC_GROUPS } = await import('./BasicJavaPage');
  return TOPIC_GROUPS;
}
