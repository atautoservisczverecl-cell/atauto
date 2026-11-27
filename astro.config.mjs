import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.atautoservis.cz',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [sitemap({ filter: (p) => !p.includes('/dekujeme/') && !p.includes('/administrace/') })],
  compressHTML: true,
});
