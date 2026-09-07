gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const canvas = document.getElementById("background-canvas");
const ctx = canvas ? canvas.getContext("2d", { alpha: false }) : null;
const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const sections = Array.from(document.querySelectorAll(".split-section, .works-showcase-section"));
const timelineNodes = Array.from(document.querySelectorAll(".timeline-node"));
const loader = document.getElementById("site-loader");
const loaderBar = document.getElementById("loader-bar");
const loaderPercent = document.getElementById("loader-percent");

const TOTAL_FRAMES = 240;
const frames = [];
let loadedCount = 0;
let lastRenderedIndex = -1;
let isIntroDone = false;
const isMobilePerformanceMode = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
let lastMobileSectionSync = 0;

// Paced intro duration (1.8 seconds)
const MIN_LOADER_TIME = 1800;
const startTime = Date.now();

const state = {
  currentFrameIndex: 0,
  targetFrameIndex: 0,
};

// Deter casual extraction of portfolio media while keeping text and links usable.
document.addEventListener("dragstart", (event) => {
  if (event.target.closest(".protected-media, #featured-video, #background-canvas")) {
    event.preventDefault();
  }
});

document.addEventListener("contextmenu", (event) => {
  if (event.target.closest(".protected-media, #featured-video, #background-canvas")) {
    event.preventDefault();
  }
});

let frameId = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function drawCoverImage(img) {
  if (!ctx || !canvas || !img || !img.complete) return;

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const imgWidth = img.naturalWidth || 1280;
  const imgHeight = img.naturalHeight || 720;

  const imgAspect = imgWidth / imgHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let drawWidth, drawHeight, offsetX, offsetY;

  if (canvasAspect > imgAspect) {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imgAspect;
    offsetX = 0;
    offsetY = (canvasHeight - drawHeight) / 2;
  } else {
    drawWidth = canvasHeight * imgAspect;
    drawHeight = canvasHeight;
    offsetX = (canvasWidth - drawWidth) / 2;
    offsetY = 0;
  }

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

function renderFrame(index) {
  const safeIndex = clamp(Math.round(index), 0, TOTAL_FRAMES - 1);
  if (safeIndex === lastRenderedIndex) return; // Prevent redundant draws

  const img = frames[safeIndex];

  if (img && img.complete) {
    drawCoverImage(img);
    lastRenderedIndex = safeIndex;
  } else {
    // Fallback to nearest loaded frame
    for (let offset = 1; offset < 25; offset++) {
      const prev = frames[safeIndex - offset];
      const next = frames[safeIndex + offset];
      if (prev && prev.complete) {
        drawCoverImage(prev);
        lastRenderedIndex = safeIndex - offset;
        break;
      }
      if (next && next.complete) {
        drawCoverImage(next);
        lastRenderedIndex = safeIndex + offset;
        break;
      }
    }
  }
}

// Progressive WebP preloader — loads just enough frames up front to
// satisfy the loader + early scrolling, then feeds the rest in small
// batches during browser idle time. Firing all 240 requests at once
// on page load competes for bandwidth and decode time with the
// fonts/GSAP/CSS the page also needs; spreading the tail out keeps
// the initial load lighter without delaying anything the user can
// actually reach yet.
const EAGER_FRAME_COUNT = isMobilePerformanceMode ? 24 : 40;
const IDLE_BATCH_SIZE = isMobilePerformanceMode ? 3 : 6;

const requestIdle =
  window.requestIdleCallback ||
  ((cb) => setTimeout(() => cb({ timeRemaining: () => 10 }), 200));

function loadFrame(i) {
  const img = new Image();
  img.decoding = "async";
  const frameNum = String(i).padStart(3, "0");
  img.src = `frames/frame_${frameNum}.webp`;

  img.onload = () => {
    loadedCount++;
    if (i === 0) {
      lastRenderedIndex = -1;
      renderFrame(0); // Force-draw frame 0 immediately when loaded
    }
    updateLoaderProgress();
  };

  frames[i] = img;
}

function preloadFramesProgressive() {
  for (let i = 0; i < EAGER_FRAME_COUNT; i++) {
    loadFrame(i);
  }

  let next = EAGER_FRAME_COUNT;
  function loadNextBatch() {
    if (next >= TOTAL_FRAMES) return;
    const end = Math.min(next + IDLE_BATCH_SIZE, TOTAL_FRAMES);
    for (; next < end; next++) {
      loadFrame(next);
    }
    requestIdle(loadNextBatch);
  }

  requestIdle(loadNextBatch);
}

function updateLoaderProgress() {
  const elapsedTime = Date.now() - startTime;
  const timeProgress = clamp(elapsedTime / MIN_LOADER_TIME, 0, 1);
  const loadProgress = clamp(loadedCount / 30, 0, 1);

  const combinedProgress = Math.min(timeProgress, loadProgress);
  const percent = Math.round(combinedProgress * 100);

  if (loaderBar) loaderBar.style.width = `${percent}%`;
  if (loaderPercent) loaderPercent.textContent = `${percent}%`;

  if (percent >= 100 && !isIntroDone) {
    triggerIntroSequence();
  } else if (!isIntroDone) {
    requestAnimationFrame(updateLoaderProgress);
  }
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  lastRenderedIndex = -1; // Force re-render on window resize
  renderFrame(state.currentFrameIndex);
}

function setActiveSection(sectionId) {
  navLinks.forEach((link) => {
    const isTarget = link.getAttribute("href") === `#${sectionId}`;
    link.classList.toggle("active", isTarget);
  });
  const mobileLinks = document.querySelectorAll(".mobile-nav-link");
  mobileLinks.forEach((link) => {
    const isTarget = link.getAttribute("href") === `#${sectionId}`;
    link.classList.toggle("active", isTarget);
  });
}

function syncSequenceFromScroll() {
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollHeight <= 0) return;

  const scrollTop = window.scrollY || window.pageYOffset;
  const scrollProgress = clamp(scrollTop / scrollHeight, 0, 1);

  state.targetFrameIndex = Math.min(TOTAL_FRAMES - 1, scrollProgress * (TOTAL_FRAMES - 1));

  // The frame target stays responsive on phones; active-nav geometry is less visual-critical.
  const now = performance.now();
  if (isMobilePerformanceMode && now - lastMobileSectionSync < 80) return;
  lastMobileSectionSync = now;

  // Determine active section reliably based on viewport intersection
  const triggerPoint = window.innerHeight * 0.4;
  let activeSection = null;

  for (let i = 0; i < sections.length; i++) {
    const rect = sections[i].getBoundingClientRect();
    if (rect.top <= triggerPoint && rect.bottom > triggerPoint) {
      activeSection = sections[i];
      break;
    }
  }

  // Edge cases: at top or bottom
  if (!activeSection) {
    if (scrollTop < 80) {
      activeSection = sections[0];
    } else if (window.innerHeight + scrollTop >= document.documentElement.scrollHeight - 50) {
      activeSection = sections[sections.length - 1];
    } else {
      let minDistance = Number.POSITIVE_INFINITY;
      sections.forEach((sec) => {
        const rect = sec.getBoundingClientRect();
        const dist = Math.abs(rect.top - triggerPoint);
        if (dist < minDistance) {
          minDistance = dist;
          activeSection = sec;
        }
      });
    }
  }

  if (activeSection) {
    setActiveSection(activeSection.id);
  }
}

