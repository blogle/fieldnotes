const headings = [...document.querySelectorAll('.prose h1, .prose h2, .prose h3')];
const used = new Set();
headings.forEach(heading => {
  const base = heading.textContent.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
  let id = base, n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  heading.id = id;
  if (heading.tagName === 'H1') return;
  const link = document.createElement('a');
  link.href = `#${id}`;
  link.textContent = heading.textContent;
  link.className = heading.tagName.toLowerCase();
  document.querySelector('.toc nav').append(link);
});
const links = [...document.querySelectorAll('.toc a')];
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) links.forEach(link => {
    if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}, { rootMargin: '-5% 0px -65% 0px' });
headings.forEach(h => observer.observe(h));
document.querySelectorAll('.masthead nav a').forEach(a => {
  if (a.pathname === location.pathname) a.setAttribute('aria-current', 'page');
});
if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
