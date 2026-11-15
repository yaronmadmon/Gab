import { emptyMemory, type Memory } from './memory';

const KEY = 'gab.memory.v2';

/** Memory lives in this browser only for now. Every read and write is guarded. */
export function loadMemory(): Memory {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyMemory();
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.people) || !Array.isArray(data.chats)) return emptyMemory();
    return data as Memory;
  } catch {
    return emptyMemory();
  }
}

export function saveMemory(memory: Memory): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
    return true;
  } catch {
    return false;
  }
}
