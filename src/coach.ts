import { Platform } from 'react-native';
import { type CoachProvider } from './connection';

export type Note = {
  id: string;
  text: string;
  source: string;
  createdAt: string;
  status: 'current' | 'uncertain' | 'outdated' | 'private';
};

export type Person = {
  id: string;
  name: string;
  relationship: string;
  notes: Note[];
};

export type PrepCard = { opener: string; followUps: [string, string]; exit: string; nudge: string };
export type StuckCard = { ask: string; share: string; change: string; leave: string; quiet: string };
export type NoteSuggestion = { name: string; detail: string };
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export const initialPrep: PrepCard = {
  opener: "Good to see you. How's your week going?",
  followUps: ["What has that been like?", "How did you get into that?"],
  exit: "It was good talking. I'll let you get back to it.",
  nudge: 'Hear one word. Ask about it. Then share a little.',
};

export function localPrep(situation: string, person?: Person): PrepCard {
  const name = person?.name?.trim();
  const usable = person?.notes.find((note) => note.status === 'current');
  const opening = name ? `Hey ${name}, good to see you. How have you been?` : initialPrep.opener;
  return {
    opener: opening,
    followUps: usable
      ? [`You mentioned ${usable.text.replace(/[.!?]+$/, '')}. How is that going?`, "What else has been new for you?"]
      : ["What has your week been like?", "How did you get into that?"],
    exit: initialPrep.exit,
    nudge: situation.toLowerCase().includes('walk') ? 'A little quiet on a walk is okay.' : initialPrep.nudge,
  };
}

export function localStuck(word: string): StuckCard {
  const topic = word.trim().replace(/[.!?]+$/, '');
  return {
    ask: topic ? `You mentioned ${topic}. What was that like?` : "What has that been like for you?",
    share: "That reminds me of something I went through. Can I tell you?",
    change: "Speaking of this week, what else is going on?",
    leave: "It was good talking with you. See you soon.",
    quiet: "A short silence is okay. You can just listen.",
  };
}

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? (Platform.OS === 'web' ? '' : 'https://gab-sandy-nu.vercel.app');

async function post<T>(path: string, body: object, provider: CoachProvider): Promise<T | null> {
  if (API_BASE === undefined) return null;
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, provider }),
  });
  if (!response.ok) throw new Error(`Coach service returned ${response.status}`);
  return (await response.json()) as T;
}

export async function getPrep(situation: string, person?: Person, includeNotes = false, provider: CoachProvider = 'openai'): Promise<PrepCard> {
  const fallback = localPrep(situation, person);
  const result = await post<PrepCard>('/api/prep', {
    situation,
    person: person?.name || null,
    notes: includeNotes ? person?.notes.filter((note) => note.status === 'current').map((note) => note.text).slice(0, 3) : [],
  }, provider);
  return result || fallback;
}

export async function getStuck(word: string, provider: CoachProvider = 'openai'): Promise<StuckCard> {
  return (await post<StuckCard>('/api/stuck', { word }, provider)) || localStuck(word);
}

export async function suggestNote(raw: string, provider: CoachProvider = 'openai'): Promise<NoteSuggestion | null> {
  return post<NoteSuggestion>('/api/note', { raw }, provider);
}
export async function sendChat(messages: ChatMessage[], provider: CoachProvider): Promise<string> {
  const result = await post<{ reply: string }>('/api/chat', { messages: messages.slice(-19) }, provider);
  if (!result?.reply) throw new Error('Coach service unavailable');
  return result.reply;
}

export const coachConnected = API_BASE !== undefined;
