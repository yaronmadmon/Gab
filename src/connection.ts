import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type CoachProvider = 'openai' | 'claude';
const CODE_KEY = 'gab.coach.access.v1';
const PROVIDER_KEY = 'gab.coach.provider.v1';

export async function readAccessCode(): Promise<string> {
  if (Platform.OS === 'web') return typeof sessionStorage === 'undefined' ? '' : sessionStorage.getItem(CODE_KEY) || '';
  return await SecureStore.getItemAsync(CODE_KEY) || '';
}
export async function saveAccessCode(value: string) {
  if (Platform.OS === 'web') sessionStorage.setItem(CODE_KEY, value);
  else await SecureStore.setItemAsync(CODE_KEY, value);
}
export async function removeAccessCode() {
  if (Platform.OS === 'web') sessionStorage.removeItem(CODE_KEY);
  else await SecureStore.deleteItemAsync(CODE_KEY);
}
export async function readProvider(): Promise<CoachProvider> {
  return (await AsyncStorage.getItem(PROVIDER_KEY)) === 'claude' ? 'claude' : 'openai';
}
export async function saveProvider(value: CoachProvider) { await AsyncStorage.setItem(PROVIDER_KEY, value); }
