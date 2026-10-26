export async function mountComparison(root, page, { close } = {}) {
  root.innerHTML = `<header class="comparison-header"><h1>Page diff</h1><button id="close-diff">Close diff</button></header><p id="comparison-status" role="status">Loading comparison…</p><div id="comparison-content" hidden><div class="compare-columns"><section><h2>HEAD</h2><iframe title="HEAD preview" sandbox="allow-same-origin"></iframe></section><section><h2>Working tree</h2><iframe title="Working tree preview" sandbox="allow-same-origin"></iframe></section></div><p class="preview-note">Scripts and forms are disabled in previews. Markdown uses the current viewer theme.</p><details><summary>Source diff</summary><pre id="source-diff"></pre></details></div>`;
  const $ = id => root.querySelector('#' + id);
  $('close-diff').onclick = close || (() => location.assign('/' + page));
  $('close-diff').focus();
  try {
    const response = await fetch('/__fieldnotes/api/compare?path=' + encodeURIComponent(page));
    if (!response.ok) throw new Error(await response.text());
    const result = await response.json();
    if (!root.isConnected) return;
    if (!result.available) { $('comparison-status').textContent = result.reason; return; }
    $('comparison-status').textContent = `${result.relative} · HEAD ${result.commit.slice(0,12)} · ${result.untracked ? 'New file: no HEAD version' : result.changed ? 'Working tree has changes' : 'No source changes'}`;
    for (const line of result.diff.split('\n')) {
      const span = document.createElement('span'); span.textContent = line + '\n';
      span.className = line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@') ? 'diff-header' : line.startsWith('+') ? 'diff-add' : line.startsWith('-') ? 'diff-remove' : '';
      $('source-diff').append(span);
    }
    function preview(source, before) {
      const parsed = new DOMParser().parseFromString(source,'text/html');
      parsed.querySelectorAll('script,base,meta[http-equiv="refresh"]').forEach(e => e.remove());
      const base = document.createElement('base');
      base.href = new URL((before ? '/__fieldnotes/head/' : '/') + page, location.origin).href;
      parsed.head.prepend(base);
      if (before) parsed.querySelectorAll('[src],[href]').forEach(element => {
        for (const attribute of ['src','href']) {
          const value = element.getAttribute(attribute);
          if (value?.startsWith('/') && !value.startsWith('/__fieldnotes/')) element.setAttribute(attribute,'/__fieldnotes/head' + value);
        }
      });
      if (result.markdown) {
        const nav = parsed.querySelector('.toc nav');
        parsed.querySelectorAll('.prose h2,.prose h3').forEach(h => { const p = parsed.createElement('p'); p.textContent = h.textContent; nav.append(p); });
      }
      return '<!doctype html>' + parsed.documentElement.outerHTML;
    }
    const frames = root.querySelectorAll('iframe');
    frames[0].srcdoc = preview(result.beforeHtml,true); frames[1].srcdoc = preview(result.afterHtml,false);
    $('comparison-content').hidden = false;
  } catch (error) { if (root.isConnected) $('comparison-status').textContent = error.message; }
}

const standalone = document.querySelector('main.comparison');
if (standalone && location.pathname === '/__fieldnotes/compare') {
  const page = new URL(location.href).searchParams.get('path');
  if (page && !page.startsWith('/') && !page.split('/').includes('..')) mountComparison(standalone,page);
  else standalone.textContent = 'A valid content-relative page path is required.';
}
