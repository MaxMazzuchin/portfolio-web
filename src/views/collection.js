import { projects, projectUrl } from '../data/work.js';
import { library, kinds } from '../data/library.js';
import { accentOf } from '../data/accents.js';
import { gl } from '../gl/index.js';
import { createWheel } from '../gl/wheel.js';
import { scroll } from '../core/scroll.js';
import { setAccent } from '../core/accent.js';
import { sized } from '../core/srcset.js';
import { generatedCover } from '../core/cards.js';
import { mountDbars } from '../core/dbar.js';
import { indexRowHTML } from './work-index.js';

const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SAMPLE_DESC = 'Texto de ejemplo. Acá va una nota breve tuya: por qué esta pieza te importa, qué te dejó y en qué momento la volvés a mirar. Entre dos y cuatro líneas alcanzan.';

/** Each collection maps its data to the same item shape: { name, sub, meta, cover, accent, href|url, group }. */
const CONFIGS = {
    work: {
        title: 'Trabajos | Máximo Mazzuchin',
        openLabel: 'Ver proyecto ↗',
        items: () => projects.map((p) => ({
            key: p.slug, name: p.title, sub: p.type, meta: `${p.index} / ${pad(projects.length)}`,
            // Rueda y vista Lista: las cartas miden hasta 320 px (640 en pantallas 2×), no hace falta la portada de 2400 px.
            cover: sized(p.cover, 800), accent: accentOf(p.slug), href: projectUrl(p.slug), subLabel: p.type,
        })),
    },
    library: {
        title: 'Biblioteca | Máximo Mazzuchin',
        openLabel: 'Abrir recurso ↗',
        filters: true,
        items: () => library.map((e) => ({
            key: e.slug, name: e.author, sub: e.title, meta: e.year, group: e.kind, subLabel: kinds[e.kind].singular,
            cover: e.cover || null, accent: e.accent, url: e.url, placeholder: e.placeholder, desc: e.desc || (e.placeholder ? SAMPLE_DESC : ''),
            kindLabel: kinds[e.kind].singular, year: e.year, title: e.title, author: e.author,
            gen: { kindLabel: kinds[e.kind].singular, author: e.author, title: e.title, accent: e.accent },
        })),
    },
};

/** Minimal stand-in for the WebGL wheel, so the list view still works without WebGL. */
function stubWheel(N, { onFrame, onActive, onOpen }) {
    let active = -1;
    const set = (i) => {
        const a = ((i % N) + N) % N;
        if (a !== active) { active = a; onActive?.(a); }
        onFrame?.(a, a);
    };
    const onKey = (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') set(active + 1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') set(active - 1);
        else if (e.key === 'Enter') onOpen?.(active);
    };
    let lastWheel = 0;
    const onWheel = (e) => {
        const now = performance.now();
        if (Math.abs(e.deltaY) < 4 || now - lastWheel < 140) return;
        lastWheel = now;
        set(active + (e.deltaY > 0 ? 1 : -1));
    };
    addEventListener('keydown', onKey);
    addEventListener('wheel', onWheel, { passive: true });
    set(0);
    return {
        goTo: set, go: (n) => set(active + n), setVisible() {}, get active() { return active; },
        dispose() { removeEventListener('keydown', onKey); removeEventListener('wheel', onWheel); },
    };
}

