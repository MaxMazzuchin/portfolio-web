// =========================================
// 0. CONFIG
// =========================================
// ID de Google Analytics 4 (formato "G-XXXXXXXXXX"). Vacío = sin tracking.
const GA_ID = '';

// =========================================
// 1. BASE DE DATOS (CMS)
// Después de agregar/editar un proyecto: `node build-projects.js`
// (Netlify lo corre solo en cada deploy).
// =========================================
const projectsData = [
    {
        title: "ALBUM ARTWORK",
        slug: "album-artwork",
        imageFolder: "images/projects/album-artwork",
        description: "Recopilación de arte de tapa para artistas. El enfoque personal fue tipográfico y de alto contraste, evitando la representación literal para construir narrativas visuales que funcionan tanto en digital como en gran formato físico.",
        type: "Arte de tapa / Dirección de arte",
        verticalImgCount: 11,
        masonryImgCount: 0
    },
    {
        title: "PONÉ ATENCIÓN",
        slug: "pone-atencion",
        imageFolder: "images/projects/pone-atencion",
        description: "Arte y sistema visual para el segundo álbum de Sin Datos. El concepto pivotó sobre lo analógico: mixed media, trazos manuales y elementos orgánicos integrados directamente en la composición. El resultado rompe la rigidez digital y le da carácter propio al lanzamiento.",
        type: "Arte de tapa / Dirección de arte",
        verticalImgCount: 6,
        masonryImgCount: 0
    },
    {
        title: "SIN DATOS",
        slug: "sin-datos",
        imageFolder: "images/projects/sin-datos",
        description: "Desarrollo de piezas gráficas para comunicación digital de Sin Datos, banda de rock emergente argentina. Flyers promocionales para shows y contenido para redes sociales.",
        type: "Comunicación digital / Redes sociales",
        verticalImgCount: 0,
        masonryImgCount: 14
    },
    {
        title: "I-LIFE",
        slug: "i-life",
        imageFolder: "images/projects/i-life",
        description: "Once11 es una cápsula de estampas y gráficas para I-Life, una marca de ropa deportiva con más de 10 años en el mercado. El enfoque fue streetwear con referencias urbanas del barrio de Once, modernizando la imagen de la marca para conectar con un público más joven sin abandonar sus valores de origen.",
        type: "Diseño de estampas / Dirección de arte",
        verticalImgCount: 12,
        masonryImgCount: 10
    },
    {
        title: "OUTFRAME",
        slug: "outframe",
        imageFolder: "images/projects/outframe",
        description: "Proyecto editorial sobre el fotógrafo Chema Madoz, realizado para una estudiante universitaria en España. Desarrollé la identidad visual completa: tipografías, paleta, maquetación y estructura editorial. El resultado fue una publicación con jerarquías claras y nivel estético profesional.",
        type: "Diseño editorial",
        verticalImgCount: 7,
        masonryImgCount: 0
    },
    {
        title: "EXPERIMENTACIÓN GRÁFICA",
        slug: "exp-grafica",
        imageFolder: "images/projects/exp-grafica",
        description: "Un laboratorio visual en curso. Cada pieza es una excusa para expandir el vocabulario gráfico más allá de las soluciones predecibles, con base técnica suficiente como para que lo disruptivo no pierda claridad.",
        type: "Exploración visual / Personal",
        verticalImgCount: 0,
        masonryImgCount: 43
    },
    {
        title: "100 POSTERS",
        slug: "100-posters",
        imageFolder: "images/projects/100-posters",
        description: "100 piezas únicas diseñadas en 24 horas. Un ejercicio de resistencia creativa donde el desafío no era solo el volumen, sino no repetirse. La solución fue apoyarse en sistemas de diseño ágiles y decisiones tipográficas veloces sin sacrificar impacto visual.",
        type: "Exploración visual / Personal",
        verticalImgCount: 0,
        masonryImgCount: 99
    },
    {
        title: "D2X",
        slug: "d2x",
        imageFolder: "images/projects/d2x",
        description: "Publicación editorial para D2X, artista emergente de Chicago, construida a partir de una entrevista exclusiva. El trabajo consistió en estructurar y diseñar la pieza entera, reflejando su discurso e identidad en un resultado coherente y documental.",
        type: "Identidad Visual",
        verticalImgCount: 1,
        masonryImgCount: 0
    },
    {
        title: "NYRO",
        slug: "nyro",
        imageFolder: "images/projects/nyro",
        description: "Identidad de marca para Nyro, una empresa de analytics orientada a la toma de decisiones basada en datos. El desafío fue darle forma visual al concepto del equipo sin caer en los clichés de la competencia.",
        type: "Dirección de arte / Identidad de marca",
        verticalImgCount: 9,
        masonryImgCount: 0
    },
    {
        title: "TOUCHDESIGNER",
        role: "Motion Design / TouchDesigner",
        slug: "touchdesigner",
        coverImage: "assets/projects/touchdesigner/video-1.mp4",
        posterImage: "assets/projects/touchdesigner/cover.webp",
        galleryItems: [
            "assets/projects/touchdesigner/video-2.mp4",
            "assets/projects/touchdesigner/video-3.mp4",
            "assets/projects/touchdesigner/video-4.mp4",
            "assets/projects/touchdesigner/video-5.mp4",
            "assets/projects/touchdesigner/video-6.mp4",
            "assets/projects/touchdesigner/video-7.mp4"
        ],
        description: "Piezas generativas y en vivo hechas en TouchDesigner: loops, sistemas reactivos y salidas para pantalla. El foco está en motion claro, ritmo y una estética directa, sin ornamentos de más.",
        type: "Motion Design / TouchDesigner"
    }
];

