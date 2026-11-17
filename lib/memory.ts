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

/** Who the person is to the user. Gab coaches each kind differently. */
export type Relationship =
  | 'spouse' | 'child' | 'parent' | 'sibling' | 'family'
  | 'boss' | 'coworker' | 'friend' | 'crush' | 'neighbor' | 'community' | 'club' | 'other';

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  spouse: 'Spouse or partner',
  child: 'My child',
  parent: 'My parent',
  sibling: 'Brother or sister',
  family: 'Other family',
  boss: 'My boss',
  coworker: 'Coworker',
  friend: 'Friend',
  crush: 'Someone I like',
  neighbor: 'Neighbor',
  community: 'Community (synagogue, school)',
  club: 'Club or activity',
  other: 'Other',
};

export const RELATIONSHIPS = Object.keys(RELATIONSHIP_LABELS) as Relationship[];

/** Goals that make sense for each kind. "Stay away" from your own child is not a choice Gab offers. */
export function goalsFor(rel?: Relationship): Goal[] {
  if (rel === 'spouse' || rel === 'child') return ['closer', 'unsure'];
  if (rel === 'boss') return ['closer', 'friendly', 'distance', 'unsure'];
  return ['closer', 'friendly', 'distance', 'avoid', 'unsure'];
}

/** The goal to keep when the kind changes: the same one if it still fits, otherwise a sensible start. */
export function fitGoal(goal: Goal, rel?: Relationship): Goal {
  if (goalsFor(rel).includes(goal)) return goal;
  return rel === 'spouse' || rel === 'child' ? 'closer' : 'unsure';
}

/** Age today from a birth year, or undefined. */
export function ageOf(p: Pick<Person, 'birthYear'>, now = new Date()) {
  return p.birthYear ? now.getFullYear() - p.birthYear : undefined;
}

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
  /** The story so far: how they met, what happened between them. Free text. */
  history?: string;
  /** What the user wants with this person, in their own words. */
  wish?: string;
  /** Who they are to the user. Missing on people saved before this existed. */
  relationship?: Relationship;
  /** Kept as a year, not an age, so it never goes stale. Asked for children. */
  birthYear?: number;
};

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type Chat = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
  /** What Gab saved during this chat, shown under the reply that saved it. */
  saved: { afterMessage: number; changes: SavedChange[] }[];
  /** The person this chat was started about (prep, interview, "talk about"). */
  personId?: string;
};

export type Memory = { people: Person[]; chats: Chat[] };

/** A change Gab asks to make. Comes from the AI, so every field is checked. */
export type MemoryOp =
  | { type: 'add_person'; name: string; where?: string; goal?: Goal; relationship?: Relationship }
  | { type: 'add_fact'; person: string; text: string; date?: string }
  | { type: 'set_goal'; person: string; goal: Goal }
  | { type: 'set_where'; person: string; where: string }
  | { type: 'add_history'; person: string; text: string }
  | { type: 'set_wish'; person: string; text: string }
  | { type: 'set_relationship'; person: string; relationship: Relationship }
  | { type: 'set_age'; person: string; age: number };

/** What actually changed, so the person can see it and undo it. */
export type SavedChange = {
  label: string; personId: string; factId?: string;
  kind: 'person' | 'fact' | 'goal' | 'where' | 'history' | 'wish' | 'relationship' | 'age';
  /** For history and wish: the text before the change, so undo can put it back. */
  before?: string;
};

export const HISTORY_MAX = 4000;
export const WISH_MAX = 600;

