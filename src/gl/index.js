import * as THREE from 'three';
import gsap from 'gsap';
import common from './shaders/common.glsl?raw';
import transitionFrag from './shaders/transition.frag?raw';
import horseFrag from './shaders/horse.frag?raw';
import { createTextItem, createImageItem } from './items.js';
import { scroll, reduced } from '../core/scroll.js';
import { cssColor } from '../core/colors.js';
import { sound } from '../core/sound.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const CELL_CSS_PX = 3; // size of one dither cell, in CSS px

// Caballo de la transición (grilla de scripts/horse-sprite.mjs): se muestra al cerrarse la cortina y se queda `hold` segundos.
const HORSE = { src: '/images/transition/caballo.webp', cols: 5, rows: 2, frames: 10, fps: 16, hold: 0.55, fadeIn: 0.2, fadeOut: 0.2, cellPx: 2 };

export const gl = {
    ok: false,
    revealEnabled: false,
    items: [],
    seen: new WeakSet(), // elementos cuya animación de entrada ya se mostró

    init(canvas) {
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
        } catch {
            return false;
        }
        this.renderer = renderer;
        this.dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 2);
        renderer.setPixelRatio(this.dpr);
        renderer.setClearColor(0x000000, 0);

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 10);
        this.camera.position.z = 5;
        this.geo = new THREE.PlaneGeometry(1, 1);
        this.loader = new THREE.TextureLoader();

        // Uniforms shared by every material (same objects, so one write updates all).
        this.U = {
            uTime: { value: 0 },
            uFg: { value: new THREE.Vector3() },
            uCell: { value: CELL_CSS_PX * this.dpr },
            uMouse: { value: new THREE.Vector2(-9999, -9999) },
            uRes: { value: new THREE.Vector2(1, 1) },
        };
        this.frame = { vw: 1, vh: 1, vel: 0, reveal: false, mouse: { x: -9999, y: -9999 } };
        this.mouseTarget = new THREE.Vector2(-9999, -9999);
        this.syncColors();

        // Transition curtain (always on top).
        this.tMat = this.material(transitionFrag, {
            uProgress: { value: 0 },
            uDir: { value: 0 },
            uColor: { value: new THREE.Vector3(1, 1, 1) },
        });
        this.curtain = new THREE.Mesh(this.geo, this.tMat);
        this.curtain.renderOrder = 999;
        this.curtain.visible = false;
        this.scene.add(this.curtain);

        // Caballo: va sobre la cortina, centrado y chico, en el color opuesto al de ella.
        this.hMat = this.material(horseFrag, {
            uTex: { value: null },
            uColor: { value: new THREE.Vector3(1, 1, 1) },
            uGrid: { value: new THREE.Vector2(HORSE.cols, HORSE.rows) },
            uCell: { value: HORSE.cellPx * this.dpr },
            uReveal: { value: 0 },
            uFrame: { value: 0 },
        });
        this.horse = new THREE.Mesh(this.geo, this.hMat);
        this.horse.renderOrder = 1000;
        this.horse.visible = false;
        this.scene.add(this.horse);
        this.loader.load(HORSE.src, (t) => {
            t.flipY = false;
            t.generateMipmaps = false;
            t.minFilter = THREE.LinearFilter;
            this.hMat.uniforms.uTex.value = t;
            this.horseReady = true;
        });

        this.resize();
        // En el celular la barra del navegador aparece y desaparece al hacer scroll y dispara 'resize' solo con el alto: eso no necesita
        // rearmar nada (las imágenes siguen su rectángulo cada frame). Solo un cambio de ANCHO (rotar, redimensionar) re-escanea el texto.
        let lastW = window.innerWidth;
        addEventListener('resize', () => {
            this.resize();
            if (window.innerWidth !== lastW) { lastW = window.innerWidth; this.queueRebuild(); }
        });
        addEventListener('pointermove', (e) => {
            this.frame.mouse.x = e.clientX;
            this.frame.mouse.y = e.clientY;
            this.mouseTarget.set(e.clientX * this.dpr, (window.innerHeight - e.clientY) * this.dpr);
        }, { passive: true });
        gsap.ticker.add((t) => this.tick(t));

        this.ok = true;
        document.documentElement.classList.add('gl-on');
        return true;
    },

    /** ShaderMaterial with the shared uniforms + dither/noise helpers prepended. */
    material(frag, uniforms = {}) {
        return new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: `${common}\n${frag}`,
            uniforms: { ...this.U, ...uniforms },
            transparent: true,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
    },

    syncColors() {
        const [r, g, b] = cssColor('--fg');
        this.U.uFg.value.set(r, g, b);
    },

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h, false);
        this.camera.right = w;
        this.camera.bottom = h;
        this.camera.updateProjectionMatrix();
        this.frame.vw = w;
        this.frame.vh = h;
        this.renderer.getDrawingBufferSize(this.U.uRes.value);
        this.curtain.position.set(w / 2, h / 2, 1);
        this.curtain.scale.set(w, h, 1);
        const hw = w < 800 ? w * 0.5 : Math.min(Math.max(w * 0.2, 220), 340);
        this.horse.position.set(w / 2, h / 2, 2);
        this.horse.scale.set(hw, hw * 450 / 640, 1);
    },

    /** Re-scan a DOM root for [data-gl-text] / [data-gl-img] and (re)create their meshes. */
    async build(root = document) {
        if (!this.ok) return;
        this.clear();
        try {
            // Make sure every face the GL text will be painted with is actually loaded.
            const faces = new Set();
            root.querySelectorAll('[data-gl-text]').forEach((el) => {
                const cs = getComputedStyle(el);
                faces.add(`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`);
            });
            await Promise.all([...faces].map((f) => document.fonts.load(f)));
            await document.fonts.ready;
        } catch { /* ignore */ }
        this.root = root;
        let order = 0;
        root.querySelectorAll('[data-gl-text], [data-gl-img]').forEach((el) => {
            const item = el.hasAttribute('data-gl-text') ? createTextItem(el, this) : createImageItem(el, this);
            if (item) { item.delay = (order++ % 4) * 0.08; this.items.push(item); }
        });
    },

    clear() {
        this.items.forEach((i) => i.dispose());
        this.items = [];
    },

    queueRebuild() {
        clearTimeout(this._rb);
        this._rb = setTimeout(() => { if (this.root) this.build(this.root); }, 220);
    },

    enableReveal(on = true) {
        if (!this.ok) return;
        this.revealEnabled = on;
        this.frame.reveal = on;
        if (on && reduced) this.items.forEach((i) => { i.mat.uniforms.uReveal.value = 1; i.revealed = true; });
    },

    tick(time) {
        const U = this.U;
        U.uTime.value = reduced ? 0 : time;
        const m = U.uMouse.value;
        m.x += (this.mouseTarget.x - m.x) * 0.12;
        m.y += (this.mouseTarget.y - m.y) * 0.12;

        this.frame.vel = scroll.velocity;

        for (const item of this.items) item.update(item.el.getBoundingClientRect());
        this.wheel?.update(time);
        if (this.horse.visible) this.hMat.uniforms.uFrame.value = Math.floor((time - this._horseT0) * HORSE.fps) % HORSE.frames;
        this.renderer.render(this.scene, this.camera);
    },

    /* ---------------- dither curtain ---------------- */
    _sweep(from, to, dir, duration) {
        const u = this.tMat.uniforms;
        u.uDir.value = dir;
        u.uProgress.value = from;
        this.curtain.visible = true;
        document.documentElement.classList.add('gl-top'); // la cortina también tapa la navbar
        return new Promise((resolve) => {
            gsap.to(u.uProgress, {
                value: to, duration, ease: 'power2.inOut',
                onComplete: () => {
                    if (to === 0) { this.curtain.visible = false; this.horse.visible = false; document.documentElement.classList.remove('gl-top'); }
                    resolve();
                },
            });
        });
    },

    /** Cover the screen. Color = fondo del tema actual (negro en oscuro, claro en claro), congelado al empezar so a theme flip underneath is invisible. */
    cover(colorVar = '--bg') {
        if (!this.ok || reduced) return Promise.resolve();
        if (this._runTween) this._stopHorseRun(); // si el caballo del huevo de pascua está cruzando, la transición manda
        sound.play('wipeIn');
        this.tMat.uniforms.uColor.value.set(...cssColor(colorVar));
        this.hMat.uniforms.uColor.value.set(...cssColor(colorVar === '--bg' ? '--fg' : '--bg'));
        return this._sweep(0, 1, 0, 0.55).then(() => this._horseIn());
    },

    /** Huevo de pascua (5 clicks en el logo): el caballo cruza la pantalla galopando, en dither y en el color del texto. */
    horseRun() {
        if (!this.ok || reduced || this._runTween || this.curtain.visible || !this.horseReady) return;
        const { vw, vh } = this.frame;
        const hw = this.horse.scale.x * 1.3;
        this.hMat.uniforms.uColor.value.set(...cssColor('--fg'));
        this.hMat.uniforms.uReveal.value = 1;
        this._horseT0 = gsap.ticker.time;
        this.horse.scale.set(hw, (hw * 450) / 640, 1);
        this.horse.position.set(-hw / 2, vh * 0.55, 2);
        this.horse.visible = true;
        document.documentElement.classList.add('gl-top'); // por encima de la navbar, como la cortina
        const dur = (vw + hw) / Math.max(420, vw * 0.45);
        sound.play('gallopRun', 1, dur);
        this._runTween = gsap.to(this.horse.position, { x: vw + hw / 2, duration: dur, ease: 'none', onComplete: () => this._stopHorseRun() });
    },

    _stopHorseRun() {
        this._runTween?.kill();
        this._runTween = null;
        if (!this.curtain.visible) { this.horse.visible = false; document.documentElement.classList.remove('gl-top'); }
        this.resize(); // devuelve el caballo de la cortina a su tamaño y lugar (centrado)
    },

    /** El caballo aparece con dither sobre la cortina cerrada y galopa (en el sonido también). */
    _horseIn() {
        if (!this.horseReady) return;
        this._horseT0 = gsap.ticker.time;
        this.hMat.uniforms.uFrame.value = 0;
        this.hMat.uniforms.uReveal.value = 0;
        this.horse.visible = true;
        sound.play('gallop');
        gsap.to(this.hMat.uniforms.uReveal, { value: 1, duration: HORSE.fadeIn, ease: 'none', overwrite: true });
    },

    /** Si la cortina se abre antes de que el caballo haya galopado su ciclo, espera lo que falta. */
    async _horseOut() {
        if (!this.horse.visible) return;
        const wait = HORSE.hold - (gsap.ticker.time - this._horseT0);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait * 1000));
        gsap.to(this.hMat.uniforms.uReveal, { value: 0, duration: HORSE.fadeOut, ease: 'none', overwrite: true });
    },

    async uncover() {
        if (!this.ok || reduced) return;
        await this._horseOut();
        sound.play('wipeOut');
        return this._sweep(1, 0, 1, 0.6);
    },
};
