import AsyncStorage from '@react-native-async-storage/async-storage';

export type CoachProvider = 'openai' | 'claude';
const PROVIDER_KEY = 'gab.coach.provider.v1';

export async function readProvider(): Promise<CoachProvider> {
  return (await AsyncStorage.getItem(PROVIDER_KEY)) === 'openai' ? 'openai' : 'claude';
}
export async function saveProvider(value: CoachProvider) { await AsyncStorage.setItem(PROVIDER_KEY, value); }
