'use client';
import { useEffect, useState } from 'react';
import { comingUp, GOAL_LABELS, newId, whenLabel, type Goal, type Person } from '@/lib/memory';

const GOALS = Object.keys(GOAL_LABELS) as Goal[];

export default function PersonCard({ person, today, onChange, onDelete, onPrep, onClose }: {
  person: Person; today: string;
  onChange: (p: Person) => void; onDelete: () => void; onPrep: () => void; onClose: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [where, setWhere] = useState(person.where);
  const [fact, setFact] = useState('');
  const [date, setDate] = useState('');
  useEffect(() => { setName(person.name); setWhere(person.where); }, [person.id, person.name, person.where]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dayCounts = new Map(comingUp([person], today).map(u => [u.fact.id, u.days]));
  const saveName = () => { const n = name.trim(); if (n && n !== person.name) onChange({ ...person, name: n }); else setName(person.name); };
  const saveWhere = () => { if (where.trim() !== person.where) onChange({ ...person, where: where.trim() }); };
  const addFact = () => {
    const text = fact.trim();
    if (!text) return;
    onChange({ ...person, facts: [{ id: newId(), text, date: date || undefined, createdAt: new Date().toISOString() }, ...person.facts] });
    setFact(''); setDate('');
  };

  return (
    <div className="card-layer" role="dialog" aria-modal="true" aria-label={person.name}>
      <button className="scrim" aria-label="Close" onClick={onClose} />
      <section className="card">
        <div className="card-head">
          <span className="avatar big" aria-hidden>{person.name.slice(0, 1).toUpperCase()}</span>
          <input className="card-name" value={name} onChange={e => setName(e.target.value)} onBlur={saveName} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Name" maxLength={80} />
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <button className="prep" onClick={onPrep}>I&apos;m about to see {person.name}</button>

        <label className="field">
          <span>Where you know them</span>
          <input value={where} onChange={e => setWhere(e.target.value)} onBlur={saveWhere} placeholder="Work, synagogue, the building…" maxLength={120} />
        </label>

        <div className="field">
          <span>What you want</span>
          <div className="goals" role="radiogroup" aria-label="What you want with this person">
            {GOALS.map(g => (
              <button key={g} role="radio" aria-checked={person.goal === g} className={person.goal === g ? 'on' : ''} onClick={() => onChange({ ...person, goal: g })}>{GOAL_LABELS[g]}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>What you know</span>
          <form className="add-fact" onSubmit={e => { e.preventDefault(); addFact(); }}>
            <input value={fact} onChange={e => setFact(e.target.value)} placeholder="Add something you know" maxLength={300} aria-label="New note" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Date, if it's an event" title="Date, if it's an event" />
            <button type="submit" disabled={!fact.trim()}>Add</button>
          </form>
          {person.facts.length === 0 && <p className="muted">Nothing yet. Tell Gab about {person.name} in a chat and it will fill in.</p>}
          <ul className="facts">
            {person.facts.map(f => (
              <li key={f.id}>
                <div>
                  <p>{f.text}</p>
                  {f.date && <span className="fact-date">{dayCounts.has(f.id) ? whenLabel(dayCounts.get(f.id)!) : new Date(`${f.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                </div>
                <button className="icon-btn small" onClick={() => onChange({ ...person, facts: person.facts.filter(x => x.id !== f.id) })} aria-label={`Delete: ${f.text}`}>✕</button>
              </li>
            ))}
          </ul>
        </div>

        <button className="danger" onClick={() => { if (window.confirm(`Delete ${person.name} and everything Gab knows about them?`)) onDelete(); }}>Delete {person.name}</button>
      </section>
    </div>
  );
}