function scheduleSync() {
  if (frameId !== null) return;

  frameId = requestAnimationFrame(() => {
    frameId = null;
    syncSequenceFromScroll();
  });
}

function tickFrameLoop() {
  const delta = state.targetFrameIndex - state.currentFrameIndex;

  if (Math.abs(delta) > 0.01 || lastRenderedIndex === -1) {
    state.currentFrameIndex += delta * 0.14;
    renderFrame(state.currentFrameIndex);
  }

  requestAnimationFrame(tickFrameLoop);
}

// Cinematic Intro Entrance Reveal
function triggerIntroSequence() {
  if (isIntroDone) return;
  isIntroDone = true;

  // CRITICAL FIX: Force-render frame 0 onto the background canvas BEFORE hiding loader
  lastRenderedIndex = -1;
  renderFrame(0);

  if (loader) {
    loader.classList.add("loaded");
  }

  const tl = gsap.timeline();

  // Reveal Header
  tl.fromTo(
    ".site-header",
    { opacity: 0, y: -25 },
    { opacity: 1, y: 0, duration: 1.0, ease: "power3.out" }
  );

  // Reveal Hero Left Elements
  tl.fromTo(
    "#hero .split-left > *",
    { opacity: 0, x: -40 },
    { opacity: 1, x: 0, duration: 0.85, stagger: 0.12, ease: "power2.out" },
    "-=0.6"
  );

  // Reveal Hero Right Elements
  tl.fromTo(
    "#hero .split-right > *",
    { opacity: 0, x: 40 },
    { opacity: 1, x: 0, duration: 0.85, stagger: 0.12, ease: "power2.out" },
    "-=0.75"
  );
}

