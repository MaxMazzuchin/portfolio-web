// Índice de proyectos como links reales. Lo usa el build para dejarlo dentro de trabajo.html (buscadores, sin JS, respaldo
// sin WebGL) y views/collection.js para pintar el mismo índice en el navegador.
import { projects, projectUrl } from '../data/work.js';

const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Una fila del índice: link si la entrada tiene `href` (Trabajos), botón si no (Biblioteca abre una ficha). */
export function indexRowHTML(it, i) {
    const inner = `<span class="num">${pad(i + 1)}</span><span>${esc(it.name)}</span><span>${esc(it.sub)}</span>`;
    return it.href
        ? `<a class="ci-row" href="${esc(it.href)}" data-i="${i}">${inner}</a>`
        : `<button type="button" class="ci-row" data-i="${i}">${inner}</button>`;
}

/** Índice completo de Trabajos. */
export const workIndexHTML = () => projects.map((p, i) => indexRowHTML({ name: p.title, sub: p.type, href: projectUrl(p.slug) }, i)).join('');
