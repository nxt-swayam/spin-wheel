/**
 * ═══════════════════════════════════════════════════════
 *  DECISION SPINNER — script.js
 *  Features:
 *    · Canvas wheel with unlimited sections & neon colours
 *    · Realistic randomised spin physics (ease-out cubic)
 *    · Web Audio API sound (oscillator-based, no file needed)
 *    · Confetti burst on result
 *    · LocalStorage persistence
 *    · Spin history & stats
 *    · Glassmorphism popup with taglines
 *    · Responsive / mobile-friendly
 * ═══════════════════════════════════════════════════════
 */

'use strict';

/* ──────────────────────────────────────────────────────
   CONSTANTS & STATE
────────────────────────────────────────────────────── */

const DEFAULT_OPTIONS = ['Yes', 'No', 'Maybe', 'Try Again', 'Definitely', 'Never'];

// Neon-saturated colour palette (auto-cycles for 20+ options)
const PALETTE = [
  '#00f5ff', '#a855f7', '#ec4899', '#facc15', '#22c55e', '#f97316',
  '#3b82f6', '#e879f9', '#4ade80', '#fb923c', '#38bdf8', '#f472b6',
  '#a3e635', '#c084fc', '#fbbf24', '#34d399', '#60a5fa', '#f43f5e',
  '#818cf8', '#2dd4bf',
];

// Taglines shown after spin
const TAGLINES = [
  'Trust the cosmos.', 'The wheel never lies.', 'Your fate is sealed.',
  'Accept your destiny.', 'The universe has spoken.', 'No take-backs!',
  'Written in the stars.', 'Bow to the wheel.', 'Spin complete. Obey.',
  'This is your sign.', 'Resistance is futile.', 'The oracle has decided.',
];

// Accent swatches user can pick for new options
const SWATCH_COLORS = [
  '#00f5ff', '#a855f7', '#ec4899', '#facc15', '#22c55e',
  '#f97316', '#3b82f6', '#f43f5e', '#4ade80', '#c084fc',
];

// App state
const state = {
  options:        [],   // [{ label, color }]
  isSpinning:     false,
  currentAngle:   0,    // radians – current wheel rotation
  spinCount:      0,
  selectedAccent: SWATCH_COLORS[0],
  history:        [],   // last 10 results
};

/* ──────────────────────────────────────────────────────
   DOM REFS
────────────────────────────────────────────────────── */
const canvas        = document.getElementById('wheel-canvas');
const ctx           = canvas.getContext('2d');
const spinBtn       = document.getElementById('spin-btn');
const addBtn        = document.getElementById('add-btn');
const optionInput   = document.getElementById('option-input');
const optionList    = document.getElementById('option-list');
const optionCount   = document.getElementById('option-count');
const resetBtn      = document.getElementById('reset-btn');
const clearBtn      = document.getElementById('clear-btn');
const popupOverlay  = document.getElementById('popup-overlay');
const popupResult   = document.getElementById('popup-result');
const popupTagline  = document.getElementById('popup-tagline');
const popupClose    = document.getElementById('popup-close');
const popupSpinAgain= document.getElementById('popup-spin-again');
const colorSwatches = document.getElementById('color-swatches');
const statOptions   = document.getElementById('stat-options');
const statSpins     = document.getElementById('stat-spins');
const statLast      = document.getElementById('stat-last');
const historyList   = document.getElementById('history-list');
const confettiCanvas= document.getElementById('confetti-canvas');
const cCtx          = confettiCanvas.getContext('2d');

/* ──────────────────────────────────────────────────────
   LOCALSTORE HELPERS
────────────────────────────────────────────────────── */
function saveToStorage() {
  try {
    localStorage.setItem('spinner_options', JSON.stringify(state.options));
    localStorage.setItem('spinner_spins',   JSON.stringify(state.spinCount));
    localStorage.setItem('spinner_history', JSON.stringify(state.history));
  } catch (_) {}
}

