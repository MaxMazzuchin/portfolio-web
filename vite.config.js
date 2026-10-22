import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = import.meta.dirname;

/** URL pública del sitio: la pone Netlify (URL) o se define a mano con SITE_URL. Sin URL no se generan tags absolutos. */
const SITE = (process.env.SITE_URL || process.env.URL || '').replace(/\/+$/, '');
const NAME = 'Máximo Mazzuchin';

/** Inyecta src/partials/<name>.html donde las páginas ponen <!--shell:<name>-->, así head/header/footer viven en un solo lugar.
 *  <!--prerender:work-index--> (trabajo.html) se reemplaza por el índice de proyectos con links reales (views/work-index.js),
 *  para que buscadores y lectores sin JS vean los trabajos; en el navegador collection.js pinta el mismo índice encima. */
function shellPartials() {
    return {
        name: 'shell-partials',
        transformIndexHtml: {
            order: 'pre',
            async handler(html) {
                html = html.replace(/<!--shell:(\w+)-->/g, (_, name) => readFileSync(resolve(root, `src/partials/${name}.html`), 'utf8'));
                if (html.includes('<!--prerender:work-index-->')) {
                    const { workIndexHTML } = await import(pathToFileURL(resolve(root, 'src/views/work-index.js')).href);
                    html = html.replace('<!--prerender:work-index-->', () => workIndexHTML());
                }
                return html;
            },
        },
    };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/** Rutas públicas de cada página (el home es "/"). */
const routeOf = (file) => (file === 'index.html' ? '/' : `/${file}`);

/** Recorta un texto a `max` caracteres sin cortar palabras: para la meta description. */
const clip = (text, max = 160) => {
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    return cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.]+$/, '') + '…';
};

/** JSON-LD dentro de un <script>: el "<" se escapa para que un texto con "</script>" no cierre la etiqueta. */
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

/** Bloque de tags de compartir de una página. Va entre marcas para poder reemplazarlo en las páginas de proyecto. */
function seoBlock({ title, desc, url, image, alt = `${NAME}, diseñador gráfico en Córdoba, Argentina`, canonical = true, noindex = false, extra = [] }) {
    const tags = [
        '<meta name="theme-color" content="#000000">',
        '<meta property="og:type" content="website">',
        `<meta property="og:site_name" content="${NAME}">`,
        '<meta property="og:locale" content="es_AR">',
        `<meta property="og:title" content="${esc(title)}">`,
        `<meta property="og:description" content="${esc(desc)}">`,
        `<meta property="og:image" content="${image}">`,
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        `<meta property="og:image:alt" content="${esc(alt)}">`,
        '<meta name="twitter:card" content="summary_large_image">',
        `<meta name="twitter:title" content="${esc(title)}">`,
        `<meta name="twitter:description" content="${esc(desc)}">`,
        `<meta name="twitter:image" content="${image}">`,
        `<meta name="twitter:image:alt" content="${esc(alt)}">`,
    ];
    if (url && canonical) tags.push(`<link rel="canonical" href="${url}">`, `<meta property="og:url" content="${url}">`);
    if (noindex) tags.push('<meta name="robots" content="noindex">');
    tags.push(...extra);
    return `<!--seo-->\n    ${tags.join('\n    ')}\n    <!--/seo-->`;
}

/** og / twitter / canonical por página, a partir de su <title> y <meta description>; sitemap.xml y robots.txt al compilar.
 *  proyecto.html sirve todos los proyectos: al compilar se clona una página por proyecto en /proyecto/<slug>/ con su título,
 *  descripción e imagen, porque eso es lo que ven WhatsApp, LinkedIn o Google (el contenido lo arma JS, el <head> no). */
