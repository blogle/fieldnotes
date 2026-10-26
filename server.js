#!/usr/bin/env node
import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { watch } from 'chokidar';
import { readConfig } from './lib/config.js';
import { renderMarkdown, injectTools, asset } from './lib/render.js';
import { baseline, compare } from './lib/git.js';

const { values } = parseArgs({ options: {
  root: { type: 'string' }, project: { type: 'string' }, config: { type: 'string' },
  host: { type: 'string' }, port: { type: 'string' }, help: { type: 'boolean' }
} });
if (values.help) {
  console.log('fieldnotes [--root docs] [--project .] [--config docs/fieldnotes.json] [--host 127.0.0.1] [--port 3000]');
  process.exit(0);
}
const root = await realpath(path.resolve(values.root || 'docs'));
const project = await realpath(path.resolve(values.project || path.dirname(root)));
const inside = (base, filename) => filename === base || filename.startsWith(base + path.sep);
if (!inside(project, root)) throw new Error('Content root must be inside the project root');
const configPath = path.resolve(values.config || path.join(root, 'fieldnotes.json'));
await readConfig(configPath); // Fail early with an actionable configuration error.
const builtins = await realpath(fileURLToPath(new URL('./docs/assets/', import.meta.url)));
const clients = new Set();
const types = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.html': 'text/html', '.md': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2' };
async function confined(base, relative, { missing = false } = {}) {
  const target = path.resolve(base, relative);
  if (!inside(base, target)) throw Object.assign(new Error('Forbidden'), { status: 403 });
  try { if (!inside(base, await realpath(target))) throw Object.assign(new Error('Forbidden'), { status: 403 }); }
  catch (error) { if (!missing || error.code !== 'ENOENT') throw error; }
  return target;
}
function send(res, type, body, status = 200) {
  res.writeHead(status, { 'Content-Type': type + (type.startsWith('text/') || type === 'application/json' || type === 'image/svg+xml' ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store' });
  res.end(body);
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 'text/plain', 'Read-only server', 405); return; }
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/__fieldnotes/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': connected\n\n'); clients.add(res);
      req.on('close', () => clients.delete(res)); return;
    }
    const config = await readConfig(configPath);
    if (pathname === '/') { res.writeHead(302, { Location: '/' + config.entry }).end(); return; }
    if (pathname === '/__fieldnotes/context') {
      send(res, 'application/json', JSON.stringify({ project, root })); return;
    }
    if (pathname === '/__fieldnotes/api/compare') {
      const relative = url.searchParams.get('path');
      if (!relative || relative.startsWith('/')) throw new Error('A content-relative page path is required');
      const filename = await confined(root, relative);
      if (!['.md', '.html'].includes(path.extname(filename))) throw new Error('Comparison supports Markdown and HTML pages');
      const result = await compare(project, filename, await readFile(filename, 'utf8'));
      if (result.available) {
        const markdown = path.extname(filename) === '.md';
        const render = source => markdown ? renderMarkdown(source, config, { review: false }) : source;
        result.beforeHtml = render(result.before);
        result.afterHtml = render(result.after);
        result.markdown = markdown;
      }
      send(res, 'application/json', JSON.stringify(result)); return;
    }
    if (pathname === '/__fieldnotes/compare') {
      send(res, 'text/html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Compare with HEAD</title><link rel="stylesheet" href="${asset('fieldnotes.css')}"><link rel="stylesheet" href="${asset('compare.css')}"><script type="module" src="${asset('compare.js')}"></script></head><body><main class="comparison"></main></body></html>`); return;
    }
    if (pathname.startsWith('/__fieldnotes/head/')) {
      const filename = await confined(root, pathname.slice('/__fieldnotes/head/'.length), { missing: true });
      const result = await baseline(project, filename, { binary: true });
      if (!result.available || result.untracked) { send(res, 'text/plain', 'No HEAD version', 404); return; }
      send(res, types[path.extname(filename)] || 'application/octet-stream', result.before); return;
    }
    if (pathname.startsWith('/__fieldnotes/assets/')) {
      const filename = await confined(builtins, pathname.slice('/__fieldnotes/assets/'.length));
      send(res, types[path.extname(filename)] || 'application/octet-stream', await readFile(filename)); return;
    }
    if (pathname.startsWith('/__fieldnotes/')) { send(res, 'text/plain', 'Unknown viewer endpoint', 404); return; }
    let filename = await confined(root, '.' + pathname);
    if ((await stat(filename)).isDirectory()) filename = await confined(root, path.relative(root, path.join(filename, 'index.md')));
    const page = path.relative(root, filename).split(path.sep).join('/');
    const ext = path.extname(filename);
    let body = await readFile(filename);
    if (ext === '.md') body = renderMarkdown(body.toString(), config, { page });
    else if (ext === '.html') body = injectTools(body.toString(), page);
    send(res, types[ext] || 'application/octet-stream', body);
  } catch (error) {
    send(res, 'text/plain', error.status === 403 ? 'Forbidden' : error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'Document not found' : error.message,
      error.status || (error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 400));
  }
});
let timer;
const watcher = watch([root, configPath], { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 } });
watcher.on('all', () => { clearTimeout(timer); timer = setTimeout(() => clients.forEach(res => res.write('data: reload\n\n')), 80); });
const heartbeat = setInterval(() => clients.forEach(res => res.write(': heartbeat\n\n')), 20000);
server.listen(Number(values.port || process.env.PORT || 3000), values.host || process.env.HOST || '127.0.0.1', () => {
  console.log(`Fieldnotes → http://${values.host || process.env.HOST || '127.0.0.1'}:${server.address().port}/`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  clearInterval(heartbeat); clearTimeout(timer); clients.forEach(res => res.end()); await watcher.close(); server.close();
});
