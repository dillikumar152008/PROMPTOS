'use client';

import React, { useEffect, useRef } from 'react';

// ============================================================================
// DLP SCAN BACKGROUND TUNING CONSTANTS
// ============================================================================
export const DLP_BG_CONFIG = {
  TEXT_OPACITY: 0.14,         // Base opacity for background dummy data
  SCAN_LINE_OPACITY: 0.28,    // Emerald scan line sweep opacity
  DETECT_FLASH_OPACITY: 0.55, // Flash opacity when scan line / cursor detects value
  COLUMN_DENSITY: 1.0,        // Column density multiplier (1.0 = standard)
  SCAN_SPEED: 1.0,            // Sweep speed multiplier (1.0 = ~9s per cycle)
  FPS_CAP: 30,                // Frame rate limit for battery & GPU efficiency
};

interface DummyPattern {
  raw: string;
  masked: string;
  category: string;
}

const DUMMY_DATA: DummyPattern[] = [
  { raw: '0000 0000 0000', masked: '[AADHAAR_1]', category: 'Aadhaar' },
  { raw: 'ABCDE1234F', masked: '[PAN_1]', category: 'PAN' },
  { raw: '0000 0000 0000 0000', masked: '[CARD_1]', category: 'Card' },
  { raw: 'sk-test-000000000000', masked: '[KEY_1]', category: 'API Key' },
  { raw: '+91 90000 00000', masked: '[PHONE_1]', category: 'Phone' },
  { raw: '9999 0000 1111', masked: '[AADHAAR_2]', category: 'Aadhaar' },
  { raw: 'WXYZP9876Q', masked: '[PAN_2]', category: 'PAN' },
  { raw: 'sk-live-000000000000', masked: '[KEY_2]', category: 'API Key' },
  { raw: '4111 1111 1111 1111', masked: '[CARD_2]', category: 'Card' },
  { raw: '+91 98888 77777', masked: '[PHONE_2]', category: 'Phone' },
  { raw: '8888 0000 3333', masked: '[AADHAAR_3]', category: 'Aadhaar' },
  { raw: 'JKLMK4321R', masked: '[PAN_3]', category: 'PAN' },
  { raw: '5500 0000 0000 0004', masked: '[CARD_3]', category: 'Card' },
  { raw: 'sk-ant-000000000000', masked: '[KEY_3]', category: 'API Key' },
  { raw: '+91 91234 56789', masked: '[PHONE_3]', category: 'Phone' },
];

interface CellItem {
  pattern: DummyPattern;
  colIndex: number;
  y: number;
  detectedAt: number;     // timestamp when detection triggered (0 if inactive)
  maskDuration: number;   // 4000ms to 6000ms
  showTag: boolean;       // whether to display tiny "masked" tag
}

