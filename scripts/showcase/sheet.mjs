/** Hoja de contactos de una carpeta de cuadros: node scripts/showcase/sheet.mjs <carpeta> <salida.jpg> [columnas] [ancho] */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [dir, out, cols = '13', tw = '160'] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort();
const c = Number(cols); const w = Number(tw);
const first = await sharp(path.join(dir, files[0])).metadata();
const h = Math.round((w * first.height) / first.width);
const rows = Math.ceil(files.length / c);
const tiles = await Promise.all(files.map(async (f, i) => ({
    input: await sharp(path.join(dir, f)).resize(w, h).toBuffer(),
    left: (i % c) * w, top: Math.floor(i / c) * h,
})));
await sharp({ create: { width: c * w, height: rows * h, channels: 3, background: '#222' } }).composite(tiles).jpeg({ quality: 88 }).toFile(out);
console.log(`${files.length} cuadros → ${out}`);
