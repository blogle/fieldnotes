(() => {
  const pause = document.getElementById('pause');
  const close = document.getElementById('close');
  function render() {
    const tasks = demo.state.tasks.filter(t => t.campaign === 'autumn');
    const done = tasks.filter(t => t.status === 'done').length;
    const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const closed = demo.state.campaignStatus === 'complete';
    document.getElementById('fraction').textContent = `${done} / ${tasks.length}`;
    document.getElementById('progress').value = percent;
    document.getElementById('progress-description').textContent = `${percent}% complete · ${tasks.length - done} tasks remaining`;
    document.getElementById('campaign-status').textContent = `${demo.state.campaignStatus.toUpperCase()} CAMPAIGN`;
    pause.textContent = demo.state.campaignStatus === 'paused' ? 'Resume campaign' : 'Pause campaign';
    pause.disabled = closed;
    close.textContent = closed ? 'Reopen campaign' : 'Close campaign';
    close.disabled = !closed && (!tasks.length || done !== tasks.length);
    document.getElementById('close-hint').textContent = closed ? 'Campaign closed. Reopen to edit tasks.' : close.disabled ? 'Complete every task before closing.' : 'All tasks are complete. The campaign can be closed.';
    document.getElementById('new-task').disabled = closed;
    document.getElementById('add-task').disabled = closed;
    const list = document.getElementById('tasks'); list.replaceChildren();
    tasks.forEach(task => {
      const item = demo.row(task, 'Complete', checked => {
        task.status = checked ? 'done' : 'open'; demo.save(); render();
        demo.announce(checked ? 'Task completed.' : 'Task reopened.');
        // Restore focus after replacing the list for keyboard users.
        [...list.querySelectorAll('input')][tasks.indexOf(task)]?.focus();
      }, task.status === 'done', closed);
      const marker = document.createElement('span'); marker.className = 'eyebrow'; marker.textContent = String(tasks.indexOf(task) + 1).padStart(2,'0');
      item.append(marker); list.append(item);
    });
    if (!tasks.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'No tasks in this campaign.'; list.append(p); }
  }
  pause.addEventListener('click', () => {
    if (demo.state.campaignStatus === 'complete') return;
    demo.state.campaignStatus = demo.state.campaignStatus === 'paused' ? 'active' : 'paused';
    demo.save(); render(); demo.announce(`Campaign ${demo.state.campaignStatus}.`);
  });
  close.addEventListener('click', () => {
    const tasks = demo.state.tasks.filter(t => t.campaign === 'autumn');
    if (demo.state.campaignStatus !== 'complete' && (!tasks.length || tasks.some(t => t.status !== 'done'))) return;
    demo.state.campaignStatus = demo.state.campaignStatus === 'complete' ? 'active' : 'complete';
    demo.save(); render(); demo.announce(demo.state.campaignStatus === 'complete' ? 'Campaign closed.' : 'Campaign reopened.');
  });
  document.getElementById('capture').addEventListener('submit', event => {
    event.preventDefault(); if (demo.state.campaignStatus === 'complete') return;
    const input = document.getElementById('new-task');
    if (!demo.add(input.value, 'autumn')) { demo.announce('Enter a task title.'); return; }
    input.value = ''; render(); demo.announce('Task added to Autumn launch.'); input.focus();
  });
  window.addEventListener('demochange', render);
  render();
})();
