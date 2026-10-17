/**
 * Arma el audio del promo: la lista AUDIO de la timeline (audio.json, la deja render.mjs), renderizada en Chrome
 * con las mismas recetas de src/core/sound.js. Salida: originales/showcase/promo-<v|h>/audio.wav (48 kHz estéreo).
 *   node scripts/showcase/audio.mjs v|h
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'http://localhost:5199';
const DURATION = 20;
const mode = process.argv[2] === 'h' ? 'h' : 'v';
const dir = path.resolve('originales/showcase', `promo-${mode}`);
const cues = JSON.parse(fs.readFileSync(path.join(dir, 'audio.json'), 'utf8')).filter((q) => q.t >= 0 && q.t < DURATION).map((q) => ({ ...q, t: q.t + 0.005 }));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(SITE + '/');
const b64 = await page.evaluate(async ({ cues, secs }) => {
    const { renderCues } = await import('/src/core/sound.js');
    const buf = await renderCues(cues, secs, { gain: 0.9 });
    const n = buf.length;
    const out = new Int16Array(n * 2);
    const l = buf.getChannelData(0);
    const r = buf.getChannelData(1);
    for (let i = 0; i < n; i++) {
        out[i * 2] = Math.max(-1, Math.min(1, l[i])) * 32767;
        out[i * 2 + 1] = Math.max(-1, Math.min(1, r[i])) * 32767;
    }
    let s = '';
    const u8 = new Uint8Array(out.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
}, { cues, secs: DURATION });
await browser.close();

const pcm = Buffer.from(b64, 'base64');
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8);
h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(48000, 24);
h.writeUInt32LE(48000 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(path.join(dir, 'audio.wav'), Buffer.concat([h, pcm]));
console.log(`audio.wav: ${cues.length} eventos, ${(pcm.length / 4 / 48000).toFixed(2)} s`);
