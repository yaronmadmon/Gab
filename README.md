# Gab

A coach for awkward moments that remembers the people in your life.

You talk or type, like a normal chat. Gab helps with three moments:

- **Before:** "I'm about to see David." You get a short brief: what you know about him, an opener or two, a follow-up, and an easy way out.
- **Right now:** "We're walking and it's silent." One or two lines you can use straight away.
- **After:** "Here's what happened." A quick debrief, and Gab saves what you learned.

Gab fills in your people as you talk. Each thing it saves shows under the reply as "Remembered", with Undo. The sidebar has **Coming up** (dated things a week back to two weeks ahead), **Your people** (tap one for their card: where you know them, what you want with them, what you know) and your past chats.

## For now

- No sign-in. Everything is kept in this browser only. It does not follow you to another device, and clearing browser data erases it.
- The chat service is open to anyone with the address, and every message uses the AI credits. Keep the address private until sign-in and limits are added.

## Run it locally

Node 22 or newer.

```bash
npm install
npm run dev
```

The chat needs an Anthropic API key in `.env.local` as `ANTHROPIC_API_KEY`. Without one, the app opens but replies fail with "Gab could not answer right now."

## Deploy

Vercel builds it as a Next.js app. Set `ANTHROPIC_API_KEY` in the project's environment variables. `ANTHROPIC_MODEL` is optional and defaults to Claude Opus 5.5.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

## Where things are

- `lib/prompt.ts`: Gab's coaching rules and the remember tool.
- `app/api/chat/route.ts`: the server call to Claude.
- `lib/memory.ts`: people, facts, Coming up, and the rules for saving and undoing (tested in `lib/memory.test.ts`).
- `components/`: the screens.
