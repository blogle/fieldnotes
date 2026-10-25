// Native DOM/CSSOM export. No generated files are written into the project.
export async function exportPage() {
  const clone = document.documentElement.cloneNode(true);
  const cache = new Map();
  function local(url) {
    const resolved = new URL(url, location.href);
    if (resolved.origin !== location.origin) throw new Error(`External asset is not bundled: ${resolved.href}`);
    return resolved;
  }
  async function fetchResource(url, binary = false) {
    const resolved = local(url);
    const key = `${binary}:${resolved.href}`;
    if (!cache.has(key)) cache.set(key, (async () => {
      const response = await fetch(resolved);
      if (!response.ok) throw new Error(`Cannot read ${resolved.pathname} (${response.status})`);
      if (!binary) return response.text();
      const blob = await response.blob();
      return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    })());
    return cache.get(key);
  }
  async function urls(css, base) {
    const matches = [...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/g)];
    for (const match of matches.reverse()) {
      const value = (match[1] ?? match[2] ?? match[3]).trim();
      if (!value || value.startsWith('data:') || value.startsWith('#')) continue;
      const url = new URL(value, base);
      const fragment = url.hash; url.hash = '';
      const embedded = await fetchResource(url, true);
      css = css.slice(0, match.index) + `url("${embedded}${fragment}")` + css.slice(match.index + match[0].length);
    }
    return css;
  }
  async function stylesheet(sheet, seen = new Set()) {
    if (seen.has(sheet)) return '';
    seen.add(sheet);
    let output = '';
    for (const rule of sheet.cssRules) {
      if (rule.type === CSSRule.IMPORT_RULE) {
        let imported = await stylesheet(rule.styleSheet, seen);
        if (rule.media.mediaText) imported = `@media ${rule.media.mediaText}{${imported}}`;
        if (rule.supportsText) imported = `@supports (${rule.supportsText}){${imported}}`;
        if (rule.layerName !== undefined && rule.layerName !== null) imported = `@layer ${rule.layerName}{${imported}}`;
        output += imported;
      } else output += await urls(rule.cssText, sheet.href || location.href) + '\n';
    }
    seen.delete(sheet); return output;
  }
  const originalStyles = [...document.querySelectorAll('link[rel="stylesheet"],style')];
  const clonedStyles = [...clone.querySelectorAll('link[rel="stylesheet"],style')];
  for (let i = 0; i < originalStyles.length; i++) {
    const original = originalStyles[i], destination = clonedStyles[i];
    if (original.hasAttribute('data-workbench-ui')) { destination.remove(); continue; }
    if (!original.sheet) throw new Error('A stylesheet has not loaded yet');
    const style = document.createElement('style');
    style.textContent = await stylesheet(original.sheet);
    if (original.media) style.media = original.media;
    destination.replaceWith(style);
  }
  for (const element of clone.querySelectorAll('[style]')) element.setAttribute('style', await urls(element.getAttribute('style'), location.href));
  // Normalize responsive pictures to their currently selected image; embed ordinary media.
  const originalImages = [...document.querySelectorAll('img')];
  for (const [i, image] of [...clone.querySelectorAll('img')].entries()) {
    const source = originalImages[i].currentSrc || originalImages[i].src;
    if (source && !source.startsWith('data:')) image.src = await fetchResource(source, true);
    image.removeAttribute('srcset'); image.removeAttribute('sizes'); image.closest('picture')?.querySelectorAll('source').forEach(s => s.remove());
  }
  for (const element of clone.querySelectorAll('video[src],audio[src],source[src],video[poster],input[type=image][src]')) {
    for (const attribute of ['src','poster']) if (element.hasAttribute(attribute)) element.setAttribute(attribute, await fetchResource(element.getAttribute(attribute), true));
  }
  for (const element of clone.querySelectorAll('use[href],use[xlink\\:href]')) {
    const attribute = element.hasAttribute('href') ? 'href' : 'xlink:href', href = element.getAttribute(attribute);
    if (!href.startsWith('#')) throw new Error('External SVG use references must be authored as inline symbols or images');
  }
  for (const element of clone.querySelectorAll('svg image[href],svg image[xlink\\:href],link[rel~="icon"][href]')) {
    const attribute = element.hasAttribute('href') ? 'href' : 'xlink:href', href = element.getAttribute(attribute);
    if (href && !href.startsWith('#') && !href.startsWith('data:')) element.setAttribute(attribute, await fetchResource(href, true));
  }
  if (clone.querySelector('iframe,object,embed')) throw new Error('Embedded documents are not supported by single-page export');
  // Preserve native form state in the snapshot; app scripts may initialize their own state.
  const originals = [...document.querySelectorAll('input,textarea,select,details')];
  [...clone.querySelectorAll('input,textarea,select,details')].forEach((element,i) => {
    const source = originals[i];
    if (element.tagName === 'INPUT') {
      if (element.type !== 'file' && element.type !== 'password') element.setAttribute('value', source.value);
      else element.removeAttribute('value');
      element.toggleAttribute('checked', source.checked);
    } else if (element.tagName === 'TEXTAREA') element.textContent = source.value;
    else if (element.tagName === 'SELECT') [...element.options].forEach((o,j) => o.toggleAttribute('selected', source.options[j].selected));
    else element.toggleAttribute('open', source.open);
  });
  // Explicit application hook: examples can supply a JSON bootstrap, not a storage dump.
  const detail = { document: clone, bootstrap: [] };
  window.dispatchEvent(new CustomEvent('workbench:export', { detail }));
  const scripts = [...clone.querySelectorAll('script')];
  for (const script of scripts) {
    if (script.hasAttribute('data-workbench-ui')) { script.remove(); continue; }
    if (script.type === 'module') throw new Error('ES modules must be made standalone before export');
    if (script.src) {
      script.textContent = await fetchResource(script.getAttribute('src'));
      script.removeAttribute('src'); script.removeAttribute('integrity'); script.removeAttribute('crossorigin');
    }
    script.textContent = script.textContent.replace(/<\/script/gi, '<\\/script');
    script.removeAttribute('defer'); script.removeAttribute('async');
    script.remove();
  }
  clone.querySelectorAll('[data-workbench-ui],meta[name="workbench-page"],base,link[rel="preload"],link[rel="modulepreload"]').forEach(e => e.remove());
  clone.querySelectorAll('[data-workbench-original-inert]').forEach(e => {
    e.inert = e.dataset.workbenchOriginalInert === 'true'; delete e.dataset.workbenchOriginalInert;
  });
  if (document.querySelector('script[src="/__workbench/assets/document.js"],script[src="/assets/document.js"]')) clone.querySelector('.toc nav')?.replaceChildren();
  // Outgoing page links keep an absolute destination; a download is one page, not a site.
  for (const a of clone.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (href && !href.startsWith('#')) a.setAttribute('href', new URL(href, location.href).href);
  }
  for (const source of detail.bootstrap) { const script = document.createElement('script'); script.textContent = source.replace(/<\/script/gi,'<\\/script'); clone.querySelector('body').append(script); }
  for (const script of scripts) if (!script.hasAttribute('data-workbench-ui')) clone.querySelector('body').append(script);
  const html = '<!doctype html>\n' + clone.outerHTML;
  const blob = new Blob([html], { type:'text/html;charset=utf-8' });
  const page = document.querySelector('meta[name="workbench-page"]')?.content || location.pathname;
  return { blob, filename: page.split('/').pop().replace(/\.[^.]+$/, '') + '.html' };
}
