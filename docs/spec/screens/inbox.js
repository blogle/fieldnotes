(() => {
  const { row, announce } = demo;
  const selected = new Set();
  const search = document.getElementById('search');
  const filter = document.getElementById('filter');
  const all = document.getElementById('select-all');
  const complete = document.getElementById('complete-selected');
  const move = document.getElementById('move-selected');
  function visible() {
    return demo.state.tasks.filter(t => !t.campaign && (filter.value === 'all' || t.status === filter.value)
      && t.title.toLowerCase().includes(search.value.toLowerCase()));
  }
  function selection() {
    const tasks = visible();
    all.checked = tasks.length > 0 && tasks.every(t => selected.has(t.id));
    all.indeterminate = selected.size > 0 && !all.checked;
    all.disabled = !tasks.length;
    complete.disabled = !tasks.some(t => selected.has(t.id) && t.status !== 'done');
    move.disabled = !selected.size || demo.state.campaignStatus === 'complete';
    move.title = demo.state.campaignStatus === 'complete' ? 'Reopen the campaign before assigning tasks' : '';
    document.getElementById('selection-count').textContent = selected.size ? `${selected.size} selected` : 'Select all';
  }
  function render() {
    const list = document.getElementById('tasks');
    list.replaceChildren();
    for (const task of visible()) {
      const item = row(task, 'Select', checked => {
        if (checked) selected.add(task.id); else selected.delete(task.id);
        item.classList.toggle('selected', checked); selection();
      }, selected.has(task.id));
      const toggle = document.createElement('button');
      toggle.textContent = task.status === 'done' ? 'Reopen' : 'Complete';
      toggle.setAttribute('aria-label', `${toggle.textContent}: ${task.title}`);
      toggle.addEventListener('click', () => {
        task.status = task.status === 'done' ? 'open' : 'done';
        demo.save(); selected.clear(); render(); announce(`Task ${task.status === 'done' ? 'completed' : 'reopened'}.`);
        const index = visible().findIndex(t => t.id === task.id);
        if (index >= 0) document.querySelectorAll('.task-row button')[index]?.focus();
        else filter.focus();
      });
      item.append(toggle); list.append(item);
    }
    if (!list.children.length) {
      const empty = document.createElement('p'); empty.className = 'empty';
      empty.textContent = 'No tasks match the current filters.'; list.append(empty);
    }
    document.getElementById('open-count').textContent = String(demo.state.tasks.filter(t => !t.campaign && t.status === 'open').length).padStart(2, '0');
    selection();
  }
  all.addEventListener('change', () => { visible().forEach(t => all.checked ? selected.add(t.id) : selected.delete(t.id)); render(); all.focus(); });
  search.addEventListener('input', () => { selected.clear(); render(); });
  filter.addEventListener('change', () => { selected.clear(); render(); });
  complete.addEventListener('click', () => {
    const count = demo.state.tasks.filter(t => selected.has(t.id) && t.status === 'open').length;
    demo.state.tasks.forEach(t => { if (selected.has(t.id)) t.status = 'done'; });
    demo.save(); selected.clear(); render(); announce(`${count} tasks completed.`);
  });
  move.addEventListener('click', () => {
    if (demo.state.campaignStatus === 'complete') return;
    const count = selected.size;
    demo.state.tasks.forEach(t => { if (selected.has(t.id)) t.campaign = 'autumn'; });
    demo.save(); selected.clear(); render(); announce(`${count} tasks moved to Autumn launch.`);
  });
  document.getElementById('capture').addEventListener('submit', event => {
    event.preventDefault(); const input = document.getElementById('new-task');
    if (!demo.add(input.value, null)) { announce('Enter a task title.'); return; }
    input.value = ''; search.value = ''; filter.value = 'all'; selected.clear(); render(); announce('Task captured.'); input.focus();
  });
  window.addEventListener('demochange', () => { selected.clear(); render(); });
  render();
})();
