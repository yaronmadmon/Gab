export type HintLevel = 'full' | 'short' | 'topic' | 'off';
export type ProgressEntry = { id: string; date: string; text: string; kind: 'win' | 'debrief'; nextStep?: string };
export type ProgressData = {
  entries: ProgressEntry[];
  challenge: { date: string; text: string; status: 'open' | 'done' | 'skipped' } | null;
  reminder: { enabled: boolean; time: string };
  hints: { level: HintLevel; fadeSince: string | null };
};
export const emptyProgress = (): ProgressData => ({ entries: [], challenge: null, reminder: { enabled: false, time: '19:00' }, hints: { level: 'full', fadeSince: null } });
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function effectiveHintLevel(hints: ProgressData['hints'], now = Date.now()): HintLevel {
  const levels: HintLevel[] = ['full', 'short', 'topic', 'off'];
  if (!hints.fadeSince) return hints.level;
  const elapsed = Math.max(0, Math.floor((now - new Date(hints.fadeSince).getTime()) / (7 * 86400000)));
  if (!Number.isFinite(elapsed)) return hints.level;
  return levels[Math.min(3, levels.indexOf(hints.level) + elapsed)];
}
export function shortHint(text: string, level: HintLevel, topic: string): string {
  if (level === 'off') return '';
  if (level === 'topic') return topic;
  if (level === 'short') {
    const words = text.trim().split(/\s+/);
    return words.length > 5 ? `${words.slice(0, 5).join(' ')}…` : text;
  }
  return text;
}
