// Optional browser checks. Set CHROMIUM to an installed Chromium executable.
import { chromium } from 'playwright-core';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

if (!process.env.CHROMIUM) throw new Error('Set CHROMIUM to the absolute path of an installed Chromium executable.');
const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../', import.meta.url));
const fixture = await mkdtemp(path.join(tmpdir(),'fieldnotes-browser-'));
async function start(root, project) {
  const child = spawn(process.execPath,[path.join(repository,'server.js'),'--root',root,'--project',project,'--port','0']);
  const base = await new Promise((resolve,reject) => {
    child.stdout.on('data', data => { const match = String(data).match(/http:\/\/127.0.0.1:\d+/); if(match) resolve(match[0]); });
    child.on('error',reject); child.once('exit',code => reject(new Error(`Viewer exited ${code}`)));
  });
  return {child,base};
}
const first = await start(path.join(repository,'docs'),repository);
let browser, second;
const probe = path.join(repository,'docs/assets/__browser-probe.css');
try {
  browser = await chromium.launch({ executablePath:process.env.CHROMIUM, headless:true, args:['--no-sandbox'] });
  const context = await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
  const page = await context.newPage(), errors = [];
  page.on('pageerror',error => errors.push(error.message));
  const tool = name => page.getByRole('button',{name,exact:true});
  await page.goto(first.base+'/index.md');
  await tool('Download page').focus(); await page.keyboard.press('Tab');
  assert.equal(await tool('Review annotations').evaluate(e => e.matches(':focus-visible')),true);
  await tool('Review annotations').click();
  await page.evaluate(() => {
    const text = document.querySelector('.prose p').firstChild, range = document.createRange();
    range.setStart(text,0); range.setEnd(text,Math.min(35,text.length));
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  await page.waitForTimeout(100);
  await tool('Annotate selection').click();
  await page.getByLabel('Feedback',{exact:true}).fill('Clarify the source directory.');
  await tool('Save comment').click(); await page.reload();
  await tool('Review annotations').click();
  assert.ok(await page.getByText('Clarify the source directory.',{exact:true}).count());
  await tool('Pick element').click(); await page.locator('.prose h2').first().click();
  await page.getByLabel('Feedback',{exact:true}).fill('Explain supported Node versions here.'); await tool('Save comment').click();
  await tool('Copy prompt').click(); await page.locator('textarea#prompt:not([hidden])').waitFor();
  const prompt = await page.locator('textarea#prompt').inputValue();
  for (const pattern of [/Clarify the source directory/,/index.md/,/Quote:/,/Locator:/]) assert.match(prompt,pattern);
  await page.evaluate(() => { document.querySelector('.prose p').textContent = 'This target was replaced.'; });
  await tool('Close review panel').click(); await tool('Review annotations').click();
  assert.ok(await page.getByText('Target changed or missing',{exact:false}).count());
  await page.reload();
  async function downloadPage(route,name) {
    await page.goto(first.base+route);
    const pending = page.waitForEvent('download'), popup = page.waitForEvent('popup'); await tool('Download page').click();
    const download = await pending, filename = path.join(fixture,name); await download.saveAs(filename);
    const preview = await popup; await preview.waitForURL('blob:**');
    assert.equal(await preview.locator('[data-fieldnotes-ui]').count(),0); await preview.close();
    assert.equal(await page.locator('#review-drawer').isVisible(),false);
    return filename;
  }
  const documentExport = await downloadPage('/index.md','document.html');
  const html = await readFile(documentExport,'utf8');
  assert.doesNotMatch(html,/data-fieldnotes-ui|fieldnotes-review-v1|new EventSource|<script[^>]+src=/);
  assert.match(html,/<style>/);
  const diagramExport = await downloadPage('/pipeline.md','diagram.html');
  assert.match(await readFile(diagramExport,'utf8'),/data:image\/svg\+xml/);
  await page.goto(first.base+'/spec/screens/inbox.html');
  await page.locator('#new-task').fill('Task included in offline snapshot'); await page.getByRole('button',{name:'+ Add task',exact:true}).click();
  const pending = page.waitForEvent('download'), inboxPopup = page.waitForEvent('popup'); await tool('Download page').click();
  const inboxExport = path.join(fixture,'inbox.html'); await (await pending).saveAs(inboxExport);
  await (await inboxPopup).close();
  assert.doesNotMatch(await readFile(inboxExport,'utf8'),/@import|<script[^>]+src=/);
  const offline = await browser.newContext({offline:true}), offlinePage = await offline.newPage(), offlineErrors = [];
  offlinePage.on('pageerror',e => offlineErrors.push(e.message));
  for (const file of [documentExport,diagramExport,inboxExport]) {
    await offlinePage.goto('file://'+file);
    assert.equal(await offlinePage.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),'rgb(33, 29, 25)');
    for (const image of await offlinePage.locator('img').all()) assert.equal(await image.evaluate(img => img.complete && img.naturalWidth>0),true);
  }
  assert.equal(await offlinePage.getByText('Task included in offline snapshot',{exact:true}).count(),1);
  await offlinePage.locator('#new-task').fill('Offline interaction'); await offlinePage.getByRole('button',{name:'+ Add task',exact:true}).click();
  assert.equal(await offlinePage.getByText('Offline interaction',{exact:true}).count(),1);
  assert.deepEqual(offlineErrors,[]); await offline.close();
  await page.goto(first.base+'/spec/screens/approaches.html');
  await page.locator('input[value=skill]').check(); await page.locator('#rationale').fill('This project needs a custom runtime.');
  await tool('Copy as prompt').click(); assert.match(await page.locator('#decision').textContent(),/custom runtime/);
  const choices = await downloadPage('/spec/screens/approaches.html','approaches.html');
  // downloadPage navigates: native form-state capture is exercised separately without navigating.
  await page.locator('input[value=skill]').check(); await page.locator('#rationale').fill('Preserved constraints.');
  const choiceDownload = page.waitForEvent('download'), choicePopup = page.waitForEvent('popup'); await tool('Download page').click(); await (await choiceDownload).saveAs(choices);
  await (await choicePopup).close();
  const choicePage = await context.newPage(); await choicePage.goto('file://'+choices);
  assert.equal(await choicePage.locator('input[value=skill]').isChecked(),true);
  assert.equal(await choicePage.locator('#rationale').inputValue(),'Preserved constraints.'); await choicePage.close();
  const routes = ['/index.md','/architecture.md','/pipeline.md','/spec/index.md','/research.md','/reuse.md','/review.md','/spec/screens/approaches.html'];
  for (const width of [375,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for (const route of routes) {
      await page.goto(first.base+route);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),`${width}: ${route}`);
      if (route.endsWith('.md')) {
        const layout = await page.evaluate(() => {
          const prose = document.querySelector('.prose').getBoundingClientRect(), toc = document.querySelector('.toc').getBoundingClientRect();
          return { ratio:prose.width/toc.width, stacked:toc.bottom<=prose.top };
        });
        if (width>850) assert.ok(Math.abs(layout.ratio-2)<.02); else assert.equal(layout.stacked,true);
      }
    }
    await tool('Review annotations').click();
    assert.ok(await page.evaluate(() => {
      const panel = document.querySelector('div[data-fieldnotes-ui]').shadowRoot.querySelector('.panel').getBoundingClientRect();
      return panel.left>=0 && panel.right<=innerWidth;
    }));
    await tool('Pick element').click(); assert.equal(await page.locator('#review-drawer').isVisible(),false);
    await page.locator('main h1').click(); await page.getByLabel('Feedback',{exact:true}).waitFor(); await tool('Cancel').click();
  }
  // Download errors and blocked popups must never open the annotation drawer.
  await page.goto(first.base+'/index.md');
  await page.evaluate(() => { window.open = () => null; });
  const blockedDownload = page.waitForEvent('download'); await tool('Download page').click(); await blockedDownload;
  assert.equal(await page.locator('#review-drawer').isVisible(),false);
  await page.evaluate(() => { const iframe = document.createElement('iframe'); document.body.append(iframe); });
  await tool('Download page').click(); await page.getByText('Download failed:',{exact:false}).waitFor();
  assert.equal(await page.locator('#review-drawer').isVisible(),false);
  // Exercise real file-change navigation, with the probe removed even on failure.
  await page.goto(first.base+'/index.md'); await page.waitForTimeout(300);
  const load = page.waitForEvent('load'); await writeFile(probe,'/* browser reload check */'); await load; await unlink(probe);
  const docs = path.join(fixture,'docs'); await mkdir(docs);
  await writeFile(path.join(docs,'index.md'),'# Baseline\n\n## Original\n\nOriginal paragraph.\n');
  await writeFile(path.join(docs,'screen.html'),'<!doctype html><h1>Before</h1><script>if(window!==window.top)parent.__previewExecuted=true</script>');
  const git = args => execute('git',['-C',fixture,...args],{env:{...process.env,GIT_AUTHOR_NAME:'Test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'Test',GIT_COMMITTER_EMAIL:'test@example.invalid'}});
  await git(['init','--quiet']); await git(['add','docs']); await git(['commit','--quiet','-m','Browser fixture']);
  await writeFile(path.join(docs,'index.md'),'# Updated\n\n## Revised\n\nRevised paragraph.\n' + '\n\nAdditional context.'.repeat(50));
  await writeFile(path.join(docs,'screen.html'),'<!doctype html><h1>After</h1><script>if(window!==window.top)parent.__previewExecuted=true</script>');
  second = await start(docs,fixture);
  await page.goto(second.base+'/index.md');
  const initialUrl = page.url();
  await page.evaluate(() => scrollTo(0,240)); const initialScroll = await page.evaluate(() => scrollY);
  await tool('Toggle page diff').click(); await page.locator('#comparison-content:not([hidden])').waitFor();
  assert.equal(page.url(),initialUrl);
  assert.equal(await page.locator('.prose').evaluate(e => e.closest('[inert]') !== null),true);
  assert.match(await page.locator('#source-diff').textContent(),/-Original paragraph/);
  await page.frameLocator('iframe').nth(0).getByText('Original paragraph.',{exact:true}).waitFor();
  await page.frameLocator('iframe').nth(1).getByText('Revised paragraph.',{exact:true}).waitFor();
  await tool('Close diff').click(); assert.equal(page.url(),initialUrl);
  assert.equal(await page.evaluate(() => scrollY),initialScroll);
  assert.equal(await page.locator('.prose').evaluate(e => e.closest('[inert]') !== null),false);
  for (const width of [375,1440]) {
    await page.setViewportSize({width,height:900}); await tool('Toggle page diff').click();
    await page.locator('#comparison-content:not([hidden])').waitFor();
    assert.ok(await page.locator('.comparison').evaluate(e => e.scrollWidth <= e.clientWidth));
    await tool('Toggle page diff').click();
  }
  await page.goto(second.base+'/screen.html'); await tool('Toggle page diff').click(); await page.locator('#comparison-content:not([hidden])').waitFor();
  assert.equal(await page.evaluate(() => window.__previewExecuted),undefined);
  assert.equal(await page.locator('iframe').first().getAttribute('sandbox'),'allow-same-origin');
  assert.equal((await git(['diff','--cached','--name-only'])).stdout,'');
  // Direct-file examples keep functioning independently of viewer injection.
  for (const screen of ['inbox','campaign']) {
    await page.goto('file://'+path.join(repository,`docs/spec/screens/${screen}.html`)); await page.locator('.task-row').first().waitFor();
  }
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: annotations, prompt export, offline HTML/SVG/task snapshots, choices, responsive grid/tools, reload, Git source/rendered comparison, and standalone screens.');
} finally {
  await browser?.close(); first.child.kill('SIGTERM'); second?.child.kill('SIGTERM');
  await unlink(probe).catch(() => {}); await rm(fixture,{recursive:true,force:true});
}