function loadFromStorage() {
  try {
    const opts = JSON.parse(localStorage.getItem('spinner_options'));
    if (Array.isArray(opts) && opts.length >= 2) {
      state.options = opts;
    } else {
      state.options = DEFAULT_OPTIONS.map((label, i) => ({
        label,
        color: PALETTE[i % PALETTE.length],
      }));
    }
    state.spinCount = JSON.parse(localStorage.getItem('spinner_spins')) || 0;
    state.history   = JSON.parse(localStorage.getItem('spinner_history')) || [];
  } catch (_) {
    state.options = DEFAULT_OPTIONS.map((label, i) => ({
      label,
      color: PALETTE[i % PALETTE.length],
    }));
  }
}

/* ──────────────────────────────────────────────────────
   OPTION MANAGEMENT
────────────────────────────────────────────────────── */
function addOption(label) {
  label = label.trim();
  if (!label) return false;
  if (label.length > 30) { label = label.slice(0, 30); }
  // Pick colour: next in palette or user accent
  const color = state.selectedAccent || PALETTE[state.options.length % PALETTE.length];
  state.options.push({ label, color });
  saveToStorage();
  renderOptionList();
  drawWheel();
  updateStats();
  return true;
}

function removeOption(index) {
  state.options.splice(index, 1);
  saveToStorage();
  renderOptionList();
  drawWheel();
  updateStats();
}

function resetOptions() {
  state.options = DEFAULT_OPTIONS.map((label, i) => ({
    label,
    color: PALETTE[i % PALETTE.length],
  }));
  saveToStorage();
  renderOptionList();
  drawWheel();
  updateStats();
}

function clearOptions() {
  state.options = [];
  saveToStorage();
  renderOptionList();
  drawWheel();
  updateStats();
}

function renderOptionList() {
  optionList.innerHTML = '';
  optionCount.textContent = state.options.length;

  if (state.options.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No options yet…';
    li.style.cssText = 'color:var(--text-faint);font-size:0.82rem;padding:8px 0;font-style:italic;';
    optionList.appendChild(li);
    return;
  }

  state.options.forEach((opt, i) => {
    const li = document.createElement('li');
    li.className = 'option-item';

    const dot = document.createElement('span');
    dot.className = 'option-dot';
    dot.style.background = opt.color;
    dot.style.color = opt.color;

    const text = document.createElement('span');
    text.className = 'option-text';
    text.textContent = opt.label;

    const rm = document.createElement('button');
    rm.className = 'option-remove';
    rm.innerHTML = '✕';
    rm.title = 'Remove option';
    rm.setAttribute('aria-label', `Remove ${opt.label}`);
    rm.addEventListener('click', (e) => {
      e.stopPropagation();
      li.style.animation = 'none';
      li.style.opacity = '0';
      li.style.transform = 'translateX(-12px)';
      li.style.transition = 'all 0.25s ease';
      setTimeout(() => removeOption(i), 240);
    });

    li.appendChild(dot);
    li.appendChild(text);
    li.appendChild(rm);
    optionList.appendChild(li);
  });
}