/** Hero title HTML: two lines for Experimentación Gráfica (first word / rest). */
function projectHeroTitleHtml(project) {
    if (project.slug === 'exp-grafica') {
        const i = project.title.indexOf(' ');
        if (i <= 0) return `(${project.title})`;
        return `(${project.title.slice(0, i)}<br>${project.title.slice(i + 1)})`;
    }
    if (project.slug === 'touchdesigner') {
        return `(TOUCH<br>DESIGNER)`;
    }
    return `(${project.title})`;
}

/** Header gigante del proyecto. Lo usan esta página y build-projects.js (pre-render). */
function projectHeaderHtml(project) {
    const classes = ['title-wrapper'];
    if (project.slug === 'i-life' || project.slug === '100-posters') classes.push('title-wrapper--single-line');
    if (project.slug === 'exp-grafica') classes.push('title-wrapper--fit');
    if (project.slug === 'touchdesigner') classes.push('title-wrapper--touchdesigner');
    return `<div class="${classes.join(' ')}"><h1 class="title-giant">${projectHeroTitleHtml(project)}</h1></div>`;
}

/** Página estática del proyecto (generada por build-projects.js). */
function projectUrl(project) {
    return `proyectos/${project.slug}.html`;
}

/** After innerHTML injection, nudge layout so .title-wrapper slideUp runs once (no Intersection Observer). */
function kickTitleReveal(rootEl) {
    if (!rootEl || !rootEl.querySelector('.title-wrapper')) return;
    requestAnimationFrame(() => {
        void rootEl.offsetWidth;
    });
}

// =========================================
// 2. LIGHTBOX (clicks + Esc / arrow keys in lightbox only)
// =========================================
let currentLightboxIndex = 0;
/** @type {{ src: string, media: 'image' | 'video' }[]} */
let lightboxItems = [];
/** 1 = base; `LIGHTBOX_ZOOM_SCALE` = one-step +35% zoom (toggle on stage click) */
let currentZoom = 1;
const LIGHTBOX_ZOOM_SCALE = 1.35;

const VIDEO_URL_RE = /\.(mp4|mov|webm)(\?.*)?$/i;

function isVideoUrl(url) {
    return VIDEO_URL_RE.test(String(url || '').split('#')[0]);
}

function configureGalleryVideo(video, { eager = true } = {}) {
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.disablePictureInPicture = true;
    video.controls = false;
    video.setAttribute('playsinline', '');
    video.setAttribute('disablePictureInPicture', '');
    // Eager: hero/lightbox video, plays immediately. Lazy: gallery-body video,
    // only fetched/played once it actually scrolls into view (see lazyVideoObserver).
    video.autoplay = eager;
    video.preload = eager ? 'metadata' : 'none';
}

/** Plays/pauses lazy gallery videos as they enter/leave the viewport, so a
 * project page never downloads more than one screenful of video at a time. */
let lazyVideoObserver = null;
function getLazyVideoObserver() {
    if (lazyVideoObserver) return lazyVideoObserver;
    lazyVideoObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const video = entry.target;
            if (entry.isIntersecting) {
                video.play().catch(() => {});
            } else {
                video.pause();
            }
        });
    }, { rootMargin: '200px 0px' });
    return lazyVideoObserver;
}

