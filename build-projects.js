// Genera una página estática por proyecto (proyectos/<slug>.html) y el sitemap.xml
// a partir de projectsData (script.js) y la plantilla project.html.
// Así cada proyecto tiene su propio título, descripción y preview al compartirlo
// (WhatsApp, Instagram, LinkedIn no ejecutan JavaScript).
//
// Uso: node build-projects.js   (Netlify lo corre solo en cada deploy, ver netlify.toml)
const fs = require('fs');
const vm = require('vm');

const SITE = 'https://maximomazzuchin.com';
const OUT_DIR = 'proyectos';

// Carga script.js tal cual; el document falso alcanza porque todo lo que toca
// el DOM corre dentro de DOMContentLoaded.
const ctx = vm.createContext({ document: { addEventListener() {} } });
vm.runInContext(fs.readFileSync('script.js', 'utf8'), ctx);
const { projectsData, projectHeaderHtml, cardThumbnailUrl, projectUrl } = vm.runInContext(
    '({ projectsData, projectHeaderHtml, cardThumbnailUrl, projectUrl })', ctx);

const template = fs.readFileSync('project.html', 'utf8');
const META_BLOCK = /[ \t]*<!-- Plantilla:[\s\S]*?<!-- meta:end -->/;
const HEADER = /(<section class="project-title-header" id="dynamic-header">)\s*(<\/section>)/;
const DESCRIPTION = /(<p class="project-description" id="project-description">)(<\/p>)/;
const TYPE = /(<p class="project-type-text" id="project-type">)(<\/p>)/;
for (const re of [META_BLOCK, HEADER, DESCRIPTION, TYPE]) {
    if (!re.test(template)) throw new Error(`project.html cambió: no encuentro ${re}`);
}

const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR);

for (const p of projectsData) {
    const title = esc(`${p.title} — ${p.type} | Máximo Mazzuchin`);
    const description = esc(p.description);
    const url = `${SITE}/${projectUrl(p)}`;
    const image = `${SITE}/${cardThumbnailUrl(p)}`;
    const meta = `    <base href="/">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${url}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${url}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">`;

    const html = template
        .replace(META_BLOCK, () => meta)
        .replace('<body>', `<body data-slug="${esc(p.slug)}">`)
        .replace(HEADER, (_, open, close) => `${open}\n        ${projectHeaderHtml(p)}\n    ${close}`)
        .replace(DESCRIPTION, (_, open, close) => `${open}${esc(p.description)}${close}`)
        .replace(TYPE, (_, open, close) => `${open}${esc(p.type)}${close}`);

    fs.writeFileSync(`${OUT_DIR}/${p.slug}.html`, html);
}

const urls = ['', 'work.html', 'sobre-mi.html', ...projectsData.map(projectUrl)];
fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}/${u}</loc></url>`).join('\n')}
</urlset>
`);

console.log(`${projectsData.length} páginas en ${OUT_DIR}/ + sitemap.xml`);