/* ──────────────────────────────────────────────────────
   CANVAS WHEEL DRAWING
────────────────────────────────────────────────────── */
function drawWheel() {
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R  = Math.min(cx, cy) - 4; // outer radius

  ctx.clearRect(0, 0, W, H);

  const n = state.options.length;

  if (n === 0) {
    // Draw empty placeholder wheel
    drawEmptyWheel(cx, cy, R);
    return;
  }

  const arc = (2 * Math.PI) / n;

  // ── Draw segments ──
  state.options.forEach((opt, i) => {
    const startAngle = state.currentAngle + i * arc - Math.PI / 2;
    const endAngle   = startAngle + arc;

    // Fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = opt.color;
    ctx.fill();

    // Inner shadow (dark gradient toward center)
    const grad = ctx.createRadialGradient(cx, cy, R * 0.25, cx, cy, R);
    grad.addColorStop(0, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Segment border
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startAngle, endAngle);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(6,6,16,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Text ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + arc / 2);

    const MAX_TEXT_WIDTH = R * 0.52;
    const fontSize = n <= 6 ? 17 : n <= 12 ? 14 : n <= 18 ? 12 : 10;

    ctx.font = `bold ${fontSize}px 'Syne', sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 4;
    ctx.textAlign   = 'right';
    ctx.textBaseline= 'middle';

    // Truncate label if needed
    let label = opt.label;
    while (ctx.measureText(label).width > MAX_TEXT_WIDTH && label.length > 3) {
      label = label.slice(0, -1);
    }
    if (label !== opt.label) label = label.slice(0, -1) + '…';

    ctx.fillText(label, R - 16, 0);
    ctx.restore();
  });

  // ── Outer ring ──
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // ── Outer glow ring ──
  ctx.beginPath();
  ctx.arc(cx, cy, R + 1, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(0,245,255,0.18)';
  ctx.lineWidth = 5;
  ctx.stroke();

  // ── Center hub ──
  const hubR = Math.min(56, R * 0.13);
  const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, hubR);
  hubGrad.addColorStop(0, '#1a1a3e');
  hubGrad.addColorStop(1, '#060616');
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, 2 * Math.PI);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,245,255,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawEmptyWheel(cx, cy, R) {
  // Dashed empty circle
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  grad.addColorStop(0, 'rgba(255,255,255,0.03)');
  grad.addColorStop(1, 'rgba(255,255,255,0.01)');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,245,255,0.2)';
  ctx.setLineDash([12, 8]);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = 'bold 18px Syne, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Add options to begin', cx, cy);
}

/* ──────────────────────────────────────────────────────
   SPIN PHYSICS
────────────────────────────────────────────────────── */
let animId = null;
let soundInterval = null;

function spin() {
  if (state.isSpinning) return;
  if (state.options.length < 2) {
    showError('Add at least 2 options to spin!');
    return;
  }

  state.isSpinning = true;
  spinBtn.disabled = true;
  spinBtn.classList.add('spinning');

  // Randomised physics parameters
  const extraSpins = 6 + Math.random() * 8;          // full rotations
  const arcOffset  = Math.random() * 2 * Math.PI;    // random landing offset
  const totalAngle = extraSpins * 2 * Math.PI + arcOffset;
  const duration   = 4000 + Math.random() * 3000;    // 4–7 s

  const startAngle = state.currentAngle;
  const startTime  = performance.now();

  // Start spin sound
  startSpinSound();

  function easeOut(t) {
    // Cubic ease-out with slight springiness
    return 1 - Math.pow(1 - t, 3.5);
  }

  function animate(now) {
    const elapsed = now - startTime;
    const t       = Math.min(elapsed / duration, 1);
    const eased   = easeOut(t);

    state.currentAngle = startAngle + totalAngle * eased;
    drawWheel();

    if (t < 1) {
      animId = requestAnimationFrame(animate);
    } else {
      // Spin done
      state.currentAngle = startAngle + totalAngle;
      state.isSpinning   = false;
      spinBtn.disabled   = false;
      spinBtn.classList.remove('spinning');
      stopSpinSound();
      onSpinComplete();
    }
  }

  animId = requestAnimationFrame(animate);
}

/* ──────────────────────────────────────────────────────
   RESULT CALCULATION
────────────────────────────────────────────────────── */
function getWinner() {
  const n   = state.options.length;
  const arc = (2 * Math.PI) / n;

  // The pointer is at the top (–π/2 from canvas 0).
  // We need the segment at that position relative to wheel rotation.
  const pointer  = -Math.PI / 2;
  let   relative = ((pointer - state.currentAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const index    = Math.floor(relative / arc) % n;
  return state.options[index];
}

function onSpinComplete() {
  const winner = getWinner();
  state.spinCount++;

  // Update history
  state.history.unshift({ label: winner.label, color: winner.color });
  if (state.history.length > 10) state.history.pop();

  saveToStorage();
  updateStats();
  renderHistory();

  // Fire confetti
  launchConfetti(winner.color);

  // Play win sound
  playWinSound();

  // Show popup
  showPopup(winner);
}

/* ──────────────────────────────────────────────────────
   POPUP
────────────────────────────────────────────────────── */
function showPopup(winner) {
  popupResult.textContent = winner.label;
  popupResult.style.color = winner.color;
  popupResult.style.textShadow = `0 0 30px ${winner.color}88`;

  popupTagline.textContent = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];

  popupOverlay.classList.add('visible');
  popupOverlay.setAttribute('aria-hidden', 'false');
}

function hidePopup() {
  popupOverlay.classList.remove('visible');
  popupOverlay.setAttribute('aria-hidden', 'true');
}

/* ──────────────────────────────────────────────────────
   STATS & HISTORY
────────────────────────────────────────────────────── */
function updateStats() {
  statOptions.textContent = state.options.length;
  statSpins.textContent   = state.spinCount;
  statLast.textContent    = state.history[0]?.label.slice(0, 6) || '—';
}

function renderHistory() {
  historyList.innerHTML = '';
  if (state.history.length === 0) {
    const li = document.createElement('li');
    li.className = 'history-empty';
    li.textContent = 'No spins yet…';
    historyList.appendChild(li);
    return;
  }
  state.history.forEach((h, i) => {
    const li = document.createElement('li');
    li.className = 'history-item';

    const dot = document.createElement('span');
    dot.className = 'history-dot';
    dot.style.background = h.color;
    dot.style.boxShadow  = `0 0 6px ${h.color}`;

    const text = document.createElement('span');
    text.textContent = h.label;
    text.style.flex = '1';

    const num = document.createElement('span');
    num.className = 'history-num';
    num.textContent = `#${state.spinCount - i}`;

    li.appendChild(dot);
    li.appendChild(text);
    li.appendChild(num);
    historyList.appendChild(li);
  });
}

