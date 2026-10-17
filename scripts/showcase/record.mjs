/**
 * Graba el sitio (npm run dev en :5199) cuadro a cuadro con el reloj virtual de Playwright, así GSAP, Three y la
 * cortina salen suaves aunque la máquina vaya lenta. Guarda los cuadros y el registro de sonidos (sfx.json).
 *   node scripts/showcase/record.mjs desk|mob [segundos]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { timeline, FPS, DURATION, SITE } from './cues.mjs';

const mode = process.argv[2] === 'mob' ? 'mob' : 'desk';
const secs = Number(process.argv[3]) || DURATION;
const out = path.resolve('originales/showcase', mode);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const mobile = mode === 'mob';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=default', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext(mobile
    ? { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
// Precarga en otra pestaña (tiempo real): módulos, fuentes e imágenes quedan en caché y no se ven armándose en el video.
const warm = await ctx.newPage();
for (const u of ['/', '/trabajo.html', '/biblioteca.html', '/proyecto/outframe/', '/proyecto/blue-marketing/', '/proyecto/nyro/', '/proyecto/sin-datos/']) {
    await warm.goto(SITE + u, { waitUntil: 'load' });
    await warm.waitForTimeout(2500);
}
await warm.close();
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('  [page error]', m.text()));
await page.addInitScript(() => { window.__sfxLog = []; });
await page.clock.install({ time: 0 });
await page.clock.pauseAt(1); // sin esto el reloj falso sigue corriendo en tiempo real y los cuadros pierden el compás
await page.goto(`${SITE}/`);
const t0 = await page.evaluate(() => performance.now() / 1000);

// Utilidades que usan los cues
const center = async (sel) => page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
}, sel);
const api = {
    mobile,
    page,
    center,
    pos: { x: -50, y: -50 },
    async click(sel) {
        const c = await center(sel);
        if (!c) { console.log('  [cue] sin elemento', sel); return; }
        this.pos = c;
        if (mobile) await page.touchscreen.tap(c.x, c.y);
        else { await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.up(); }
    },
    async nav(href) { // click sintético sobre un link: lo toma el router, igual que un click real
        await page.evaluate((h) => { const a = document.createElement('a'); a.href = h; a.style.display = 'none'; document.body.append(a); a.click(); a.remove(); }, href);
    },
    async key(k) { await page.keyboard.press(k); },
    async wheel(dy) { await page.mouse.wheel(0, dy); },
};

const cues = timeline(api).sort((a, b) => a.t - b.t);
let ci = 0;
const frames = Math.round(secs * FPS);
const t = Date.now();
for (let f = 0; f < frames; f++) {
    const now = f / FPS;
    while (ci < cues.length && cues[ci].t <= now + 1e-6) { await cues[ci].run(now); ci++; }
    if (!mobile) {
        const m = api.mouseAt?.(now);
        if (m) { api.pos = m; await page.mouse.move(m.x, m.y); }
    }
    await page.clock.runFor(1000 / FPS);
    await page.screenshot({ path: path.join(out, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 94 });
    if (f % 60 === 0) console.log(`  ${mode} ${now.toFixed(1)}s  (${((Date.now() - t) / 1000).toFixed(0)}s)`);
}

const log = await page.evaluate(() => window.__sfxLog);
fs.writeFileSync(path.join(out, 'sfx.json'), JSON.stringify(log.map((q) => ({ ...q, t: q.t - t0 })), null, 1));
console.log(`listo: ${frames} cuadros, ${log.length} sonidos → ${out}`);
await browser.close();
