import http from 'node:http';
import OpenAI from 'openai';

const port = Number(process.env.PORT || 8787);
const model = process.env.OPENAI_MODEL || 'gpt-6-luna';
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const schemas = {
  prep: { type: 'object', additionalProperties: false, required: ['opener', 'followUps', 'exit', 'nudge'], properties: {
    opener: { type: 'string' }, followUps: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 }, exit: { type: 'string' }, nudge: { type: 'string' },
  } },
  stuck: { type: 'object', additionalProperties: false, required: ['ask', 'share', 'change', 'leave', 'quiet'], properties: {
    ask: { type: 'string' }, share: { type: 'string' }, change: { type: 'string' }, leave: { type: 'string' }, quiet: { type: 'string' },
  } },
  note: { type: 'object', additionalProperties: false, required: ['name', 'detail'], properties: {
    name: { type: 'string' }, detail: { type: 'string' },
  } },
};

const instructions = {
  prep: 'You are Gab, a concise, kind coach for real conversations. Give one natural opener, two follow-up questions, a graceful exit, and a tiny nudge. Use plain language, no pickup lines, no manipulation, no invented facts. Do not force the user to attend or engage. Each string under 140 characters. Use supplied notes only as user-provided information, never imply certainty beyond them.',
  stuck: 'You are Gab helping during a live conversational lull. The user typed a word they heard; you are NOT listening to the other person. Return one short question about that word, one authentic self-share prompt, a topic change, a kind exit, and a reassurance that quiet is okay. No manipulation or invented facts. Each string under 120 characters.',
  note: 'Extract ONE proposed note from the user\'s own post-conversation words. Return the named person and one concise factual detail. Do not invent or infer private facts. If no person is named, use an empty string. If no fact is stated, use an empty string. The app will ask for approval before saving.',
};

const paths = { '/api/prep': 'prep', '/api/stuck': 'stuck', '/api/note': 'note' };
const send = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'http://localhost:8081', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS, GET' });
  res.end(JSON.stringify(data));
};

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.url === '/health' && req.method === 'GET') return send(res, 200, { ready: Boolean(client) });
  const kind = paths[req.url];
  if (!kind || req.method !== 'POST') return send(res, 404, { error: 'Not found' });
  if (!client) return send(res, 503, { error: 'OPENAI_API_KEY is not configured' });
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 12000) return send(res, 413, { error: 'Request too large' });
    }
    const input = JSON.parse(body);
    if (kind === 'prep' && (typeof input.situation !== 'string' || input.situation.length > 500 || !Array.isArray(input.notes) || input.notes.length > 3 || input.notes.some((n) => typeof n !== 'string' || n.length > 500))) return send(res, 400, { error: 'Invalid prep request' });
    if (kind === 'stuck' && (typeof input.word !== 'string' || input.word.length > 200)) return send(res, 400, { error: 'Invalid stuck request' });
    if (kind === 'note' && (typeof input.raw !== 'string' || input.raw.length > 1000)) return send(res, 400, { error: 'Invalid note request' });
    const response = await client.responses.create({
      model,
      instructions: instructions[kind],
      input: JSON.stringify(input),
      store: false,
      max_output_tokens: 350,
      text: { format: { type: 'json_schema', name: `gab_${kind}`, strict: true, schema: schemas[kind] } },
    });
    const data = JSON.parse(response.output_text);
    return send(res, 200, data);
  } catch (error) {
    console.error('Coach request failed:', error?.status || error?.name || 'unknown');
    return send(res, 502, { error: 'Coach service unavailable' });
  }
}).listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Gab coach listening on port ${port}`));
