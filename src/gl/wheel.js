import * as THREE from 'three';
import gsap from 'gsap';
import { imageMaterial } from './items.js';
import { cursor } from '../core/cursor.js';
import { reduced } from '../core/scroll.js';
import { sound } from '../core/sound.js';

const mod = (a, n) => ((a % n) + n) % n;

/**
 * A wheel of cover cards. The cards ride the top arc of a large circle; turning the wheel
 * (scroll, drag, swipe, arrows) slides each card along the arc and tilts it by its angle.
 *
 *   projects    [{ cover:{src,w,h}, ... }]
 *   onFrame     (pos, active) every frame, pos = continuous index (drives the DOM title list)
 *   onActive    (index) when the centred card changes
 *   onOpen      (index) when the centred card is clicked / Enter is pressed
 */
export function createWheel(G, { projects, hit, onFrame, onActive, onOpen }) {
    const N = projects.length;
    const wrap = (d) => d - N * Math.round(d / N);

    const cards = projects.map((p, i) => {
        const mat = imageMaterial(G);
        mat.uniforms.uBorder.value = 5;
        mat.uniforms.uBorderColor.value.copy(G.U.uFg.value);
        const mesh = new THREE.Mesh(G.geo, mat);
        mesh.visible = false;
        G.scene.add(mesh);
        const card = { i, mesh, mat, loaded: false, d: 0, x: 0, y: 0, rot: 0 };
        G.loader.load(p.cover.src, (t) => {
            t.flipY = false;
            t.generateMipmaps = false;
            t.minFilter = THREE.LinearFilter;
            mat.uniforms.uTex.value = t;
            mat.uniforms.uImg.value.set(t.image.width, t.image.height);
            card.tex = t;
            card.loaded = true;
            gsap.to(mat.uniforms.uReveal, { value: 1, duration: 1, ease: 'power2.out', delay: 0.08 * i });
        });
        return card;
    });

    // Entrance: the wheel spins in from one side.
    let pos = reduced ? 0 : -1.6;
    let target = 0;
    let active = -1;
    let shown = true;
    let snapTimer;
    const geo = { cw: 0, ch: 0, R: 0, step: 0, cy: 0, spacing: 1 };

    function layout() {
        const { vw, vh } = G.frame;
        const mobile = vw < 800;
        geo.cw = mobile ? Math.min(vw * 0.58, vh * 0.36) : Math.min(Math.max(vw * 0.2, 170), 320);
        geo.ch = geo.cw * 1.25;
        geo.R = mobile ? vw * 1.1 : vw * 0.9;
        geo.step = mobile ? 0.4 : 0.33;
        geo.cy = vh * (mobile ? 0.55 : 0.655);
        geo.spacing = geo.R * geo.step;
    }

    function update() {
        layout();
        // Con el dedo abajo la rueda lo sigue casi pegada; suelta, en el celular frena un poco más rápido que en escritorio.
        pos += (target - pos) * (reduced ? 1 : drag ? 0.34 : G.frame.vw < 800 ? 0.12 : 0.085);
        const { vw } = G.frame;

        for (const c of cards) {
            const d = wrap(c.i - pos);
            const ad = Math.abs(d);
            const phi = d * geo.step;
            c.d = d;
            c.rot = phi;
            c.x = vw / 2 + geo.R * Math.sin(phi);
            c.y = geo.cy + geo.R * (1 - Math.cos(phi));

            const vis = shown && c.loaded && ad < 3;
            c.mesh.visible = vis;
            if (!vis) continue;
            c.mesh.position.set(c.x, c.y, -ad * 0.1);
            c.mesh.rotation.z = phi;
            c.mesh.scale.set(geo.cw, geo.ch, 1);
            const u = c.mat.uniforms;
            u.uSize.value.set(geo.cw, geo.ch);
            u.uVel.value = 0;
            u.uAlpha.value = 1 - Math.min(1, Math.max(0, ad - 2.0));
            u.uBorderColor.value.copy(G.U.uFg.value);
        }

        const a = mod(Math.round(pos), N);
        if (a !== active) {
            if (active !== -1) sound.play('tick', 1 + Math.min(0.1, Math.abs(target - pos) * 0.03) * (Math.random() < 0.5 ? -1 : 1));
            active = a;
            onActive?.(a);
        }
        onFrame?.(pos, active);
    }

    /* ---------------- input ---------------- */
    function cardAt(px, py) {
        const order = [...cards].filter((c) => Math.abs(c.d) < 1.8).sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
        for (const c of order) {
            const dx = px - c.x;
            const dy = py - c.y;
            const lx = dx * Math.cos(c.rot) + dy * Math.sin(c.rot);
            const ly = -dx * Math.sin(c.rot) + dy * Math.cos(c.rot);
            if (Math.abs(lx) <= geo.cw / 2 && Math.abs(ly) <= geo.ch / 2) return c;
        }
        return null;
    }

    const snapSoon = () => {
        clearTimeout(snapTimer);
        snapTimer = setTimeout(() => { target = Math.round(target); }, 140);
    };
    const go = (n) => { target = Math.round(target) + n; };

    const onWheel = (e) => {
        e.preventDefault();
        const delta = Math.max(-120, Math.min(120, e.deltaY + e.deltaX));
        target += delta * 0.0035;
        snapSoon();
    };

    let drag = null;
    // En el celular el dedo recorre poco: con la distancia de escritorio (≈170 px por carta) la rueda se sentía pesada.
    const gain = () => (G.frame.vw < 800 ? 1.9 : 1);
    const onDown = (e) => {
        try { hit.setPointerCapture(e.pointerId); } catch { /* synthetic / already-released pointer */ }
        drag = { x: e.clientX, y: e.clientY, t: target, moved: 0, lx: e.clientX, ly: e.clientY, lt: performance.now(), v: 0 };
    };
    const onMove = (e) => {
        if (drag) {
            const dx = e.clientX - drag.x;
            const dy = e.clientY - drag.y;
            drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
            // Velocidad del dedo (px/ms, suavizada) para el empujón al soltar.
            const now = performance.now();
            drag.v = drag.v * 0.7 + (((e.clientX - drag.lx) + (e.clientY - drag.ly)) / Math.max(1, now - drag.lt)) * 0.3;
            drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
            target = drag.t + ((-dx - dy) * gain()) / geo.spacing;
            return;
        }
        const c = cardAt(e.clientX, e.clientY);
        cursor.hint(c ? (c.i === active ? 'Ver' : 'Ir') : null);
    };
    const onUp = (e) => {
        if (!drag) return;
        const wasClick = drag.moved < 6;
        // Un flick rápido sigue de largo (hasta 2,5 cartas); si el dedo se quedó quieto antes de soltar, no hay empujón.
        const v = performance.now() - drag.lt > 90 ? 0 : drag.v;
        const flick = Math.max(-2.5, Math.min(2.5, (-v * 220 * gain()) / geo.spacing));
        drag = null;
        if (wasClick) {
            const c = cardAt(e.clientX, e.clientY);
            if (c) {
                if (c.i === active) { sound.play('open'); onOpen?.(c.i); }
                else target = Math.round(target) + Math.round(c.d);
                return;
            }
        }
        target = Math.round(target + flick);
    };
    const onLeave = () => cursor.hint(null);
    const onKey = (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(-1);
        else if (e.key === 'Enter') { sound.play('open'); onOpen?.(active); }
    };

    addEventListener('wheel', onWheel, { passive: false });
    addEventListener('keydown', onKey);
    hit.addEventListener('pointerdown', onDown);
    hit.addEventListener('pointermove', onMove);
    hit.addEventListener('pointerup', onUp);
    hit.addEventListener('pointercancel', onUp);
    hit.addEventListener('pointerleave', onLeave);

    return {
        update,
        go,
        get active() { return active; },
        /** List view hides the cards but keeps the wheel's state (and scroll / key input) running. */
        setVisible(v) { shown = v; },
        goTo(i) { target = Math.round(target) + Math.round(wrap(i - Math.round(target))); },
        dispose() {
            clearTimeout(snapTimer);
            removeEventListener('wheel', onWheel);
            removeEventListener('keydown', onKey);
            hit.removeEventListener('pointerdown', onDown);
            hit.removeEventListener('pointermove', onMove);
            hit.removeEventListener('pointerup', onUp);
            hit.removeEventListener('pointercancel', onUp);
            hit.removeEventListener('pointerleave', onLeave);
            cursor.hint(null);
            for (const c of cards) {
                G.scene.remove(c.mesh);
                c.tex?.dispose();
                c.mat.dispose();
            }
        },
    };
}
