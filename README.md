# Gab

Gab helps you get ready for a real conversation, find one small nudge during a lull, and remember what a person told you afterward. This repository contains an Expo/React Native app for iOS, Android, and the web, plus a Vercel API.

## What works

- **Chat**: type or dictate to the coach on the home screen. Messages in the current session go to the selected AI provider. You can explicitly select a person to share their name and up to three current notes. Each of your messages offers a note suggestion that you can review and approve before saving.
- **Your story & circle**: answer a few optional questions about yourself or one person, then review and approve before saving. In the chat menu, you can explicitly share your story and select a person's name, goal, and current notes for coaching. Your answers are stored locally; the browser version is not encrypted.
- **About to…**: a short card with an opener, two follow-ups, and a kind exit.
- **I'm stuck**: ask, share, change topic, leave kindly, or simply allow a quiet moment.
- **People Notebook**: add people, dictate or type a debrief, review a proposed detail, approve it, then edit, mark, or delete it later. Each saved detail retains the user's original words.
- **Local fallback**: the first two cards work without an API connection.
- **Privacy controls**: native Notebook data is encrypted at rest, with the encryption key in the device's secure store. The app asks for device authentication when available. It does not listen to other people.

The web app stores notes in ordinary browser storage and does not have biometric locking. Use fictional details for browser testing.

## Vercel setup

The Git repository builds the web app and three Vercel Functions. In Vercel Project Settings → Environment Variables, add these for **Production** and **Preview** as secret values:

- `OPENAI_API_KEY`: your existing OpenAI API key.
- `ANTHROPIC_API_KEY`: your Claude API key, if you want Claude access.

You can set `OPENAI_MODEL` and `ANTHROPIC_MODEL` to override the defaults. Redeploy after changing environment variables. Do not use the `EXPO_PUBLIC_` prefix for API keys. The web app calls same-origin `/api/*` endpoints. Native builds need `EXPO_PUBLIC_API_BASE_URL` set to the deployed Vercel URL at build time.

The AI API is publicly accessible. Anyone who can reach it can use the configured API credits. Add authentication and rate limits before sharing it widely.

## Run locally

Use Node.js 22.13 or newer. From this directory:

```powershell
npm install
```

To use your **existing** OpenAI key, run this on your own machine. It prompts for the key without showing what you type and writes it to the ignored `.env.local` file:

```powershell
./scripts/configure-key.ps1
```

Add `ANTHROPIC_API_KEY` to `.env.local` if you want to use Claude locally. See `.env.example` for the variable names.

Then start the API and app in separate terminals:

```powershell
npm run coach
```

```powershell
npm run web
```

Open `http://localhost:8081`. The API listens on `127.0.0.1:8787` by default. Provider keys stay in the API process; they are not embedded in the phone or web bundle.

For Android or iOS, `expo-speech-recognition` requires a **development build**, so Expo Go cannot run voice dictation. On a machine with the native toolchain, run `npx expo run:android` or `npx expo run:ios`. Android emulator API requests can use `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8787`. A physical phone needs the deployed Vercel URL in `EXPO_PUBLIC_API_BASE_URL`; the local fallback cards and Notebook work without it.

## Privacy boundary

People and notes are stored only on the device in the native app. When you request AI coaching, your current text goes to the Gab API and then to the selected provider, OpenAI or Claude. A selected person's approved notes are sent only if you turn on the note option on the prep screen. When you request an AI note suggestion, that debrief text goes to the selected provider; the proposed note is stored only after you approve it. The API does not persist request bodies and uses `store: false` for OpenAI Responses API calls. Dictation uses the operating system's speech service, which may process audio over a network depending on device settings.

Do not advertise this prototype as fully on-device AI. The plan's stronger privacy promise requires an on-device model or a separate user-reviewed policy for cloud processing.

## Checks

```powershell
npm run typecheck
npx expo-doctor
npx expo export --platform web
```

## Next product steps

Test this version with about ten people for two weeks. Watch whether they use **I'm stuck** in a real conversation and add someone to the Notebook. Then build the missed-moment text and short voice practice flows. Before a public release, add account/device recovery, a secure hosted API with authentication and rate limits, and native device testing on both platforms.
