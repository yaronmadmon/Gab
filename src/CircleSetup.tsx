import { useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Story } from './coach';

type PersonDraft = { name: string; relationship: string; detail: string; goal: string };
type VoiceProps = { value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean };
type Props = {
  story: Story;
  VoiceField: ComponentType<VoiceProps>;
  onSaveStory: (story: Story) => Promise<void>;
  onSavePerson: (person: PersonDraft) => Promise<void>;
  onExit: () => void;
};
const emptyPerson: PersonDraft = { name: '', relationship: '', detail: '', goal: '' };

export function CircleSetup({ story, VoiceField, onSaveStory, onSavePerson, onExit }: Props) {
  const [mode, setMode] = useState<'start' | 'story' | 'person'>('start');
  const [step, setStep] = useState(0);
  const [draftStory, setDraftStory] = useState<Story>(story);
  const [draftPerson, setDraftPerson] = useState<PersonDraft>(emptyPerson);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const storyQuestions = [
    { key: 'about' as const, text: 'What would you like me to know about you?', hint: 'Anything you want to share about your life.' },
    { key: 'goal' as const, text: 'What would you like to feel or do differently?', hint: 'For example, feel more at ease at work events.' },
    { key: 'help' as const, text: 'How can I be most helpful to you?', hint: 'For example, keep suggestions short and direct.' },
  ];
  const personQuestions = [
    { key: 'name' as const, text: 'Who would you like to tell me about?', hint: 'Their name or the name you use for them.' },
    { key: 'relationship' as const, text: `How do you know ${draftPerson.name.trim() || 'this person'}?`, hint: 'For example, a neighbor or a friend from work.' },
    { key: 'detail' as const, text: `What do you know or like about ${draftPerson.name.trim() || 'them'}?`, hint: 'A shared interest, something they enjoy, or a detail you want to remember.' },
    { key: 'goal' as const, text: `What would you like your connection with ${draftPerson.name.trim() || 'them'} to look like?`, hint: 'For example, get to know them a little better.' },
  ];
  const fields = mode === 'story' ? storyQuestions : personQuestions;
  const review = mode !== 'start' && step >= fields.length;
  const button = (label: string, action: () => void, secondary = false, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} style={[styles.button, secondary && styles.secondary, disabled && { opacity: .5 }]} onPress={action}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
  const begin = (next: 'story' | 'person') => { setError(''); setStep(0); setDraftStory(story); setDraftPerson(emptyPerson); setMode(next); };
  const finish = async () => {
    if (mode === 'person' && !draftPerson.name.trim()) return setError('Add a name before saving this person.');
    setSaving(true); setError('');
    try {
      if (mode === 'story') await onSaveStory({ about: draftStory.about.trim(), goal: draftStory.goal.trim(), help: draftStory.help.trim() });
      else await onSavePerson({ name: draftPerson.name.trim(), relationship: draftPerson.relationship.trim(), detail: draftPerson.detail.trim(), goal: draftPerson.goal.trim() });
      setMode('start');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setSaving(false); }
  };
  return <View>
    <Pressable onPress={mode === 'start' ? onExit : () => { setMode('start'); setError(''); }} accessibilityRole="button"><Text style={styles.back}>← {mode === 'start' ? 'Back to chat' : 'Stop and go back'}</Text></Pressable>
    {mode === 'start' ? <><Text style={styles.eyebrow}>YOUR STORY & CIRCLE</Text><Text style={styles.title}>Let Gab get to know you.</Text><Text style={styles.body}>A few short questions, one at a time. You can skip anything or stop whenever you like. Nothing is saved until you approve it.</Text>
      <View style={styles.card}><Text style={styles.cardTitle}>Your story</Text><Text style={styles.body}>{story.goal ? `Your goal: ${story.goal}` : 'Share what matters to you and what you want help with.'}</Text>{button(story.about || story.goal || story.help ? 'Review or change your story' : 'Tell Gab about you', () => begin('story'))}</View>
      <View style={styles.card}><Text style={styles.cardTitle}>Your circle</Text><Text style={styles.body}>Tell Gab about one person and the connection you’d like to build.</Text>{button('Add someone', () => begin('person'))}</View><Text style={styles.hint}>Your answers stay on this device. You decide if they are shared with your coach.</Text></> :
      <><Text style={styles.eyebrow}>{mode === 'story' ? 'YOUR STORY' : 'YOUR CIRCLE'} · {review ? 'REVIEW' : `QUESTION ${step + 1} OF ${fields.length}`}</Text>
      {review ? <><Text style={styles.title}>Does this look right?</Text><Text style={styles.body}>Change anything below. Only what you approve will be saved.</Text>
        {mode === 'story' ? storyQuestions.map(q => <View key={q.key}><Text style={styles.label}>{q.text}</Text><TextInput style={styles.input} value={draftStory[q.key]} maxLength={500} multiline onChangeText={value => setDraftStory({ ...draftStory, [q.key]: value })} placeholder="Leave blank if you prefer" placeholderTextColor="#84908A" /></View>) : personQuestions.map(q => <View key={q.key}><Text style={styles.label}>{q.text}</Text><TextInput style={styles.input} value={draftPerson[q.key]} maxLength={q.key === 'name' ? 100 : 500} multiline onChangeText={value => setDraftPerson({ ...draftPerson, [q.key]: value })} placeholder="Leave blank if you prefer" placeholderTextColor="#84908A" /></View>)}
        {button(saving ? 'Saving…' : 'Approve and save', () => void finish(), false, saving)}{button('Don’t save', () => setMode('start'), true, saving)}</> :
        <><Text style={styles.title}>{fields[step].text}</Text><Text style={styles.body}>{fields[step].hint}</Text>
          {mode === 'story' ? <VoiceField value={draftStory[storyQuestions[step].key]} onChange={value => setDraftStory({ ...draftStory, [storyQuestions[step].key]: value.slice(0, 500) })} placeholder="Type or tap Mic…" multiline /> : <VoiceField value={draftPerson[personQuestions[step].key]} onChange={value => setDraftPerson({ ...draftPerson, [personQuestions[step].key]: value.slice(0, personQuestions[step].key === 'name' ? 100 : 500) })} placeholder="Type or tap Mic…" multiline />}
          {button('Continue', () => setStep(step + 1))}{button('Skip this question', () => setStep(step + 1), true)}
          {step > 0 && button('Previous question', () => setStep(step - 1), true)}</>}
      {!!error && <Text style={styles.error}>{error}</Text>}</>}
  </View>;
}

