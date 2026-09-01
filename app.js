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

    // Animate skill bars when skills section enters viewport
    initSkillBars();
  }

  /**
   * Viewport-triggered skill bar animation
   * Reads data-width attribute and transitions bar width from 0 → target
   */
  function initSkillBars() {
    const bars = document.querySelectorAll('.sk-bar[data-width]');
    if (!bars.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const bar = entry.target;
          const targetWidth = bar.getAttribute('data-width');
          // Slight stagger based on DOM order
          const index = Array.from(bars).indexOf(bar);
          setTimeout(() => {
            bar.style.width = targetWidth + '%';
          }, index * 60);
          observer.unobserve(bar);
        }
      });
    }, { threshold: 0.1 });

    bars.forEach((bar) => observer.observe(bar));
  }

  // Certificate Modal Controller (Read-Only Viewer)
  window.openCertModal = function(imgSrc, title, issuer, id, date) {
    const modal = document.getElementById('cert-modal');
    if (!modal) return;
    document.getElementById('cert-modal-img').src = imgSrc;
    document.getElementById('cert-modal-title').textContent = title || 'Certificate of Achievement';
    document.getElementById('cert-modal-issuer').textContent = `${issuer || ''} ${date ? '· ' + date : ''}`;
    document.getElementById('cert-modal-id').textContent = id ? `ID: ${id}` : 'Verified Credential';
    document.getElementById('cert-modal-download').href = imgSrc;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeCertModal = function(e) {
    const modal = document.getElementById('cert-modal');
    if (!modal) return;
    if (!e || e.target === modal || e.target.classList.contains('cert-modal-close') || !e.target.closest('.cert-modal-content')) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  // Drag & drop on upload card
  function initCertDragDrop() {
    const uploadCard = document.querySelector('.cert-card--upload');
    if (!uploadCard) return;

    ['dragenter', 'dragover'].forEach(name => {
      uploadCard.addEventListener(name, (e) => {
        e.preventDefault();
        uploadCard.style.borderColor = 'var(--accent-cyan)';
        uploadCard.style.background = 'rgba(0, 240, 255, 0.1)';
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      uploadCard.addEventListener(name, (e) => {
        e.preventDefault();
        uploadCard.style.borderColor = '';
        uploadCard.style.background = '';
      });
    });

    uploadCard.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length) {
        window.handleCertUpload({ target: { files: e.dataTransfer.files } });
      }
    });
  }

  // CV Modal & Download Manager
  window.openCvModal = function() {
    const modal = document.getElementById('cv-modal');
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeCvModal = function(e) {
    const modal = document.getElementById('cv-modal');
    if (!modal) return;
    if (!e || e.target === modal || e.target.classList.contains('cv-modal-close') || !e.target.closest('.cv-modal-content')) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  // Synchronize all CV download buttons with uploaded CV
  function applyCvDownloadUrl(dataUrl, fileName) {
    const downloadLinks = document.querySelectorAll('.cv-download-link');
    downloadLinks.forEach(link => {
      link.href = dataUrl;
      link.download = fileName || 'Aryan_Vishwakarma_CV.pdf';
    });

    const statusName = document.getElementById('cv-active-filename');
    const statusMeta = document.getElementById('cv-active-meta');
    if (statusName) statusName.textContent = fileName || 'Aryan_Vishwakarma_CV.pdf';
    if (statusMeta) statusMeta.textContent = 'Custom resume loaded · Ready for 1-click download';
  }

  // Load custom CV from localStorage
  function loadSavedCv() {
    try {
      const savedCv = JSON.parse(localStorage.getItem('portfolio_user_cv') || 'null');
      if (savedCv && savedCv.dataUrl) {
        applyCvDownloadUrl(savedCv.dataUrl, savedCv.name);
      }
    } catch (err) {
      console.warn('Could not load saved CV:', err);
    }
  }

  // Handle CV file upload
  window.handleCvUpload = function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result;
      const fileName = file.name;

      // Apply to all download buttons
      applyCvDownloadUrl(dataUrl, fileName);

      // Save to localStorage
      try {
        localStorage.setItem('portfolio_user_cv', JSON.stringify({
          dataUrl,
          name: fileName,
          uploadedAt: new Date().toISOString()
        }));
      } catch (err) {
        console.warn('Could not cache CV in localStorage (file might be large):', err);
      }

      // Visual feedback
      const statusMeta = document.getElementById('cv-active-meta');
      if (statusMeta) {
        statusMeta.textContent = '✓ Successfully updated! Ready for download.';
        statusMeta.style.color = '#4ade80';
      }
    };
    reader.readAsDataURL(file);

    // Reset input
    event.target.value = '';
  };

  // Drag & drop on CV dropzone
  function initCvDragDrop() {
    const dropzone = document.getElementById('cv-dropzone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--accent-cyan)';
        dropzone.style.background = 'rgba(0, 240, 255, 0.1)';
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '';
        dropzone.style.background = '';
      });
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length) {
        window.handleCvUpload({ target: { files: e.dataTransfer.files } });
      }
    });
  }

  // Close modals on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeCertModal();
      window.closeCvModal();
    }
  });

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      loadSavedCv();
      initCvDragDrop();
    });
  } else {
    init();
    loadSavedCv();
    initCvDragDrop();
  }
})();
