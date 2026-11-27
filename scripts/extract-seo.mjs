// Vytáhne z buildu (dist/) titulky, popisy a H1 všech stránek → src/data/seo-pages.json (výchozí data pro administraci SEO)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim();
const pages = walk('dist').filter((f) => f.endsWith('index.html') && !f.includes('administrace') && !f.includes('dekujeme'))
  .map((f) => {
    const s = readFileSync(f, 'utf8');
    const rel = relative('dist', f).replace(/index\.html$/, '').replace(/\/$/, '');
    return {
      slug: rel, title: dec((s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || rel),
      seo_title: dec((s.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''),
      seo_description: dec((s.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ''),
      noindex: /<meta name="robots" content="noindex/.test(s), custom: false,
    };
  }).sort((a, b) => a.slug.localeCompare(b.slug));
writeFileSync('src/data/seo-pages.json', JSON.stringify(pages, null, 1));
console.log('seo pages:', pages.length);
