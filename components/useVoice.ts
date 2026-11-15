'use client';
import { useEffect, useRef, useState } from 'react';

// The browser's own speech-to-text. Works in Chrome, Edge and Safari; the mic
// button hides itself where it is missing.
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start: () => void; stop: () => void;
};

export function useVoice(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  callback.current = onText;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = e => {
      const text = Array.from(e.results).map(res => res[0]?.transcript ?? '').join('');
      callback.current(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setSupported(true);
    return () => r.stop();
  }, []);

  const toggle = () => {
    if (!rec.current) return;
    if (listening) { rec.current.stop(); return; }
    try { rec.current.start(); setListening(true); } catch { setListening(false); }
  };

  return { supported, listening, toggle };
}
