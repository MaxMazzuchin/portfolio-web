/**
 * Junta los cuadros y el audio del promo en un MP4 (H.264 + AAC, audio normalizado a ~-18 LUFS para redes).
 *   node scripts/showcase/edit.mjs v|h [nombre]   → originales/showcase/mzz-<nombre>-9x16.mp4 (o 16x9)
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
const FPS = 30;
const DURATION = 20;

const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const mode = process.argv[2] === 'h' ? 'h' : 'v';
const dir = path.resolve('originales/showcase', `promo-${mode}`);
const name = process.argv[3] || 'estreno'; // nombre de la pieza: así una versión nueva no pisa la anterior
const out = path.resolve('originales/showcase', `mzz-${name}-${mode === 'h' ? '16x9' : '9x16'}.mp4`);

execFileSync(ffmpeg, [
    '-v', 'error', '-y',
    '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.jpg'),
    '-i', path.join(dir, 'audio.wav'),
    '-af', 'loudnorm=I=-18:TP=-2:LRA=9',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-t', String(DURATION), '-movflags', '+faststart', out,
], { stdio: 'inherit' });
console.log('→', out);