function seo() {
    return {
        name: 'seo',
        transformIndexHtml: {
            order: 'post',
            handler(html, ctx) {
                const file = (ctx.path || '/index.html').replace(/^\//, '') || 'index.html';
                const title = unesc((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim() || NAME);
                const desc = unesc((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
                const extra = [];
                if (file === 'index.html') {
                    extra.push(ld({
                        '@context': 'https://schema.org', '@type': 'Person', name: NAME, jobTitle: 'Diseñador gráfico',
                        description: desc, sameAs: ['https://instagram.com/mzz.dsg'],
                        address: { '@type': 'PostalAddress', addressLocality: 'Córdoba', addressCountry: 'AR' },
                        ...(SITE && { url: SITE }),
                    }));
                }
                // El proyecto.html genérico no tiene canonical: cada proyecto tiene el suyo en /proyecto/<slug>/.
                const block = seoBlock({
                    title, desc, url: SITE ? SITE + routeOf(file) : '', image: `${SITE}/og.png`,
                    canonical: !['404.html', 'proyecto.html'].includes(file), noindex: file === '404.html', extra,
                });
                return html.replace('</head>', `    ${block}\n</head>`);
            },
        },
        // Dev: /proyecto/<slug>/ lo sirve proyecto.html (en producción, las páginas clonadas de generateBundle).
        configureServer(server) {
            server.middlewares.use((req, _res, next) => {
                const m = /^\/proyecto\/[\w-]+\/?(\?.*)?$/.exec(req.url || '');
                if (m) req.url = '/proyecto.html' + (m[1] || '');
                next();
            });
        },
        // Preview: sirve dist/; "/proyecto/<slug>" sin la barra final también tiene que entrar.
        configurePreviewServer(server) {
            server.middlewares.use((req, _res, next) => {
                const m = /^\/proyecto\/([\w-]+)(\?.*)?$/.exec(req.url || '');
                if (m) req.url = `/proyecto/${m[1]}/${m[2] || ''}`;
                next();
            });
        },
        generateBundle: {
            order: 'post',
            async handler(_opts, bundle) {
                const { projects, projectUrl, known } = await import(pathToFileURL(resolve(root, 'src/data/work.js')).href);
                const { renderProject } = await import(pathToFileURL(resolve(root, 'src/views/project-html.js')).href);
                if (!SITE) this.warn('Sin SITE_URL ni URL: og:image, og:url y canonical quedan relativos y las vistas previas de links no muestran imagen. En Netlify URL ya viene; para compilar a mano: SITE_URL=https://... npm run build');

                // Una página por proyecto, a partir del proyecto.html ya procesado (con sus scripts y estilos hasheados).
                const generic = bundle['proyecto.html'];
                if (generic?.type === 'asset') {
                    const sharp = (await import('sharp')).default;
                    const base = String(generic.source);
                    for (const p of projects) {
                        const c = p.case;
                        const title = `${p.title} — ${p.type} | ${NAME}`;
                        const desc = clip((c && known(c.context) ? c.context : p.description) || '');
                        const route = projectUrl(p.slug);

                        // Imagen para compartir: la portada entera sobre negro a 1200×630 (la original pesa varios MB y los chats la ignoran).
                        let image = `${SITE}/og.png`;
                        try {
                            const jpg = await sharp(resolve(root, 'public' + p.cover.src))
                                .resize(1200, 630, { fit: 'contain', background: '#000' }).flatten({ background: '#000' })
                                .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
                            this.emitFile({ type: 'asset', fileName: `og/${p.slug}.jpg`, source: jpg });
                            image = `${SITE}/og/${p.slug}.jpg`;
                        } catch (err) {
                            this.warn(`og:image de ${p.slug}: ${err.message}. Queda la imagen general.`);
                        }

                        const block = seoBlock({
                            title, desc, url: SITE ? SITE + route : '', image, alt: `${p.title}, ${p.type.toLowerCase()} de ${NAME}`,
                            extra: [ld({
                                '@context': 'https://schema.org', '@type': 'CreativeWork', name: p.title, genre: p.type, description: desc,
                                image, creator: { '@type': 'Person', name: NAME }, ...(c && known(c.year) && { dateCreated: c.year }), ...(SITE && { url: SITE + route }),
                            })],
                        });
                        const page = base
                            .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`)
                            .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${esc(desc)}">`)
                            .replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, () => block)
                            // El contenido del proyecto ya en el HTML: buscadores, vistas previas y lectores sin JS lo ven; project.js lo reutiliza.
                            .replace(/(<main data-router-view data-page="project")>\s*<\/main>/, (_, open) => `${open}>${renderProject(p)}</main>`);
                        if (!page.includes(`data-project="${p.slug}"`)) this.error(`No se pudo pre-renderizar ${p.slug}: falta <main data-router-view data-page="project"></main> en proyecto.html.`);
                        this.emitFile({ type: 'asset', fileName: `proyecto/${p.slug}/index.html`, source: page });
                    }
                }

                if (!SITE) return; // sin URL absoluta un sitemap no sirve
                const urls = [
                    ...['index.html', 'trabajo.html', 'biblioteca.html', 'sobre-mi.html'].map(routeOf),
                    ...projects.map((p) => projectUrl(p.slug)),
                ];
                const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(SITE + u)}</loc></url>`).join('\n')}\n</urlset>\n`;
                this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: xml });
                this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n` });
            },
        },
    };
}

export default defineConfig({
    plugins: [shellPartials(), seo()],
    build: {
        rollupOptions: {
            input: {
                main: resolve(root, 'index.html'),
                trabajo: resolve(root, 'trabajo.html'),
                biblioteca: resolve(root, 'biblioteca.html'),
                sobremi: resolve(root, 'sobre-mi.html'),
                proyecto: resolve(root, 'proyecto.html'),
                notfound: resolve(root, '404.html'),
            },
            output: {
                // Three.js y GSAP/Lenis en chunks aparte: cachean entre deploys y bajan en paralelo con el código propio.
                manualChunks(id) {
                    if (id.includes('node_modules/three')) return 'three';
                    if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'motion';
                },
            },
        },
    },
});
