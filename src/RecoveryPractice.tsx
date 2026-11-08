import { useEffect, useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
import { getRecovery, practiceTurn, getPracticeFeedback, type ChatMessage, type PracticeDifficulty, type PracticeFeedback } from './coach';
import type { CoachProvider } from './connection';

type VoiceProps = { value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean };
type Props = { mode: 'froze' | 'awkward' | 'practice'; provider: CoachProvider; VoiceField: ComponentType<VoiceProps>; onExit: () => void; onPractice: (scene: string) => void; initialScene?: string };

export function RecoveryPractice({ mode, provider, VoiceField, onExit, onPractice, initialScene = '' }: Props) {
  const [raw, setRaw] = useState('');
  const [impact, setImpact] = useState<'hurt' | 'embarrassed' | 'unsure' | null>(null);
  const [result, setResult] = useState<{ response: string; nextStep: string } | null>(null);
  const [scene, setScene] = useState(initialScene);
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>('friendly');
  const [stage, setStage] = useState<'setup' | 'active' | 'finished'>('setup');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => { void Speech.stop(); }, []);
  const button = (label: string, action: () => void, secondary = false, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} style={[styles.button, secondary && styles.secondary, disabled && { opacity: .5 }]} onPress={action}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
  const recover = async () => {
    const value = raw.trim();
    if (!value) return setError('Tell Gab a little about what happened first.');
    if (value.length > 1000) return setError('Please keep this under 1,000 characters.');
    if (mode === 'awkward' && !impact) return setError('Choose the option that feels closest.');
    setError(''); setBusy(true);
    try { setResult(await getRecovery(value, mode === 'froze' ? 'froze' : impact!, provider)); }
    catch { setError('Gab could not get a suggestion. Please try again.'); }
    finally { setBusy(false); }
  };
  const start = async () => {
    if (!scene.trim()) return setError('Choose a scene or describe one first.');
    if (scene.trim().length > 300) return setError('Keep the scene under 300 characters.');
    setError(''); setBusy(true);
    try { const reply = await practiceTurn(scene.trim(), difficulty, [], provider); setMessages([{ role: 'assistant', content: reply }]); setStage('active'); }
    catch { setError('Practice could not start. Check your connection and try again.'); }
    finally { setBusy(false); }
  };
  const send = async () => {
    const value = draft.trim();
    if (!value || busy) return;
    if (value.length > 1000) return setError('Please keep each reply under 1,000 characters.');
    const next: ChatMessage[] = [...messages, { role: 'user', content: value }];
    setMessages(next); setDraft(''); setBusy(true); setError('');
    try { const reply = await practiceTurn(scene.trim(), difficulty, next, provider); setMessages([...next, { role: 'assistant', content: reply }]); }
    catch { setMessages(messages); setDraft(value); setError('Could not get a reply. Please try again.'); }
    finally { setBusy(false); }
  };
  const finish = async () => {
    if (!messages.some(m => m.role === 'user')) { setStage('finished'); return; }
    setBusy(true); setError('');
    try { setFeedback(await getPracticeFeedback(scene.trim(), messages, provider)); setStage('finished'); }
    catch { setError('Could not get feedback. You can try again or leave practice.'); }
    finally { setBusy(false); }
  };
  const play = (text: string) => {
    try { void Speech.stop(); Speech.speak(text, { onError: () => setError('Audio playback is unavailable on this device. You can read the reply instead.') }); }
    catch { setError('Audio playback is unavailable on this device. You can read the reply instead.'); }
  };
  return <View>
    <Pressable accessibilityRole="button" onPress={onExit}><Text style={styles.back}>← Back to chat</Text></Pressable>
    {mode !== 'practice' ? <><Text style={styles.eyebrow}>{mode === 'froze' ? 'RECONNECT' : 'AFTER AN AWKWARD MOMENT'}</Text><Text style={styles.title}>{mode === 'froze' ? 'I froze' : 'That felt awkward'}</Text><Text style={styles.body}>{mode === 'froze' ? 'Tell Gab what happened. You can get a short message to use if you want.' : 'Tell Gab what happened. You can decide whether to say something or leave it here.'}</Text><VoiceField value={raw} onChange={value => { setRaw(value); setResult(null); }} placeholder="What happened?" multiline />
      {mode === 'awkward' && <><Text style={styles.label}>WHAT FEELS CLOSEST?</Text><Text style={styles.body}>Do you think someone was hurt, or does it mostly feel embarrassing?</Text><View style={styles.row}>{([['hurt', 'Someone was hurt'], ['embarrassed', 'Mostly embarrassing'], ['unsure', 'Not sure']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: impact === value }} style={[styles.chip, impact === value && styles.chipActive]} onPress={() => { setImpact(value); setResult(null); }}><Text style={[styles.chipText, impact === value && styles.chipTextActive]}>{label}</Text></Pressable>)}</View></>}
      {button(busy ? 'Thinking…' : 'Give me a suggestion', () => void recover(), false, busy)}
      {result && <View style={styles.card}><Text style={styles.eyebrow}>{mode === 'froze' ? 'A MESSAGE YOU COULD SEND' : 'ONE WAY TO RESPOND'}</Text><Text selectable style={styles.result}>{result.response}</Text><Text style={styles.label}>A SMALL NEXT STEP</Text><Text style={styles.body}>{result.nextStep}</Text><Text style={styles.hint}>This is only a suggestion. Gab won’t send anything for you.</Text>{mode === 'awkward' && button('Practice this moment', () => onPractice(`Practice this situation: ${raw.trim().slice(0, 250)}`), true)}</View>}
      <Text style={styles.hint}>Your words are sent to {provider === 'claude' ? 'Claude' : 'OpenAI'} for this suggestion. Nothing is saved automatically.</Text></> :
      <><Text style={styles.eyebrow}>PRACTICE</Text><Text style={styles.title}>{stage === 'setup' ? 'A short practice' : stage === 'active' ? 'Your practice' : 'Nice work showing up.'}</Text>
      {stage === 'setup' && <><Text style={styles.body}>Choose a situation and how the other person responds. Aim for a couple of minutes, or stop whenever you like.</Text><Text style={styles.label}>PICK A SCENE</Text><View style={styles.row}>{['Meeting a neighbor', 'Ordering coffee', 'A work event', 'Catching up with a friend'].map(item => <Pressable key={item} accessibilityRole="button" style={[styles.chip, scene === item && styles.chipActive]} onPress={() => setScene(item)}><Text style={[styles.chipText, scene === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View><Text style={styles.label}>OR DESCRIBE YOUR OWN</Text><TextInput style={styles.input} value={scene} maxLength={300} onChangeText={setScene} placeholder="What would you like to practice?" placeholderTextColor="#84908A" multiline /><Text style={styles.label}>HOW SHOULD THEY RESPOND?</Text><View style={styles.row}>{([['friendly', 'Friendly'], ['busy', 'Busy'], ['short answers', 'Short answers'], ['interrupts', 'Interrupts']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: difficulty === value }} style={[styles.chip, difficulty === value && styles.chipActive]} onPress={() => setDifficulty(value)}><Text style={[styles.chipText, difficulty === value && styles.chipTextActive]}>{label}</Text></Pressable>)}</View>{button(busy ? 'Starting…' : 'Start practice', () => void start(), false, busy)}<Text style={styles.hint}>Your practice is sent to {provider === 'claude' ? 'Claude' : 'OpenAI'}. Use Mic to dictate; use Play reply to hear the other person. This practice isn’t saved.</Text></>}
      {stage === 'active' && <><Text style={styles.body}>{scene} · {difficulty}</Text>{messages.map((m, i) => <View key={i} style={styles.card}><Text style={styles.eyebrow}>{m.role === 'assistant' ? 'PRACTICE PARTNER' : 'YOU'}</Text><Text style={styles.result}>{m.content}</Text>{m.role === 'assistant' && <Pressable accessibilityRole="button" onPress={() => play(m.content)}><Text style={styles.audio}>▶ Play reply</Text></Pressable>}</View>)}{busy && <Text style={styles.body}>Thinking…</Text>}<VoiceField value={draft} onChange={setDraft} placeholder="Your reply…" /><View style={styles.row}><View style={styles.flex}>{button('Send reply', () => void send(), false, busy)}</View><View style={styles.flex}>{button('End & get feedback', () => void finish(), true, busy)}</View></View><Text style={styles.hint}>Only your dictated words are used. Gab does not listen to anyone else.</Text></>}
      {stage === 'finished' && <>{feedback ? <View style={styles.card}><Text style={styles.eyebrow}>WHAT WENT WELL</Text><Text style={styles.result}>{feedback.strength}</Text><Text style={styles.label}>ONE THING TO TRY</Text><Text style={styles.result}>{feedback.nextStep}</Text></View> : <Text style={styles.body}>You ended before sending a reply, so there’s no feedback yet.</Text>}{button('Practice again', () => { setMessages([]); setFeedback(null); setDraft(''); setStage('setup'); }, true)}{button('Back to chat', onExit)}</>}
      </>}
    {!!error && <Text style={styles.error}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  back: { color: '#BFD1C7', fontWeight: '700', fontSize: 14, marginBottom: 26 },
  eyebrow: { color: '#BFD1C7', fontSize: 10, letterSpacing: 1.4, fontWeight: '700', marginBottom: 10 },
  title: { color: '#F0F0EB', fontSize: 32, lineHeight: 38, fontWeight: '700', marginBottom: 10 },
  body: { color: '#AAB5B0', fontSize: 15, lineHeight: 23, marginBottom: 15 },
  label: { color: '#BFD1C7', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 18, marginBottom: 9 },
  button: { backgroundColor: '#BFD1C7', minHeight: 50, marginTop: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondary: { backgroundColor: '#303B38' }, buttonText: { color: '#18221E', fontWeight: '700', fontSize: 14, textAlign: 'center' }, secondaryText: { color: '#F0F0EB' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, flex: { flex: 1, minWidth: 130 },
  chip: { borderColor: '#53615C', borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 10 },
  chipActive: { backgroundColor: '#BFD1C7', borderColor: '#BFD1C7' }, chipText: { color: '#F0F0EB', fontSize: 13 }, chipTextActive: { color: '#18221E', fontWeight: '700' },
  input: { color: '#F0F0EB', backgroundColor: '#222829', borderColor: '#3A4542', borderWidth: 1, borderRadius: 6, minHeight: 50, padding: 12, fontSize: 15 },
  card: { backgroundColor: '#222829', borderColor: '#3A4542', borderWidth: 1, borderRadius: 8, padding: 18, marginTop: 16 },
  result: { color: '#F0F0EB', fontSize: 17, lineHeight: 25 }, audio: { color: '#D99476', fontSize: 13, fontWeight: '700', marginTop: 12 },
  hint: { color: '#AAB5B0', fontSize: 12, lineHeight: 19, marginTop: 17 }, error: { color: '#F1AE99', fontSize: 14, marginTop: 14 },
});
