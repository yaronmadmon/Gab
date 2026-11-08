import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { Person, Story } from './coach';

const PLAIN_KEY = 'gab.people.v1';
const ENCRYPTED_KEY = 'gab.people.v2';
const SECRET_KEY = 'gab.notebook.key.v1';
const STORY_KEY = 'gab.story.v1';

function parsePeople(raw: string): Person[] {
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Notebook format is invalid');
  return value;
}

async function getKey(create: boolean) {
  let hex = await SecureStore.getItemAsync(SECRET_KEY);
  if (!hex && create) {
    const key = await AESEncryptionKey.generate();
    hex = await key.encoded('hex');
    await SecureStore.setItemAsync(SECRET_KEY, hex);
    return key;
  }
  return hex ? AESEncryptionKey.import(hex, 'hex') : null;
}

export async function readPeople(): Promise<Person[]> {
  if (Platform.OS === 'web') {
    const raw = await AsyncStorage.getItem(PLAIN_KEY);
    return raw ? parsePeople(raw) : [];
  }
  const encrypted = await AsyncStorage.getItem(ENCRYPTED_KEY);
  if (encrypted) {
    const key = await getKey(false);
    if (!key) throw new Error('Notebook key is unavailable');
    const bytes = await aesDecryptAsync(AESSealedData.fromCombined(encrypted), key);
    return parsePeople(new TextDecoder().decode(bytes as Uint8Array));
  }
  const previous = await AsyncStorage.getItem(PLAIN_KEY);
  if (!previous) return [];
  const people = parsePeople(previous);
  await writePeople(people);
  await AsyncStorage.removeItem(PLAIN_KEY);
  return people;
}

export async function writePeople(people: Person[]) {
  if (Platform.OS === 'web') return AsyncStorage.setItem(PLAIN_KEY, JSON.stringify(people));
  const key = await getKey(true);
  if (!key) throw new Error('Notebook key is unavailable');
  const sealed = await aesEncryptAsync(new TextEncoder().encode(JSON.stringify(people)), key);
  await AsyncStorage.setItem(ENCRYPTED_KEY, await sealed.combined('base64') as string);
}

export async function clearPeople() {
  await AsyncStorage.multiRemove([PLAIN_KEY, ENCRYPTED_KEY]);
}

export async function readStory(): Promise<Story> {
  const stored = await AsyncStorage.getItem(STORY_KEY);
  if (!stored) return { about: '', goal: '', help: '' };
  let raw = stored;
  if (Platform.OS !== 'web') {
    const key = await getKey(false);
    if (!key) throw new Error('Story key is unavailable');
    raw = new TextDecoder().decode(await aesDecryptAsync(AESSealedData.fromCombined(stored), key) as Uint8Array);
  }
  const data = JSON.parse(raw);
  if (!data || typeof data.about !== 'string' || typeof data.goal !== 'string' || typeof data.help !== 'string') throw new Error('Story format is invalid');
  return data;
}
export async function writeStory(story: Story) {
  const raw = JSON.stringify(story);
  if (Platform.OS === 'web') return AsyncStorage.setItem(STORY_KEY, raw);
  const key = await getKey(true);
  if (!key) throw new Error('Story key is unavailable');
  const sealed = await aesEncryptAsync(new TextEncoder().encode(raw), key);
  return AsyncStorage.setItem(STORY_KEY, await sealed.combined('base64') as string);
}

export function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
