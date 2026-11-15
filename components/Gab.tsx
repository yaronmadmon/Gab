'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyOps, chatTitle, comingUp, emptyMemory, GOAL_LABELS, localDay, memoryForCoach, newId, parseOps, recentTurns, undoChange, whenLabel,
  type Chat, type ChatMessage, type Memory, type Person, type SavedChange,
} from '@/lib/memory';
import { loadMemory, saveMemory } from '@/lib/storage';
import { useVoice } from './useVoice';
import PersonCard from './PersonCard';
import { Reply } from './Reply';

const STARTERS = [
  { label: "I'm about to see someone", text: "I'm about to see " },
  { label: "It's awkward right now", text: "Right now " },
  { label: "Here's what happened", text: "Just got back. " },
];

export default function Gab() {
  const [memory, setMemory] = useState<Memory>(emptyMemory);
  const [loaded, setLoaded] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [personId, setPersonId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [today, setToday] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const voice = useVoice(text => setDraft(text));

  // The latest memory, so a reply that arrives later never overwrites edits made while waiting.
  const memRef = useRef<Memory>(memory);

  useEffect(() => {
    const loadedMemory = loadMemory();
    memRef.current = loadedMemory;
    setMemory(loadedMemory);
    setLoaded(true);
    // Keep "today" right if the tab stays open past midnight.
    const tick = () => setToday(localDay());
    tick();
    const timer = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);

  const commit = (next: Memory) => {
    memRef.current = next;
    setMemory(next);
    if (!saveMemory(next)) setError('This browser would not save. Your notes may not be kept.');
  };
  /** Change memory from its latest state. */
  const change = (fn: (m: Memory) => Memory) => commit(fn(memRef.current));

  const chat = memory.chats.find(c => c.id === chatId) ?? null;
  const person = memory.people.find(p => p.id === personId) ?? null;
  const upcoming = useMemo(() => (today ? comingUp(memory.people, today) : []), [memory.people, today]);

  // Grow the message box with its text (works where CSS field-sizing does not).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chat?.messages.length, busy]);

  const startNew = () => { setChatId(null); setDraft(''); setError(''); setMenuOpen(false); inputRef.current?.focus(); };

  async function send(textArg?: string, fresh = false) {
    const text = (textArg ?? draft).trim();
    if (!text || busy) return;
    if (voice.listening) voice.toggle();
    setError('');
    const open = fresh ? null : chat;
    const base: Chat = open ?? { id: newId(), title: chatTitle(text), updatedAt: '', messages: [], saved: [] };
    const messages: ChatMessage[] = [...base.messages, { role: 'user', content: text }];
    const pending: Chat = { ...base, messages, updatedAt: new Date().toISOString() };
    change(m => ({ ...m, chats: [pending, ...m.chats.filter(c => c.id !== pending.id)] }));
    setChatId(pending.id);
    setDraft('');
    setBusy(true);
    try {
      const now = new Date();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: recentTurns(messages),
          memory: memoryForCoach(memRef.current.people),
          today: `${localDay(now)}, ${now.toLocaleDateString('en-US', { weekday: 'long' })}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.reply !== 'string') throw new Error(data.error || 'Gab could not answer right now.');
      change(m => {
        const { people, changes } = applyOps(m.people, parseOps(data.ops));
        const current = m.chats.find(c => c.id === pending.id) ?? pending;
        const answered: Chat = {
          ...current,
          messages: [...messages, { role: 'assistant', content: data.reply }],
          saved: changes.length ? [...current.saved, { afterMessage: messages.length, changes }] : current.saved,
          updatedAt: new Date().toISOString(),
        };
        return { people, chats: [answered, ...m.chats.filter(c => c.id !== answered.id)] };
      });
    } catch (e) {
      // Put the words back so nothing typed is lost.
      change(m => ({ ...m, chats: base.messages.length ? m.chats.map(c => (c.id === base.id ? base : c)) : m.chats.filter(c => c.id !== base.id) }));
      if (!base.messages.length) setChatId(null);
      setDraft(text);
      setError(e instanceof Error ? e.message : 'Gab could not answer right now.');
    } finally {
      setBusy(false);
    }
  }

  const undo = (saved: SavedChange, group: SavedChange[]) => {
    if (!chat) return;
    // Undoing "Added David" also undoes the facts saved with him, but never facts saved later.
    const together = saved.kind === 'person' ? group.filter(c => c.personId === saved.personId) : [saved];
    change(m => {
      let people = m.people;
      for (const c of together) people = undoChange(people, c, together);
      const chats = m.chats.map(c => (c.id !== chat.id ? c : {
        ...c,
        saved: c.saved.map(s => ({ ...s, changes: s.changes.filter(x => !together.includes(x)) })).filter(s => s.changes.length),
      }));
      return { people, chats };
    });
  };

  const updatePerson = (next: Person) => change(m => ({ ...m, people: m.people.map(p => (p.id === next.id ? next : p)) }));
  const deletePerson = (id: string) => { change(m => ({ ...m, people: m.people.filter(p => p.id !== id) })); setPersonId(null); };
  const addPerson = () => {
    const name = newName.trim();
    if (!name) return;
    const existing = memory.people.find(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) { setPersonId(existing.id); setNewName(''); return; }
    const p: Person = { id: newId(), name, where: '', goal: 'unsure', facts: [] };
    change(m => ({ ...m, people: [p, ...m.people] }));
    setNewName('');
    setPersonId(p.id);
  };
  const deleteChat = (id: string) => {
    if (!window.confirm('Delete this chat? What Gab saved about people stays.')) return;
    change(m => ({ ...m, chats: m.chats.filter(c => c.id !== id) }));
    if (chatId === id) setChatId(null);
  };
  const prepFor = (p: Person) => { setPersonId(null); setMenuOpen(false); void send(`I'm about to see ${p.name}. Help me get ready.`, true); };

  const pickStarter = (text: string) => { setDraft(text); requestAnimationFrame(() => { const el = inputRef.current; if (el) { el.focus(); el.setSelectionRange(text.length, text.length); } }); };

  return (
    <div className="app">
      <aside className={`side ${menuOpen ? 'open' : ''}`} aria-label="Your people and chats">
        <div className="side-top">
          <button className="brand" onClick={startNew}>gab<span>.</span></button>
          <button className="icon-btn only-mobile" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
        </div>
        <button className="new-chat" onClick={startNew}><span aria-hidden>＋</span> New chat</button>

        {upcoming.length > 0 && (
          <section className="side-section">
            <h2>Coming up</h2>
            {upcoming.map(({ person: p, fact, days }) => (
              <button key={fact.id} className="up-item" onClick={() => { setPersonId(p.id); setMenuOpen(false); }}>
                <span className={`when ${days < 0 ? 'past' : ''}`}>{whenLabel(days)}</span>
                <span className="up-text"><strong>{p.name}</strong> · {fact.text}</span>
              </button>
            ))}
          </section>
        )}

        <section className="side-section">
          <h2>Your people</h2>
          {memory.people.map(p => (
            <button key={p.id} className="person-row" onClick={() => { setPersonId(p.id); setMenuOpen(false); }}>
              <span className="avatar" aria-hidden>{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="person-meta">
                <span className="person-name">{p.name}</span>
                <span className="person-sub">{[p.where, p.goal !== 'unsure' ? GOAL_LABELS[p.goal] : ''].filter(Boolean).join(' · ') || `${p.facts.length} notes`}</span>
              </span>
            </button>
          ))}
          {loaded && memory.people.length === 0 && <p className="side-empty">Mention someone in a chat and Gab will add them here.</p>}
          <form className="add-person" onSubmit={e => { e.preventDefault(); addPerson(); }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Add a person" maxLength={80} aria-label="Add a person by name" />
          </form>
        </section>

        {memory.chats.length > 0 && (
          <section className="side-section">
            <h2>Chats</h2>
            {memory.chats.slice(0, 20).map(c => (
              <div key={c.id} className={`chat-row ${c.id === chatId ? 'active' : ''}`}>
                <button className="chat-open" onClick={() => { setChatId(c.id); setMenuOpen(false); setError(''); }}>{c.title}</button>
                <button className="chat-del" onClick={() => deleteChat(c.id)} aria-label={`Delete chat ${c.title}`}>✕</button>
              </div>
            ))}
          </section>
        )}
        <p className="side-foot">Your notes stay in this browser.</p>
      </aside>
      {menuOpen && <button className="scrim only-mobile" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <main className="main">
        <header className="topbar only-mobile">
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open your people and chats">☰</button>
          <button className="brand" onClick={startNew}>gab<span>.</span></button>
          <button className="icon-btn" onClick={startNew} aria-label="New chat">＋</button>
        </header>

        <div className="thread">
          {!chat ? (
            <div className="welcome">
              <h1>What&apos;s going on?</h1>
              <p>Tell me who you&apos;re about to see, what&apos;s awkward right now, or how it went. I&apos;ll remember the people for next time.</p>
              <div className="starters">
                {STARTERS.map(s => <button key={s.label} onClick={() => pickStarter(s.text)}>{s.label}</button>)}
              </div>
              {upcoming.length > 0 && (
                <div className="nudge">
                  <strong>{upcoming[0].person.name}</strong>: {upcoming[0].fact.text} · {whenLabel(upcoming[0].days).toLowerCase()}
                </div>
              )}
            </div>
          ) : (
            chat.messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === 'assistant' ? <Reply text={m.content} /> : <p>{m.content}</p>}
                {chat.saved.filter(s => s.afterMessage === i).flatMap(s => s.changes.map(c => ({ c, group: s.changes }))).map(({ c, group }, j) => (
                  <div key={j} className="saved">
                    <span className="saved-label">Remembered</span>
                    <button className="saved-text" onClick={() => setPersonId(c.personId)}>{c.label}</button>
                    {(c.kind === 'fact' || c.kind === 'person') && <button className="saved-undo" onClick={() => undo(c, group)}>Undo</button>}
                  </div>
                ))}
              </div>
            ))
          )}
          {busy && <div className="msg assistant thinking" aria-live="polite"><span /><span /><span /></div>}
          <div ref={endRef} />
        </div>

        <div className="composer-wrap">
          {error && <button className="error" onClick={() => setError('')}>{error} <span aria-hidden>✕</span></button>}
          <form className="composer" onSubmit={e => { e.preventDefault(); void send(); }}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
              placeholder={voice.listening ? 'Listening…' : 'Talk to Gab…'}
              rows={1}
              maxLength={4000}
              aria-label="Message"
            />
            {voice.supported && (
              <button type="button" className={`icon-btn mic ${voice.listening ? 'on' : ''}`} onClick={voice.toggle} aria-label={voice.listening ? 'Stop talking' : 'Talk instead of typing'}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" /></svg>
              </button>
            )}
            <button type="submit" className="send" disabled={busy || !draft.trim()} aria-label="Send">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path fill="currentColor" d="M12 4l7 7-1.4 1.4L13 7.8V20h-2V7.8l-4.6 4.6L5 11z" /></svg>
            </button>
          </form>
        </div>
      </main>

      {person && (
        <PersonCard
          person={person}
          today={today}
          onChange={updatePerson}
          onDelete={() => deletePerson(person.id)}
          onPrep={() => prepFor(person)}
          onClose={() => setPersonId(null)}
        />
      )}
    </div>
  );
}
