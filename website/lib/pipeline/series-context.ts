export interface SeriesContext {
  seriesId: string;
  seriesTitle: string;
  learningGoal: string;
  topic: string;
  learningObjective: string;
}

export function buildSeriesContextPrompt(context?: SeriesContext): string {
  if (!context) return "";

  return `
========================
SERIES CONTEXT & BRANDING
========================
This video is part of a larger learning journey: "${context.seriesTitle}".
- OVERALL GOAL: ${context.learningGoal}
- THIS VIDEO'S ROLE: ${context.topic}
- LEARNING OBJECTIVE: ${context.learningObjective}

CRITICAL INDEPENDENCE RULES:
- The content MUST be completely independently valuable. 
- Do NOT assume the viewer has watched previous episodes.
- Do NOT use phrasing like "Welcome back", "In the last episode", or "Episode X".
- Treat the viewer as a first-time watcher who stumbled upon this specific topic, but ensure the depth matches the progression of the series.
- Keep the introduction focused purely on the immediate tension of this specific topic.

TITLE & DESCRIPTION RULE:
- Ensure the video title naturally includes the series name in parentheses, like "Understanding IAM (${context.seriesTitle})".
`;
}