function resetLightboxVideo(video) {
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    while (video.firstChild) video.removeChild(video.firstChild);
    video.load();
}

function setLightboxOpen(isOpen) {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    lightbox.classList.toggle('is-open', isOpen);
    lightbox.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    document.body.style.overflow = isOpen ? 'hidden' : '';
}

function updateLightboxNavVisibility() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    if (!prevBtn || !nextBtn) return;
    const hide = lightboxItems.length <= 1;
    prevBtn.classList.toggle('hidden', hide);
    nextBtn.classList.toggle('hidden', hide);
}

function getLightboxStage() {
    return document.getElementById('lightbox-stage');
}

function resetLightboxStageTransform() {
    const stage = getLightboxStage();
    currentZoom = 1;
    if (stage) stage.style.transform = 'translate3d(0,0,0) scale(1)';
}

function syncLightboxMedia() {
    const item = lightboxItems[currentLightboxIndex];
    const stage = getLightboxStage();
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxVideo = document.getElementById('lightbox-video');
    if (!item || !stage || !lightboxImg || !lightboxVideo) return;

    if (item.media === 'video') {
        lightboxImg.classList.add('lightbox-asset--hidden');
        lightboxImg.removeAttribute('src');
        lightboxVideo.classList.remove('lightbox-asset--hidden');
        configureGalleryVideo(lightboxVideo);
        lightboxVideo.src = item.src;
        lightboxVideo.load();
        lightboxVideo.play().catch(() => {});
    } else {
        resetLightboxVideo(lightboxVideo);
        lightboxVideo.classList.add('lightbox-asset--hidden');
        lightboxImg.classList.remove('lightbox-asset--hidden');
        lightboxImg.src = item.src;
    }
}

function openLightbox(index) {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox || lightboxItems.length === 0) return;

    currentLightboxIndex = index;
    resetLightboxStageTransform();
    syncLightboxMedia();
    updateLightboxNavVisibility();
    setLightboxOpen(true);
}

function changeImage(step) {
    if (lightboxItems.length === 0) return;
    resetLightboxStageTransform();
    currentLightboxIndex = (currentLightboxIndex + step + lightboxItems.length) % lightboxItems.length;
    syncLightboxMedia();
    updateLightboxNavVisibility();
}

function toggleLightboxZoom() {
    const stage = getLightboxStage();
    if (!stage) return;
    currentZoom = currentZoom === 1 ? LIGHTBOX_ZOOM_SCALE : 1;
    stage.style.transform = `translate3d(0,0,0) scale(${currentZoom})`;
}

function closeLightbox() {
    const lightboxVideo = document.getElementById('lightbox-video');
    resetLightboxStageTransform();
    resetLightboxVideo(lightboxVideo);
    if (lightboxVideo) lightboxVideo.classList.add('lightbox-asset--hidden');
    const lightboxImg = document.getElementById('lightbox-img');
    if (lightboxImg) {
        lightboxImg.classList.remove('lightbox-asset--hidden');
    }
    setLightboxOpen(false);
}

function onLightboxStageClick(e) {
    e.stopPropagation();
    toggleLightboxZoom();
}

function isLightboxOpen() {
    const lightbox = document.getElementById('lightbox');
    return lightbox && lightbox.classList.contains('is-open');
}

// =========================================
// 2B. FUNCIÓN PARA RENDERIZAR GALERÍA
// =========================================
function coverImageUrl(project) {
    return project.coverImage || `${project.imageFolder}/cover.webp`;
}

/** Static thumbnail for cards (work grid, home, "other projects") — never a
 * video, so browsing the site never triggers autoplaying downloads. */
function cardThumbnailUrl(project) {
    return project.posterImage || coverImageUrl(project);
}

function pushLightboxItem(src, media) {
    lightboxItems.push({ src, media });
    return lightboxItems.length - 1;
}

function appendGalleryCover(coverItem, project) {
    const url = coverImageUrl(project);
    if (isVideoUrl(url)) {
        const video = document.createElement('video');
        video.className = 'gallery-video gallery-cover-video';
        video.src = url;
        configureGalleryVideo(video);
        video.setAttribute('aria-label', `${project.title} cover`);
        video.style.cursor = 'pointer';
        video.dataset.lbIndex = String(pushLightboxItem(url, 'video'));
        coverItem.appendChild(video);
    } else {
        const coverImg = document.createElement('img');
        coverImg.src = url;
        coverImg.alt = `${project.title} cover`;
        coverImg.loading = 'lazy';
        coverImg.style.cursor = 'pointer';
        coverImg.dataset.lbIndex = String(pushLightboxItem(coverImg.src, 'image'));
        coverItem.appendChild(coverImg);
    }
}

