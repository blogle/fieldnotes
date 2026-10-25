/* Plain script so file:// screens work without a module server. */
(() => {
  const key = 'understory-demo-v1';
  const seed = () => ({ version: 1, campaignStatus: 'active', tasks: [
    { id: 'i1', title: 'Ask the studio about their weekly review', status: 'open', campaign: null, priority: 'normal' },
    { id: 'i2', title: 'Specify the inbox empty state', status: 'open', campaign: null, priority: 'high' },
    { id: 'i3', title: 'Collect notes from the first five teams', status: 'open', campaign: null, priority: 'normal' },
    { id: 'i4', title: 'Read through the onboarding draft', status: 'done', campaign: null, priority: 'normal' },
    { id: 'i5', title: 'Write a short note on keyboard shortcuts', status: 'open', campaign: null, priority: 'normal' },
    { id: 'c1', title: 'Define the first-release acceptance criteria', status: 'done', campaign: 'autumn', priority: 'normal' },
    { id: 'c2', title: 'Shape the task inbox interaction', status: 'done', campaign: 'autumn', priority: 'normal' },
    { id: 'c3', title: 'Review the welcome sequence', status: 'open', campaign: 'autumn', priority: 'high' },
    { id: 'c4', title: 'Prepare the early-access invitation', status: 'open', campaign: 'autumn', priority: 'normal' },
    { id: 'c5', title: 'Run a keyboard accessibility pass', status: 'open', campaign: 'autumn', priority: 'high' },
    { id: 'c6', title: 'Publish the release documentation', status: 'open', campaign: 'autumn', priority: 'normal' }
  ] });
  let state;
  const warn = message => { document.getElementById('storage-warning').textContent = message; };
  function valid(value) {
    return value?.version === 1 && ['active','paused','complete'].includes(value.campaignStatus)
      && Array.isArray(value.tasks) && new Set(value.tasks.map(t => t?.id)).size === value.tasks.length
      && value.tasks.every(t => t && typeof t.id === 'string' && typeof t.title === 'string'
        && ['open','done'].includes(t.status) && [null,'autumn'].includes(t.campaign)
        && ['normal','high'].includes(t.priority));
  }
  try {
    const raw = window.__WORKBENCH_EXAMPLE_STATE__ ? null : localStorage.getItem(key);
    state = window.__WORKBENCH_EXAMPLE_STATE__ || (raw ? JSON.parse(raw) : seed());
    if (!valid(state)) throw new Error('Invalid snapshot');
  } catch {
    state = seed();
    warn('Saved state could not be read. Using the sample tasks; changes may not persist.');
  }
  function save() {
    if (window.__WORKBENCH_EXAMPLE_STATE__) return; // Exported examples remain isolated in memory.
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch { warn('Storage is unavailable. Changes last only while this page is open.'); }
  }
  function announce(text) { document.getElementById('feedback').textContent = text; }
  function add(title, campaign) {
    title = title.trim();
    if (!title || title.length > 160) return false;
    state.tasks.push({ id: `t-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, title, campaign, status: 'open', priority: 'normal' });
    save();
    return true;
  }
  function row(task, checkboxLabel, onCheck, checked, disabled = false) {
    const item = document.createElement('div');
    item.className = `task-row ${task.status === 'done' ? 'done' : ''} ${checked ? 'selected' : ''}`;
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = checked;
    check.disabled = disabled;
    check.setAttribute('aria-label', `${checkboxLabel}: ${task.title}`);
    check.addEventListener('change', () => onCheck(check.checked));
    const copy = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.title;
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.textContent = `${task.status === 'done' ? '✓ COMPLETE' : '○ OPEN'}${task.priority === 'high' ? '  /  HIGH PRIORITY' : ''}`;
    copy.append(title, meta);
    item.append(check, copy);
    return item;
  }
  document.getElementById('reset').addEventListener('click', () => {
    if (!confirm('Reset both screens to the sample tasks?')) return;
    state = seed(); save(); window.dispatchEvent(new Event('demochange')); announce('Sample workspace restored.');
  });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    try {
      const next = event.newValue ? JSON.parse(event.newValue) : seed();
      if (valid(next)) { state = next; window.dispatchEvent(new Event('demochange')); }
    } catch { /* Keep current state if another tab writes an invalid snapshot. */ }
  });
  window.demo = { get state() { return state; }, save, add, row, announce };
  window.addEventListener('workbench:export', event => {
    event.detail.bootstrap.push(`window.__WORKBENCH_EXAMPLE_STATE__ = ${JSON.stringify(state)};`);
  });
})();
