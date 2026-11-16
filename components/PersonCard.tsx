'use client';
import { useEffect, useState } from 'react';
import { comingUp, GOAL_LABELS, HISTORY_MAX, newId, whenLabel, WISH_MAX, type Chat, type Goal, type Person } from '@/lib/memory';

const GOALS = Object.keys(GOAL_LABELS) as Goal[];

/** A person's page: their story, what you want with them, things to remember, and your chats about them. */
export default function PersonCard({ person, today, chats, onChange, onDelete, onPrep, onTalk, onInterview, onOpenChat, onClose }: {
  person: Person; today: string; chats: Chat[];
  onChange: (p: Person) => void; onDelete: () => void; onPrep: () => void; onTalk: () => void;
  onInterview: () => void; onOpenChat: (id: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [where, setWhere] = useState(person.where);
  const [history, setHistory] = useState(person.history ?? '');
  const [wish, setWish] = useState(person.wish ?? '');
  const [fact, setFact] = useState('');
  const [date, setDate] = useState('');
  // Pick up changes Gab saves while the page is open.
  useEffect(() => { setName(person.name); setWhere(person.where); }, [person.id, person.name, person.where]);
  useEffect(() => { setHistory(person.history ?? ''); }, [person.id, person.history]);
  useEffect(() => { setWish(person.wish ?? ''); }, [person.id, person.wish]);
  /** Save every typed-but-unsaved box in one change, so leaving the page never loses words. */
  const flush = () => {
    const n = name.trim() || person.name;
    const next: Person = { ...person, name: n, where: where.trim(), history: history.trim() || undefined, wish: wish.trim() || undefined };
    if (next.name !== person.name || next.where !== person.where || next.history !== person.history || next.wish !== person.wish) onChange(next);
  };
  const leave = (then: () => void) => () => { flush(); then(); };
  const close = leave(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const dayCounts = new Map(comingUp([person], today).map(u => [u.fact.id, u.days]));
  const saveName = () => { const n = name.trim(); if (n && n !== person.name) onChange({ ...person, name: n }); else setName(person.name); };
  const saveWhere = () => { if (where.trim() !== person.where) onChange({ ...person, where: where.trim() }); };
  const saveHistory = () => { const h = history.trim(); if (h !== (person.history ?? '')) onChange({ ...person, history: h || undefined }); };
  const saveWish = () => { const w = wish.trim(); if (w !== (person.wish ?? '')) onChange({ ...person, wish: w || undefined }); };
  const addFact = () => {
    const text = fact.trim();
    if (!text) return;
    onChange({ ...person, facts: [{ id: newId(), text, date: date || undefined, createdAt: new Date().toISOString() }, ...person.facts] });
    setFact(''); setDate('');
  };

  return (
    <div className="card-layer" role="dialog" aria-modal="true" aria-label={person.name}>
      <button className="scrim" aria-label="Close" onClick={close} />
      <section className="card wide">
        <div className="card-head">
          <span className="avatar big" aria-hidden>{person.name.slice(0, 1).toUpperCase()}</span>
          <input className="card-name" value={name} onChange={e => setName(e.target.value)} onBlur={saveName} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Name" maxLength={80} />
          <button className="icon-btn" onClick={close} aria-label="Close">✕</button>
        </div>

        <div className="person-actions">
          <button className="prep" onClick={leave(onPrep)}>I&apos;m about to see {person.name}</button>
          <div className="person-actions-row">
            <button className="soft-btn" onClick={leave(onTalk)}>Talk about {person.name}</button>
            <button className="soft-btn" onClick={leave(onInterview)}>Let Gab ask me more</button>
          </div>
        </div>

        <label className="field">
          <span>Where you know them</span>
          <input value={where} onChange={e => setWhere(e.target.value)} onBlur={saveWhere} placeholder="Work, synagogue, the building…" maxLength={120} />
        </label>

        <label className="field">
          <span>Your history together</span>
          <textarea value={history} onChange={e => setHistory(e.target.value)} onBlur={saveHistory} rows={6} maxLength={HISTORY_MAX}
            placeholder="How you met, what's happened between you, how things are now." />
        </label>

        <div className="field">
          <span>What you want with them</span>
          <div className="goals" role="radiogroup" aria-label="What you want with this person">
            {GOALS.map(g => (
              <button key={g} role="radio" aria-checked={person.goal === g} className={person.goal === g ? 'on' : ''} onClick={() => onChange({ ...person, goal: g })}>{GOAL_LABELS[g]}</button>
            ))}
          </div>
          <textarea value={wish} onChange={e => setWish(e.target.value)} onBlur={saveWish} rows={2} maxLength={WISH_MAX}
            placeholder="In your own words: “I want him to feel easy around me again.”" aria-label="What you want, in your own words" />
        </div>

        <div className="field">
          <span>Things to remember</span>
          <form className="add-fact" onSubmit={e => { e.preventDefault(); addFact(); }}>
            <input value={fact} onChange={e => setFact(e.target.value)} placeholder="Add something you know" maxLength={300} aria-label="New note" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Date, if it's an event" title="Date, if it's an event" />
            <button type="submit" disabled={!fact.trim()}>Add</button>
          </form>
          {person.facts.length === 0 && <p className="muted">Nothing yet. Add a detail above, or let Gab ask you.</p>}
          <ul className="facts">
            {person.facts.map(f => (
              <li key={f.id}>
                <div className="fact-body">
                  <p>{f.text}</p>
                  {f.date && <span className="fact-date">{dayCounts.has(f.id) ? whenLabel(dayCounts.get(f.id)!) : new Date(`${f.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                  <button
                    className={`fact-private ${f.private ? 'on' : ''}`}
                    aria-pressed={!!f.private}
                    onClick={() => onChange({ ...person, facts: person.facts.map(x => (x.id === f.id ? { ...x, private: !x.private } : x)) })}
                  >
                    {f.private ? "Don't bring up · on" : "Don't bring up"}
                  </button>
                </div>
                <button className="icon-btn small" onClick={() => onChange({ ...person, facts: person.facts.filter(x => x.id !== f.id) })} aria-label={`Delete: ${f.text}`}>✕</button>
              </li>
            ))}
          </ul>
        </div>

        {chats.length > 0 && (
          <div className="field">
            <span>Your chats about {person.name}</span>
            <ul className="person-chats">
              {chats.slice(0, 15).map(c => (
                <li key={c.id}>
                  <button onClick={leave(() => onOpenChat(c.id))}>
                    <span className="pc-title">{c.title}</span>
                    <span className="pc-date">{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button className="danger" onClick={() => { if (window.confirm(`Delete ${person.name} and everything Gab knows about them?`)) onDelete(); }}>Delete {person.name}</button>
      </section>
    </div>
  );
}
