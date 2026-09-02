(() => {
  'use strict';

  // Constants & Config
  const FRAME_COUNT = 240;
  const LERP_FACTOR = 0.09; // Smooth damping factor for inertial scrolling
  const getFramePath = (index) => `video_frames_24fps/frame_${String(index).padStart(4, '0')}.png`;

  // DOM Elements
  const canvas = document.getElementById('frameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
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
   * Preload all video sequence frames in background without blocking page
   */
  function preloadFrames() {
    // First, load frame 1 immediately for instant initial canvas paint
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

    // Load remaining frames asynchronously in background
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = (i === 1) ? firstImg : new Image();
      if (i !== 1) {
        img.src = getFramePath(i);
        images[i - 1] = img;
      }

      img.onload = () => {
        loadedCount++;
        if (!isInitialFrameRendered && (images[0]?.complete || loadedCount >= 1)) {
          isInitialFrameRendered = true;
          handleResize();
          drawFrame(0);
          currentRenderedIndex = 0;
        }
      };
      img.onerror = () => {
        loadedCount++;
      };
    }
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

    // Preload background frames asynchronously without blocking
    preloadFrames();

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

  // Certificate Modal Controller
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

  // Load Saved Certificates from localStorage
  function loadSavedCertificates() {
    try {
      const saved = JSON.parse(localStorage.getItem('portfolio_user_certs') || '[]');
      const certsGrid = document.getElementById('certs-grid');
      const uploadCard = document.querySelector('.cert-card--upload');
      if (!certsGrid || !uploadCard) return;

      saved.forEach((cert) => {
        const card = createCertCardElement(cert.imgSrc, cert.title, cert.issuer, cert.id, cert.date, cert.desc, cert.tags);
        certsGrid.insertBefore(card, uploadCard);
      });
    } catch (err) {
      console.warn('Could not load cached certificates:', err);
    }
  }

  // Save all certificates in DOM to localStorage
  function saveAllCertsToStorage() {
    try {
      const cards = document.querySelectorAll('.cert-card:not(.cert-card--upload)');
      const certsData = [];
      cards.forEach((card) => {
        const img = card.querySelector('.cert-thumb-img')?.getAttribute('src') || '';
        const title = card.querySelector('.cert-title')?.innerText.trim() || '';
        const issuer = card.querySelector('.cert-issuer')?.innerText.trim() || '';
        const date = card.querySelector('.cert-date')?.innerText.trim() || '';
        const id = card.querySelector('.cert-cred-id code')?.innerText.trim() || '';
        const desc = card.querySelector('.cert-desc')?.innerText.trim() || '';
        const tags = Array.from(card.querySelectorAll('.ptag')).map(t => t.innerText.trim()).filter(Boolean);
        certsData.push({ imgSrc: img, title, issuer, id, date, desc, tags });
      });
      localStorage.setItem('portfolio_user_certs', JSON.stringify(certsData));
    } catch (err) {
      console.warn('Could not save certificates to localStorage:', err);
    }
  }

  function createCertCardElement(imgSrc, title, issuer, id, date, desc, tags) {
    const card = document.createElement('div');
    card.className = 'cert-card';
    const tagList = (tags && tags.length) ? tags : ['Certification', 'Verified'];
    const tagsHtml = tagList.map(t => `<span class="ptag editable" contenteditable="true" spellcheck="false">${t}</span>`).join(' ');

    card.innerHTML = `
      <div class="cert-thumb-wrap">
        <img src="${imgSrc}" alt="${title}" class="cert-thumb-img">
        <button class="cert-del-btn" title="Remove Certificate" onclick="deleteCertCard(this)">✕</button>
        <div class="cert-overlay">
          <button class="cert-view-btn" onclick="openCertModalFromCard(this)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>View Certificate</span>
          </button>
        </div>
        <span class="cert-badge">Verified</span>
      </div>
      <div class="cert-info">
        <div class="cert-header-meta">
          <span class="cert-issuer editable" contenteditable="true" spellcheck="false" data-placeholder="Issuer">${issuer || 'Issued By'}</span>
          <span class="cert-date editable" contenteditable="true" spellcheck="false" data-placeholder="Date">${date || 'Date'}</span>
        </div>
        <h3 class="cert-title editable" contenteditable="true" spellcheck="false" data-placeholder="Certificate Title">${title || 'Certificate Title'}</h3>
        <p class="cert-desc editable" contenteditable="true" spellcheck="false" data-placeholder="Click here to type notes/description about this certificate (topics learned, skills, grade)...">${desc || ''}</p>
        <p class="cert-cred-id">Credential ID: <code class="editable" contenteditable="true" spellcheck="false" data-placeholder="ID">${id || 'ID-1234'}</code></p>
        <div class="cert-tags">
          ${tagsHtml}
        </div>
      </div>
    `;

    // Listen to changes on any editable element inside this card
    card.querySelectorAll('.editable').forEach((el) => {
      el.addEventListener('input', () => {
        saveAllCertsToStorage();
      });
      el.addEventListener('blur', () => {
        saveAllCertsToStorage();
      });
    });

    return card;
  }

  // Helper to open modal from inside card
  window.openCertModalFromCard = function(btn) {
    const card = btn.closest('.cert-card');
    if (!card) return;
    const imgSrc = card.querySelector('.cert-thumb-img')?.getAttribute('src') || '';
    const title = card.querySelector('.cert-title')?.innerText.trim() || 'Certificate Preview';
    const issuer = card.querySelector('.cert-issuer')?.innerText.trim() || '';
    const date = card.querySelector('.cert-date')?.innerText.trim() || '';
    const id = card.querySelector('.cert-cred-id code')?.innerText.trim() || '';
    window.openCertModal(imgSrc, title, issuer, id, date);
  };

  // Helper to delete certificate
  window.deleteCertCard = function(btn) {
    const card = btn.closest('.cert-card');
    if (!card) return;
    if (confirm('Are you sure you want to remove this certificate?')) {
      card.remove();
      saveAllCertsToStorage();
    }
  };

  // Dynamic Certificate Upload Handler (Multi-file + LocalStorage)
  window.handleCertUpload = function(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const certsGrid = document.getElementById('certs-grid');
    const uploadCard = document.querySelector('.cert-card--upload');

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const imgSrc = e.target.result;
        const fileNameClean = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');
        const certTitle = fileNameClean.charAt(0).toUpperCase() + fileNameClean.slice(1);
        const randomId = 'CERT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const today = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        const newCard = createCertCardElement(imgSrc, certTitle, 'Issued By', randomId, today, '', ['Certificate', 'Verified']);
        if (uploadCard && certsGrid) {
          certsGrid.insertBefore(newCard, uploadCard);
        }

        saveAllCertsToStorage();
      };
      reader.readAsDataURL(file);
    });

    // Reset input so re-uploading same file name triggers change
    event.target.value = '';
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
      loadSavedCertificates();
      initCertDragDrop();
      loadSavedCv();
      initCvDragDrop();
    });
  } else {
    init();
    loadSavedCertificates();
    initCertDragDrop();
    loadSavedCv();
    initCvDragDrop();
  }
})();
