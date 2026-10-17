/**
 * Junta los cuadros y el audio en un MP4 (H.264 + AAC, audio normalizado a ~-14 LUFS para redes).
 *   node scripts/showcase/edit.mjs desk|mob
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { FPS, DURATION } from './cues.mjs';

const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const mode = process.argv[2] === 'mob' ? 'mob' : 'desk';
const dir = path.resolve('originales/showcase', mode);
const out = path.resolve('originales/showcase', mode === 'mob' ? 'mzz-showcase-9x16.mp4' : 'mzz-showcase-16x9.mp4');

execFileSync(ffmpeg, [
    '-v', 'error', '-y',
    '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.jpg'),
    '-i', path.join(dir, 'audio.wav'),
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-t', String(DURATION), '-movflags', '+faststart', out,
], { stdio: 'inherit' });
console.log('→', out);
