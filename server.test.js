import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile, unlink, mkdir, rmdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('documentation viewer integration', async t => {
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '0' } });
  t.after(() => child.kill('SIGTERM'));
  let output = '';
  const base = await new Promise((resolve, reject) => {
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) resolve(match[0]);
    });
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited: ${code}`)));
  });
  await t.test('Markdown, navigation, highlighting and direct assets', async () => {
    for (const route of ['/index.md','/architecture.md','/pipeline.md','/research.md','/reuse.md','/review.md','/spec/index.md']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /assets\/fieldnotes.css/);
      assert.match(html, /class="toc"/);
      assert.match(html, /assets\/document.js/);
      assert.match(html, /assets\/reload.js/);
      for (const [, link] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (link.startsWith('#') || /^https?:/.test(link)) continue;
        assert.equal((await fetch(new URL(link, base + route))).status, 200, link);
      }
    }
    const architecture = await (await fetch(base + '/architecture.md')).text();
    assert.match(architecture, /hljs-/);
    assert.match(architecture, /<table>/);
    const index = await (await fetch(base + '/index.md')).text();
    assert.match(index, /<h1>Fieldnotes documentation<\/h1>/);
    assert.match(index, /<table>/);
    for (const route of ['/spec/screens/inbox.html','/spec/screens/campaign.html','/spec/screens/approaches.html']) {
      const html = await (await fetch(base + route)).text();
      assert.match(html, /assets\/reload.js/);
      for (const [, link] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (link.startsWith('#')) continue;
        assert.equal((await fetch(new URL(link, base + route))).status, 200, link);
      }
    }
    assert.match((await fetch(base + '/spec/diagram.svg')).headers.get('content-type'), /image\/svg\+xml/);
    assert.equal((await fetch(base + '/missing.md')).status, 404);
    assert.equal((await fetch(base + '/%2e%2e%2fpackage.json')).status, 403);
    assert.equal((await fetch(base + '/', { redirect: 'manual' })).headers.get('location'), '/index.md');
  });
  await t.test('live changes include Markdown, HTML, CSS and new directories', async () => {
    const controller = new AbortController();
    const response = await fetch(base + '/__events', { signal: controller.signal });
    const reader = response.body.getReader();
    await reader.read();
    const directory = new URL('./docs/__integration/', import.meta.url);
    await mkdir(directory);
    try {
      await new Promise(resolve => setTimeout(resolve, 400));
      for (const ext of ['md','html','css','svg']) {
        const file = new URL(`sample.${ext}`, directory);
        const pending = (async () => {
          let value = '';
          while (!value.includes('data: reload')) value += new TextDecoder().decode((await reader.read()).value);
        })();
        await writeFile(file, ext === 'md' ? '# New document\n\n## A heading' : 'sample');
        await Promise.race([pending, new Promise((_, reject) => {
          const timer = setTimeout(() => reject(new Error(`No reload for ${ext}`)), 5000);
          timer.unref();
        })]);
        if (ext === 'md') assert.match(await (await fetch(base + '/__integration/sample.md')).text(), /<h1>New document<\/h1>/);
      }
    } finally {
      controller.abort();
      for (const ext of ['md','html','css','svg']) await unlink(new URL(`sample.${ext}`, directory)).catch(() => {});
      await rmdir(directory);
    }
  });
  child.kill('SIGTERM');
  await once(child, 'exit');
});

test('external consumer configuration and read-only Git comparison', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'workbench-test-'));
  t.after(() => rm(directory, { recursive:true, force:true }));
  const docs = path.join(directory,'docs'); await mkdir(docs);
  const filename = path.join(docs,'index.md');
  await writeFile(filename, '# Consumer\n\n## Original\n\nBefore text.\n');
  await writeFile(path.join(docs,'workbench.json'), JSON.stringify({title:'Consumer project',navigation:[{label:'Home',href:'index.md'}]}));
  const execute = promisify(execFile);
  const git = args => execute('git',['-C',directory,...args], { env: { ...process.env, GIT_AUTHOR_NAME:'Test', GIT_AUTHOR_EMAIL:'test@example.invalid', GIT_COMMITTER_NAME:'Test', GIT_COMMITTER_EMAIL:'test@example.invalid' } });
  const child = spawn(process.execPath,[fileURLToPath(new URL('./server.js', import.meta.url)), '--root', docs, '--project', directory, '--port','0']);
  t.after(() => child.kill('SIGTERM'));
  const base = await new Promise((resolve,reject) => {
    child.stdout.on('data', chunk => { const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/); if(match) resolve(match[0]); });
    child.on('error',reject); child.once('exit', code => reject(new Error(`Server exited ${code}`)));
  });
  assert.match(await (await fetch(base+'/index.md')).text(), /Consumer project/);
  assert.equal((await fetch(base+'/__workbench/assets/fieldnotes.css')).status,200);
  const noGit = await (await fetch(base+'/__workbench/api/compare?path=index.md')).json();
  assert.equal(noGit.available,false);
  await git(['init','--quiet']); await git(['add','docs']); await git(['commit','--quiet','-m','Fixture baseline']);
  await writeFile(filename, '# Consumer\n\n## Updated\n\nAfter text.\n');
  const comparison = await (await fetch(base+'/__workbench/api/compare?path=index.md')).json();
  assert.equal(comparison.changed,true); assert.match(comparison.diff, /-Before text/); assert.match(comparison.diff, /\+After text/);
  assert.match(comparison.beforeHtml, /Original/); assert.match(comparison.afterHtml, /Updated/);
  assert.doesNotMatch(comparison.beforeHtml, /review.js/);
  assert.equal(await (await fetch(base+'/__workbench/head/index.md')).text(), '# Consumer\n\n## Original\n\nBefore text.\n');
  await writeFile(path.join(docs,'new.html'), '<h1>New</h1>');
  const added = await (await fetch(base+'/__workbench/api/compare?path=new.html')).json();
  assert.equal(added.untracked,true);
  assert.equal((await fetch(base+'/__workbench/api/compare?path=../outside.md')).status,403);
  await symlink(path.join(directory,'outside.md'), path.join(docs,'escape.md'));
  await writeFile(path.join(directory,'outside.md'),'outside');
  assert.equal((await fetch(base+'/escape.md')).status,403);
  await writeFile(path.join(docs,'workbench.json'), JSON.stringify({title:'Changed configuration',navigation:[]}));
  assert.match(await (await fetch(base+'/index.md')).text(), /Changed configuration/);
  await writeFile(path.join(docs,'guide.md'),'# Guide');
  await writeFile(path.join(docs,'project.css'), ':root{--accent:#ccbb7b}');
  await writeFile(path.join(docs,'project.js'),'window.customDocumentation=true;');
  await writeFile(path.join(docs,'workbench.json'), JSON.stringify({title:'Custom',entry:'guide.md',navigation:[{label:'Guide',href:'guide.md'}],styles:['project.css'],scripts:['project.js']}));
  const custom = await (await fetch(base+'/guide.md')).text();
  assert.match(custom, /href="\/project.css"/); assert.match(custom, /src="\/project.js"/);
  assert.equal((await fetch(base+'/',{redirect:'manual'})).headers.get('location'),'/guide.md');
  await writeFile(path.join(docs,'workbench.json'),'null');
  assert.equal((await fetch(base+'/index.md')).status,400);
  await writeFile(path.join(docs,'workbench.json'),'{}');
  const status = (await git(['status','--porcelain'])).stdout;
  assert.match(status,/docs\/index.md/); // Comparison did not change the index or commit source edits.
  assert.equal((await git(['diff','--cached','--name-only'])).stdout,'');
  assert.equal((await fetch(base+'/__workbench/compare?path=index.md')).status,200);
  child.kill('SIGTERM'); await once(child,'exit');
});
