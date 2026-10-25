import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

export const md = new MarkdownIt({ html: true, highlight(code, language) {
  return language && hljs.getLanguage(language) ? hljs.highlight(code, { language }).value : '';
} });
export const escape = md.utils.escapeHtml;
export const asset = name => `/__workbench/assets/${name}`;
export function tools(page) {
  return `<meta name="workbench-page" content="${escape(page)}"><style data-workbench-ui>body{padding-bottom:72px}</style><script data-workbench-ui src="${asset('review.js')}" defer></script><script data-workbench-ui src="${asset('reload.js')}" defer></script>`;
}
export function renderMarkdown(source, config, { page = '', review = true } = {}) {
  const content = md.render(source);
  const title = /<h1>(.*?)<\/h1>/.exec(content)?.[1].replace(/<[^>]*>/g, '') || config.title;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · ${escape(config.title)}</title><link rel="stylesheet" href="${asset('fieldnotes.css')}">${config.styles.map(href => `<link rel="stylesheet" href="/${escape(href)}">`).join('')}<script src="${asset('document.js')}" defer></script>${config.scripts.map(src => `<script src="/${escape(src)}" defer></script>`).join('')}${review ? tools(page) : ''}</head><body><a class="skip" href="#content">Skip to content</a><header class="masthead"><a class="brand" href="/${escape(config.entry)}">${escape(config.title)}</a><nav aria-label="Documentation">${config.navigation.map(link => `<a href="/${escape(link.href)}">${escape(link.label)}</a>`).join('')}</nav></header><div class="document-layout"><main id="content" class="prose">${content}</main><aside class="toc" aria-label="On this page"><div class="eyebrow">On this page</div><nav></nav></aside></div></body></html>`;
}
export function injectTools(html, page) {
  const extra = tools(page);
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, extra + '</head>') : extra + html;
}
