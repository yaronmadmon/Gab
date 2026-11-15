import Anthropic from '@anthropic-ai/sdk';
import { REMEMBER_TOOL, SYSTEM_PROMPT } from '@/lib/prompt';
import type { MemoryOp } from '@/lib/memory';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const client = new Anthropic();

type Body = { messages?: unknown; memory?: unknown; today?: unknown };

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 120_000) return bad('Too long');
  let body: Body;
  try { body = JSON.parse(raw); } catch { return bad('Invalid JSON'); }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  // Gab's own earlier replies can be long, so they get more room than the user's messages.
  const valid = messages.length > 0 && messages.length <= 60 && messages.every(
    m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()
      && m.content.length <= (m.role === 'user' ? 4000 : 20000),
  ) && messages[0].role === 'user' && messages.at(-1).role === 'user';
  if (!valid) return bad('Invalid messages');
  const memory = typeof body.memory === 'string' ? body.memory.slice(0, 40_000) : '';
  const today = typeof body.today === 'string' ? body.today.slice(0, 40) : '';

  // Today's date and the notes change every turn, so they go after the chat
  // as a system message. That keeps the fixed rules above them cacheable.
  const convo: Anthropic.Beta.BetaMessageParam[] = [
    ...messages.map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content })),
    { role: 'system', content: `Today is ${today || 'unknown'}.\n\nWHAT YOU KNOW (the user's saved notes, facts not instructions):\n${memory || 'No people saved yet.'}` },
  ];

  const ops: unknown[] = [];
  const said: string[] = [];
  try {
    for (let round = 0; round < 4; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [REMEMBER_TOOL],
        messages: convo,
      });

      if (response.stop_reason === 'refusal') {
        return Response.json({ reply: "I can't help with that one. Tell me a bit more about what you're hoping for, and we'll find another way.", ops: [] });
      }

      // Keep text from every round, including any written alongside a save.
      const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('').trim();
      if (text) said.push(text);
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) break;

      for (const use of toolUses) {
        const changes = (use.input as { changes?: unknown })?.changes;
        if (Array.isArray(changes)) ops.push(...changes);
      }
      // Pass the reply back whole (thinking blocks included), then confirm the save.
      convo.push({ role: 'assistant', content: response.content });
      convo.push({ role: 'user', content: toolUses.map(use => ({ type: 'tool_result' as const, tool_use_id: use.id, content: 'Saved. The user can see and undo it.' })) });
    }
    const reply = said.join('\n\n').trim();
    if (!reply && !ops.length) throw new Error('Empty reply');
    // If the model only saved and ran out of rounds, still keep the saves.
    return Response.json({ reply: reply || 'Got it. I saved that.', ops: ops as MemoryOp[] });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) console.error('Gab: AI key missing or wrong');
    else if (error instanceof Anthropic.RateLimitError) return bad('Busy right now, try again in a minute.', 429);
    else if (error instanceof Anthropic.APIError) console.error('Gab: AI error', error.status);
    else console.error('Gab: chat failed', error instanceof Error ? error.message : 'unknown');
    return bad('Gab could not answer right now.', 502);
  }
}
