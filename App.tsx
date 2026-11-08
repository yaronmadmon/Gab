import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { coachConnected, getPrep, getStuck, localPrep, localStuck, suggestNote, type Note, type NoteSuggestion, type Person, type PrepCard, type StuckCard } from './src/coach';
import { clearPeople, newId, readPeople, writePeople } from './src/storage';

type Screen = 'home' | 'prep' | 'stuck' | 'capture' | 'people' | 'person' | 'settings';
const color = { bg: '#F8F6F0', white: '#FFF', ink: '#19372E', green: '#245947', muted: '#65746C', line: '#DFE4DC', mint: '#DFEDE3', orange: '#E99458', pale: '#FFF0E2' };

function VoiceField({ value, onChange, placeholder, multiline = false }: { value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => { const words = event.results[0]?.transcript; if (words) onChange(words); });
  useSpeechRecognitionEvent('error', () => { setListening(false); setError('Voice unavailable. You can type instead.'); });
  const toggle = async () => {
    setError('');
    if (listening) return ExpoSpeechRecognitionModule.stop();
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) return setError('Allow microphone access to use dictation.');
      Keyboard.dismiss();
      ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
    } catch { setError('Voice unavailable. You can type instead.'); }
  };
  return <View><View style={s.inputRow}><TextInput style={[s.input, multiline && s.tall]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#8C9990" multiline={multiline} textAlignVertical="top" accessibilityLabel={placeholder} /><Pressable style={[s.mic, listening && { backgroundColor: color.orange }]} onPress={toggle} accessibilityRole="button" accessibilityLabel={listening ? 'Stop dictation' : 'Start dictation'}><Text style={{ fontSize: 20 }}>{listening ? '■' : '🎙'}</Text></Pressable></View>{Boolean(listening || error) && <Text style={s.hint}>{error || 'Listening to your voice…'}</Text>}</View>;
}
function Button({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) { return <Pressable style={[s.button, secondary && s.secondary, disabled && { opacity: .5 }]} onPress={onPress} disabled={disabled} accessibilityRole="button"><Text style={[s.buttonText, secondary && { color: color.green }]}>{label}</Text></Pressable>; }
function Chip({ label, onPress, active = false }: { label: string; onPress: () => void; active?: boolean }) { return <Pressable style={[s.chip, active && { backgroundColor: color.green, borderColor: color.green }]} onPress={onPress}><Text style={[s.chipText, active && { color: color.white }]}>{label}</Text></Pressable>; }
function Title({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) { return <View style={{ marginBottom: 23 }}><Text style={s.eyebrow}>{eyebrow}</Text><Text style={s.title}>{title}</Text>{subtitle && <Text style={s.subtitle}>{subtitle}</Text>}</View>; }

function Main() {
  const [screen, setScreen] = useState<Screen>('home');
  const [people, setPeople] = useState<Person[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [situation, setSituation] = useState('');
  const [word, setWord] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [prep, setPrep] = useState<PrepCard | null>(null);
  const [stuck, setStuck] = useState<StuckCard | null>(null);
  const [raw, setRaw] = useState('');
  const [proposal, setProposal] = useState<NoteSuggestion | null>(null);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const person = people.find(p => p.id === selectedId);
  const save = (next: Person[]) => { setPeople(next); void writePeople(next).catch(() => setNotice('Could not save on this device.')); };
  const update = (id: string, fn: (p: Person) => Person) => save(people.map(p => p.id === id ? fn(p) : p));
  const unlock = async () => {
    if (Platform.OS === 'web') return;
    try {
      const available = await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync();
      setLockAvailable(available);
      if (available) { setLocked(true); const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Gab', fallbackLabel: 'Use device passcode' }); setLocked(!result.success); }
    } catch { setLockAvailable(false); setLocked(false); }
  };
  useEffect(() => {
    readPeople().then(setPeople).catch(() => setLoadError(true)).finally(() => setReady(true));
    void unlock();
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', state => { if (state === 'background') setLocked(true); if (state === 'active') void unlock(); });
    return () => sub.remove();
  }, []);
  const makePrep = async () => {
    if (!situation.trim()) return setNotice('Tell Gab where you are headed first.');
    setBusy(true); setNotice('');
    try { setPrep(await getPrep(situation.trim(), person, includeNotes)); }
    catch { setPrep(localPrep(situation.trim(), person)); setNotice('AI is unavailable. Here is a simple card.'); }
    finally { setBusy(false); }
  };
  const makeStuck = async () => {
    setBusy(true); setNotice('');
    try { setStuck(await getStuck(word.trim())); }
    catch { setStuck(localStuck(word.trim())); setNotice('AI is unavailable. Here are simple options.'); }
    finally { setBusy(false); }
  };
  const makeProposal = async () => {
    if (!raw.trim()) return setNotice('Say or type a few words first.');
    setBusy(true); setNotice('');
    try { const suggested = await suggestNote(raw.trim()); setProposal(suggested || { name: '', detail: '' }); if (!suggested) setNotice('Add the name and one detail to save.'); }
    catch { setProposal({ name: '', detail: '' }); setNotice('AI is unavailable. Add the name and one detail yourself.'); }
    finally { setBusy(false); }
  };
  const approve = () => {
    const name = proposal?.name.trim() || '', detail = proposal?.detail.trim() || '';
    if (!name || !detail) return setNotice('Add a name and detail before saving.');
    const existing = people.find(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    const note: Note = { id: newId(), text: detail, source: raw.trim(), createdAt: new Date().toISOString(), status: 'current' };
    save(existing ? people.map(p => p.id === existing.id ? { ...p, notes: [note, ...p.notes] } : p) : [{ id: newId(), name, relationship: '', notes: [note] }, ...people]);
    setRaw(''); setProposal(null); setNotice('Saved with your approval.'); setScreen('people');
  };
  const addPerson = () => {
    if (!newName.trim()) return setNotice('Add a name first.');
    const p: Person = { id: newId(), name: newName.trim(), relationship: newRelation.trim(), notes: [] };
    save([p, ...people]); setSelectedId(p.id); setNewName(''); setNewRelation(''); setNotice(''); setScreen('person');
  };
  const confirmDelete = (title: string, message: string, action: () => void) => {
    if (Platform.OS === 'web') { if (window.confirm(`${title}\n${message}`)) action(); }
    else Alert.alert(title, message, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: action }]);
  };
  const deletePerson = () => { if (!person) return; confirmDelete('Delete person?', `Delete ${person.name} and all their notes?`, () => { save(people.filter(p => p.id !== person.id)); setSelectedId(null); setScreen('people'); }); };
  const deleteAll = () => confirmDelete('Delete everything?', 'This removes all people and notes from this device.', () => { void clearPeople().then(() => { setPeople([]); setScreen('home'); setNotice('Notebook cleared.'); }).catch(() => setNotice('Could not clear the Notebook.')); });
  if (!ready) return <View style={s.center}><ActivityIndicator color={color.green} /></View>;
  if (loadError) return <View style={s.lock}><Text style={s.logo}>gab<Text style={{ color: color.orange }}>.</Text></Text><Title eyebrow="YOUR NOTEBOOK" title="Could not open your notes." subtitle="Your saved data has not been changed. Try again after unlocking your device." /><Button label="Try again" onPress={() => { void readPeople().then(data => { setPeople(data); setLoadError(false); }).catch(() => setLoadError(true)); }} /></View>;
  if (locked) return <View style={s.lock}><Text style={s.logo}>gab<Text style={{ color: color.orange }}>.</Text></Text><Title eyebrow="PRIVATE SPACE" title="Your space is locked." subtitle="Only you can open your Notebook." /><Button label="Unlock Gab" onPress={() => void unlock()} /></View>;
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><View style={s.header}><Pressable onPress={() => setScreen('home')}><Text style={s.logo}>gab<Text style={{ color: color.orange }}>.</Text></Text></Pressable><Text style={s.badge}>✦  A little braver, together</Text></View><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    {!!notice && <Pressable style={s.notice} onPress={() => setNotice('')}><Text style={s.noticeText}>{notice}  ×</Text></Pressable>}
    {screen === 'home' && <><View style={s.hero}><Text style={s.eyebrow}>A MOMENT OF COURAGE</Text><Text style={s.heroTitle}>Good conversations start with one word.</Text><Text style={s.heroBody}>Hear something they said. Ask about it. Then share a little.</Text><View style={s.underline} /></View><View style={s.card}><Text style={s.eyebrow}>START HERE</Text><Text style={s.cardTitle}>Where are you headed?</Text><Text style={s.cardBody}>A quick plan before you walk in, walk up, or say hello.</Text><VoiceField value={situation} onChange={setSituation} placeholder="A wedding, a work meeting, a walk home…" /><Button label="Get a quick plan  →" onPress={() => { setPrep(null); setScreen('prep'); }} /></View><Text style={s.section}>IN THE MOMENT</Text><View style={s.grid}><Pressable style={[s.tile, { backgroundColor: color.mint }]} onPress={() => { setStuck(null); setScreen('stuck'); }}><Text style={s.tileIcon}>✳</Text><Text style={s.tileTitle}>I'm stuck</Text><Text style={s.cardBody}>When the conversation goes quiet.</Text><Text style={s.arrow}>↗</Text></Pressable><Pressable style={[s.tile, { backgroundColor: color.pale }]} onPress={() => { setProposal(null); setScreen('capture'); }}><Text style={s.tileIcon}>✎</Text><Text style={s.tileTitle}>Remember this</Text><Text style={s.cardBody}>Save a detail after you talk.</Text><Text style={s.arrow}>↗</Text></Pressable></View><Text style={s.quote}>“You don't need the perfect line. Genuine curiosity is enough to begin.”</Text></>}
    {screen === 'prep' && <><Pressable onPress={() => setScreen('home')}><Text style={s.back}>←  Back</Text></Pressable><Title eyebrow="BEFORE YOU GO" title="A 60-second plan" subtitle="Something simple to carry into the room." /><Text style={s.label}>WHAT'S COMING UP?</Text><VoiceField value={situation} onChange={setSituation} placeholder="Where are you headed?" /><Text style={s.label}>SOMEONE YOU MIGHT SEE  ·  OPTIONAL</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}><Chip label="No one specific" active={!selectedId} onPress={() => { setSelectedId(null); setIncludeNotes(false); }} />{people.map(p => <Chip key={p.id} label={p.name} active={selectedId === p.id} onPress={() => { setSelectedId(p.id); setIncludeNotes(false); }} />)}</ScrollView>{person && <Pressable style={s.checkRow} onPress={() => setIncludeNotes(!includeNotes)}><Text style={s.check}>{includeNotes ? '☑' : '□'}</Text><Text style={s.checkText}>Use {person.name}'s approved notes for AI coaching</Text></Pressable>}<Button label={busy ? 'Making your card…' : 'Make my card  →'} disabled={busy} onPress={() => void makePrep()} />{prep && <View style={s.result}><Text style={s.eyebrow}>YOUR POCKET CARD</Text><Text style={s.label}>OPEN WITH</Text><Text style={s.bigLine}>“{prep.opener}”</Text><View style={s.rule} /><Text style={s.label}>IF THEY ANSWER, ASK</Text>{prep.followUps.map((line, i) => <Text style={s.resultLine} key={i}>{i + 1}. {line}</Text>)}<View style={s.rule} /><Text style={s.label}>A KIND EXIT</Text><Text style={s.resultLine}>“{prep.exit}”</Text><Text style={s.nudge}>{prep.nudge}</Text></View>}<Text style={s.privacy}>Only what you choose here is sent for AI coaching. Your Notebook stays on this device.</Text></>}
    {screen === 'stuck' && <><Pressable onPress={() => setScreen('home')}><Text style={s.back}>←  Back</Text></Pressable><Title eyebrow="IN THE MOMENT" title="A little nudge" subtitle="A word or two is enough. Gab never listens to the other person." /><Text style={s.label}>WHAT WORD DID YOU HEAR?</Text><VoiceField value={word} onChange={setWord} placeholder="Fishing, new job, their weekend…" /><Button label={busy ? 'Finding a nudge…' : 'Show me one thing  →'} disabled={busy} onPress={() => void makeStuck()} />{stuck && <View style={s.result}><Text style={s.eyebrow}>TRY THIS FIRST</Text><Text style={s.bigLine}>“{stuck.ask}”</Text><View style={s.rule} /><Text style={s.label}>OR PICK WHAT FITS</Text>{([['SHARE', stuck.share], ['CHANGE TOPIC', stuck.change], ['LEAVE KINDLY', stuck.leave]] as const).map(([name, line]) => <View key={name} style={{ marginVertical: 8 }}><Text style={s.eyebrow}>{name}</Text><Text style={s.resultLine}>{line}</Text></View>)}<Text style={s.nudge}>{stuck.quiet}</Text></View>}<Text style={s.privacy}>Silent and discreet. No ambient recording or live listening.</Text></>}
    {screen === 'capture' && <><Pressable onPress={() => setScreen('home')}><Text style={s.back}>←  Back</Text></Pressable><Title eyebrow="AFTER YOU TALK" title="Remember the good stuff" subtitle="Tell Gab what happened in your own words. Nothing is saved until you approve it." /><VoiceField value={raw} onChange={setRaw} placeholder="Dave mentioned his kids and how much he loves fishing…" multiline /><Text style={s.hint}>Your voice or typed words. Gab does not record anyone else.</Text>{!proposal ? <Button label={busy ? 'Finding a detail…' : 'Suggest a note  →'} disabled={busy} onPress={() => void makeProposal()} /> : <View style={s.card}><Text style={s.eyebrow}>REVIEW BEFORE SAVING</Text><Text style={s.cardTitle}>Does this look right?</Text><Text style={s.label}>PERSON</Text><TextInput style={s.plainInput} value={proposal.name} onChangeText={name => setProposal({ ...proposal, name })} placeholder="Name" /><Text style={s.label}>DETAIL TO REMEMBER</Text><TextInput style={[s.plainInput, { minHeight: 70 }]} value={proposal.detail} onChangeText={detail => setProposal({ ...proposal, detail })} multiline placeholder="One detail, in your words" /><Button label="Approve & save" onPress={approve} /><Button label="Don't save" secondary onPress={() => { setProposal(null); setRaw(''); setScreen('home'); }} /></View>}<Text style={s.privacy}>Your original words stay with the note, so you can check it later.</Text></>}
    {screen === 'people' && <><Title eyebrow="YOUR CIRCLE" title="People Notebook" subtitle="A few real details make the next hello easier." /><View style={s.card}><Text style={s.eyebrow}>ADD SOMEONE</Text><Text style={s.cardTitle}>Who is in your world?</Text><TextInput style={s.plainInput} value={newName} onChangeText={setNewName} placeholder="Their name" /><TextInput style={s.plainInput} value={newRelation} onChangeText={setNewRelation} placeholder="How you know them (optional)" /><Button label="Add person" onPress={addPerson} /></View>{people.length === 0 ? <View style={s.empty}><Text style={s.emptyIcon}>♡</Text><Text style={s.cardTitle}>Start with one person.</Text><Text style={s.cardBody}>Someone you might see this week is enough.</Text></View> : people.map(p => <Pressable key={p.id} style={s.personRow} onPress={() => { setSelectedId(p.id); setScreen('person'); }}><View style={s.avatar}><Text style={s.avatarText}>{p.name.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={s.personName}>{p.name}</Text><Text style={s.personMeta}>{p.relationship || `${p.notes.length} saved details`}</Text></View><Text style={s.chevron}>›</Text></Pressable>)}<Button label="Remember a conversation  →" secondary onPress={() => { setProposal(null); setScreen('capture'); }} /></>}
    {screen === 'person' && person && <><Pressable onPress={() => { setScreen('people'); setSelectedId(null); }}><Text style={s.back}>←  People</Text></Pressable><Title eyebrow="YOUR CIRCLE" title={person.name} subtitle={person.relationship || 'A person in your world'} /><Button label={`Make a card for seeing ${person.name}`} onPress={() => { setPrep(null); setScreen('prep'); }} /><Text style={s.section}>YOUR APPROVED NOTES</Text>{person.notes.length === 0 && <Text style={s.cardBody}>No notes yet. Add a detail after your next conversation.</Text>}{person.notes.map(note => <View key={note.id} style={s.note}><View style={s.noteTop}><Text style={s.noteMeta}>{new Date(note.createdAt).toLocaleDateString()}</Text><Text style={s.noteMeta}>{note.status === 'private' ? "DON'T BRING UP" : note.status.toUpperCase()}</Text></View>{editing === note.id ? <><TextInput style={s.plainInput} value={editText} onChangeText={setEditText} multiline /><Button label="Save edit" onPress={() => { update(person.id, p => ({ ...p, notes: p.notes.map(n => n.id === note.id ? { ...n, text: editText.trim() || n.text } : n) })); setEditing(null); }} /></> : <Text style={s.noteText}>{note.text}</Text>}<Text style={s.source}>Your words: “{note.source}”</Text><View style={s.wrap}><Chip label="Edit" onPress={() => { setEditing(note.id); setEditText(note.text); }} /><Chip label="Not sure" active={note.status === 'uncertain'} onPress={() => update(person.id, p => ({ ...p, notes: p.notes.map(n => n.id === note.id ? { ...n, status: n.status === 'uncertain' ? 'current' : 'uncertain' } : n) }))} /><Chip label="Outdated" active={note.status === 'outdated'} onPress={() => update(person.id, p => ({ ...p, notes: p.notes.map(n => n.id === note.id ? { ...n, status: n.status === 'outdated' ? 'current' : 'outdated' } : n) }))} /><Chip label="Don't bring up" active={note.status === 'private'} onPress={() => update(person.id, p => ({ ...p, notes: p.notes.map(n => n.id === note.id ? { ...n, status: n.status === 'private' ? 'current' : 'private' } : n) }))} /><Chip label="Delete" onPress={() => update(person.id, p => ({ ...p, notes: p.notes.filter(n => n.id !== note.id) }))} /></View></View>)}<Button label="Delete this person" secondary onPress={deletePerson} /></>}
    {screen === 'settings' && <><Title eyebrow="YOUR SPACE" title="Privacy & settings" subtitle="The important choices stay with you." /><View style={s.card}><Text style={s.eyebrow}>YOUR NOTEBOOK</Text><Text style={s.cardTitle}>Stored on this device</Text><Text style={s.cardBody}>On iOS and Android, people and notes are encrypted locally. They are not synced. Uninstalling Gab may erase them. The web preview uses browser storage and is not encrypted.</Text><Text style={s.cardBody}>AI coaching sends the text you enter to OpenAI. Person notes are included only when you opt in on a prep card.</Text><Text style={s.cardBody}>Dictation uses your device's speech service, which may process voice over a network. Gab never records ambient conversations.</Text><Text style={s.cardBody}>Device unlock: {Platform.OS === 'web' ? 'unavailable on web' : lockAvailable ? 'on' : 'unavailable on this device'}</Text></View><View style={s.card}><Text style={s.eyebrow}>COACH CONNECTION</Text><Text style={s.cardBody}>{coachConnected ? 'AI service configured. Basic cards remain available if it is offline.' : 'Basic cards are available. Connect the local coach service for tailored AI cards.'}</Text></View><Button label="Delete all people and notes" secondary onPress={deleteAll} /></>}
  </ScrollView><View style={s.nav}>{([['home', '⌂', 'Today'], ['people', '♡', 'People'], ['settings', '⚙', 'Settings']] as const).map(([target, icon, label]) => <Pressable key={target} style={s.navItem} onPress={() => setScreen(target)}><Text style={[s.navIcon, (screen === target || (target === 'people' && screen === 'person')) && s.active]}>{icon}</Text><Text style={[s.navText, (screen === target || (target === 'people' && screen === 'person')) && s.active]}>{label}</Text></Pressable>)}</View></SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Main /></SafeAreaProvider>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, lock: { flex: 1, justifyContent: 'center', gap: 18, padding: 32, backgroundColor: color.bg },
  header: { height: 68, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: color.line }, logo: { fontSize: 34, fontWeight: '800', color: color.ink, letterSpacing: -2 }, badge: { backgroundColor: color.mint, borderRadius: 25, padding: 9, color: color.green, fontSize: 11, fontWeight: '700' }, content: { width: '100%', maxWidth: 650, alignSelf: 'center', padding: 24, paddingBottom: 42 }, notice: { backgroundColor: color.pale, padding: 12, borderRadius: 12, marginBottom: 15 }, noticeText: { color: color.ink, fontSize: 13 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: color.green, marginBottom: 10 }, title: { fontSize: 35, lineHeight: 40, fontWeight: '800', color: color.ink, letterSpacing: -1.2 }, subtitle: { fontSize: 15, lineHeight: 23, color: color.muted, marginTop: 9 }, hero: { paddingTop: 16, paddingBottom: 34 }, heroTitle: { fontSize: 43, lineHeight: 49, fontWeight: '800', color: color.ink, letterSpacing: -1.9 }, heroBody: { fontSize: 17, lineHeight: 25, color: color.muted, marginTop: 15 }, underline: { width: 58, height: 5, backgroundColor: color.orange, borderRadius: 8, marginTop: 25 },
  card: { backgroundColor: color.white, padding: 23, borderRadius: 22, borderWidth: 1, borderColor: color.line, gap: 11, marginBottom: 14 }, cardTitle: { color: color.ink, fontSize: 24, fontWeight: '800', letterSpacing: -.6 }, cardBody: { color: color.muted, fontSize: 14, lineHeight: 21 }, inputRow: { flexDirection: 'row', backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: 12, overflow: 'hidden' }, input: { flex: 1, minHeight: 52, padding: 13, color: color.ink, fontSize: 15 }, tall: { minHeight: 115 }, mic: { width: 54, backgroundColor: color.mint, alignItems: 'center', justifyContent: 'center' }, hint: { color: color.muted, fontSize: 12, lineHeight: 18, marginTop: 6 }, button: { minHeight: 50, backgroundColor: color.green, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, marginTop: 5 }, secondary: { backgroundColor: color.mint }, buttonText: { color: color.white, fontSize: 15, fontWeight: '800' },
  section: { color: color.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 28, marginBottom: 13 }, grid: { flexDirection: 'row', gap: 12 }, tile: { flex: 1, borderRadius: 18, minHeight: 175, padding: 17 }, tileIcon: { color: color.green, fontSize: 23, marginBottom: 17 }, tileTitle: { color: color.ink, fontSize: 18, fontWeight: '800', marginBottom: 6 }, arrow: { color: color.green, fontSize: 21, position: 'absolute', top: 13, right: 16 }, quote: { borderTopWidth: 1, borderColor: color.line, marginTop: 32, paddingTop: 22, color: color.muted, fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  back: { color: color.green, fontSize: 14, fontWeight: '700', marginBottom: 26 }, label: { color: color.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: 19, marginBottom: 9 }, row: { flexDirection: 'row', gap: 7, paddingVertical: 2 }, wrap: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' }, chip: { borderWidth: 1, borderColor: color.line, borderRadius: 20, backgroundColor: color.white, paddingHorizontal: 12, paddingVertical: 8 }, chipText: { color: color.ink, fontSize: 12, fontWeight: '700' }, checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 14 }, check: { fontSize: 22, color: color.green }, checkText: { color: color.ink, fontSize: 13, flex: 1 },
  result: { backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: 22, padding: 24, marginTop: 25 }, bigLine: { color: color.ink, fontSize: 27, lineHeight: 35, fontWeight: '700', letterSpacing: -.6 }, rule: { height: 1, backgroundColor: color.line, marginVertical: 20 }, resultLine: { color: color.ink, fontSize: 16, lineHeight: 25, marginBottom: 6 }, nudge: { backgroundColor: color.mint, borderRadius: 12, padding: 15, color: color.green, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 20 }, privacy: { color: color.muted, fontSize: 12, lineHeight: 18, marginTop: 22 }, plainInput: { backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: 12, minHeight: 48, padding: 12, color: color.ink, fontSize: 15 },
  empty: { alignItems: 'center', padding: 35, gap: 8 }, emptyIcon: { color: color.green, fontSize: 44 }, personRow: { flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderColor: color.line, paddingVertical: 15 }, avatar: { width: 45, height: 45, borderRadius: 23, backgroundColor: color.mint, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: color.green, fontSize: 18, fontWeight: '800' }, personName: { color: color.ink, fontSize: 16, fontWeight: '800' }, personMeta: { color: color.muted, fontSize: 12, marginTop: 3 }, chevron: { color: color.muted, fontSize: 26 }, note: { backgroundColor: color.white, borderWidth: 1, borderColor: color.line, borderRadius: 18, padding: 18, marginBottom: 13 }, noteTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, noteMeta: { color: color.muted, fontSize: 10, fontWeight: '700' }, noteText: { color: color.ink, fontSize: 18, lineHeight: 26, fontWeight: '700' }, source: { color: color.muted, fontSize: 12, lineHeight: 18, marginVertical: 13 },
  nav: { backgroundColor: color.white, borderTopWidth: 1, borderColor: color.line, minHeight: 65, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6 }, navItem: { alignItems: 'center', minWidth: 78 }, navIcon: { color: color.muted, fontSize: 23 }, navText: { color: color.muted, fontSize: 11, fontWeight: '700' }, active: { color: color.green },
});
