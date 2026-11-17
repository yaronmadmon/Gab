'use client';
import { RELATIONSHIP_LABELS, RELATIONSHIPS, type Relationship } from '@/lib/memory';

/** "Who they are to you", plus an age box for your children. Shared by the add page and the person page. */
export default function WhoPicker({ value, age, onChange, onAge, onAgeDone }: {
  value?: Relationship; age: string;
  onChange: (r: Relationship | undefined) => void;
  onAge: (age: string) => void;
  onAgeDone?: () => void;
}) {
  return (
    <div className="field">
      <span>Who they are to you</span>
      <div className="who-row">
        <select value={value ?? ''} onChange={e => onChange((e.target.value || undefined) as Relationship | undefined)} aria-label="Who they are to you">
          <option value="">Choose…</option>
          {RELATIONSHIPS.map(r => <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>)}
        </select>
        {value === 'child' && (
          <label className="age-box">
            Age
            <input type="number" inputMode="numeric" min={0} max={60} value={age}
              onChange={e => onAge(e.target.value)} onBlur={onAgeDone} aria-label="Age" />
          </label>
        )}
      </div>
    </div>
  );
}

/** A typed age box back to a birth year, or undefined when empty or nonsense. */
export function birthYearFrom(age: string, now = new Date()) {
  const n = Number(age);
  return age.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 110 ? now.getFullYear() - n : undefined;
}
