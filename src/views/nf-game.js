import { sound } from '../core/sound.js';

/**
 * Minijuego del 404 (huevo de pascua): el caballo galopa y hay que saltar los obstáculos, estilo el dinosaurio de Chrome.
 * Espacio / flecha arriba / un toque salta. Los obstáculos van en dither (Bayer 4x4) y el caballo es el sprite de la transición
 * (public/images/transition/caballo.webp, ver scripts/horse-sprite.mjs) teñido con el color del texto.
 */
const SPRITE = '/images/transition/caballo.webp';
const COLS = 5;
const FW = 640;
const FH = 450;
const FRAMES = 10;
const FPS = 16;
const BEST_KEY = 'nf-best';
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; // 4x4
const pad = (n, l = 5) => String(n).padStart(l, '0');

export function mountGame(canvas) {
    const ctx = canvas.getContext('2d');
    const root = document.documentElement;
    const css = (v) => getComputedStyle(root).getPropertyValue(v).trim() || '#fff';

    let W = 0;
    let H = 0;
    let ground = 0;
    let horseH = 0;
    let horseW = 0;
    let hx = 0;
    let peak = 0; // altura del salto, en px
    let gravity = 0;
    let v0 = 0;

    let state = 'idle'; // idle | run | over
    let overAt = 0;
    let y = 0; // altura del caballo sobre el suelo (>= 0)
    let vy = 0;
    let dist = 0;
    let speed = 0;
    let obstacles = [];
    let nextGap = 0;
    let clock = 0;
    let best = 0;
    try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* storage unavailable */ }

    // Sprite teñido con el color del texto (se vuelve a teñir si cambia el tema).
    const sheet = document.createElement('canvas');
    const img = new Image();
    let ready = false;
    let tintedFor = '';
    const tint = () => {
        if (!ready) return;
        tintedFor = root.dataset.theme || '';
        sheet.width = img.width;
        sheet.height = img.height;
        const c = sheet.getContext('2d');
        c.globalCompositeOperation = 'source-over';
        c.clearRect(0, 0, sheet.width, sheet.height);
        c.drawImage(img, 0, 0);
        c.globalCompositeOperation = 'source-in';
        c.fillStyle = css('--fg');
        c.fillRect(0, 0, sheet.width, sheet.height);
    };
    img.onload = () => { ready = true; tint(); };
    img.src = SPRITE;

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ground = H - 22;
        horseH = Math.min(120, H * 0.5);
        horseW = (horseH * FW) / FH;
        hx = Math.max(16, W * 0.08);
        peak = Math.min(horseH * 0.8, ground - horseH - 6);
        const air = 0.55; // segundos en el aire
        gravity = (8 * peak) / (air * air);
        v0 = (4 * peak) / air;
    }
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    function reset() {
        state = 'run';
        y = 0;
        vy = 0;
        dist = 0;
        speed = 380;
        obstacles = [];
        nextGap = 520;
    }

    function jump() {
        if (state === 'idle') { reset(); return; }
        if (state === 'over') { if (performance.now() - overAt > 400) reset(); return; }
        if (y <= 0.5) { vy = v0; sound.play('jump', 0.95 + Math.random() * 0.1); }
    }

    const onKey = (e) => {
        if (e.code !== 'Space' && e.key !== 'ArrowUp' && e.key !== 'w' && e.key !== 'W') return;
        if (e.target.closest?.('input, textarea, select')) return;
        e.preventDefault();
        if (!e.repeat) jump();
    };
    const onDown = (e) => { e.preventDefault(); jump(); };
    addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onDown);

    function spawn() {
        const w = 14 + Math.random() * 14;
        const h = 22 + Math.random() * Math.min(22, peak * 0.4); // tope ~44 px: con el salto más bajo (celular) siempre se pasa
        const group = Math.random() < 0.3 ? 2 : 1; // a veces dos juntos
        for (let k = 0; k < group; k++) obstacles.push({ x: W + 20 + k * (w + 6), w, h: h * (k ? 0.75 : 1) });
        nextGap = speed * (0.75 + Math.random() * 0.8) + 230;
    }

    function hits() {
        // Caja del caballo más chica que el sprite (la crin y la cola no cuentan).
        const l = hx + horseW * 0.3;
        const r = hx + horseW * 0.72;
        const b = ground - y - horseH * 0.1;
        const t = ground - y - horseH * 0.82;
        return obstacles.some((o) => r > o.x && l < o.x + o.w && b > ground - o.h && t < ground);
    }

    function update(dt) {
        if (state !== 'run') return;
        const score = Math.floor(dist / 20);
        speed = Math.min(780, 380 + score * 3);
        dist += speed * dt;
        vy -= gravity * dt;
        y = Math.max(0, y + vy * dt);
        if (y === 0 && vy < 0) vy = 0;
        obstacles.forEach((o) => { o.x -= speed * dt; });
        obstacles = obstacles.filter((o) => o.x + o.w > -10);
        const lastX = obstacles.length ? obstacles[obstacles.length - 1].x : -Infinity;
        if (W - lastX > nextGap) spawn();
        if (hits()) {
            state = 'over';
            overAt = performance.now();
            sound.play('crash');
            const s = Math.floor(dist / 20);
            if (s > best) {
                best = s;
                try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* storage unavailable */ }
            }
        }
    }

    function drawObstacle(o, color) {
        const cell = 3;
        ctx.fillStyle = color;
        const x0 = Math.round(o.x / cell);
        const cols = Math.round(o.w / cell);
        const rows = Math.round(o.h / cell);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Más denso hacia abajo: el obstáculo "nace" del suelo.
                const level = 0.45 + 0.5 * (r / rows);
                if (BAYER[((r & 3) << 2) | ((x0 + c) & 3)] / 16 < level) ctx.fillRect((x0 + c) * cell, ground - (rows - r) * cell, cell, cell);
            }
        }
    }

    function draw(now) {
        const fg = css('--fg');
        const muted = css('--muted');
        ctx.clearRect(0, 0, W, H);

        // Suelo: una línea y marcas que corren con la distancia.
        ctx.fillStyle = muted;
        ctx.fillRect(0, ground, W, 1);
        const off = dist % 48;
        for (let x = -off; x < W; x += 48) ctx.fillRect(x + 12, ground + 6, 6, 2);
        for (let x = -off * 0.6; x < W; x += 80) ctx.fillRect(x + 30, ground + 12, 3, 2);

        obstacles.forEach((o) => drawObstacle(o, fg));

        // Caballo: galopa en el suelo, estirado en el aire, quieto antes de empezar y tirado al perder.
        if (ready) {
            if (tintedFor !== (root.dataset.theme || '')) tint();
            const frame = state === 'run' && y <= 0.5 ? Math.floor(clock * FPS) % FRAMES : state === 'idle' ? 0 : 3;
            ctx.drawImage(sheet, (frame % COLS) * FW, Math.floor(frame / COLS) * FH, FW, FH, hx, ground - y - horseH * 1.03, horseW, horseH);
        }

        ctx.font = '500 14px "Roboto Mono", ui-monospace, monospace';
        ctx.textBaseline = 'top';
        ctx.fillStyle = muted;
        ctx.textAlign = 'right';
        ctx.fillText(`HI ${pad(best)}   ${pad(Math.floor(dist / 20))}`, W - 4, 4);

        ctx.textAlign = 'center';
        if (state === 'idle') ctx.fillText('ESPACIO O TOQUE PARA EMPEZAR', W / 2, H * 0.3);
        if (state === 'over') {
            ctx.fillStyle = fg;
            ctx.fillText('FIN · ESPACIO O TOQUE PARA REINTENTAR', W / 2, H * 0.3);
        }
        void now;
    }

    let raf = 0;
    let prev = 0;
    const frame = (now) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - prev) / 1000 || 0);
        prev = now;
        clock += dt;
        update(dt);
        draw(now);
    };
    raf = requestAnimationFrame(frame);

    return () => {
        cancelAnimationFrame(raf);
        removeEventListener('keydown', onKey);
        canvas.removeEventListener('pointerdown', onDown);
        ro?.disconnect();
    };
}
