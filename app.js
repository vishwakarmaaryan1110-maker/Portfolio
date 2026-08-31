(() => {
  'use strict';

  // Constants & Config
  const FRAME_COUNT = 240;
  const LERP_FACTOR = 0.09; // Smooth damping factor for inertial scrolling
  const getFramePath = (index) => `video_frames_24fps/frame_${String(index).padStart(4, '0')}.png`;

  // DOM Elements
  const canvas = document.getElementById('frameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderPercent = document.getElementById('loader-percent');
  const scrollPrompt = document.getElementById('scroll-prompt');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.content-section');
  const fullscreenBtn = document.getElementById('fullscreenToggle');

  // State
  const images = new Array(FRAME_COUNT);
  let loadedCount = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let currentRenderedIndex = -1;
  let isInitialFrameRendered = false;

  /**
   * Handle responsive high-DPI canvas resizing
   */
  function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for optimal performance

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Redraw current frame
    if (currentRenderedIndex >= 0) {
      drawFrame(currentRenderedIndex);
    }
  }

  /**
   * Render an image onto the canvas with aspect ratio cover math
   */
  function renderImageCover(img) {
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cWidth = canvas.width;
    const cHeight = canvas.height;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    const hRatio = cWidth / imgWidth;
    const vRatio = cHeight / imgHeight;
    const ratio = Math.max(hRatio, vRatio);

    const drawW = imgWidth * ratio;
    const drawH = imgHeight * ratio;
    const drawX = (cWidth - drawW) / 2;
    const drawY = (cHeight - drawH) / 2;

    ctx.drawImage(img, 0, 0, imgWidth, imgHeight, drawX, drawY, drawW, drawH);
  }

  /**
   * Draw frame by index with fallback to nearest available frame
   */
  function drawFrame(index) {
    const img = images[index];
    if (img && img.complete && img.naturalWidth > 0) {
      renderImageCover(img);
      return;
    }

    // Fallback: search for nearest loaded frame
    for (let offset = 1; offset < FRAME_COUNT; offset++) {
      const prev = images[index - offset];
      if (prev && prev.complete && prev.naturalWidth > 0) {
        renderImageCover(prev);
        return;
      }
      const next = images[index + offset];
      if (next && next.complete && next.naturalWidth > 0) {
        renderImageCover(next);
        return;
      }
    }
  }

  /**
   * Preload all video sequence frames
   */
  function preloadFrames() {
    return new Promise((resolve) => {
      // First, load frame 1 immediately for fast initial paint
      const firstImg = new Image();
      firstImg.src = getFramePath(1);
      images[0] = firstImg;

      firstImg.onload = () => {
        if (!isInitialFrameRendered) {
          isInitialFrameRendered = true;
          handleResize();
          drawFrame(0);
          currentRenderedIndex = 0;
        }
      };

      // Load all 240 frames
      for (let i = 1; i <= FRAME_COUNT; i++) {
        const img = (i === 1) ? firstImg : new Image();
        if (i !== 1) {
          img.src = getFramePath(i);
          images[i - 1] = img;
        }

        const onComplete = () => {
          loadedCount++;
          const percent = Math.min(100, Math.round((loadedCount / FRAME_COUNT) * 100));
          
          if (loaderBar) loaderBar.style.width = `${percent}%`;
          if (loaderPercent) loaderPercent.textContent = `${percent}%`;

          // If initial frame wasn't drawn yet, draw it
          if (!isInitialFrameRendered && (images[0]?.complete || loadedCount >= 1)) {
            isInitialFrameRendered = true;
            handleResize();
            drawFrame(0);
            currentRenderedIndex = 0;
          }

          if (loadedCount >= FRAME_COUNT) {
            resolve();
          }
        };

        if (img.complete && img.naturalWidth > 0) {
          onComplete();
        } else {
          img.onload = onComplete;
          img.onerror = () => {
            onComplete(); // proceed gracefully
          };
        }
      }
    });
  }

  /**
   * Calculate scroll progress based on page scroll
   */
  function updateScrollProgress() {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const maxScroll = (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight;

    if (maxScroll <= 0) {
      targetProgress = 0;
    } else {
      targetProgress = Math.max(0, Math.min(1, scrollY / maxScroll));
    }

    // Toggle scroll indicator prompt
    if (scrollY > 50) {
      if (scrollPrompt) scrollPrompt.classList.add('hidden');
    } else {
      if (scrollPrompt) scrollPrompt.classList.remove('hidden');
    }

    // Update active navigation link based on scroll position
    updateActiveNavLink(scrollY);
  }

  /**
   * Update active navigation link based on current scroll position
   */
  function updateActiveNavLink(scrollY) {
    const triggerOffset = window.innerHeight * 0.4;
    let currentSectionId = '';

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      if (scrollY >= sectionTop - triggerOffset) {
        currentSectionId = section.getAttribute('id');
      }
    });

    if (currentSectionId) {
      navLinks.forEach((link) => {
        if (link.getAttribute('data-section') === currentSectionId) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }
  }

  /**
   * Animation Loop with smooth inertial interpolation (LERP)
   */
  function animationLoop() {
    const diff = targetProgress - currentProgress;
    
    // Smooth lerp damping
    if (Math.abs(diff) > 0.00005) {
      currentProgress += diff * LERP_FACTOR;
    } else {
      currentProgress = targetProgress;
    }

    // Map progress (0 -> 1) to frame index (0 -> 239)
    const frameIndex = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(currentProgress * (FRAME_COUNT - 1))));

    if (frameIndex !== currentRenderedIndex) {
      drawFrame(frameIndex);
      currentRenderedIndex = frameIndex;
    }

    requestAnimationFrame(animationLoop);
  }

  /**
   * Setup Navigation click handling
   */
  function setupNavigation() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const targetId = anchor.getAttribute('href');
        if (targetId === '#') return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Fullscreen toggle button
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        }
      });
    }
  }

  /**
   * Initialization
   */
  async function init() {
    handleResize();
    setupNavigation();

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
    window.addEventListener('scroll', updateScrollProgress, { passive: true });

    // Start render loop immediately
    requestAnimationFrame(animationLoop);

    // Initial scroll progress check
    updateScrollProgress();

    // Preload all frames
    await preloadFrames();

    // Fade out loading screen smoothly
    setTimeout(() => {
      if (loader) {
        loader.classList.add('fade-out');
      }
    }, 250);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