export const emptyMemory = (): Memory => ({ people: [], chats: [] });

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const GOALS = Object.keys(GOAL_LABELS) as Goal[];
const isGoal = (v: unknown): v is Goal => typeof v === 'string' && (GOALS as string[]).includes(v);
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const isRelationship = (v: unknown): v is Relationship => typeof v === 'string' && (RELATIONSHIPS as string[]).includes(v);
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
    if (o.type === 'add_person') out.push({ type: 'add_person', name: person, where: clean(o.where, 120) || undefined, goal: isGoal(o.goal) ? o.goal : undefined, relationship: isRelationship(o.relationship) ? o.relationship : undefined });
    else if (o.type === 'add_fact' && clean(o.text, 300)) out.push({ type: 'add_fact', person, text: clean(o.text, 300), date: isDay(o.date) ? o.date : undefined });
    else if (o.type === 'set_goal' && isGoal(o.goal)) out.push({ type: 'set_goal', person, goal: o.goal });
    else if (o.type === 'set_where' && clean(o.where, 120)) out.push({ type: 'set_where', person, where: clean(o.where, 120) });
    else if (o.type === 'add_history' && clean(o.text, 1500)) out.push({ type: 'add_history', person, text: clean(o.text, 1500) });
    else if (o.type === 'set_wish' && clean(o.text, WISH_MAX)) out.push({ type: 'set_wish', person, text: clean(o.text, WISH_MAX) });
    else if (o.type === 'set_relationship' && isRelationship(o.relationship)) out.push({ type: 'set_relationship', person, relationship: o.relationship });
    else if (o.type === 'set_age' && typeof o.age === 'number' && Number.isInteger(o.age) && o.age >= 0 && o.age <= 110) out.push({ type: 'set_age', person, age: o.age });
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
      if (op.relationship && !person.relationship) person.relationship = op.relationship;
      if (op.goal && person.goal === 'unsure') person.goal = op.goal;
      person.goal = fitGoal(person.goal, person.relationship);
    } else if (op.type === 'add_fact') {
      const person = ensure(op.person);
      if (person.facts.some(f => f.text.toLocaleLowerCase() === op.text.toLocaleLowerCase())) continue;
      const fact: Fact = { id: newId(), text: op.text, date: op.date, createdAt: now.toISOString() };
      person.facts.unshift(fact);
      changes.push({ kind: 'fact', personId: person.id, factId: fact.id, label: `${person.name}: ${op.text}` });
    } else if (op.type === 'set_goal') {
      const person = ensure(op.person);
      const goal = fitGoal(op.goal, person.relationship);
      if (person.goal === goal) continue;
      person.goal = goal;
      changes.push({ kind: 'goal', personId: person.id, label: `${person.name}: ${GOAL_LABELS[goal]}` });
    } else if (op.type === 'set_where') {
      const person = ensure(op.person);
      if (person.where === op.where) continue;
      person.where = op.where;
      changes.push({ kind: 'where', personId: person.id, label: `${person.name}: ${op.where}` });
    } else if (op.type === 'add_history') {
      // Gab adds to the story; it never replaces what the user wrote.
      const person = ensure(op.person);
      const before = person.history ?? '';
      if (before.toLocaleLowerCase().includes(op.text.toLocaleLowerCase())) continue;
      person.history = (before ? `${before}\n\n${op.text}` : op.text).slice(0, HISTORY_MAX);
      changes.push({ kind: 'history', personId: person.id, before, label: `${person.name}'s story: ${op.text}` });
    } else if (op.type === 'set_wish') {
      const person = ensure(op.person);
      const before = person.wish ?? '';
      if (before === op.text) continue;
      person.wish = op.text;
      changes.push({ kind: 'wish', personId: person.id, before, label: `${person.name}, you want: ${op.text}` });
    } else if (op.type === 'set_relationship') {
      const person = ensure(op.person);
      if (person.relationship === op.relationship) continue;
      person.relationship = op.relationship;
      person.goal = fitGoal(person.goal, op.relationship);
      changes.push({ kind: 'relationship', personId: person.id, label: `${person.name}: ${RELATIONSHIP_LABELS[op.relationship]}` });
    } else if (op.type === 'set_age') {
      const person = ensure(op.person);
      const birthYear = now.getFullYear() - op.age;
      if (person.birthYear === birthYear) continue;
      person.birthYear = birthYear;
      changes.push({ kind: 'age', personId: person.id, label: `${person.name}: age ${op.age}` });
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
    // Keep the person if anything else is known: a later fact, a story, or a wish not being undone now.
    const undoneStory = undoneTogether.some(c => c.kind === 'history' && c.personId === change.personId && !c.before);
    const undoneWish = undoneTogether.some(c => c.kind === 'wish' && c.personId === change.personId && !c.before);
    return people.filter(p => p.id !== change.personId
      || p.facts.some(f => !undoneFacts.has(f.id))
      || (!!p.history && !undoneStory)
      || (!!p.wish && !undoneWish));
  }
  if (change.kind === 'history' || change.kind === 'wish') {
    const key = change.kind;
    return people.map(p => (p.id === change.personId ? { ...p, [key]: change.before || undefined } : p));
  }
  return people;
}

/** Chats about a person: started about them, or where Gab saved something about them. */
export function chatsAbout(chats: Chat[], personId: string): Chat[] {
  return chats.filter(c => c.personId === personId || c.saved.some(s => s.changes.some(ch => ch.personId === personId)));
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
export function memoryForCoach(people: Person[], now = new Date()) {
  if (!people.length) return 'No people saved yet.';
  return people.slice(0, 60).map(p => {
    const rel = p.relationship ? ` | who: ${RELATIONSHIP_LABELS[p.relationship]}` : ' | who: not set';
    const age = ageOf(p, now);
    const ageText = age !== undefined ? ` | age: about ${age}` : '';
    const facts = p.facts.slice(0, 15).map(f => `  - ${f.text}${f.date ? ` (date: ${f.date})` : ''}${f.private ? ' [PRIVATE: never suggest bringing this up]' : ''}`).join('\n');
    const wish = p.wish ? `\n  What the user wants, in their words: ${p.wish}` : '';
    const history = p.history ? `\n  History: ${p.history.slice(0, 1500).replace(/\s*\n\s*/g, ' ')}` : '';
    return `${p.name}${rel}${ageText} | where: ${p.where || 'unknown'} | goal: ${GOAL_LABELS[p.goal]}${wish}${history}\n${facts || '  - (no facts yet)'}`;
  }).join('\n');
}

export function chatTitle(first: string) {
  const t = first.trim().replace(/\s+/g, ' ');
  return t.length > 48 ? `${t.slice(0, 45)}…` : t || 'New chat';
}