function collection(kind, view) {
    const cfg = CONFIGS[kind];
    document.title = cfg.title;

    const stage = view.querySelector('.col-stage');
    const listEl = view.querySelector('[data-c-list]');
    const indexEl = view.querySelector('[data-c-index]');
    const hit = view.querySelector('[data-c-hit]');
    const countEl = view.querySelector('[data-c-count]');
    const subEl = view.querySelector('[data-c-sub]');
    const openEl = view.querySelector('[data-c-open]');
    const filtersEl = view.querySelector('[data-c-filters]');
    const previewImg = view.querySelector('.c-preview img');

    let disposed = false;
    let wheel = null;
    let items = [];
    let filter = 'all';
    // Solo existe la rueda. Sin WebGL no hay cartas: ahí (y solo ahí) se muestra el índice en lista como respaldo.
    const mode = gl.ok ? 'wheel' : 'list';
    const narrow = matchMedia('(max-width: 800px)');

    scroll.stop();
    let rowH = 120;
    const onResize = () => { const r = listEl.querySelector('.c-item'); if (r) rowH = r.offsetHeight || rowH; };
    addEventListener('resize', onResize);

    const applyMode = () => {
        stage.classList.toggle('is-list', mode === 'list');
        wheel?.setVisible(mode === 'wheel');
    };

    function setOpen(item) {
        if (item.href) {
            openEl.href = item.href;
            openEl.removeAttribute('target');
            openEl.removeAttribute('rel');
            openEl.removeAttribute('aria-disabled');
            openEl.textContent = cfg.openLabel;
        } else if (item.url) {
            openEl.href = item.url;
            openEl.target = '_blank';
            openEl.rel = 'noopener';
            openEl.removeAttribute('aria-disabled');
            openEl.textContent = item.desc ? 'Ver ficha ↗' : cfg.openLabel;
        } else {
            openEl.removeAttribute('href');
            openEl.setAttribute('aria-disabled', 'true');
            openEl.textContent = 'Sin link (ejemplo)';
        }
    }

    /* Ficha: la ventana baja desde arriba (como en CRL) sobre la rueda; al cerrar vuelve a subir. */
    let sheet = null;
    let sheetOpen = false;
    let lastFocus = null;
    if (cfg.filters) {
        sheet = document.createElement('div');
        sheet.className = 'c-sheet';
        sheet.inert = true;
        sheet.innerHTML = `
            <button type="button" class="c-sheet-scrim" tabindex="-1" aria-label="Cerrar ficha" data-sheet-close></button>
            <section class="c-win" role="dialog" aria-modal="true" aria-labelledby="c-sheet-title">
                <header class="mono c-win-bar"><span data-sheet-bar></span><button type="button" data-sheet-close>Cerrar ×</button></header>
                <div class="c-win-main">
                    <img class="c-win-cover" alt="">
                    <div class="c-win-body">
                        <p class="mono c-win-meta"><span data-sheet-kind></span><span data-sheet-year></span></p>
                        <h2 class="c-win-author" id="c-sheet-title" data-sheet-author></h2>
                        <p class="c-win-title" data-sheet-title></p>
                        <p class="c-win-desc" data-sheet-desc></p>
                        <div class="mono c-win-actions"><a class="c-open" data-sheet-link target="_blank" rel="noopener">Abrir recurso ↗</a></div>
                    </div>
                </div>
            </section>`;
        stage.appendChild(sheet);
    }
    const sq = (sel) => sheet.querySelector(sel);

    function openSheet(i) {
        const it = items[i];
        if (!sheet || !it) return;
        sq('.c-win-cover').src = it.cover;
        sq('[data-sheet-bar]').textContent = `Ficha ${pad(i + 1)} / ${pad(items.length)}`;
        sq('[data-sheet-kind]').textContent = it.kindLabel;
        sq('[data-sheet-year]').textContent = `(${it.year})`;
        sq('[data-sheet-author]').textContent = it.author;
        sq('[data-sheet-title]').textContent = it.title;
        sq('[data-sheet-desc]').textContent = it.desc;
        const link = sq('[data-sheet-link]');
        if (it.url) { link.href = it.url; link.removeAttribute('aria-disabled'); link.textContent = cfg.openLabel; }
        else { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); link.textContent = 'Sin link (ejemplo)'; }
        sheet.style.setProperty('--accent', it.accent);
        lastFocus = document.activeElement;
        sheetOpen = true;
        sheet.inert = false;
        sheet.classList.add('is-open');
        sq('.c-win-bar button').focus({ preventScroll: true });
    }

    function closeSheet() {
        if (!sheetOpen) return;
        sheetOpen = false;
        sheet.inert = true;
        sheet.classList.remove('is-open');
        lastFocus?.focus?.({ preventScroll: true });
    }

    /** Abre la ficha si la entrada tiene descripción; si no, va directo al link. */
    function activate(i) {
        const it = items[i];
        if (!it) return;
        if (sheet && it.desc) openSheet(i);
        else if (it.href || it.url) openEl.click();
    }

    // Registrado antes que la rueda: mientras la ficha está abierta, scroll y teclas no llegan a la rueda.
    const onGuard = (e) => {
        if (!sheetOpen) return;
        if (e.type === 'wheel') { e.stopImmediatePropagation(); return; }
        if (e.key === 'Escape') { e.preventDefault(); closeSheet(); }
        else if (e.key === 'Tab') {
            const f = [...sheet.querySelectorAll('a[href], button:not(.c-sheet-scrim)')];
            const at = f.indexOf(document.activeElement);
            e.preventDefault();
            f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
        e.stopImmediatePropagation();
    };
    addEventListener('wheel', onGuard, { passive: true });
    addEventListener('keydown', onGuard);

    function render(next) {
        wheel?.dispose();
        if (gl.wheel === wheel) gl.wheel = null;
        items = next;
        const N = items.length;

        listEl.innerHTML = items.map((it, i) => `
            <div class="c-item" style="--fit:${Math.min(1, 14 / it.name.length).toFixed(3)}">
                <span class="c-num">${pad(i + 1)}</span>
                <span class="c-name">${esc(it.name)}<span class="c-sub2">${esc(it.sub)}${it.placeholder ? '<span class="c-tag">Ejemplo</span>' : ''}</span></span>
                <span class="c-meta">${esc(it.meta)}</span>
            </div>`).join('');
        const rows = [...listEl.children];

        // En Trabajos las filas son links reales (el build deja el mismo índice en trabajo.html, ver views/work-index.js).
        indexEl.innerHTML = items.map(indexRowHTML).join('');
        const idxRows = [...indexEl.children];
        onResize();

        const handlers = {
            onFrame(pos) {
                rows.forEach((row, k) => {
                    let d = k - pos;
                    d -= N * Math.round(d / N);
                    const ad = Math.abs(d);
                    // En el celular se ve un solo título: los vecinos se apagan antes (en escritorio se asoman).
                    row.style.opacity = ad < 1.6 ? String(Math.max(0, 1 - ad * (narrow.matches ? 2.2 : 0.78))) : '0';
                    row.style.transform = `translateY(${d * rowH}px)`;
                });
            },
            onActive(i) {
                const it = items[i];
                countEl.textContent = `${pad(i + 1)} / ${pad(N)}`;
                subEl.textContent = it.subLabel || '';
                setOpen(it);
                setAccent(it.accent);
                previewImg.src = it.cover;
                idxRows.forEach((r, k) => r.classList.toggle('is-active', k === i));
                mountDbars(view);
            },
            onOpen: activate,
        };

        wheel = gl.ok
            ? createWheel(gl, { projects: items.map((it) => ({ cover: { src: it.cover } })), hit, ...handlers })
            : stubWheel(N, handlers);
        if (gl.ok) gl.wheel = wheel;
        applyMode();
    }

    function renderFilters() {
        if (!cfg.filters) return;
        const all = cfg.items();
        const present = Object.keys(kinds).filter((k) => all.some((i) => i.group === k));
        filtersEl.innerHTML = [`<button type="button" data-f="all" class="is-on">Todos<sup class="num">${all.length}</sup></button>`]
            .concat(present.map((k) => `<button type="button" data-f="${k}">${kinds[k].label}<sup class="num">${all.filter((i) => i.group === k).length}</sup></button>`))
            .join('');
    }

    const onClick = (e) => {
        if (e.target.closest('[data-sheet-close]')) { closeSheet(); return; }
        if (e.target.closest('[data-c-open]') && sheet && items[wheel.active]?.desc) { e.preventDefault(); activate(wheel.active); return; }
        const f = e.target.closest('[data-f]');
        if (f) {
            filter = f.dataset.f;
            filtersEl.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('is-on', b === f));
            render(allItems.filter((i) => filter === 'all' || i.group === filter));
            return;
        }
        const row = e.target.closest('.ci-row');
        if (row) {
            // Un link del índice no navega solo: la rueda decide (primer click selecciona). Con Ctrl/Cmd/Shift se abre en otra pestaña como siempre.
            if (row.tagName === 'A') {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
            }
            const i = Number(row.dataset.i);
            // En el celular un toque abre la entrada (seleccionar primero y abrir con otro toque es confuso); en escritorio, el primero selecciona.
            if (i === wheel.active || narrow.matches) activate(i); else wheel.goTo(i);
        }
    };
    const onOver = (e) => {
        const row = e.target.closest('.ci-row');
        if (row && mode === 'list') wheel.goTo(Number(row.dataset.i));
    };
    view.addEventListener('click', onClick);
    view.addEventListener('pointerover', onOver);

    renderFilters();
    let allItems = [];
    // Library entries without a real cover get a generated card; resolve them all before the first render.
    Promise.all(cfg.items().map(async (it) => (it.cover ? it : { ...it, cover: await generatedCover(it.gen) })))
        .then((resolved) => {
            if (disposed) return;
            allItems = resolved;
            render(allItems);
        });

    return () => {
        disposed = true;
        removeEventListener('resize', onResize);
        removeEventListener('wheel', onGuard);
        removeEventListener('keydown', onGuard);
        view.removeEventListener('click', onClick);
        view.removeEventListener('pointerover', onOver);
        wheel?.dispose();
        if (gl.wheel === wheel) gl.wheel = null;
        scroll.start();
    };
}

export const mountWork = (view) => collection('work', view);
export const mountLibrary = (view) => collection('library', view);
