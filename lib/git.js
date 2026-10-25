import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';

const exec = promisify(execFile);
async function git(project, args, binary = false) {
  return (await exec('git', ['-C', project, ...args], { maxBuffer: 8 * 1024 * 1024, timeout: 10000, encoding: binary ? 'buffer' : 'utf8' })).stdout;
}
export async function baseline(project, filename, { binary = false } = {}) {
  let top, commit;
  try {
    top = (await git(project, ['rev-parse', '--show-toplevel'])).trim();
    commit = (await git(project, ['rev-parse', '--verify', 'HEAD'])).trim();
  } catch { return { available: false, reason: 'No Git repository with a HEAD commit is available.' }; }
  const relative = path.relative(top, filename).split(path.sep).join('/');
  if (relative.startsWith('../') || path.isAbsolute(relative)) throw new Error('Page is outside the repository');
  try { return { available: true, commit, relative, before: await git(top, ['show', `HEAD:${relative}`], binary) }; }
  catch (error) {
    // Only a missing path is a new file; permission/size/command failures are errors.
    if (error.code === 128 && /does not exist in|exists on disk, but not in/.test(String(error.stderr || ''))) return { available: true, commit, relative, before: '', untracked: true };
    throw error;
  }
}
export async function compare(project, filename, after) {
  const result = await baseline(project, filename);
  if (!result.available) return result;
  return { ...result, after, diff: createTwoFilesPatch(`HEAD/${result.relative}`, `working/${result.relative}`, result.before, after), changed: result.before !== after };
}
