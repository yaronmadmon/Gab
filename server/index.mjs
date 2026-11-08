import http from 'node:http';
import { handleCoach } from './coach-core.mjs';

const paths = { '/api/prep': 'prep', '/api/stuck': 'stuck', '/api/note': 'note' };
http.createServer(async (req, res) => {
  const kind = paths[req.url];
  if (!kind) { res.writeHead(404); res.end(); return; }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const request = new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
  const response = await handleCoach(request, kind);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}).listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1');