// Animated Stat Counter Numbers
function initNumberCounters() {
  const statNumbers = document.querySelectorAll(".stat-number");

  statNumbers.forEach((el) => {
    const rawText = el.textContent.trim();
    const targetValue = parseInt(rawText.replace(/\D/g, ""), 10);
    const suffix = rawText.replace(/[0-9]/g, "");

    if (isNaN(targetValue)) return;

    const counterObj = { val: 0 };

    ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      onEnter: () => {
        gsap.to(counterObj, {
          val: targetValue,
          duration: 1.8,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = `${Math.floor(counterObj.val)}${suffix}`;
          },
        });
      },
      once: true,
    });
  });
}

function initSectionAnimations() {
  sections.forEach((section) => {
    if (section.id === "hero") return;

    const leftCol = section.querySelector(".split-left");
    const rightCol = section.querySelector(".split-right");

    if (leftCol) {
      gsap.fromTo(
        leftCol,
        { opacity: 0, x: -35 },
        {
          opacity: 1,
          x: 0,
          duration: 0.9,
          ease: "power2.out",
          scrollTrigger: {
            trigger: section,
            start: "top 75%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }

    if (rightCol) {
      gsap.fromTo(
        rightCol,
        { opacity: 0, x: 35 },
        {
          opacity: 1,
          x: 0,
          duration: 0.9,
          ease: "power2.out",
          scrollTrigger: {
            trigger: section,
            start: "top 75%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }

    ScrollTrigger.create({
      trigger: section,
      start: "top 50%",
      end: "bottom 50%",
      onEnter: () => setActiveSection(section.id),
      onEnterBack: () => setActiveSection(section.id),
    });
  });

  // Animate skill bar fills dynamically on scroll
  document.querySelectorAll(".skill-summary-right, .skill-metrics-right").forEach((container) => {
    const fills = container.querySelectorAll(".skill-bar-fill");
    fills.forEach((fill) => {
      const targetWidth = fill.style.width || "0%";
      // Set to 0% initially for animation
      gsap.set(fill, { width: "0%" });

      ScrollTrigger.create({
        trigger: container,
        start: "top 80%",
        onEnter: () => {
          gsap.to(fill, {
            width: targetWidth,
            duration: 1.4,
            ease: "power2.out",
            overwrite: "auto"
          });
        },
        once: true
      });
    });
  });

  timelineNodes.forEach((node) => {
    ScrollTrigger.create({
      trigger: node,
      start: "top 65%",
      onEnter: () => {
        timelineNodes.forEach((n) => n.classList.remove("active"));
        node.classList.add("active");
      },
      onEnterBack: () => {
        timelineNodes.forEach((n) => n.classList.remove("active"));
        node.classList.add("active");
      },
    });
  });
}

// Studies Section — Staggered Timeline Reveal
// Each column (amber "left half" and blue "right half") reveals its
// nodes top-to-bottom as it scrolls into view, rather than the whole
// block fading in as one flat unit. Scoped to #studies only.
function initStudiesTimelineReveal() {
  const studiesSection = document.getElementById("studies");
  if (!studiesSection) return;

  const containers = studiesSection.querySelectorAll(".timeline-container");

  containers.forEach((container) => {
    const nodes = container.querySelectorAll(".timeline-node");
    if (!nodes.length) return;

    const fromSide = container.classList.contains("timeline-container-blue") ? 24 : -24;
    gsap.set(nodes, { opacity: 0, y: 20, x: fromSide });

    ScrollTrigger.create({
      trigger: container,
      start: "top 82%",
      onEnter: () => {
        gsap.to(nodes, {
          opacity: 1,
          y: 0,
          x: 0,
          duration: 0.75,
          stagger: 0.15,
          ease: "power2.out",
        });
      },
      once: true,
    });
  });
}

// Spotlight Card Hover Coordinates
function initSpotlightHover() {
  const cards = document.querySelectorAll(
    ".project-item-left, .project-item-right, .stat-card, .node-content, .accolades-box-right, .availability-card-right, .recommendation-card, .experience-primary-card, .exp-metrics-card"
  );

  cards.forEach((card) => {
    let cachedRect = null;

    card.addEventListener("mouseenter", () => {
      cachedRect = card.getBoundingClientRect();
    });

    card.addEventListener("mousemove", (e) => {
      const rect = cachedRect || card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    });
  });
}

// Smooth scroll handler — applies to every in-page anchor link
// (top nav, the logo/"back to hero" mark, hero CTAs like "VIEW
// RESUME", and "LET'S TALK"), not just .nav-link. Previously only
// .nav-link used this GSAP tween, so the logo and CTA buttons fell
// back to the browser's native CSS `scroll-behavior: smooth`, which
// is much quicker/less eased — that mismatch is what made long jumps
// (e.g. bottom of page back to Hero) feel abrupt.
const smoothScrollLinks = Array.from(
  document.querySelectorAll('a[href^="#"]:not([href="#"])')
);

// Scale duration by how far we're travelling so a short hop to the
// next section stays snappy, while a long jump (Hero <-> Contact)
// gets noticeably slower, more cinematic easing instead of a flat
// duration for every distance.
function getScrollDuration(target) {
  const destinationY = target.getBoundingClientRect().top + window.scrollY;
  const distance = Math.abs(destinationY - window.scrollY);
  const viewportHeight = window.innerHeight || 800;
  const viewportsTravelled = distance / viewportHeight;
  return clamp(1.4 + viewportsTravelled * 0.35, 1.4, 2.6);
}

smoothScrollLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");
    const target = document.querySelector(targetId);
    if (!target) return;

    event.preventDefault();

    if (target.id) {
      setActiveSection(target.id);
    }

    gsap.to(window, {
      scrollTo: { y: target, autoKill: false },
      duration: getScrollDuration(target),
      ease: "power4.inOut",
      overwrite: "auto",
      onUpdate: scheduleSync,
      onComplete: syncSequenceFromScroll,
    });
  });
});

// Start sequence preloader & loops
preloadFramesProgressive();
resizeCanvas();
initSectionAnimations();
initNumberCounters();
initSpotlightHover();
initStudiesTimelineReveal();
setActiveSection("hero");
updateLoaderProgress();

// Fallback intro trigger at 2.8s max
setTimeout(() => {
  if (!isIntroDone) {
    triggerIntroSequence();
  }
}, 2800);

let resizeFrameId = null;
function scheduleResize() {
  if (resizeFrameId !== null) return;

  resizeFrameId = requestAnimationFrame(() => {
    resizeFrameId = null;
    resizeCanvas();
    scheduleSync();
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.refresh();
    }
  });
}

window.addEventListener("resize", scheduleResize);

window.addEventListener("scroll", scheduleSync, { passive: true });
requestAnimationFrame(tickFrameLoop);
// ==========================================
// WORKS SECTION DYNAMIC LOGIC
// ==========================================
// SELECTED WORKS DATA (Ground truth from project READMEs)
// ==========================================
// Replace these values with the YouTube video IDs. Embeds are created only after Play is clicked.
const projectVideos = {
  pos: "kf14UYKXtdc",
  ecommerce: "aBU8aCfKNyw",
  yolo: "KwKuZ-Td4NE",
  pengpu: "ZuDSu0559sg",
  truck: "4V5OfNxsQqE"
};

const youtubeThumbnailVersion = "2";

const worksData = [
  {
    id: 1,
    category: "01 / DESKTOP SYSTEM",
    title: "Supermarket POS System",
    shortTitle: "POS System",
    fileTitle: "POS_SYSTEM.MP4",
    year: "Academic",
    desc: "A Java Swing desktop application designed for managing supermarket product inventory, sales transactions, seller accounts, and admin controls with unified JDBC support for both zero-setup embedded SQLite and production MySQL/MariaDB.",
    videoKey: "pos",
    poster: "images/thumb_pos.jpg",
    repo: "github.com/21illusion/upermarket-Management-System-Point-of-Sale---POS-",
    repoLink: "https://github.com/21illusion/upermarket-Management-System-Point-of-Sale---POS-.git",
    liveLink: "#",
    tech: ["Java 17+", "Java Swing", "SQLite (Embedded)", "MySQL", "JDBC", "rs2xml", "Apache Ant"]
  },
  {
    id: 2,
    category: "02 / FULL-STACK WEB",
    title: "E-Commerce Hardware Store",
    shortTitle: "E-Commerce Store",
    fileTitle: "ECOMMERCE_STORE.MP4",
    year: "License Thesis",
    desc: "A full-featured computer hardware digital marketplace built with PHP and MySQL, featuring a custom Dual-Database Adapter Pattern (translating MySQL to SQLite PDO) and a zero-configuration portable demo mode.",
    videoKey: "ecommerce",
    poster: "images/thumb_ecommerce.jpg",
    repo: "github.com/21illusion/e-commerce",
    repoLink: "https://github.com/21illusion/e-commerce.git",
    liveLink: "#",
    tech: ["PHP 8.2", "MySQL", "SQLite (Demo)", "Bootstrap 5.3", "JavaScript (ES6)", "PDO Wrapper", "FontAwesome 6"]
  },
  {
    id: 3,
    category: "03 / COMPUTER VISION & AI",
    title: "YOLOv8 Accuracy & Inference Optimization",
    shortTitle: "YOLOv8 Optimization",
    fileTitle: "YOLOV8_OPTIMIZATION.MP4",
    year: "Master Research",
    desc: "Empirical investigation of neural network architecture modifications on YOLOv8n across 5 diverse visual environments, combining multi-dataset benchmarking with NVIDIA TensorRT and Intel OpenVINO inference acceleration.",
    videoKey: "yolo",
    poster: "images/thumb_yolo.jpg",
    repo: "github.com/21illusion/yolov8-accuracy-improvement",
    repoLink: "https://github.com/21illusion/yolov8-accuracy-improvement.git",
    liveLink: "#",
    tech: ["Python", "PyTorch", "YOLOv8", "NVIDIA TensorRT", "Intel OpenVINO", "Computer Vision", "CUDA"]
  },
  {
    id: 4,
    category: "04 / 3D MOTION & CAD",
    title: "Pengpu Heavy Machinery Animation",
    shortTitle: "Pengpu Animation",
    fileTitle: "PENGPU_ANIMATION.MP4",
    year: "Industry",
    desc: "High-precision mechanical animation and brand motion sequence produced for SARL Peng Pu Algérie (Daewoo Trucks), showcasing heavy vehicle kinematics, component exploded views, and technical engineering assembly.",
    videoKey: "pengpu",
    poster: "images/thumb_pengpu.jpg",
    repo: null,
    repoLink: null,
    liveLink: "#",
    tech: ["Adobe After Effects", "Adobe Illustrator"]
  },
  {
    id: 5,
    category: "05 / ENTERPRISE DESKTOP",
    title: "Truck Inspection Pro v2",
    shortTitle: "Truck Inspection Pro",
    fileTitle: "TRUCK_INSPECTION_PRO.MP4",
    year: "Production v2.0",
    desc: "Enterprise-grade Windows desktop application engineered for commercial transport fleets, featuring AES-256-GCM encrypted binary storage, hardware-locked licensing, ExcelJS/jsPDF reporting, and fleet predictive analytics.",
    videoKey: "truck",
    poster: "images/thumb_truck.jpg",
    repo: null,
    repoLink: null,
    liveLink: "#",
    tech: ["Electron 32", "Node.js", "AES-256-GCM", "HKDF-SHA256", "node-machine-id", "ExcelJS", "Chart.js", "jsPDF"]
  }
];

function initWorksSection() {
  const listContainer = document.getElementById("works-list-container");
  const navCounter = document.getElementById("nav-counter");
  const navTitle = document.getElementById("nav-title");
  const centerCounter = document.getElementById("center-counter");
  const tagEl = document.getElementById("featured-tag");
  const titleEl = document.getElementById("featured-title");
  const descEl = document.getElementById("featured-desc");
  const videoEl = document.getElementById("featured-video");
  const fallbackImg = document.getElementById("featured-image-fallback");
  const techGrid = document.getElementById("featured-tech-grid");
  const repoContainer = document.getElementById("featured-repo-container");
  const repoLink = document.getElementById("featured-repo-link");
  const repoText = document.getElementById("featured-repo-text");
  const windowTitle = document.getElementById("demo-window-title");
  const navPipsContainer = document.getElementById("nav-pips");

  const playBtn = document.getElementById("play-overlay");

  function getProjectThumbnail(work) {
    const videoId = projectVideos[work.videoKey];
    return videoId
      ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/maxresdefault.jpg?v=${youtubeThumbnailVersion}`
      : work.poster;
  }

  function getProjectThumbnailFallback(work) {
    const videoId = projectVideos[work.videoKey];
    return videoId
      ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg?v=${youtubeThumbnailVersion}`
      : work.poster;
  }

  function showVideoFallback(message) {
    videoEl.innerHTML = `<span class="video-fallback-message">${message}</span>`;
    videoEl.classList.add("has-fallback");
    playBtn.style.display = "none";
  }

  function createYouTubeEmbed(work) {
    const videoId = projectVideos[work.videoKey];
    if (!videoId) {
      showVideoFallback("Video demo coming soon.");
      return null;
    }

    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&controls=1&playsinline=1&rel=0&modestbranding=1`;
    iframe.title = `${work.title} project video`;
    iframe.loading = "lazy";
    iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.addEventListener("error", () => showVideoFallback("This video is temporarily unavailable."), { once: true });
    return iframe;
  }

  function loadYouTubeVideo(work) {
    const iframe = createYouTubeEmbed(work);
    if (!iframe) return;
    videoEl.classList.remove("has-fallback");
    videoEl.style.backgroundImage = "none";
    videoEl.replaceChildren(iframe);
    playBtn.style.display = "none";
  }

  if (!listContainer) return;

  // Render navigation pips
  if (navPipsContainer) {
    navPipsContainer.innerHTML = "";
    worksData.forEach((_, i) => {
      const pip = document.createElement("button");
      pip.type = "button";
      pip.className = `nav-pip ${i === 0 ? "active" : ""}`;
      pip.setAttribute("aria-label", `Go to project ${i + 1}`);
      pip.addEventListener("click", () => selectProject(i));
      navPipsContainer.appendChild(pip);
    });
  }

  let currentIndex = 0;

  // Build the timeline list
  listContainer.innerHTML = "";
  worksData.forEach((work, index) => {
    const item = document.createElement("div");
    item.className = "works-item";
    if (index === 0) item.classList.add("active");
    item.dataset.index = index;
    item.innerHTML = `
      <div class="works-item-num">0${index + 1}</div>
      <div class="works-item-info">
        <div class="works-item-category">${work.category.split(' / ')[1] || work.category}</div>
        <div class="works-item-title">${work.title}</div>
        <div class="works-item-tags">
          <span class="works-item-year">${work.year}</span>
          <span class="works-item-tech-tag">${work.tech[0]}</span>
        </div>
      </div>
      <div class="works-item-chevron">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>
    `;
    item.addEventListener("click", () => selectProject(index));
    listContainer.appendChild(item);
  });

  const listItems = listContainer.querySelectorAll(".works-item");

  // Shared helper: update all card DOM content for a given project index
  function applyProjectData(index) {
    const work = worksData[index];

    const countStr = `0${index + 1} / 0${worksData.length}`;
    if (navCounter) navCounter.textContent = countStr;
    if (centerCounter) centerCounter.textContent = countStr;
    if (navTitle) navTitle.textContent = work.shortTitle || work.title;

    if (windowTitle) {
      windowTitle.textContent = work.fileTitle || `${work.title.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}.MP4`;
    }

    // Update navigation pips
    if (navPipsContainer) {
      const pips = navPipsContainer.querySelectorAll(".nav-pip");
      pips.forEach((p, pIdx) => {
        p.classList.toggle("active", pIdx === index);
      });
    }

    tagEl.textContent = work.category;
    titleEl.textContent = work.title;
    descEl.textContent = work.desc;

    if (work.videoKey) {
      videoEl.style.display = 'block';
      videoEl.classList.remove("has-fallback");
      videoEl.style.backgroundImage = `url("${getProjectThumbnail(work)}")`;
      videoEl.style.backgroundSize = "cover";
      videoEl.style.backgroundPosition = "center";
      videoEl.replaceChildren();
      fallbackImg.style.display = 'none';
      fallbackImg.onerror = () => {
        videoEl.style.backgroundImage = `url("${getProjectThumbnailFallback(work)}")`;
      };
      fallbackImg.src = getProjectThumbnail(work);
      playBtn.style.display = 'flex';
    } else {
      videoEl.style.display = 'none';
      playBtn.style.display = 'none';
      fallbackImg.style.display = 'block';
      fallbackImg.src = getProjectThumbnail(work);
    }

    // Populate Tech Badges
    techGrid.innerHTML = '';
    work.tech.forEach(t => {
      const span = document.createElement('span');
      span.className = 'tech-badge';
      span.textContent = t;
      techGrid.appendChild(span);
    });

    if (work.repo && work.repoLink && work.repoLink !== '#' && work.repoLink !== '') {
      repoContainer.style.display = 'block';
      repoLink.href = work.repoLink;
      repoText.textContent = work.repo;
    } else {
      repoContainer.style.display = 'none';
    }
  }

  function selectProject(index, animate = true) {
    if (index < 0 || index >= worksData.length) return;

    const card = document.getElementById('featured-card');
    const direction = index > currentIndex ? 1 : -1;

    if (!animate) {
      // Initial load — no animation, populate immediately
      listItems[currentIndex].classList.remove('active');
      listItems[index].classList.add('active');
      currentIndex = index;
      applyProjectData(index);
      return;
    }

    // Slide out → update content → slide in
    gsap.to(card, {
      opacity: 0,
      x: direction * -40,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: () => {
        listItems[currentIndex].classList.remove('active');
        listItems[index].classList.add('active');
        currentIndex = index;
        applyProjectData(index);

        gsap.fromTo(card,
          { opacity: 0, x: direction * 40 },
          { opacity: 1, x: 0, duration: 0.32, ease: 'power2.out' }
        );
      }
    });
  }

  // Initial populate (no slide animation)
  selectProject(0, false);

  // Navigation Buttons
  const prevBtn = document.getElementById("works-prev");
  const nextBtn = document.getElementById("works-next");
  if (prevBtn) prevBtn.addEventListener("click", () => {
    const nextIdx = (currentIndex - 1 + worksData.length) % worksData.length;
    selectProject(nextIdx);
  });
  if (nextBtn) nextBtn.addEventListener("click", () => {
    const nextIdx = (currentIndex + 1) % worksData.length;
    selectProject(nextIdx);
  });

  // Video Play overlay
  playBtn.addEventListener("click", () => loadYouTubeVideo(worksData[currentIndex]));
}

// Email Copy & Interactive Feedback System
function initEmailActions() {
  const EMAIL_ADDR = "mohamed.amine.hamdani.dev@gmail.com";
  let toastEl = document.querySelector(".portfolio-toast");

  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "portfolio-toast";
    toastEl.setAttribute("role", "alert");
    toastEl.setAttribute("aria-live", "polite");
    toastEl.innerHTML = `
      <div class="toast-icon">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="toast-message">
        <span class="toast-title">Email copied to clipboard!</span>
        <span class="toast-detail">${EMAIL_ADDR}</span>
      </div>
      <a href="https://mail.google.com/mail/?view=cm&fs=1&to=${EMAIL_ADDR}" target="_blank" rel="noopener noreferrer" class="toast-btn" title="Compose in Gmail">
        <span>Open Gmail</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    `;
    document.body.appendChild(toastEl);
  }

  let toastTimer = null;

  function handleEmailTrigger(e) {
    // Copy address to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(EMAIL_ADDR).catch(() => {});
    }

    // Show feedback toast
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 4500);
  }

  // Attach to all email triggers across hero, contact, and quick info
  const triggers = document.querySelectorAll('a[href^="mailto:"], .email-trigger-btn, .email-btn-amber');
  triggers.forEach((btn) => {
    btn.addEventListener("click", handleEmailTrigger);
  });
}

// ==========================================
// RECOMMENDATION LETTER MODAL & HIGH-RES ZOOM
// ==========================================
function initRecommendationModal() {
  const openTrigger = document.getElementById("open-letter-modal");
  const openBtn = document.getElementById("open-letter-btn");
  const modal = document.getElementById("rec-letter-modal");
  const closeBtn = document.getElementById("rec-modal-close");
  const backdrop = document.getElementById("rec-modal-backdrop");
  const zoomInBtn = document.getElementById("rec-zoom-in");
  const zoomOutBtn = document.getElementById("rec-zoom-out");
  const zoomResetBtn = document.getElementById("rec-zoom-reset");
  const maximizeBtn = document.getElementById("rec-maximize-btn");
  const zoomLevelText = document.getElementById("rec-zoom-level");
  const viewport = document.getElementById("rec-modal-viewport");
  const zoomWrapper = document.getElementById("rec-zoom-wrapper");
  const modalImage = document.getElementById("rec-modal-image");

  if (!modal) return;

  const ZOOM_STEPS = [1, 1.3, 1.6, 2.0, 2.5];
  let currentZoomIdx = 0;
  let isDragging = false;
  let startX = 0, startY = 0;
  let scrollLeft = 0, scrollTop = 0;

  function setZoom(idx) {
    currentZoomIdx = Math.max(0, Math.min(idx, ZOOM_STEPS.length - 1));
    const scale = ZOOM_STEPS[currentZoomIdx];

    if (zoomWrapper) {
      zoomWrapper.style.transform = `scale(${scale})`;
      zoomWrapper.classList.toggle("zoomed", scale > 1);
    }

    if (zoomLevelText) {
      zoomLevelText.textContent = `${Math.round(scale * 100)}%`;
    }

    if (modalImage) {
      modalImage.style.cursor = scale > 1 ? "grab" : "zoom-in";
    }
  }

  function openModal() {
    modal.classList.add("active");
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
    setZoom(0);
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    modal.classList.remove("active");
    modal.classList.remove("maximized");
    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
    setZoom(0);
    if (openTrigger) openTrigger.focus();
  }

  function toggleMaximize() {
    modal.classList.toggle("maximized");
  }

  // Open triggers
  if (openTrigger) {
    openTrigger.addEventListener("click", openModal);
    openTrigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal();
      }
    });
  }

  if (openBtn) {
    openBtn.addEventListener("click", openModal);
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeModal);
  }

  // Zoom controls
  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setZoom(currentZoomIdx + 1);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setZoom(currentZoomIdx - 1);
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setZoom(0);
    });
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMaximize();
    });
  }

  // Click on image to toggle zoom
  if (modalImage) {
    modalImage.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentZoomIdx === 0) {
        setZoom(2); // Jump directly to 1.6x (160%) for high readability
      } else {
        setZoom(0); // Reset to Fit (100%)
      }
    });
  }

  // Panning when zoomed in
  if (viewport) {
    viewport.addEventListener("mousedown", (e) => {
      if (ZOOM_STEPS[currentZoomIdx] <= 1) return;
      isDragging = true;
      if (zoomWrapper) zoomWrapper.classList.add("dragging");
      startX = e.pageX - viewport.offsetLeft;
      startY = e.pageY - viewport.offsetTop;
      scrollLeft = viewport.scrollLeft;
      scrollTop = viewport.scrollTop;
    });

    viewport.addEventListener("mouseleave", () => {
      isDragging = false;
      if (zoomWrapper) zoomWrapper.classList.remove("dragging");
    });

    viewport.addEventListener("mouseup", () => {
      isDragging = false;
      if (zoomWrapper) zoomWrapper.classList.remove("dragging");
    });

    viewport.addEventListener("mousemove", (e) => {
      if (!isDragging || ZOOM_STEPS[currentZoomIdx] <= 1) return;
      e.preventDefault();
      const x = e.pageX - viewport.offsetLeft;
      const y = e.pageY - viewport.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      viewport.scrollLeft = scrollLeft - walkX;
      viewport.scrollTop = scrollTop - walkY;
    });
  }

  // Keyboard controls when modal is active
  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("active")) return;

    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      setZoom(currentZoomIdx + 1);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      setZoom(currentZoomIdx - 1);
    } else if (e.key === "0") {
      e.preventDefault();
      setZoom(0);
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      toggleMaximize();
    }
  });
}

// Mobile Navigation Drawer Controller
function initMobileNavigation() {
  const toggleBtn = document.getElementById("mobile-menu-toggle");
  const drawer = document.getElementById("mobile-nav-drawer");
  const closeBtn = document.getElementById("mobile-nav-close");
  const backdrop = document.getElementById("mobile-nav-backdrop");
  const drawerLinks = document.querySelectorAll(".mobile-nav-link, #mobile-drawer-talk, .mobile-btn-resume");

  if (!toggleBtn || !drawer) return;

  function openDrawer() {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    toggleBtn.setAttribute("aria-expanded", "true");
    document.body.classList.add("mobile-nav-open");
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    toggleBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("mobile-nav-open");
  }

  toggleBtn.addEventListener("click", () => {
    if (drawer.classList.contains("open")) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", closeDrawer);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeDrawer);
  }

  drawerLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeDrawer();
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("open")) {
      closeDrawer();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 992 && drawer.classList.contains("open")) {
      closeDrawer();
    }
  });
}

function initPageTransitions() {
  const overlay = document.querySelector(".page-transition-overlay");
  if (!overlay) return;

  requestAnimationFrame(() => document.body.classList.add("page-transition-ready"));

  document.querySelectorAll('a[href="resume.html"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (document.body.classList.contains("page-transitioning")) return;

      document.body.classList.remove("page-transition-ready");
      document.body.classList.add("page-transitioning");
      window.setTimeout(() => {
        window.location.href = link.href;
      }, 420);
    });
  });
}

// Ensure init is called
document.addEventListener("DOMContentLoaded", () => {
  initWorksSection();
  initEmailActions();
  initRecommendationModal();
  initMobileNavigation();
  initPageTransitions();
});

// Also run immediately if DOM is already ready
if (document.readyState === "complete" || document.readyState === "interactive") {
  initWorksSection();
  initEmailActions();
  initRecommendationModal();
  initMobileNavigation();
  initPageTransitions();
}