/* ──────────────────────────────────────────────────────
   ERROR SHAKE
────────────────────────────────────────────────────── */
function showError(msg) {
  const wrapper = document.getElementById('wheel-wrapper');
  wrapper.classList.remove('shake');
  void wrapper.offsetWidth; // reflow
  wrapper.classList.add('shake');

  // Brief flash message near spin button
  spinBtn.querySelector('.spin-sub').textContent = msg;
  setTimeout(() => {
    spinBtn.querySelector('.spin-sub').textContent = 'Click me!';
  }, 1800);
}

/* ──────────────────────────────────────────────────────
   SOUND (Web Audio API — no external files)
────────────────────────────────────────────────────── */
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Tick sound during spinning
let spinOsc = null;
let spinGain= null;
let tickInterval = null;

function startSpinSound() {
  try {
    const ac = getAudioCtx();
    let tick = 0;

    function playTick() {
      const osc = ac.createOscillator();
      const g   = ac.createGain();
      osc.connect(g);
      g.connect(ac.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440 + (tick % 8) * 80, ac.currentTime);

      g.gain.setValueAtTime(0.08, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);

      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.08);
      tick++;
    }

    playTick();
    // Speed up ticks initially, slow down toward end — approximated by interval
    let interval = 80;
    function schedule() {
      if (!state.isSpinning) { clearTimeout(tickInterval); return; }
      playTick();
      interval = Math.min(interval + 3, 240); // gradually slow
      tickInterval = setTimeout(schedule, interval);
    }
    tickInterval = setTimeout(schedule, interval);
  } catch (_) {}
}

function stopSpinSound() {
  clearTimeout(tickInterval);
}

function playWinSound() {
  try {
    const ac = getAudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6 – major chord arpeggio

    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g   = ac.createGain();
      osc.connect(g);
      g.connect(ac.destination);

      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = ac.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc.start(t);
      osc.stop(t + 0.65);
    });
  } catch (_) {}
}

/* ──────────────────────────────────────────────────────
   CONFETTI
────────────────────────────────────────────────────── */
const confettiParticles = [];

function launchConfetti(accentColor) {
  confettiCanvas.width  = window.innerWidth;
  confettiCanvas.height = window.innerHeight;

  const colors = [accentColor, '#00f5ff', '#a855f7', '#facc15', '#ec4899', '#22c55e', '#ffffff'];

  for (let i = 0; i < 140; i++) {
    confettiParticles.push({
      x:     Math.random() * confettiCanvas.width,
      y:     -20 - Math.random() * 100,
      vx:    (Math.random() - 0.5) * 8,
      vy:    3 + Math.random() * 6,
      size:  5 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot:   Math.random() * Math.PI * 2,
      rotV:  (Math.random() - 0.5) * 0.2,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      alpha: 1,
    });
  }

  animateConfetti();
}

