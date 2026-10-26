import { readFile } from 'node:fs/promises';

export async function readConfig(filename) {
  let value;
  try { value = JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') value = {}; else throw error; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Fieldnotes configuration must be a JSON object');
  const allowed = ['title', 'entry', 'navigation', 'styles', 'scripts'];
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown config key: ${key}`);
  const local = href => typeof href === 'string' && href.length > 0 && !href.startsWith('/')
    && !/[\\\x00-\x20]/.test(href) && !href.split(/[/?#]/).includes('..') && !/^[a-z][a-z\d+.-]*:/i.test(href);
  const config = { title: 'Documentation', entry: 'index.md', navigation: [{ label: 'Overview', href: 'index.md' }], styles: [], scripts: [], ...value };
  if (typeof config.title !== 'string' || !local(config.entry) || /[?#]/.test(config.entry)) throw new Error('Invalid title or entry');
  if (!Array.isArray(config.navigation) || !config.navigation.every(link => link && typeof link.label === 'string' && local(link.href))) throw new Error('Navigation requires local {label, href} entries');
  for (const key of ['styles', 'scripts']) if (!Array.isArray(config[key]) || !config[key].every(local)) throw new Error(`${key} requires content-root-relative asset paths`);
  return config;
}