function appendGalleryMedia(parent, url, projectTitle, kindLabel, index) {
    const isVideo = isVideoUrl(url);
    const idx = pushLightboxItem(url, isVideo ? 'video' : 'image');

    if (isVideo) {
        const wrap = document.createElement('div');
        wrap.className = 'gallery-cell gallery-cell--video';
        const video = document.createElement('video');
        video.className = 'gallery-item gallery-video lazy-video';
        video.src = url;
        configureGalleryVideo(video, { eager: false });
        video.setAttribute('aria-label', `${projectTitle} — ${kindLabel} ${index}`);
        video.dataset.lbIndex = String(idx);
        video.style.cursor = 'pointer';
        wrap.appendChild(video);
        parent.appendChild(wrap);
    } else {
        const img = document.createElement('img');
        img.className = 'gallery-item';
        img.src = url;
        img.alt = `${projectTitle} — ${kindLabel} ${index}`;
        img.loading = 'lazy';
        img.style.cursor = 'pointer';
        img.dataset.lbIndex = String(idx);
        parent.appendChild(img);
    }
}

function renderGalleryLegacyLayout(galleryContainer, project) {
    const coverItem = document.createElement('div');
    coverItem.className = 'gallery-cover';
    appendGalleryCover(coverItem, project);
    galleryContainer.appendChild(coverItem);

    if (project.verticalImgCount && project.verticalImgCount > 0) {
        const verticalContainer = document.createElement('div');
        verticalContainer.className = 'gallery-vertical';
        for (let i = 1; i <= project.verticalImgCount; i++) {
            const url = `${project.imageFolder}/image-${i}.webp`;
            appendGalleryMedia(verticalContainer, url, project.title, 'Gallery image', i);
        }
        galleryContainer.appendChild(verticalContainer);
    }

    if (project.masonryImgCount && project.masonryImgCount > 0) {
        const masonryContainer = document.createElement('div');
        masonryContainer.className = 'gallery-masonry';
        for (let i = 1; i <= project.masonryImgCount; i++) {
            const url = `${project.imageFolder}/grid-${i}.webp`;
            appendGalleryMedia(masonryContainer, url, project.title, 'Grid image', i);
        }
        galleryContainer.appendChild(masonryContainer);
    }
}

/** One-video-at-a-time carousel (used for video galleryItems, e.g. TouchDesigner):
 * only the piece currently on screen ever has a src, so browsing never
 * downloads more than one video no matter how many pieces the project has. */
function renderGalleryItemsLayout(galleryContainer, project) {
    const coverItem = document.createElement('div');
    coverItem.className = 'gallery-cover';
    appendGalleryCover(coverItem, project);
    galleryContainer.appendChild(coverItem);

    const verticalContainer = document.createElement('div');
    verticalContainer.className = 'gallery-vertical';
    project.galleryItems.forEach((url, i) => {
        appendGalleryMedia(verticalContainer, url, project.title, 'Piece', i + 1);
    });
    galleryContainer.appendChild(verticalContainer);
}

function renderGallery(gallery, project) {
    if (!gallery) return;

    lightboxItems = [];
    currentLightboxIndex = 0;
    gallery.innerHTML = '';

    const galleryContainer = document.createElement('div');
    galleryContainer.className = 'gallery-container project-gallery';

    galleryContainer.addEventListener('click', (e) => {
        const el = e.target.closest('img[data-lb-index], video[data-lb-index]');
        if (!el || !galleryContainer.contains(el)) return;
        const idx = parseInt(el.dataset.lbIndex, 10);
        if (!Number.isNaN(idx)) openLightbox(idx);
    });

    if (Array.isArray(project.galleryItems) && project.galleryItems.length > 0) {
        renderGalleryItemsLayout(galleryContainer, project);
    } else {
        renderGalleryLegacyLayout(galleryContainer, project);
    }

    gallery.appendChild(galleryContainer);

    galleryContainer.querySelectorAll('video.lazy-video').forEach((video) => {
        getLazyVideoObserver().observe(video);
    });
}