function animateConfetti() {
  cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const p = confettiParticles[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.12; // gravity
    p.rot += p.rotV;
    p.alpha -= 0.008;

    if (p.alpha <= 0 || p.y > confettiCanvas.height + 30) {
      confettiParticles.splice(i, 1);
      continue;
    }

    cCtx.save();
    cCtx.globalAlpha = p.alpha;
    cCtx.translate(p.x, p.y);
    cCtx.rotate(p.rot);
    cCtx.fillStyle = p.color;

    if (p.shape === 'rect') {
      cCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else {
      cCtx.beginPath();
      cCtx.arc(0, 0, p.size / 2, 0, 2 * Math.PI);
      cCtx.fill();
    }
    cCtx.restore();
  }

  if (confettiParticles.length > 0) {
    requestAnimationFrame(animateConfetti);
  } else {
    cCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

/* ──────────────────────────────────────────────────────
   AMBIENT PARTICLES (background)
────────────────────────────────────────────────────── */
function initParticles() {
  const container = document.getElementById('particles');
  const count     = 40;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';

    const size  = 1 + Math.random() * 3;
    const hue   = Math.random() > 0.5 ? '180deg' : '270deg'; // cyan or violet
    const dur   = 8 + Math.random() * 16;
    const delay = Math.random() * -20;
    const left  = Math.random() * 100;

    p.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${left}%;
      bottom: -10px;
      background: hsl(${hue}, 100%, 70%);
      box-shadow: 0 0 ${size * 3}px hsl(${hue}, 100%, 70%);
      animation-duration: ${dur}s;
      animation-delay: ${delay}s;
    `;
    container.appendChild(p);
  }
}

/* ──────────────────────────────────────────────────────
   COLOR SWATCHES
────────────────────────────────────────────────────── */
function renderSwatches() {
  colorSwatches.innerHTML = '';
  SWATCH_COLORS.forEach((color, i) => {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (i === 0 ? ' active' : '');
    btn.style.background = color;
    btn.style.color = color;
    btn.title = color;
    btn.setAttribute('aria-label', `Select color ${color}`);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      state.selectedAccent = color;
    });
    colorSwatches.appendChild(btn);
  });
}

/* ──────────────────────────────────────────────────────
   CANVAS SIZING (responsive)
────────────────────────────────────────────────────── */
function resizeCanvas() {
  const wrapper = document.getElementById('wheel-wrapper');
  const size = Math.min(wrapper.clientWidth, wrapper.clientHeight, 520);
  canvas.width  = size;
  canvas.height = size;
  drawWheel();
}

/* ──────────────────────────────────────────────────────
   EVENT LISTENERS
────────────────────────────────────────────────────── */
spinBtn.addEventListener('click', spin);
canvas.addEventListener('click', () => { if (!state.isSpinning) spin(); });

addBtn.addEventListener('click', () => {
  const val = optionInput.value.trim();
  if (!val) {
    optionInput.classList.add('shake');
    setTimeout(() => optionInput.classList.remove('shake'), 420);
    return;
  }
  if (addOption(val)) {
    optionInput.value = '';
    optionInput.focus();
  }
});

optionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addBtn.click();
});

resetBtn.addEventListener('click', () => {
  if (confirm('Reset to default options?')) resetOptions();
});

clearBtn.addEventListener('click', () => {
  if (state.options.length === 0) return;
  if (confirm('Clear all options?')) clearOptions();
});

popupClose.addEventListener('click', hidePopup);
popupSpinAgain.addEventListener('click', () => { hidePopup(); setTimeout(spin, 300); });
popupOverlay.addEventListener('click', (e) => {
  if (e.target === popupOverlay) hidePopup();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hidePopup();
  if (e.key === ' ' && document.activeElement !== optionInput) {
    e.preventDefault();
    spin();
  }
});

window.addEventListener('resize', () => {
  resizeCanvas();
  confettiCanvas.width  = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
});

/* ──────────────────────────────────────────────────────
   INIT
────────────────────────────────────────────────────── */
function init() {
  loadFromStorage();
  renderSwatches();
  renderOptionList();
  renderHistory();
  updateStats();
  initParticles();
  resizeCanvas();

  // Initial wheel draw with a subtle entrance animation
  let startT = null;
  const INTRO_DUR = 900;
  function introAnim(ts) {
    if (!startT) startT = ts;
    const t = Math.min((ts - startT) / INTRO_DUR, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    state.currentAngle = ease * (Math.PI * 2);
    drawWheel();
    if (t < 1) requestAnimationFrame(introAnim);
    else { state.currentAngle = 0; drawWheel(); }
  }
  requestAnimationFrame(introAnim);
}

init();