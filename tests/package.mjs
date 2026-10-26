import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

if (!process.env.FIELDNOTES) throw new Error('FIELDNOTES must name the packaged viewer executable');
const directory = await mkdtemp(path.join(tmpdir(),'fieldnotes-consumer-'));
let child;
try {
  assert.match(execFileSync(process.env.FIELDNOTES,['--help'],{encoding:'utf8'}),/^fieldnotes /);
  const installedSkill = path.join(path.dirname(process.env.FIELDNOTES),'../share/fieldnotes/skills/fieldnotes/SKILL.md');
  assert.match(await readFile(installedSkill,'utf8'),/^---\nname: fieldnotes\n/);
  await mkdir(path.join(directory,'docs'));
  await writeFile(path.join(directory,'docs/index.md'),'# External project\n\n## Package test\n\nNo local npm dependencies.');
  await writeFile(path.join(directory,'docs/fieldnotes.json'),JSON.stringify({title:'Packaged consumer',navigation:[{label:'Home',href:'index.md'}]}));
  child = spawn(process.env.FIELDNOTES,['--root','docs','--project','.','--port','0'],{cwd:directory});
  const base = await new Promise((resolve,reject) => {
    child.stdout.on('data',data => { const match = String(data).match(/http:\/\/127.0.0.1:\d+/); if(match) resolve(match[0]); });
    child.on('error',reject); child.on('exit',code => reject(new Error(`Viewer exited ${code}`)));
  });
  const html = await (await fetch(base+'/index.md')).text();
  assert.match(html,/Packaged consumer/); assert.match(html,/External project/); assert.match(html,/review.js/);
  for (const name of ['fieldnotes.css','document.js','review.js','review.css','share.js','compare.js','compare.css']) assert.equal((await fetch(base+'/__fieldnotes/assets/'+name)).status,200,name);
  assert.equal((await (await fetch(base+'/__fieldnotes/api/compare?path=index.md')).json()).available,false);
  await assert.rejects(access(path.join(directory,'node_modules')));
  console.log('Packaged viewer serves a separate project without local node_modules.');
} finally { child?.kill('SIGTERM'); await rm(directory,{recursive:true,force:true}); }
