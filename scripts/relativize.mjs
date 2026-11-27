// Převede build v dist/ na náhled s relativními cestami (dist-preview/) pro hosting bez kořene domény.
import { cpSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, posix } from 'node:path';

const SRC = 'dist', OUT = 'dist-preview';
rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });
// Hosting náhledu nepovoluje cesty začínající podtržítkem → _astro přejmenujeme na assets
import { renameSync, existsSync } from 'node:fs';
if (existsSync(join(OUT, '_astro'))) renameSync(join(OUT, '_astro'), join(OUT, 'assets'));
for (const f of ['sitemap-index.xml', 'sitemap-0.xml', '_redirects', 'robots.txt']) rmSync(join(OUT, f), { force: true });

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

const toRel = (fromFile, target) => {
  const m = target.match(/^([^?#]*)(.*)$/); let [, path, rest] = m;
  if (path.endsWith('/')) path += 'index.html';
  const fromDir = posix.dirname('/' + relative(OUT, fromFile).split('\\').join('/'));
  let r = posix.relative(fromDir, path) || 'index.html';
  return r + rest;
};

for (const file of walk(OUT).filter((f) => f.endsWith('.html'))) {
  let s = readFileSync(file, 'utf8').replace(/\/_astro\//g, '/assets/');
  s = s.replace(/(\s(?:href|src|action|poster|content)=")(\/(?!\/)[^"]*)"/g, (all, a, u) => {
    if (a.includes('content') && !/\.(webp|png|jpg|svg)/.test(u)) return all;
    return `${a}${toRel(file, u)}"`;
  });
  s = s.replace(/(\ssrcset=")([^"]*)"/g, (all, a, v) => a + v.split(',').map((part) => part.trim().replace(/^(\/(?!\/)\S+)/, (u) => toRel(file, u))).join(', ') + '"');
  s = s.replace(/url\((['"]?)(\/(?!\/)[^)'"]+)\1\)/g, (all, q, u) => `url(${q}${toRel(file, u)}${q})`);
  if (relative(OUT, file) === 'index.html') {
    // Hlavní stránka: obal (doctype/html/head/body) doplní hosting, ponecháme jen obsah
    s = s.replace(/<!DOCTYPE html>/i, '').replace(/<html[^>]*>/i, '').replace(/<\/html>/i, '')
         .replace(/<head>/i, '').replace(/<\/head>/i, '').replace(/<body[^>]*>/i, '').replace(/<\/body>/i, '');
  }
  writeFileSync(file, s);
}
console.log('preview files:', walk(OUT).length);
