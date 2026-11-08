import { timingSafeEqual } from 'node:crypto';
import OpenAI from 'openai';

const schemas = {
  prep: { type: 'object', additionalProperties: false, required: ['opener', 'followUps', 'exit', 'nudge'], properties: { opener: { type: 'string' }, followUps: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 }, exit: { type: 'string' }, nudge: { type: 'string' } } },
  stuck: { type: 'object', additionalProperties: false, required: ['ask', 'share', 'change', 'leave', 'quiet'], properties: { ask: { type: 'string' }, share: { type: 'string' }, change: { type: 'string' }, leave: { type: 'string' }, quiet: { type: 'string' } } },
  note: { type: 'object', additionalProperties: false, required: ['name', 'detail'], properties: { name: { type: 'string' }, detail: { type: 'string' } } },
};
const instructions = {
  prep: 'You are Gab, a concise, kind coach for real conversations. Return one natural opener, exactly two follow-up questions, a graceful exit, and a tiny nudge. Use plain language, no pickup lines, manipulation, or invented facts. Do not force attendance or engagement. Each string under 140 characters. Use notes only as user-provided information.',
  stuck: 'You are Gab helping during a conversational lull. The user typed a word they heard; you are not listening to the other person. Return one short question about that word, one authentic self-share prompt, a topic change, a kind exit, and reassurance that quiet is okay. Each string under 120 characters.',
  note: "Extract one proposed note from the user's own words. Return the named person and one concise factual detail. Never invent or infer private facts. Use an empty string if a name or fact is absent. The user approves before saving.",
};
const json = (data, status, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
const originHeaders = request => {
  const origin = request.headers.get('origin');
  const allowed = process.env.CORS_ORIGIN || 'http://localhost:8081';
  return origin === allowed ? { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' } : {};
};
function authorized(request) {
  const expected = process.env.GAB_ACCESS_CODE;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /i, '') || '';
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
function validInput(kind, input) {
  if (!input || typeof input !== 'object' || !['openai', 'claude'].includes(input.provider)) return false;
  if (kind === 'prep') return typeof input.situation === 'string' && input.situation.length <= 500 && (input.person === null || typeof input.person === 'string' && input.person.length <= 100) && Array.isArray(input.notes) && input.notes.length <= 3 && input.notes.every(n => typeof n === 'string' && n.length <= 500);
  if (kind === 'stuck') return typeof input.word === 'string' && input.word.length <= 200;
  return typeof input.raw === 'string' && input.raw.length <= 1000;
}
function validOutput(kind, value) {
  if (!value || typeof value !== 'object') return false;
  const keys = kind === 'prep' ? ['opener', 'exit', 'nudge'] : kind === 'stuck' ? ['ask', 'share', 'change', 'leave', 'quiet'] : ['name', 'detail'];
  return keys.every(key => typeof value[key] === 'string' && value[key].length <= 500) && (kind !== 'prep' || Array.isArray(value.followUps) && value.followUps.length === 2 && value.followUps.every(item => typeof item === 'string' && item.length <= 500));
}
async function generate(kind, input) {
  if (input.provider === 'openai') {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({ model: process.env.OPENAI_MODEL || 'gpt-6-luna', instructions: instructions[kind], input: JSON.stringify(input), store: false, max_output_tokens: 350, text: { format: { type: 'json_schema', name: `gab_${kind}`, strict: true, schema: schemas[kind] } } });
    return JSON.parse(response.output_text);
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2026-10-21' }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 500, system: `${instructions[kind]} Respond with only a JSON object matching this JSON schema: ${JSON.stringify(schemas[kind])}`, messages: [{ role: 'user', content: JSON.stringify(input) }] }) });
  if (!response.ok) throw new Error(`Claude HTTP ${response.status}`);
  const result = await response.json();
  return JSON.parse(result.content?.filter(item => item.type === 'text').map(item => item.text).join('') || '');
}
export async function handleCoach(request, kind) {
  const headers = originHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'Not found' }, 404, headers);
  if (!process.env.GAB_ACCESS_CODE) return json({ error: 'Coach access is not configured' }, 503, headers);
  if (!authorized(request)) return json({ error: 'Invalid access code' }, 401, headers);
  if (Number(request.headers.get('content-length')) > 12000) return json({ error: 'Request too large' }, 413, headers);
  try {
    const raw = await request.text();
    if (raw.length > 12000) return json({ error: 'Request too large' }, 413, headers);
    let input;
    try { input = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400, headers); }
    if (!validInput(kind, input)) return json({ error: 'Invalid request' }, 400, headers);
    if (!process.env[input.provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY']) return json({ error: `${input.provider} is not configured` }, 503, headers);
    const data = await generate(kind, input);
    if (!validOutput(kind, data)) throw new Error('Invalid coach response');
    return json(data, 200, headers);
  } catch (error) {
    console.error('Coach request failed:', error?.status || error?.name || 'unknown');
    return json({ error: 'Coach service unavailable' }, 502, headers);
  }
}