export const DlpScanBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;
    let lastRenderTime = 0;
    let lastTime = performance.now();

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Check pointer fine (desktop pointer)
    const hasFinePointer =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: fine)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;

    // Scan line sweep cycle (~9s default)
    const sweepDuration = 9000 / DLP_BG_CONFIG.SCAN_SPEED;

    // Mouse / Cursor scanner coordinates
    let mouseX = -9999;
    let mouseY = -9999;

    // Scroll reaction variables
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    let scrollVelocity = 0;

    // Tag frequency limiter
    let lastTagTimestamp = 0;

    // Grid state
    let numCols = 0;
    let colWidth = 180;
    const rowHeight = 40;
    let totalColHeight = 0;
    let colSpeeds: number[] = [];
    let items: CellItem[] = [];

    const initGrid = () => {
      const isMobile = width < 768;
      colWidth = Math.floor((isMobile ? 140 : 185) / DLP_BG_CONFIG.COLUMN_DENSITY);
      numCols = Math.max(2, Math.floor(width / colWidth));

      // Columns speeds: slow drift between 8 and 14 px/sec
      colSpeeds = Array.from({ length: numCols }, (_, i) => 8 + (i % 3) * 3);

      const numRows = Math.ceil(height / rowHeight) + 3;
      totalColHeight = numRows * rowHeight;
      items = [];

      let patternIdx = 0;
      const now = performance.now();
      for (let c = 0; c < numCols; c++) {
        for (let r = 0; r < numRows; r++) {
          const pattern = DUMMY_DATA[patternIdx % DUMMY_DATA.length];
          patternIdx++;

          // Clean resting state: exactly ~16.7% (1 in 6) of cells start masked with staggered phases
          // The other ~83.3% start as original raw values. Page NEVER loads with most cells masked.
          const isInitialMasked = (c * 7 + r) % 6 === 0;
          const maskDuration = 4000 + ((c * 31 + r * 17) % 2000); // 4000-6000ms

          items.push({
            pattern,
            colIndex: c,
            y: r * rowHeight - rowHeight,
            // Stagger start time so initially masked cells unmask naturally over 1-4s
            detectedAt: isInitialMasked
              ? (prefersReducedMotion ? 1 : now - ((c * 19 + r * 23) % 3500))
              : 0,
            maskDuration: prefersReducedMotion ? Infinity : maskDuration,
            showTag: false,
          });
        }
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      initGrid();

      if (prefersReducedMotion) {
        drawStatic();
      }
    };

    // Draw static snapshot for reduced motion
    const drawStatic = () => {
      if (!ctx || width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);

      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const cellW = width / numCols;
      const heroCenterX = width / 2;
      const heroRectHalfW = Math.min(width * 0.46, 510);
      const heroRectTop = 65;
      const heroRectBottom = width < 640 ? 485 : 445;
      const featherMargin = 60;

      items.forEach((item) => {
        const x = item.colIndex * cellW + cellW / 2;
        const text = item.detectedAt > 0 ? item.pattern.masked : item.pattern.raw;

        // Clear area behind hero headline, subtext, and buttons
        const dx = Math.max(0, Math.abs(x - heroCenterX) - heroRectHalfW);
        const dy = item.y < heroRectTop ? heroRectTop - item.y : item.y > heroRectBottom ? item.y - heroRectBottom : 0;
        const distToHeroRect = Math.hypot(dx, dy);

        let softness = 1.0;
        if (distToHeroRect === 0) {
          softness = 0.25;
        } else if (distToHeroRect < featherMargin) {
          softness = 0.25 + 0.75 * (distToHeroRect / featherMargin);
        }

        ctx.fillStyle = item.detectedAt > 0
          ? `rgba(52, 211, 153, ${DLP_BG_CONFIG.TEXT_OPACITY * 1.5 * softness})`
          : `rgba(161, 161, 170, ${DLP_BG_CONFIG.TEXT_OPACITY * softness})`;

        ctx.fillText(text, x, item.y);
      });
    };

    // Helper: draw 1px rounded rectangle
    const drawRoundedBox = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.stroke();
    };

    const render = (now: number) => {
      if (!isVisible) return;

      // Cap at ~30 FPS
      const fpsInterval = 1000 / DLP_BG_CONFIG.FPS_CAP;
      if (now - lastRenderTime < fpsInterval) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      lastRenderTime = now;

      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // Scan line position across viewport height
      const cycleProgress = (now % sweepDuration) / sweepDuration;
      const scanY = cycleProgress * (height + 50) - 25;

      // Scroll speed reaction decay
      scrollVelocity *= 0.92;

      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const cellW = width / numCols;
      const heroCenterX = width / 2;
      const heroRectHalfW = Math.min(width * 0.46, 510);
      const heroRectTop = 65;
      const heroRectBottom = width < 640 ? 485 : 445;
      const featherMargin = 60;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const x = item.colIndex * cellW + cellW / 2;
        const speed = colSpeeds[item.colIndex] + scrollVelocity;

        // Slow upward vertical drift with loop wrap
        item.y -= speed * delta;
        if (item.y < -rowHeight) {
          item.y += totalColHeight;
        }

        // 1. Detection trigger from scan line (maintains 15-20% resting state)
        const distToScan = Math.abs(item.y - scanY);
        const isReadyForScan = item.detectedAt === 0 || (now - item.detectedAt > item.maskDuration + 1500);
        if (distToScan < 16 && isReadyForScan) {
          // Selectively trigger ~33% of cells so steady-state across the viewport stays ~15-20%
          const cellHash = (item.colIndex * 13 + Math.floor(((item.y % totalColHeight) + totalColHeight) / rowHeight)) % 3;
          if (cellHash === 0) {
            item.detectedAt = now;
            item.maskDuration = 4000 + Math.random() * 2000; // 4-6 seconds

            // Occasionally show tiny "masked" tag (max 1 every ~3s)
            if (now - lastTagTimestamp > 3200) {
              item.showTag = true;
              lastTagTimestamp = now;
            } else {
              item.showTag = false;
            }
          }
        }

        // 2. Detection trigger from cursor scanner (desktop fine pointer only)
        if (hasFinePointer && mouseX > 0 && mouseY > 0) {
          const distToMouse = Math.hypot(x - mouseX, item.y - mouseY);
          if (distToMouse < 120 && (item.detectedAt === 0 || now - item.detectedAt > item.maskDuration)) {
            item.detectedAt = now;
            item.maskDuration = 4500;
            item.showTag = false;
          }
        }

        // 3. Clear area behind hero text (headline, subtext, and buttons)
        // Drops opacity to 25% of normal directly behind text, feathered to 1.0 outside. Sides stay normal.
        const dx = Math.max(0, Math.abs(x - heroCenterX) - heroRectHalfW);
        const dy = item.y < heroRectTop ? heroRectTop - item.y : item.y > heroRectBottom ? item.y - heroRectBottom : 0;
        const distToHeroRect = Math.hypot(dx, dy);

        let softness = 1.0;
        if (distToHeroRect === 0) {
          softness = 0.25;
        } else if (distToHeroRect < featherMargin) {
          softness = 0.25 + 0.75 * (distToHeroRect / featherMargin);
        }

        // 4. Sequence state rendering
        if (item.detectedAt > 0) {
          const timeSince = now - item.detectedAt;

          if (timeSince < 300) {
            // (a) Flash phase (first 300ms): bright flash + 1px emerald rounded outline box
            const flashAlpha = DLP_BG_CONFIG.DETECT_FLASH_OPACITY * softness;
            ctx.fillStyle = `rgba(244, 244, 245, ${flashAlpha})`;
            ctx.fillText(item.pattern.raw, x, item.y);

            // Emerald detection box
            ctx.strokeStyle = `rgba(52, 211, 153, ${0.45 * softness})`;
            ctx.lineWidth = 1;
            const textWidth = Math.min(ctx.measureText(item.pattern.raw).width + 16, cellW - 8);
            drawRoundedBox(x - textWidth / 2, item.y - 11, textWidth, 22, 4);

          } else if (timeSince < item.maskDuration) {
            // (b) Masked placeholder phase (4-6s)
            // Emerald tint fading slightly into muted zinc
            const maskedAlpha = Math.max(DLP_BG_CONFIG.TEXT_OPACITY * 1.3, 0.18) * softness;
            ctx.fillStyle = `rgba(52, 211, 153, ${maskedAlpha})`;
            ctx.fillText(item.pattern.masked, x, item.y);

            // Fading box during 300ms-600ms
            if (timeSince < 600) {
              const boxFade = (1 - (timeSince - 300) / 300) * 0.35 * softness;
              ctx.strokeStyle = `rgba(52, 211, 153, ${boxFade})`;
              ctx.lineWidth = 1;
              const textWidth = Math.min(ctx.measureText(item.pattern.masked).width + 16, cellW - 8);
              drawRoundedBox(x - textWidth / 2, item.y - 11, textWidth, 22, 4);
            }

            // Optional tiny "masked" tag fading out over 1.6s
            if (item.showTag && timeSince < 1600) {
              const tagAlpha = (1 - timeSince / 1600) * 0.75 * softness;
              ctx.save();
              ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
              ctx.fillStyle = `rgba(52, 211, 153, ${tagAlpha})`;
              ctx.fillText('masked', x + 58, item.y - 8);
              ctx.restore();
            }

          } else {
            // (c) Restored to original raw value
            item.detectedAt = 0;
            item.showTag = false;
            const textAlpha = DLP_BG_CONFIG.TEXT_OPACITY * softness;
            ctx.fillStyle = `rgba(161, 161, 170, ${textAlpha})`;
            ctx.fillText(item.pattern.raw, x, item.y);
          }

        } else {
          // Standard unmasked state
          const textAlpha = DLP_BG_CONFIG.TEXT_OPACITY * softness;
          ctx.fillStyle = `rgba(161, 161, 170, ${textAlpha})`;
          ctx.fillText(item.pattern.raw, x, item.y);
        }
      }

      // 5. Thin horizontal emerald scan line
      if (scanY >= 0 && scanY <= height) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(52, 211, 153, ${DLP_BG_CONFIG.SCAN_LINE_OPACITY})`;
        ctx.lineWidth = 1;
        ctx.moveTo(0, scanY);
        ctx.lineTo(width, scanY);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    // Event Listeners
    const handlePointerMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handlePointerLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
    };

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const diff = Math.abs(currentScrollY - lastScrollY);
      scrollVelocity = Math.min(scrollVelocity + diff * 0.4, 40);
      lastScrollY = currentScrollY;
    };

    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';
      if (isVisible && !prefersReducedMotion) {
        lastTime = performance.now();
        lastRenderTime = performance.now();
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (hasFinePointer && !prefersReducedMotion) {
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      window.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    }

    if (!prefersReducedMotion) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', handleResize, { passive: true });

    handleResize();

    if (!prefersReducedMotion) {
      lastTime = performance.now();
      lastRenderTime = performance.now();
      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none select-none z-0"
    />
  );
};
