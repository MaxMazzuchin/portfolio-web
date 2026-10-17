/**
 * Saca los cuadros del promo (scripts/showcase/promo) llamando a window.render(t) por cada cuadro.
 *   node scripts/showcase/render.mjs v|h [--every N] [--from s] [--to s]
 * Necesita `npm run dev -- --port 5199`. Cuadros en originales/showcase/promo-<v|h>/f0000.jpg.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'http://localhost:5199';
const FPS = 30;
const f = process.argv[2] === 'h' ? 'h' : 'v';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const every = arg('--every', 1);
const from = arg('--from', 0);
const to = arg('--to', 20);
const [W, H] = f === 'h' ? [1920, 1080] : [1080, 1920];
const out = path.resolve('originales/showcase', `promo-${f}`);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && console.log(`  [page ${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('  [page exception]', e.message));
await page.goto(`${SITE}/scripts/showcase/promo/index.html?f=${f}&render`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

const t0 = Date.now();
for (let n = Math.round(from * FPS); n < Math.round(to * FPS); n += every) {
    await page.evaluate((t) => window.render(t), n / FPS);
    await page.screenshot({ path: path.join(out, `f${String(n).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 94 });
    if (n % 60 === 0) console.log(`  ${f} ${(n / FPS).toFixed(1)}s (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
const audio = await page.evaluate(() => window.AUDIO);
fs.writeFileSync(path.join(out, 'audio.json'), JSON.stringify(audio));
console.log(`listo → ${out} (${audio.length} sonidos)`);
await browser.close();