// =========================================
// 3. FUNCIÓN PARA CREAR TARJETAS
// =========================================
function createProjectCard(project) {
    const card = document.createElement('a');
    card.href = projectUrl(project);
    card.className = 'project-card';

    const media = document.createElement('div');
    media.className = 'project-card-media';

    const img = document.createElement('img');
    img.className = 'project-image';
    img.src = cardThumbnailUrl(project);
    img.alt = `${project.title} — ${project.type}`;
    img.loading = 'lazy';

    img.onerror = function() {
        const placeholder = document.createElement('div');
        placeholder.className = 'img-placeholder';
        this.parentNode.replaceChild(placeholder, this);
    };

    media.appendChild(img);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'project-info';
    infoDiv.innerHTML = `
        <h2>(${project.title})</h2>
        <p class="project-card-type">${project.type}</p>
    `;

    card.appendChild(media);
    card.appendChild(infoDiv);
    return card;
}

// =========================================
// 2B. CREAR TARJETA PARA "OTHER PROJECTS"
// =========================================
function createOtherProjectCard(project) {
    const card = document.createElement('a');
    card.href = projectUrl(project);
    card.className = 'other-project-card';

    const media = document.createElement('div');
    media.className = 'other-project-card-media';

    const imageElement = document.createElement('img');
    imageElement.className = 'other-project-card-image';
    imageElement.src = cardThumbnailUrl(project);
    imageElement.alt = project.title;
    imageElement.loading = 'lazy';

    imageElement.onerror = function() {
        const placeholder = document.createElement('div');
        placeholder.className = 'img-placeholder';
        this.parentNode.replaceChild(placeholder, this);
    };

    media.appendChild(imageElement);

    const titleElement = document.createElement('h3');
    titleElement.className = 'other-project-card-title';
    titleElement.textContent = project.title;

    const typeElement = document.createElement('p');
    typeElement.className = 'other-project-card-type';
    typeElement.textContent = project.type;

    card.appendChild(media);
    card.appendChild(typeElement);
    card.appendChild(titleElement);

    return card;
}

