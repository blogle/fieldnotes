(async () => {
  if (window.top !== window) return;
  const page = document.querySelector('meta[name="workbench-page"]')?.content;
  if (!page) return;
  const content = document.body;
  const host = document.createElement('div');
  host.dataset.workbenchUi = '';
  const ui = host.attachShadow({ mode: 'open' });
  const icon = paths => `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  ui.innerHTML = `<link rel="stylesheet" href="/__workbench/assets/review.css"><div class="bar" role="group" aria-label="Page tools"><button id="share" class="icon" aria-label="Download page" title="Download self-contained HTML">${icon('<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>')}</button><button id="review" class="icon" aria-label="Review annotations" title="Review annotations" aria-expanded="false" aria-controls="review-drawer">${icon('<path d="M21 4H3v13h5v4l5-4h8z"/>')}<span id="count" aria-hidden="true" hidden></span></button><button id="compare" class="icon" aria-label="Toggle page diff" title="Compare page with HEAD" aria-pressed="false">${icon('<path d="M9 3H4v18h5m6-18h5v18h-5M12 4v16M6 8h2m-2 8h2m8-8h2m-1-1v2m-1 7h2"/>')}</button></div><p class="toast" id="download-status" role="status" aria-live="polite" hidden></p><section id="review-drawer" class="panel" hidden aria-label="Review annotations"><header class="drawer-header"><h2>Annotations</h2><button class="close" id="hide" aria-label="Close review panel">×</button></header><p>Select text to annotate, or pick a page element.</p><div class="actions"><button id="annotate">Annotate selection</button><button id="pick" aria-pressed="false">Pick element</button></div><p class="quote" id="target">No target selected.</p><form id="comment-form" hidden><label for="comment">Feedback</label><textarea id="comment" required maxlength="10000"></textarea><div class="actions"><button type="submit">Save comment</button><button type="button" id="cancel">Cancel</button></div></form><p class="status" id="status" role="status" aria-live="polite"></p><ol id="notes" aria-label="Saved annotations"></ol><div class="drawer-footer"><div class="actions"><button id="copy">Copy prompt</button><button id="clear">Clear page draft</button></div><label id="prompt-label" hidden for="prompt">Prompt (select and copy if clipboard is unavailable)</label><textarea id="prompt" hidden readonly></textarea></div></section>`;
  document.body.append(host);
  const $ = id => ui.getElementById(id);
  const pickHint = document.createElement('p'); pickHint.className = 'toast'; pickHint.hidden = true; pickHint.setAttribute('role','status');
  pickHint.textContent = 'Pick a page element. Press Escape to cancel.'; ui.append(pickHint);
  let context = {};
  try { context = await (await fetch('/__workbench/context')).json(); } catch { /* Origin/page still provides a local fallback. */ }
  const key = `workbench-review-v1:${context.root || location.origin}:${page}`;
  let notes = [], target, editing, selection, picking = false, closeDiff;
  let storageError = '';
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) notes = saved.filter(n => n && typeof n.comment === 'string' && n.target && ['text','element'].includes(n.target.kind));
  } catch { storageError = 'Draft storage is unavailable; keep this tab open and copy your prompt.'; }
  function status(message) { $('status').textContent = message; }
  function persist() {
    try { localStorage.setItem(key, JSON.stringify(notes)); }
    catch { storageError = 'Draft could not be saved. Copy your prompt before leaving.'; }
    if (storageError) status(storageError);
  }
  function textNodes() {
    const nodes = [], walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return node.parentElement.closest('script,style,noscript,[data-workbench-ui]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }
  function heading(element) {
    let current = '';
    for (const h of content.querySelectorAll('h1,h2,h3')) {
      if (h === element || h.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) current = h.textContent;
    }
    return current;
  }
  function selector(element) {
    if (element === content) return ':scope';
    if (element.id) return '#' + CSS.escape(element.id);
    const stable = element.getAttribute('data-review-id');
    if (stable) return `[data-review-id="${CSS.escape(stable)}"]`;
    const parts = [];
    while (element && element !== content) {
      const tag = element.localName;
      const siblings = [...element.parentElement.children].filter(e => e.localName === tag);
      parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(element) + 1})`);
      element = element.parentElement;
    }
    return ':scope > ' + parts.join(' > ');
  }
  document.addEventListener('selectionchange', () => {
    const selected = document.getSelection();
    if (!selected.rangeCount || selected.isCollapsed) return;
    const range = selected.getRangeAt(0);
    if (!content.contains(range.startContainer) || !content.contains(range.endContainer)) return;
    const nodes = textNodes();
    const start = nodes.indexOf(range.startContainer), end = nodes.indexOf(range.endContainer);
    if (start < 0 || end < 0) return;
    const text = nodes.map(n => n.data).join('');
    const offset = nodes.slice(0, start).reduce((n, node) => n + node.length, 0) + range.startOffset;
    const finish = nodes.slice(0, end).reduce((n, node) => n + node.length, 0) + range.endOffset;
    selection = { kind: 'text', quote: text.slice(offset, finish), prefix: text.slice(Math.max(0, offset - 60), offset), suffix: text.slice(finish, finish + 60), offset, heading: heading(range.startContainer.parentElement) };
  });
  function locate(anchor) {
    if (anchor.kind === 'element') {
      let element;
      try { element = content.matches(anchor.selector) ? content : content.querySelector(anchor.selector); } catch { return null; }
      if (!element || (element.textContent || '').trim().slice(0, 300) !== anchor.quote) return null;
      return element;
    }
    const nodes = textNodes(), text = nodes.map(n => n.data).join('');
    if (!anchor.quote) return null;
    const hits = [];
    for (let at = text.indexOf(anchor.quote); at >= 0; at = text.indexOf(anchor.quote, at + 1)) hits.push(at);
    const contextual = hits.filter(at => (!anchor.prefix || text.slice(Math.max(0, at - anchor.prefix.length), at) === anchor.prefix)
      && (!anchor.suffix || text.slice(at + anchor.quote.length, at + anchor.quote.length + anchor.suffix.length) === anchor.suffix));
    const offset = contextual.length === 1 ? contextual[0] : hits.length === 1 ? hits[0] : -1;
    if (offset < 0) return null;
    let current = 0, startNode, startOffset, endNode, endOffset;
    for (const node of nodes) {
      if (!startNode && offset < current + node.length) { startNode = node; startOffset = offset - current; }
      if (startNode && offset + anchor.quote.length <= current + node.length) { endNode = node; endOffset = offset + anchor.quote.length - current; break; }
      current += node.length;
    }
    if (!startNode || !endNode) return null;
    const range = document.createRange(); range.setStart(startNode, startOffset); range.setEnd(endNode, endOffset); return range;
  }
  function open() { $('review').setAttribute('aria-expanded','true'); ui.querySelector('.panel').hidden = false; }
  function draft(anchor, index) {
    if (!anchor) { status('Select some page text first, or choose Pick element.'); return; }
    target = anchor; editing = index;
    $('target').textContent = `${anchor.heading ? anchor.heading + ' / ' : ''}${anchor.quote || anchor.selector}`;
    $('comment-form').hidden = false; $('comment').value = index === undefined ? '' : notes[index].comment;
    open(); $('comment').focus();
  }
  $('review').onclick = () => {
    if (picking) { picking = false; pickHint.hidden = true; $('pick').classList.remove('picker'); $('pick').setAttribute('aria-pressed','false'); open(); return; }
    const panel = ui.querySelector('.panel'); panel.hidden = !panel.hidden;
    $('review').setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) render();
  };
  $('hide').onclick = () => { ui.querySelector('.panel').hidden = true; $('review').setAttribute('aria-expanded','false'); picking = false; pickHint.hidden = true; $('pick').classList.remove('picker'); $('pick').setAttribute('aria-pressed','false'); $('review').focus(); };
  $('annotate').onclick = () => draft(selection);
  $('pick').onclick = () => {
    picking = !picking; pickHint.hidden = !picking; $('pick').classList.toggle('picker',picking); $('pick').setAttribute('aria-pressed',String(picking));
    if (picking) { ui.querySelector('.panel').hidden = true; $('review').setAttribute('aria-expanded','false'); $('review').focus(); }
    else status('Element picking cancelled.');
  };
  document.addEventListener('click', event => {
    if (!picking || event.composedPath().includes(host) || !content.contains(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation(); picking = false; pickHint.hidden = true;
    $('pick').classList.remove('picker'); $('pick').setAttribute('aria-pressed','false');
    const element = event.target;
    draft({ kind: 'element', selector: selector(element), quote: (element.textContent || '').trim().slice(0,300), heading: heading(element), tag: element.localName });
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (picking) { picking = false; pickHint.hidden = true; $('pick').classList.remove('picker'); $('pick').setAttribute('aria-pressed','false'); open(); $('pick').focus(); }
    else if (!ui.querySelector('.panel').hidden) $('hide').click();
    else closeDiff?.();
  });
  $('comment-form').onsubmit = event => {
    event.preventDefault(); const comment = $('comment').value.trim(); if (!comment || !target) return;
    const note = { target, comment, created: new Date().toISOString() };
    if (editing === undefined) notes.push(note); else notes[editing] = note;
    persist(); $('comment-form').hidden = true; target = null; editing = undefined; render(); status(storageError || 'Comment saved in this browser.');
  };
  $('cancel').onclick = () => { $('comment-form').hidden = true; target = null; editing = undefined; };
  const markers = [];
  function positionMarkers() {
    for (const { button, anchor } of markers) {
      const found = locate(anchor), rect = found?.getBoundingClientRect();
      button.hidden = Boolean(closeDiff) || !rect || rect.bottom < 0 || rect.top > innerHeight;
      if (rect) { button.style.left = `${Math.max(4, Math.min(innerWidth - 32, rect.right + 4))}px`; button.style.top = `${Math.max(4,rect.top)}px`; }
    }
  }
  function render() {
    $('count').textContent = notes.length; $('count').hidden = !notes.length;
    $('review').title = `Review annotations (${notes.length})`; $('notes').replaceChildren();
    markers.splice(0).forEach(m => m.button.remove());
    notes.forEach((note, index) => {
      const found = locate(note.target);
      const item = document.createElement('li'); item.className = 'note';
      const title = document.createElement('h3'); title.textContent = `${index + 1}. ${found ? 'Anchored' : 'Target changed or missing'}`;
      const quote = document.createElement('p'); quote.className = 'quote'; quote.textContent = note.target.quote || note.target.selector;
      const comment = document.createElement('p'); comment.className = 'comment'; comment.textContent = note.comment;
      const actions = document.createElement('div'); actions.className = 'actions';
      for (const [label, action] of [ ['Locate', () => { if (!found) return; const element = found.startContainer?.parentElement || found; element.scrollIntoView({ block:'center' }); }], ['Edit', () => draft(note.target,index)], ['Delete', () => { notes.splice(index,1); persist(); render(); }] ]) {
        const button = document.createElement('button'); button.textContent = label; button.onclick = action; if (label === 'Locate' && !found) button.disabled = true; actions.append(button);
      }
      item.append(title, quote, comment, actions); $('notes').append(item);
      const button = document.createElement('button'); button.className = 'marker'; button.textContent = index + 1;
      button.setAttribute('aria-label', `Review comment ${index + 1}`); button.onclick = () => { open(); item.scrollIntoView({block:'nearest'}); };
      ui.append(button); markers.push({button,anchor:note.target});
    });
    $('copy').disabled = !notes.length; positionMarkers();
  }
  addEventListener('scroll', positionMarkers, { passive:true }); addEventListener('resize', positionMarkers);
  new MutationObserver(() => positionMarkers()).observe(content, { subtree:true, childList:true, characterData:true });
  $('clear').onclick = () => { if (confirm('Clear review comments for this page?')) { notes = []; persist(); render(); } };
  $('copy').onclick = async () => {
    const prompt = `Apply the following review feedback to ${context.root ? context.root + '/' : ''}${page}.\nUse the current source, verify each quoted target before editing, and report ambiguous or missing targets.\nReview captured: ${new Date().toISOString()}\n\n` + notes.map((note,index) => `${index+1}. ${note.target.kind === 'text' ? 'Text selection' : 'Element'}${note.target.heading ? ' under "'+note.target.heading+'"' : ''}\n   Target status: ${locate(note.target) ? 'located' : 'changed or missing; verify before editing'}\n   Quote: ${JSON.stringify(note.target.quote)}\n   Locator: ${note.target.selector || `text quote with prefix ${JSON.stringify(note.target.prefix)} and suffix ${JSON.stringify(note.target.suffix)}`}\n   Feedback: ${note.comment}`).join('\n\n');
    $('prompt').value = prompt; $('prompt').hidden = false; $('prompt-label').hidden = false;
    try { await navigator.clipboard.writeText(prompt); status('Prompt copied. Draft comments remain saved.'); }
    catch { $('prompt').focus(); $('prompt').select(); status('Select and copy the prompt below.'); }
  };
  $('compare').onclick = async () => {
    if (closeDiff) { closeDiff(); return; }
    $('compare').disabled = true;
    try {
      const { mountComparison } = await import('/__workbench/assets/compare.js');
      const scroll = { x:scrollX, y:scrollY };
      const original = [...document.body.children].filter(e => e !== host && !e.matches('script,style'));
      original.forEach(e => { e.dataset.workbenchOriginalInert = String(e.inert); e.inert = true; });
      const view = document.createElement('section'); view.className = 'comparison'; view.setAttribute('aria-label','Page diff');
      const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/__workbench/assets/compare.css'; ui.append(style,view);
      const lock = document.createElement('style'); lock.dataset.workbenchUi = ''; lock.textContent = 'html{overflow:hidden}'; document.head.append(lock);
      closeDiff = () => {
        view.remove(); style.remove(); lock.remove();
        original.forEach(e => { e.inert = e.dataset.workbenchOriginalInert === 'true'; delete e.dataset.workbenchOriginalInert; });
        closeDiff = null; $('compare').setAttribute('aria-pressed','false'); $('annotate').disabled = false; $('pick').disabled = false;
        scrollTo(scroll.x,scroll.y); positionMarkers(); $('compare').focus();
      };
      picking = false; pickHint.hidden = true; $('pick').classList.remove('picker'); $('pick').setAttribute('aria-pressed','false');
      $('compare').setAttribute('aria-pressed','true'); $('annotate').disabled = true; $('pick').disabled = true; positionMarkers();
      await mountComparison(view,page,{close:() => closeDiff?.()});
    } catch (error) {
      closeDiff?.();
      ui.getElementById('diff-error')?.remove();
      const message = document.createElement('p'); message.id = 'diff-error'; message.className = 'toast'; message.setAttribute('role','status');
      message.textContent = `Comparison failed: ${error.message}`; ui.append(message);
      setTimeout(() => message.remove(),8000);
    }
    finally { $('compare').disabled = false; }
  };
  let toastTimer;
  function toast(message) {
    clearTimeout(toastTimer); $('download-status').hidden = false; $('download-status').textContent = message;
    toastTimer = setTimeout(() => { $('download-status').hidden = true; },8000);
  }
  $('share').onclick = async () => {
    const preview = window.open('about:blank','_blank');
    if (preview) { preview.opener = null; preview.document.title = 'Preparing Fieldnotes download'; preview.document.body.textContent = 'Preparing self-contained HTML…'; }
    $('share').disabled = true; $('share').setAttribute('aria-busy','true'); toast('Preparing download…');
    try {
      const { exportPage } = await import('/__workbench/assets/share.js');
      const { blob, filename } = await exportPage();
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      if (preview && !preview.closed) preview.location.replace(url);
      setTimeout(() => URL.revokeObjectURL(url),60000);
      toast(preview ? 'Download started. A preview opened in a new tab.' : 'Download started. Your browser blocked the preview tab.');
    } catch (error) { preview?.close(); toast(`Download failed: ${error.message}`); }
    finally { $('share').disabled = false; $('share').removeAttribute('aria-busy'); }
  };
  render(); if (storageError) status(storageError);
})();
