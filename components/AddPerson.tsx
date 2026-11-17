'use client';
import { useEffect, useState } from 'react';
import { fitGoal, GOAL_LABELS, goalsFor, HISTORY_MAX, newId, WISH_MAX, type Fact, type Goal, type Person, type Relationship } from '@/lib/memory';
import WhoPicker, { birthYearFrom } from './WhoPicker';

type Row = { text: string; date: string };

/** The full "Add a person" page. Fill it in yourself, or hand over to Gab to interview you. */
export default function AddPerson({ existingNames, onSave, onInterview, onClose }: {
  existingNames: string[];
  onSave: (p: Person) => void;
  onInterview: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [where, setWhere] = useState('');
  const [history, setHistory] = useState('');
  const [goal, setGoal] = useState<Goal>('unsure');
  const [relationship, setRelationship] = useState<Relationship | undefined>();
  const [age, setAge] = useState('');
  const [wish, setWish] = useState('');
  const [rows, setRows] = useState<Row[]>([{ text: '', date: '' }]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmed = name.trim();
  const taken = existingNames.some(n => n.toLocaleLowerCase() === trimmed.toLocaleLowerCase());

  const save = () => {
    if (!trimmed || taken) return;
    const now = new Date().toISOString();
    const facts: Fact[] = rows.filter(r => r.text.trim()).map(r => ({ id: newId(), text: r.text.trim(), date: r.date || undefined, createdAt: now }));
    onSave({
      id: newId(), name: trimmed, where: where.trim(), goal, facts, relationship,
      birthYear: relationship === 'child' ? birthYearFrom(age) : undefined,
      history: history.trim() || undefined, wish: wish.trim() || undefined,
    });
  };

  const setRow = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="card-layer" role="dialog" aria-modal="true" aria-label="Add a person">
      <button className="scrim" aria-label="Close" onClick={onClose} />
      <form className="card wide" onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="card-head">
          <h2 className="card-title">Add a person</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="David" maxLength={80} autoFocus />
          {taken && <small className="warn">{trimmed} is already in your people.</small>}
        </label>

        <WhoPicker value={relationship} age={age} onAge={setAge}
          onChange={r => { setRelationship(r); setGoal(g => fitGoal(g, r)); }} />

        <div className="interview-offer">
          <p>Rather talk it through? Gab will ask you a few questions and fill this in for you.</p>
          <button type="button" className="soft-btn" disabled={!trimmed || taken} onClick={() => onInterview(trimmed)}>
            {trimmed ? `Let Gab ask me about ${trimmed}` : 'Type a name, then let Gab ask you'}
          </button>
        </div>

        <label className="field">
          <span>Where you know them</span>
          <input value={where} onChange={e => setWhere(e.target.value)} placeholder="Work, synagogue, the building…" maxLength={120} />
        </label>

        <label className="field">
          <span>Your history together</span>
          <textarea value={history} onChange={e => setHistory(e.target.value)} rows={5} maxLength={HISTORY_MAX}
            placeholder="How you met, what's happened between you, how things are now. Write as much as you like." />
        </label>

        <div className="field">
          <span>What you want with them</span>
          <div className="goals" role="radiogroup" aria-label="What you want with this person">
            {goalsFor(relationship).map(g => (
              <button type="button" key={g} role="radio" aria-checked={goal === g} className={goal === g ? 'on' : ''} onClick={() => setGoal(g)}>{GOAL_LABELS[g]}</button>
            ))}
          </div>
          <textarea value={wish} onChange={e => setWish(e.target.value)} rows={2} maxLength={WISH_MAX}
            placeholder="In your own words: “I want him to feel easy around me again.”" aria-label="What you want, in your own words" />
        </div>

        <div className="field">
          <span>Things to remember</span>
          {rows.map((r, i) => (
            <div className="add-fact" key={i}>
              <input value={r.text} onChange={e => setRow(i, { text: e.target.value })} placeholder="His son is getting married" maxLength={300} aria-label={`Thing to remember ${i + 1}`} />
              <input type="date" value={r.date} onChange={e => setRow(i, { date: e.target.value })} aria-label="Date, if it's an event" title="Date, if it's an event" />
            </div>
          ))}
          <button type="button" className="link-btn" onClick={() => setRows(rs => [...rs, { text: '', date: '' }])}>＋ Another one</button>
        </div>

        <button type="submit" className="prep" disabled={!trimmed || taken}>Save {trimmed || 'person'}</button>
      </form>
    </div>
  );
}