const styles = StyleSheet.create({
  back: { color: '#BFD1C7', fontWeight: '700', fontSize: 14, marginBottom: 26 },
  eyebrow: { color: '#BFD1C7', fontSize: 10, letterSpacing: 1.5, fontWeight: '700', marginBottom: 12 },
  title: { color: '#F0F0EB', fontSize: 30, lineHeight: 37, fontWeight: '700', letterSpacing: -.8, marginBottom: 12 },
  body: { color: '#AAB5B0', fontSize: 15, lineHeight: 23, marginBottom: 18 },
  card: { backgroundColor: '#222829', borderColor: '#3A4542', borderWidth: 1, borderRadius: 8, padding: 19, marginBottom: 14 },
  cardTitle: { color: '#F0F0EB', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  button: { backgroundColor: '#BFD1C7', minHeight: 50, marginTop: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondary: { backgroundColor: '#303B38' },
  buttonText: { color: '#18221E', fontWeight: '700', fontSize: 14 },
  secondaryText: { color: '#F0F0EB' },
  label: { color: '#BFD1C7', fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 7 },
  input: { color: '#F0F0EB', backgroundColor: '#222829', borderColor: '#3A4542', borderWidth: 1, borderRadius: 6, minHeight: 48, padding: 12, fontSize: 15 },
  hint: { color: '#AAB5B0', fontSize: 12, lineHeight: 18, marginTop: 10 },
  error: { color: '#F1AE99', fontSize: 14, marginTop: 12 },
});