// =========================================
// 2C. FUNCIÓN PARA SHUFFLE ARRAY
// =========================================
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// =========================================
// 3. LÓGICA DE RUTAS E INYECCIÓN DE DATOS
// =========================================
document.addEventListener('DOMContentLoaded', () => {

    // Google Analytics 4 (solo si GA_ID está cargado arriba de todo).
    if (GA_ID) {
        const gaScript = document.createElement('script');
        gaScript.async = true;
        gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
        document.head.appendChild(gaScript);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', GA_ID);

        // Conversiones: clic en el email (lead) o en Instagram.
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="mailto:"], a[href*="instagram.com"]');
            if (!link) return;
            const isMail = link.href.startsWith('mailto:');
            window.gtag('event', isMail ? 'generate_lead' : 'click_instagram', { link_url: link.href });
        });
    }

    // Intro (index.html): plays once per browser session, skippable.
    const introOverlay = document.getElementById('intro-overlay');
    if (introOverlay) {
        let alreadyShown = false;
        try {
            alreadyShown = sessionStorage.getItem('introShown') === '1';
        } catch (e) {}

        if (alreadyShown) {
            introOverlay.remove();
        } else {
            document.body.style.overflow = 'hidden';
            const introVideo = document.getElementById('intro-video');
            const introSkipBtn = document.getElementById('intro-skip-btn');
            const endIntro = () => {
                try { sessionStorage.setItem('introShown', '1'); } catch (e) {}
                introOverlay.classList.add('intro-overlay--hidden');
                document.body.style.overflow = '';
                setTimeout(() => introOverlay.remove(), 500);
            };
            if (introVideo) {
                introVideo.addEventListener('ended', endIntro);
                // Autoplay bloqueado (iOS en modo ahorro), error de red o video
                // trabado: nunca dejar al visitante frente a una pantalla negra.
                introVideo.addEventListener('error', endIntro);
                const playing = introVideo.play();
                if (playing) playing.catch(endIntro);
                setTimeout(endIntro, 8000); // ponytail: el intro dura ~5s; ajustar si cambia el video
            }
            if (introSkipBtn) introSkipBtn.addEventListener('click', endIntro);
        }
    }

    // A. Renderizado para la Home (index.html)
    const homeGrid = document.getElementById('projects-grid');
    if (homeGrid) {
        const featuredSlugs = ['exp-grafica', 'pone-atencion', 'i-life', '100-posters'];
        const featuredProjects = featuredSlugs
            .map(slug => projectsData.find(p => p.slug === slug))
            .filter(Boolean);
        featuredProjects.forEach(project => {
            homeGrid.appendChild(createProjectCard(project));
        });

        // Adelanto del resto (se funde a negro sobre "VER MÁS"). 2 tarjetas = una
        // fila en desktop; en móvil el CSS oculta la segunda.
        const peekGrid = document.getElementById('projects-peek');
        if (peekGrid) {
            projectsData
                .filter(p => !featuredSlugs.includes(p.slug))
                .slice(0, 2)
                .forEach(project => peekGrid.appendChild(createProjectCard(project)));
        }
    }

    // B. Renderizado para la página Work (work.html)
    const workGrid = document.getElementById('work-grid');
    if (workGrid) {
        // Muestra TODOS los proyectos
        projectsData.forEach(project => {
            workGrid.appendChild(createProjectCard(project));
        });
    }

    // C. Página de proyecto: proyectos/<slug>.html (estática, trae data-slug en
    // <body> y el título/meta ya pre-renderizados) o project.html?slug=... (plantilla).
    const dynamicHeader = document.getElementById('dynamic-header');
    if (dynamicHeader) {
        const currentSlug = document.body.dataset.slug ||
            new URLSearchParams(window.location.search).get('slug');

        const project = projectsData.find(p => p.slug === currentSlug);

        if (project) {
            if (!dynamicHeader.querySelector('h1')) {
                dynamicHeader.innerHTML = projectHeaderHtml(project);
            }

            // Llena la sección de información del proyecto (descripción, tipo)
            const projectInfo = document.getElementById('project-info');
            if (projectInfo) {
                const descElement = document.getElementById('project-description');
                descElement.textContent = project.description;

                const typeElement = document.getElementById('project-type');
                typeElement.textContent = project.type;
            }

            // Renderiza la galería con el layout basado en el tipo de proyecto
            const gallery = document.getElementById('dynamic-gallery');
            renderGallery(gallery, project);

            // Llena la sección "Other Projects" con 3 proyectos aleatorios
            const otherGrid = document.getElementById('other-projects-grid');
            const otherProjects = projectsData.filter(p => p.slug !== currentSlug);
            const shuffledProjects = shuffleArray(otherProjects);
            const randomThreeProjects = shuffledProjects.slice(0, 3);
            
            if (otherGrid) {
                randomThreeProjects.forEach(p => {
                    otherGrid.appendChild(createOtherProjectCard(p));
                });
            }

        } else {
            // Manejo de error si no se encuentra el slug
            dynamicHeader.innerHTML = `
                <div class="title-wrapper">
                    <h1 class="title-giant">PROYECTO NO ENCONTRADO</h1>
                </div>
                <a href="work.html" class="back-btn">Back to Work</a>
            `;
        }

        kickTitleReveal(dynamicHeader);
    }

    // E. 404: 3 trabajos al azar para que la visita no termine en un callejón.
    const notFoundGrid = document.getElementById('not-found-grid');
    if (notFoundGrid) {
        shuffleArray(projectsData).slice(0, 3).forEach(p => {
            notFoundGrid.appendChild(createOtherProjectCard(p));
        });
    }

    // D. Renderizado para la página Sobre Mi (sobre-mi.html)
    const aboutImageColumn = document.querySelector('.about-image-column');
    if (aboutImageColumn) {
        // Busca las imágenes desde la carpeta about
        const portraitPhoto = aboutImageColumn.querySelector('.about-photo.portrait');

        if (portraitPhoto) {
            portraitPhoto.style.backgroundImage = 'url(\'images/about/portrait.webp\')';
            portraitPhoto.style.backgroundSize = 'cover';
            portraitPhoto.style.backgroundPosition = 'center';
        }
    }

    // F. Lightbox (project.html)
    const lightbox = document.getElementById('lightbox');
    const closeBtn = document.getElementById('close-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const lightboxStage = document.getElementById('lightbox-stage');

    const stop = (e) => e.stopPropagation();

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            stop(e);
            closeLightbox();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            stop(e);
            changeImage(-1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            stop(e);
            changeImage(1);
        });
    }

    if (lightboxStage) {
        lightboxStage.addEventListener('click', onLightboxStageClick);
    }

    document.addEventListener('keydown', (e) => {
        if (!isLightboxOpen()) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeLightbox();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            changeImage(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            changeImage(1);
        }
    });

    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
    }
});