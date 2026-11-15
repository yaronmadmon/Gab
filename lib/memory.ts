// Everything Gab remembers, and the rules for changing it.
// Pure functions only, so they can be tested without a browser.

export type Goal = 'closer' | 'friendly' | 'distance' | 'avoid' | 'unsure';

export const GOAL_LABELS: Record<Goal, string> = {
  closer: 'Get closer',
  friendly: 'Stay friendly',
  distance: 'Polite distance',
  avoid: 'Stay away',
  unsure: 'Not sure yet',
};

export type Fact = {
  id: string;
  text: string;
  /** Day the thing happens, YYYY-MM-DD, when the fact is about an event. */
  date?: string;
  createdAt: string;
  /** Kept for the user's own memory; the coach must never bring it up. */
  private?: boolean;
};

export type Person = {
  id: string;
  name: string;
  where: string;
  goal: Goal;
  facts: Fact[];
};

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type Chat = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
  /** What Gab saved during this chat, shown under the reply that saved it. */
  saved: { afterMessage: number; changes: SavedChange[] }[];
};

export type Memory = { people: Person[]; chats: Chat[] };

/** A change Gab asks to make. Comes from the AI, so every field is checked. */
export type MemoryOp =
  | { type: 'add_person'; name: string; where?: string; goal?: Goal }
  | { type: 'add_fact'; person: string; text: string; date?: string }
  | { type: 'set_goal'; person: string; goal: Goal }
  | { type: 'set_where'; person: string; where: string };

/** What actually changed, so the person can see it and undo it. */
export type SavedChange = { label: string; personId: string; factId?: string; kind: 'person' | 'fact' | 'goal' | 'where' };

export const emptyMemory = (): Memory => ({ people: [], chats: [] });

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const GOALS = Object.keys(GOAL_LABELS) as Goal[];
const isGoal = (v: unknown): v is Goal => typeof v === 'string' && (GOALS as string[]).includes(v);
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Keeps only well-formed changes from whatever the AI sent. */
export function parseOps(raw: unknown): MemoryOp[] {
  if (!Array.isArray(raw)) return [];
  const out: MemoryOp[] = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const person = clean(o.person ?? o.name, 80);
    if (!person) continue;
    if (o.type === 'add_person') out.push({ type: 'add_person', name: person, where: clean(o.where, 120) || undefined, goal: isGoal(o.goal) ? o.goal : undefined });
    else if (o.type === 'add_fact' && clean(o.text, 300)) out.push({ type: 'add_fact', person, text: clean(o.text, 300), date: isDay(o.date) ? o.date : undefined });
    else if (o.type === 'set_goal' && isGoal(o.goal)) out.push({ type: 'set_goal', person, goal: o.goal });
    else if (o.type === 'set_where' && clean(o.where, 120)) out.push({ type: 'set_where', person, where: clean(o.where, 120) });
  }
  return out;
}

const findPerson = (people: Person[], name: string) => people.find(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase());

/** Applies changes and returns the new people list plus a plain record of what changed. */
export function applyOps(people: Person[], ops: MemoryOp[], now = new Date()): { people: Person[]; changes: SavedChange[] } {
  let next = people.map(p => ({ ...p, facts: [...p.facts] }));
  const changes: SavedChange[] = [];
  const ensure = (name: string) => {
    const found = findPerson(next, name);
    if (found) return found;
    const person: Person = { id: newId(), name, where: '', goal: 'unsure', facts: [] };
    next = [person, ...next];
    changes.push({ kind: 'person', personId: person.id, label: `Added ${name}` });
    return person;
  };
  for (const op of ops) {
    if (op.type === 'add_person') {
      const person = ensure(op.name);
      if (op.where && !person.where) person.where = op.where;
      if (op.goal && person.goal === 'unsure') person.goal = op.goal;
    } else if (op.type === 'add_fact') {
      const person = ensure(op.person);
      if (person.facts.some(f => f.text.toLocaleLowerCase() === op.text.toLocaleLowerCase())) continue;
      const fact: Fact = { id: newId(), text: op.text, date: op.date, createdAt: now.toISOString() };
      person.facts.unshift(fact);
      changes.push({ kind: 'fact', personId: person.id, factId: fact.id, label: `${person.name}: ${op.text}` });
    } else if (op.type === 'set_goal') {
      const person = ensure(op.person);
      if (person.goal === op.goal) continue;
      person.goal = op.goal;
      changes.push({ kind: 'goal', personId: person.id, label: `${person.name}: ${GOAL_LABELS[op.goal]}` });
    } else if (op.type === 'set_where') {
      const person = ensure(op.person);
      if (person.where === op.where) continue;
      person.where = op.where;
      changes.push({ kind: 'where', personId: person.id, label: `${person.name}: ${op.where}` });
    }
  }
  return { people: next, changes };
}

/**
 * Undo for a saved fact or a person Gab added. Goal and place changes are fixed on the person card.
 * A person is removed only if everything known about them is being undone too, so undoing
 * "Added David" never wipes facts saved about him later.
 */
export function undoChange(people: Person[], change: SavedChange, undoneTogether: SavedChange[] = [change]): Person[] {
  if (change.kind === 'fact') return people.map(p => (p.id === change.personId ? { ...p, facts: p.facts.filter(f => f.id !== change.factId) } : p));
  if (change.kind === 'person') {
    const undoneFacts = new Set(undoneTogether.filter(c => c.kind === 'fact').map(c => c.factId));
    return people.filter(p => p.id !== change.personId || p.facts.some(f => !undoneFacts.has(f.id)));
  }
  return people;
}

/** The last turns of a chat, trimmed so the first one sent is always the user's. */
export function recentTurns(messages: ChatMessage[], max = 40): ChatMessage[] {
  const recent = messages.slice(-max);
  const firstUser = recent.findIndex(m => m.role === 'user');
  return firstUser === -1 ? [] : recent.slice(firstUser);
}

/** The person's own calendar day, YYYY-MM-DD, never the server's. */
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

export type ComingUp = { person: Person; fact: Fact; days: number };

/** Dated facts from a week ago to two weeks ahead, soonest first. */
export function comingUp(people: Person[], today: string): ComingUp[] {
  const t = dayNumber(today);
  const items: ComingUp[] = [];
  for (const person of people) for (const fact of person.facts) {
    if (!fact.date) continue;
    const days = dayNumber(fact.date) - t;
    if (days >= -7 && days <= 14) items.push({ person, fact, days });
  }
  return items.sort((a, b) => Math.abs(a.days) - Math.abs(b.days) || a.days - b.days);
}

export function whenLabel(days: number) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `In ${days} days`;
  if (days === -1) return 'Yesterday · ask how it went';
  return `${-days} days ago · ask how it went`;
}

/** Short text version of memory for the coach. */
export function memoryForCoach(people: Person[]) {
  if (!people.length) return 'No people saved yet.';
  return people.slice(0, 60).map(p => {
    const facts = p.facts.slice(0, 15).map(f => `  - ${f.text}${f.date ? ` (date: ${f.date})` : ''}${f.private ? ' [PRIVATE: never suggest bringing this up]' : ''}`).join('\n');
    return `${p.name} | where: ${p.where || 'unknown'} | goal: ${GOAL_LABELS[p.goal]}\n${facts || '  - (no facts yet)'}`;
  }).join('\n');
}

export function chatTitle(first: string) {
  const t = first.trim().replace(/\s+/g, ' ');
  return t.length > 48 ? `${t.slice(0, 45)}…` : t || 'New chat';
}
