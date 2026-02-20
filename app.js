/* Archery Coach – lightweight offline tracker
   Data is stored locally in the browser (localStorage).
   You can export/import JSON backups in Settings.
*/

const STORAGE_KEY = 'archeryCoach.v2';

const STEPS = [
  { id: 'stance', name: '1) Stance', tip: 'Set your feet and posture consistently.' },
  { id: 'nock', name: '2) Nock Arrow', tip: 'Nock the arrow under control, every time.' },
  { id: 'drawHand', name: '3) Draw Hand Placement', tip: 'Hook the string the same way each shot.' },
  { id: 'bowHand', name: '4) Bow Hand Placement', tip: 'Relaxed bow hand, repeatable grip.' },
  { id: 'preDraw', name: '5) Pre-Draw', tip: 'Start the draw smoothly, arrow level and safe.' },
  { id: 'draw', name: '6) Draw', tip: 'Pull with back/shoulders, keep alignment.' },
  { id: 'anchor', name: '7) Anchor', tip: 'Find a solid anchor point and settle.' },
  { id: 'aim', name: '8) Aim', tip: 'Aim using your consistent sight picture/reference.' },
  { id: 'shotSetup', name: '9) Shot Setup', tip: 'Settle, breathe, and commit to the shot.' },
  { id: 'release', name: '10) Release', tip: 'Relax fingers for a clean release.' },
  { id: 'followThrough', name: '11) Follow-Through & Reflect', tip: 'Hold your finish and learn from it.' }
];

const ANIMAL_DISTANCES = [10, 11, 12, 13, 14, 15];
const PAPER_DISTANCES = [10, 15];

// Based on NASP 3D rule ordering (turkey @ ~10m, stone sheep @ ~15m; others between).
const DEFAULT_ANIMALS = [
  { key: 'buck', name: 'Buck' },
  { key: 'warthog', name: 'Warthog' },
  { key: 'bushpig', name: 'Bushpig' },
  { key: 'baboon', name: 'Baboon' },
  { key: 'porcupine', name: 'Porcupine' }
];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function getActiveProfileId(){
  if (state.activeProfileId) return state.activeProfileId;
  if (state.profiles && state.profiles.length) return state.profiles[0].id;
  return null;
}
function ensureProfiles(){
  if (!Array.isArray(state.profiles) || state.profiles.length === 0) {
    const pid = uid();
    state.profiles = [{ id: pid, name: 'Archer 1', createdAt: new Date().toISOString() }];
    state.activeProfileId = pid;
  }
  if (!state.activeProfileId) state.activeProfileId = state.profiles[0].id;
  // attach profileId to existing records if missing
  const pid = state.activeProfileId;
  (state.practice || []).forEach(r => { if (r && !r.profileId) r.profileId = pid; });
  (state.competitions || []).forEach(r => { if (r && !r.profileId) r.profileId = pid; });
  (state.aimMaps || []).forEach(r => { if (r && !r.profileId) r.profileId = pid; });
}
function practiceForActive(){ const pid = getActiveProfileId(); return (state.practice||[]).filter(r => (r.profileId||pid) === pid); }
function competitionsForActive(){ const pid = getActiveProfileId(); return (state.competitions||[]).filter(r => (r.profileId||pid) === pid); }
function aimMapsForActive(){ const pid = getActiveProfileId(); return (state.aimMaps||[]).filter(r => (r.profileId||pid) === pid); }


function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}
function formatDate(ymd) {
  // ymd: YYYY-MM-DD
  if (!ymd) return '';
  const [y,m,d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m||1)-1, d||1);
  return dt.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });
}
function toLocalDateTimeInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2,'0');
  const y = date.getFullYear();
  const m = pad(date.getMonth()+1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}
function parseTags(s) {
  return (s || '')
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 30);
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

function defaultState() {
  const pid = uid();
  return {
    profiles: [
      { id: pid, name: 'Archer 1', createdAt: new Date().toISOString() }
    ],
    activeProfileId: pid,
    practice: [],
    competitions: [],
    aimMaps: [],
    settings: {
      animalScoring: 'nasp3d'
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // lightweight migrations / defaults
    const st = Object.assign(defaultState(), parsed);
    st.settings = Object.assign(defaultState().settings, parsed.settings || {});
    st.practice = Array.isArray(st.practice) ? st.practice : [];
    st.competitions = Array.isArray(st.competitions) ? st.competitions : [];
    st.aimMaps = Array.isArray(st.aimMaps) ? st.aimMaps : [];

    // profiles support (up to 5)
    if (!Array.isArray(st.profiles) || st.profiles.length === 0) {
      const pid = uid();
      st.profiles = [{ id: pid, name: 'Archer 1', createdAt: new Date().toISOString() }];
      st.activeProfileId = pid;
    }
    if (!st.activeProfileId) st.activeProfileId = st.profiles[0].id;
    const pid = st.activeProfileId;
    st.practice.forEach(r => { if (r && !r.profileId) r.profileId = pid; });
    st.competitions.forEach(r => { if (r && !r.profileId) r.profileId = pid; });
    st.aimMaps.forEach(r => { if (r && !r.profileId) r.profileId = pid; });

    // migrate older bullseye shapes (numbers) to arrays
    st.practice.forEach(s => {
      if (s && s.bullseye) {
        if (typeof s.bullseye.m10 === 'number') s.bullseye.m10 = [s.bullseye.m10];
        if (typeof s.bullseye.m15 === 'number') s.bullseye.m15 = [s.bullseye.m15];
        if (!Array.isArray(s.bullseye.m10)) s.bullseye.m10 = [];
        if (!Array.isArray(s.bullseye.m15)) s.bullseye.m15 = [];
      }
    });
    st.competitions.forEach(c => {
      if (c && c.round === 'bullseye' && c.bullseye) {
        // legacy numeric structure
        if (typeof c.bullseye.m10 === 'number' || typeof c.bullseye.m15 === 'number') {
          c.bullseye = {
            format: 'legacy',
            m10: [typeof c.bullseye.m10 === 'number' ? c.bullseye.m10 : 0],
            m15: [typeof c.bullseye.m15 === 'number' ? c.bullseye.m15 : 0]
          };
          if (!c.category) c.category = 'adult';
        }
      }
    });

    return st;
  } catch (e) {
    console.warn('Failed to load state; resetting.', e);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
ensureProfiles();

// --- Built-in placeholder images (SVG) ---
function svgData(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function builtInPaperTargetSvg() {
  // Simple 80cm-style target visual (not an official face)
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
    <rect width="600" height="600" fill="#ffffff"/>
    <g transform="translate(300,300)">
      ${[
        {r:280, c:'#ffffff'},
        {r:240, c:'#000000'},
        {r:200, c:'#000000'},
        {r:160, c:'#008cff'},
        {r:120, c:'#008cff'},
        {r:90,  c:'#ff3c3c'},
        {r:60,  c:'#ff3c3c'},
        {r:40,  c:'#ffd700'},
        {r:22,  c:'#ffd700'}
      ].map(o => `<circle r="${o.r}" fill="${o.c}" stroke="#111" stroke-width="2"/>`).join('')}
      <circle r="8" fill="#111"/>
    </g>
    <text x="16" y="32" font-family="system-ui, sans-serif" font-size="16" fill="#475569">Paper target (placeholder)</text>
  </svg>`;
  return svgData(svg);
}

function builtInAnimalSvg(key, label) {
  // Minimal silhouettes (placeholder). Users can upload photos/scans for their own targets.
  const common = `
    <defs>
      <linearGradient id="bg" x1="0" x2="1">
        <stop offset="0" stop-color="#f8fafc"/>
        <stop offset="1" stop-color="#eef2ff"/>
      </linearGradient>
    </defs>
    <rect width="800" height="450" fill="url(#bg)"/>
    <text x="20" y="36" font-family="system-ui, sans-serif" font-size="20" fill="#334155">${label} (placeholder)</text>
    <text x="20" y="62" font-family="system-ui, sans-serif" font-size="14" fill="#64748b">Upload your own target face image to match what you shoot.</text>
  `;

  let body = '';
  if (key === 'turkey') {
    body = `
      <g transform="translate(230,110)" fill="#111827">
        <ellipse cx="210" cy="160" rx="150" ry="110" opacity=".9"/>
        <circle cx="360" cy="150" r="28" opacity=".9"/>
        <rect x="372" y="150" width="40" height="14" rx="7" opacity=".9"/>
        <g opacity=".8">
          ${Array.from({length:8}).map((_,i)=> {
            const a = -60 + i*15;
            return `<path d="M220 160 L80 120" stroke="#111827" stroke-width="14" stroke-linecap="round" transform="rotate(${a} 220 160)" />`;
          }).join('')}
        </g>
        <ellipse cx="210" cy="160" rx="80" ry="55" fill="none" stroke="#ffffff" stroke-width="4" opacity=".65"/>
      </g>`;
  } else if (key === 'coyote') {
    body = `
      <g transform="translate(150,170)" fill="#111827" opacity=".9">
        <rect x="80" y="90" width="330" height="90" rx="40"/>
        <polygon points="410,120 500,95 520,120 500,145" />
        <rect x="120" y="170" width="34" height="110" rx="14"/>
        <rect x="200" y="170" width="34" height="110" rx="14"/>
        <rect x="280" y="170" width="34" height="110" rx="14"/>
        <rect x="360" y="170" width="34" height="110" rx="14"/>
        <path d="M90 120 C 20 140, 20 210, 80 220" fill="none" stroke="#111827" stroke-width="22" stroke-linecap="round"/>
        <ellipse cx="250" cy="135" rx="70" ry="44" fill="none" stroke="#ffffff" stroke-width="4" opacity=".65"/>
      </g>`;
  } else if (key === 'bear') {
    body = `
      <g transform="translate(140,120)" fill="#111827" opacity=".9">
        <ellipse cx="250" cy="210" rx="210" ry="140"/>
        <circle cx="455" cy="190" r="54"/>
        <circle cx="420" cy="140" r="26"/>
        <rect x="120" y="320" width="44" height="90" rx="18"/>
        <rect x="210" y="320" width="44" height="90" rx="18"/>
        <rect x="300" y="320" width="44" height="90" rx="18"/>
        <rect x="390" y="320" width="44" height="90" rx="18"/>
        <ellipse cx="250" cy="220" rx="95" ry="70" fill="none" stroke="#ffffff" stroke-width="4" opacity=".65"/>
      </g>`;
  } else if (key === 'antelope') {
    body = `
      <g transform="translate(130,140)" fill="#111827" opacity=".9">
        <ellipse cx="260" cy="220" rx="210" ry="120"/>
        <circle cx="455" cy="170" r="48"/>
        <path d="M450 80 C 470 40, 510 30, 520 70" fill="none" stroke="#111827" stroke-width="12" stroke-linecap="round"/>
        <path d="M430 90 C 440 55, 470 40, 480 70" fill="none" stroke="#111827" stroke-width="10" stroke-linecap="round"/>
        <rect x="140" y="320" width="36" height="110" rx="14"/>
        <rect x="230" y="320" width="36" height="110" rx="14"/>
        <rect x="320" y="320" width="36" height="110" rx="14"/>
        <rect x="410" y="320" width="36" height="110" rx="14"/>
        <ellipse cx="250" cy="230" rx="90" ry="62" fill="none" stroke="#ffffff" stroke-width="4" opacity=".65"/>
      </g>`;
  } else if (key === 'deer') {
    body = `
      <g transform="translate(120,140)" fill="#111827" opacity=".9">
        <ellipse cx="270" cy="225" rx="220" ry="125"/>
        <circle cx="485" cy="170" r="50"/>
        <path d="M480 70 C 460 30, 520 18, 510 70" fill="none" stroke="#111827" stroke-width="10" stroke-linecap="round"/>
        <path d="M500 70 C 540 30, 590 50, 545 90" fill="none" stroke="#111827" stroke-width="10" stroke-linecap="round"/>
        <path d="M465 80 C 430 55, 420 30, 455 40" fill="none" stroke="#111827" stroke-width="10" stroke-linecap="round"/>
        <rect x="140" y="330" width="36" height="110" rx="14"/>
        <rect x="235" y="330" width="36" height="110" rx="14"/>
        <rect x="330" y="330" width="36" height="110" rx="14"/>
        <rect x="425" y="330" width="36" height="110" rx="14"/>
        <ellipse cx="260" cy="235" rx="92" ry="64" fill="none" stroke="#ffffff" stroke-width="4" opacity=".65"/>
      </g>`;
  } else { // sheep
    body = `
      <g transform="translate(135,140)" fill="#111827" opacity=".9">
        <ellipse cx="270" cy="225" rx="220" ry="125"/>
        <circle cx="480" cy="185" r="46"/>
        <path d="M460 170 C 420 120, 430 70, 480 80 C 535 92, 540 150, 500 175" fill="none" stroke="#111827" stroke-width="18" stroke-linecap="round"/>
        <rect x="150" y="330" width="40" height="110" rx="14"/>
        <rect x="245" y="330" width="40" height="110" rx="14"/>
        <rect x="340" y="330" width="40" height="110" rx="14"/>
        <rect x="435" y="330" width="40" height="110" rx="14"/>
        <ellipse cx="260" cy="235" rx="92" ry="64" fill="none" stroke="#ffffff" stroke-width="4" opacity=".65"/>
      </g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    ${common}
    ${body}
  </svg>`;
  return svgData(svg);
}

function getBuiltinImageForMap(map) {
  if (!map || map.imageKind !== 'builtin') return null;
  if (map.builtinKey === 'paper') return builtInPaperTargetSvg();
  const animal = DEFAULT_ANIMALS.find(a => a.key === map.builtinKey);
  return builtInAnimalSvg(map.builtinKey, animal ? animal.name : 'Animal');
}

// --- DOM helpers ---
const $ = (sel) => document.querySelector(sel);
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.entries(v).forEach(([dk,dv]) => node.dataset[dk] = dv);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, String(v));
  });
  for (const ch of children) node.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch);
  return node;
}

// --- Navigation ---
function setTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const is = btn.dataset.tab === tabId;
    btn.setAttribute('aria-selected', is ? 'true' : 'false');
  });
  document.querySelectorAll('.section').forEach(sec => {
    sec.classList.toggle('active', sec.id === tabId);
  });
  // refresh chart canvases when becoming visible
  if (tabId === 'progress') renderProgress();
  if (tabId === 'trends') renderTrends();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
});

// --- Practice UI ---
let editingPracticeId = null;


// Dynamic bullseye round entry UI (variable number of rounds per distance)
function addRoundRow(listEl, dist, value = 0, opts = {}) {
  const row = el('div', { class: 'roundrow' });
  const label = el('div', { class: 'roundlabel' }, [opts.label || `${dist}m`]);
  const inp = el('input', {
    type: 'number',
    min: '0',
    max: '50',
    step: '1',
    value: String(clamp(safeNumber(value), 0, 50)),
    'data-dist': String(dist),
    class: opts.inputClass || 'round-input'
  });
  row.appendChild(label);
  row.appendChild(inp);

  if (opts.removable) {
    const rm = el('button', { type: 'button', class: 'btn danger small' }, ['Remove']);
    rm.addEventListener('click', () => row.remove());
    row.appendChild(rm);
  }

  listEl.appendChild(row);
}

function clearRoundList(listEl){
  listEl.innerHTML = '';
}

function setPracticeRoundLists(m10 = [], m15 = []){
  const list10 = $('#p_b10_list');
  const list15 = $('#p_b15_list');
  if (!list10 || !list15) return;
  clearRoundList(list10);
  clearRoundList(list15);
  // Default: one row each, but allow empty distances
  (m10 && m10.length ? m10 : [0]).forEach((v, i) => addRoundRow(list10, 10, v, { removable: true, label: `Round ${i+1}` }));
  (m15 && m15.length ? m15 : [0]).forEach((v, i) => addRoundRow(list15, 15, v, { removable: true, label: `Round ${i+1}` }));
}

function collectPracticeRounds(dist){
  const listEl = dist === 10 ? $('#p_b10_list') : $('#p_b15_list');
  if (!listEl) return [];
  const vals = [];
  listEl.querySelectorAll('input[type="number"]').forEach(inp => {
    vals.push(clamp(safeNumber(inp.value), 0, 50));
  });
  return vals;
}

function ensurePracticeBullseyeButtons(){
  const add10 = $('#p_b10_add');
  const add15 = $('#p_b15_add');
  if (add10 && !add10.dataset.bound) {
    add10.dataset.bound = '1';
    add10.addEventListener('click', () => {
      const list = $('#p_b10_list');
      addRoundRow(list, 10, 0, { removable: true, label: `Round ${list.children.length + 1}` });
    });
  }
  if (add15 && !add15.dataset.bound) {
    add15.dataset.bound = '1';
    add15.addEventListener('click', () => {
      const list = $('#p_b15_list');
      addRoundRow(list, 15, 0, { removable: true, label: `Round ${list.children.length + 1}` });
    });
  }
}

function buildStepsPills() {
  const wrap = $('#stepsPills');
  wrap.innerHTML = '';
  STEPS.forEach(step => {
    const cb = el('input', { type:'checkbox', value: step.id });
    const pill = el('label', { class:'pill', title: step.tip }, [cb, el('span', {}, [step.name])]);
    cb.addEventListener('change', () => pill.classList.toggle('active', cb.checked));
    wrap.appendChild(pill);
  });
}

function fillAnimalRows(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';
  ANIMAL_DISTANCES.forEach((dist, idx) => {
    const defaultAnimal = DEFAULT_ANIMALS[idx] ? DEFAULT_ANIMALS[idx].name : '';
    const tr = el('tr', {}, [
      el('td', {}, [`${dist}m`]),
      el('td', {}, [
        el('input', { type:'text', placeholder:'Animal', list:'animalOptions', value: defaultAnimal, 'data-dist': String(dist), class:'animal-name' })
      ]),
      el('td', { class:'num' }, [
        el('input', { type:'number', min:'0', max:'999', value:'0', 'data-dist': String(dist), class:'animal-score' })
      ])
    ]);
    tbody.appendChild(tr);
  });
}

function getSelectedSteps() {
  const ids = [];
  document.querySelectorAll('#stepsPills input[type="checkbox"]').forEach(cb => {
    if (cb.checked) ids.push(cb.value);
  });
  return ids;
}
function setSelectedSteps(ids) {
  const set = new Set(ids || []);
  document.querySelectorAll('#stepsPills input[type="checkbox"]').forEach(cb => {
    cb.checked = set.has(cb.value);
    cb.closest('.pill')?.classList.toggle('active', cb.checked);
  });
}

function resetPracticeForm() {
  editingPracticeId = null;
  $('#practiceSaveHint').textContent = '';
  $('#p_date').value = toLocalDateTimeInputValue(new Date());
  $('#p_title').value = '';
  $('#p_mood').value = '3';
  $('#p_phys').value = '3';
  $('#p_tags').value = '';
  $('#p_notes').value = '';
  setSelectedSteps([]);
  $('#p_enable_bullseye').checked = true;
  $('#p_enable_animal').checked = false;

  ensurePracticeBullseyeButtons();
  setPracticeRoundLists([0], [0]);

  // reset animal rows
  document.querySelectorAll('#animalRows .animal-name').forEach((inp, idx) => {
    inp.value = DEFAULT_ANIMALS[idx] ? DEFAULT_ANIMALS[idx].name : '';
  });
  document.querySelectorAll('#animalRows .animal-score').forEach(inp => inp.value = '0');
  toggleScoreBlocks();
}

function toggleScoreBlocks(){
  $('#bullseyeBlock').style.display = $('#p_enable_bullseye').checked ? '' : 'none';
  $('#animalBlock').style.display = $('#p_enable_animal').checked ? '' : 'none';
}

$('#p_enable_bullseye').addEventListener('change', toggleScoreBlocks);
$('#p_enable_animal').addEventListener('change', toggleScoreBlocks);

$('#practiceReset').addEventListener('click', resetPracticeForm);

$('#practiceForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const dtLocal = $('#p_date').value;
  if (!dtLocal) return;

  const session = {
    id: editingPracticeId || uid(),
    profileId: getActiveProfileId(),
    datetime: new Date(dtLocal).toISOString(),
    title: $('#p_title').value.trim(),
    mood: safeNumber($('#p_mood').value),
    phys: safeNumber($('#p_phys').value),
    tags: parseTags($('#p_tags').value),
    notes: $('#p_notes').value.trim(),
    goals: getSelectedSteps(),
    bullseye: null,
    animal: null,
    updatedAt: new Date().toISOString()
  };

  if ($('#p_enable_bullseye').checked) {
    const m10 = collectPracticeRounds(10);
    const m15 = collectPracticeRounds(15);
    // allow empty arrays per distance (e.g., only shot 10m today)
    session.bullseye = { m10, m15 };
  }

  if ($('#p_enable_animal').checked) {
    const rows = [];
    ANIMAL_DISTANCES.forEach((dist) => {
      const nameInp = document.querySelector(`#animalRows .animal-name[data-dist="${dist}"]`);
      const scoreInp = document.querySelector(`#animalRows .animal-score[data-dist="${dist}"]`);
      rows.push({
        distance: dist,
        animal: (nameInp?.value || '').trim(),
        score: clamp(safeNumber(scoreInp?.value), 0, 999)
      });
    });
    session.animal = rows;
  }

  if (editingPracticeId) {
    const idx = state.practice.findIndex(s => s.id === editingPracticeId);
    if (idx >= 0) state.practice[idx] = session;
    $('#practiceSaveHint').textContent = 'Saved changes.';
  } else {
    session.createdAt = session.updatedAt;
    state.practice.push(session);
    $('#practiceSaveHint').textContent = 'Saved!';
  }

  // sort by datetime descending
  state.practice.sort((a,b) => new Date(b.datetime) - new Date(a.datetime));
  saveState();
  renderPractice();
  renderProgress();
  renderTrends();
  resetPracticeForm();
});

function meanOrNull(arr){
  const xs = (arr || []).map(safeNumber).filter(n => Number.isFinite(n));
  if (!xs.length) return null;
  return xs.reduce((a,b)=>a+b,0) / xs.length;
}

function sum(arr){
  return (arr || []).map(safeNumber).filter(n=>Number.isFinite(n)).reduce((a,b)=>a+b,0);
}

function practiceTotals(session) {
  let bull10Sum = null, bull15Sum = null, bull10Avg = null, bull15Avg = null, bullTotalSum = null;
  if (session.bullseye) {
    const m10 = Array.isArray(session.bullseye.m10) ? session.bullseye.m10 : [];
    const m15 = Array.isArray(session.bullseye.m15) ? session.bullseye.m15 : [];
    bull10Sum = m10.length ? sum(m10) : null;
    bull15Sum = m15.length ? sum(m15) : null;
    bull10Avg = m10.length ? meanOrNull(m10) : null;
    bull15Avg = m15.length ? meanOrNull(m15) : null;
    bullTotalSum = sum(m10) + sum(m15);
  }
  const animalTotal = session.animal ? session.animal.reduce((sum0, r) => sum0 + safeNumber(r.score), 0) : null;
  return { bull10Sum, bull15Sum, bull10Avg, bull15Avg, bullTotalSum, animalTotal };
}

function stepLabel(id){
  const s = STEPS.find(x => x.id === id);
  return s ? s.name.replace(/^\d+\)\s*/,'') : id;
}

function focusSummary(goals){
  if (!goals || !goals.length) return '—';
  const names = goals.slice(0,2).map(stepLabel);
  return names.join(', ') + (goals.length > 2 ? ` +${goals.length-2}` : '');
}

function renderPracticeKpis(){
  const wrap = $('#practiceKpis');
  const items = practiceForActive();

  const bull10Avgs = items.map(s => practiceTotals(s).bull10Avg).filter(v => v != null);
  const bull15Avgs = items.map(s => practiceTotals(s).bull15Avg).filter(v => v != null);
  const animalTotals = items.map(s => practiceTotals(s).animalTotal).filter(v => v != null);

  const avg = (arr) => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : null;
  const best = (arr) => arr.length ? Math.max(...arr) : null;

  wrap.innerHTML = '';
  wrap.appendChild(kpiItem('Practice sessions', String(items.length), ''));
  wrap.appendChild(kpiItem('Bull 10m avg', bull10Avgs.length ? avg(bull10Avgs).toFixed(1) : '—', bull10Avgs.length ? `Best ${best(bull10Avgs).toFixed(1)}` : ''));
  wrap.appendChild(kpiItem('Bull 15m avg', bull15Avgs.length ? avg(bull15Avgs).toFixed(1) : '—', bull15Avgs.length ? `Best ${best(bull15Avgs).toFixed(1)}` : ''));
  wrap.appendChild(kpiItem('Animal avg', animalTotals.length ? avg(animalTotals).toFixed(1) : '—', animalTotals.length ? `Best ${best(animalTotals)}` : ''));
}

function kpiItem(label, value, sub){
  const node = el('div', { class:'item' }, [
    el('div', { class:'label' }, [label]),
    el('div', { class:'value' }, [value]),
    el('div', { class:'sub' }, [sub || ''])
  ]);
  return node;
}

function renderPracticeTable(){
  const tbody = $('#practiceTbody');
  tbody.innerHTML = '';

  practiceForActive().slice(0, 50).forEach(sess => {
    const { bull10Avg, bull15Avg, animalTotal } = practiceTotals(sess);
    const tr = el('tr', {}, [
      el('td', {}, [formatDateTime(sess.datetime)]),
      el('td', {}, [focusSummary(sess.goals)]),
      el('td', { class:'num' }, [bull10Avg == null ? '—' : bull10Avg.toFixed(1)]),
      el('td', { class:'num' }, [bull15Avg == null ? '—' : bull15Avg.toFixed(1)]),
      el('td', { class:'num' }, [animalTotal == null ? '—' : String(animalTotal)]),
      el('td', {}, [
        el('button', { class:'btn secondary small', type:'button', onclick: () => editPractice(sess.id) }, ['Edit']),
        document.createTextNode(' '),
        el('button', { class:'btn danger small', type:'button', onclick: () => deletePractice(sess.id) }, ['Delete'])
      ])
    ]);
    tbody.appendChild(tr);
  });

  if (!practiceForActive().length) {
    tbody.appendChild(el('tr', {}, [
      el('td', { colspan:'6', style:'color:#64748b' }, ['No practice sessions yet.'])
    ]));
  }
}

function editPractice(id){
  const sess = state.practice.find(s => s.id === id);
  if (!sess) return;
  editingPracticeId = id;
  $('#practiceSaveHint').textContent = 'Editing existing session — save to apply changes.';
  $('#p_date').value = toLocalDateTimeInputValue(new Date(sess.datetime));
  $('#p_title').value = sess.title || '';
  $('#p_mood').value = String(sess.mood ?? 3);
  $('#p_phys').value = String(sess.phys ?? 3);
  $('#p_tags').value = (sess.tags || []).join(', ');
  $('#p_notes').value = sess.notes || '';
  setSelectedSteps(sess.goals || []);

  $('#p_enable_bullseye').checked = !!sess.bullseye;
  $('#p_enable_animal').checked = !!sess.animal;

  ensurePracticeBullseyeButtons();

  const m10 = Array.isArray(sess.bullseye?.m10) ? sess.bullseye.m10 : [];
  const m15 = Array.isArray(sess.bullseye?.m15) ? sess.bullseye.m15 : [];
  setPracticeRoundLists(m10.length ? m10 : [0], m15.length ? m15 : [0]);

  // animal
  if (sess.animal) {
    sess.animal.forEach(r => {
      const nameInp = document.querySelector(`#animalRows .animal-name[data-dist="${r.distance}"]`);
      const scoreInp = document.querySelector(`#animalRows .animal-score[data-dist="${r.distance}"]`);
      if (nameInp) nameInp.value = r.animal || '';
      if (scoreInp) scoreInp.value = String(r.score ?? 0);
    });
  }
  toggleScoreBlocks();
  setTab('practice');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deletePractice(id){
  const sess = state.practice.find(s => s.id === id);
  if (!sess) return;
  const ok = confirm('Delete this practice session? This cannot be undone.');
  if (!ok) return;
  state.practice = state.practice.filter(s => s.id !== id);
  if (editingPracticeId === id) resetPracticeForm();
  saveState();
  renderPractice();
  renderProgress();
  renderTrends();
}

function renderPractice(){
  renderPracticeKpis();
  renderPracticeTable();
}

// --- Competitions UI ---
let editingCompId = null;


const ARCHER_CATEGORIES = ['cub','beginner','junior','senior','adult'];

function compCategoryLabel(cat){
  const map = { cub:'Cub', beginner:'Beginner', junior:'Junior', senior:'Senior', adult:'Adult' };
  return map[cat] || cat || '—';
}

function renderCompBullseyeDynamic(existing){
  const wrap = $('#c_bullseye_dynamic');
  const help = $('#c_bullseye_help');
  if (!wrap) return;
  wrap.innerHTML = '';
  const cat = $('#c_category')?.value || 'adult';

  if (cat === 'cub' || cat === 'beginner') {
    const list = el('div', { class:'scorelist', id:'c_4x10_list' });
    const values = (existing && existing.format === '4x10' && Array.isArray(existing.m10)) ? existing.m10 : null;
    for (let i=0;i<4;i++) {
      const v = values ? safeNumber(values[i] ?? 0) : 0;
      list.appendChild(el('div', { class:'roundrow' }, [
        el('div', { class:'roundlabel' }, [`Round ${i+1}`]),
        el('input', { type:'number', min:'0', max:'50', step:'1', value:String(clamp(v,0,50)), 'data-i':String(i), class:'c10_round' })
      ]));
    }
    wrap.appendChild(el('h3', {}, ['10m (4 rounds)']));
    wrap.appendChild(list);
    if (help) help.textContent = 'Cub/Beginner: 4 rounds at 10m. Max score = 200.';
    return;
  }

  const sets = (existing && existing.format === '2sets' && Array.isArray(existing.sets)) ? existing.sets : null;

  for (let s=0;s<2;s++) {
    const box = el('div', { class:'card', style:'background:#fff; box-shadow:none; margin-top:10px;' });
    box.appendChild(el('h3', {}, [`Set ${s+1}`]));

    const row = el('div', { class:'row' });

    const col10 = el('div', {}, [el('label', {}, ['10m (3 flights)'])]);
    const list10 = el('div', { class:'scorelist' });
    for (let i=0;i<3;i++) {
      const v = sets ? safeNumber(sets[s]?.m10?.[i] ?? 0) : 0;
      list10.appendChild(el('div', { class:'roundrow' }, [
        el('div', { class:'roundlabel' }, [`F${i+1}`]),
        el('input', { type:'number', min:'0', max:'50', step:'1', value:String(clamp(v,0,50)), 'data-set':String(s), 'data-i':String(i), class:'cset10' })
      ]));
    }
    col10.appendChild(list10);

    const col15 = el('div', {}, [el('label', {}, ['15m (3 flights)'])]);
    const list15 = el('div', { class:'scorelist' });
    for (let i=0;i<3;i++) {
      const v = sets ? safeNumber(sets[s]?.m15?.[i] ?? 0) : 0;
      list15.appendChild(el('div', { class:'roundrow' }, [
        el('div', { class:'roundlabel' }, [`F${i+1}`]),
        el('input', { type:'number', min:'0', max:'50', step:'1', value:String(clamp(v,0,50)), 'data-set':String(s), 'data-i':String(i), class:'cset15' })
      ]));
    }
    col15.appendChild(list15);

    row.appendChild(col10);
    row.appendChild(col15);

    box.appendChild(row);
    wrap.appendChild(box);
  }

  if (help) help.textContent = 'Junior/Senior/Adult: 2 sets. Each set has 3 flights at 10m and 3 flights at 15m. Max = 300 per set, 600 total.';
}

function collectCompetitionBullseye(){
  const cat = $('#c_category')?.value || 'adult';
  if (cat === 'cub' || cat === 'beginner') {
    const m10 = [];
    document.querySelectorAll('.c10_round').forEach(inp => m10.push(clamp(safeNumber(inp.value), 0, 50)));
    return { format:'4x10', m10 };
  }

  const sets = [];
  for (let s=0;s<2;s++) {
    const m10 = [];
    const m15 = [];
    document.querySelectorAll('.cset10').forEach(inp => {
      if (inp.getAttribute('data-set') === String(s)) m10.push(clamp(safeNumber(inp.value), 0, 50));
    });
    document.querySelectorAll('.cset15').forEach(inp => {
      if (inp.getAttribute('data-set') === String(s)) m15.push(clamp(safeNumber(inp.value), 0, 50));
    });
    sets.push({ m10, m15 });
  }
  return { format:'2sets', sets };
}

function competitionMax(c){
  if (c.round === 'animal') return null;
  if (c.round === 'bullseye') {
    const cat = c.category || 'adult';
    if (cat === 'cub' || cat === 'beginner') return 200;
    if (cat === 'junior' || cat === 'senior' || cat === 'adult') return 600;
    if (c.bullseye?.format === 'legacy') {
      const m10 = Array.isArray(c.bullseye.m10) ? c.bullseye.m10.length : 0;
      const m15 = Array.isArray(c.bullseye.m15) ? c.bullseye.m15.length : 0;
      return (m10 + m15) * 50;
    }
  }
  return null;
}

function resetCompForm(){
  editingCompId = null;
  $('#compSaveHint').textContent = '';
  const today = new Date();
  const ymd = today.toISOString().slice(0,10);
  $('#c_date').value = ymd;
  $('#c_event').value = '';
  $('#c_location').value = '';
  $('#c_round').value = 'bullseye';
  $('#c_category').value = 'adult';
  document.querySelectorAll('#c_animalRows .animal-name').forEach((inp, idx) => inp.value = DEFAULT_ANIMALS[idx] ? DEFAULT_ANIMALS[idx].name : '');
  document.querySelectorAll('#c_animalRows .animal-score').forEach(inp => inp.value = '0');
  $('#c_tens').value = '';
  $('#c_notes').value = '';
  toggleCompRound();
  renderCompBullseyeDynamic();
}

function toggleCompRound(){
  const isAnimal = $('#c_round').value === 'animal';
  $('#c_bullseye').style.display = isAnimal ? 'none' : '';
  $('#c_animal').style.display = isAnimal ? '' : 'none';
  const catRow = $('#c_categoryRow');
  if (catRow) catRow.style.display = isAnimal ? 'none' : '';
  if (!isAnimal) renderCompBullseyeDynamic();
}

$('#c_round').addEventListener('change', toggleCompRound);
$('#c_category').addEventListener('change', () => renderCompBullseyeDynamic());
$('#compReset').addEventListener('click', resetCompForm);

$('#compForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const comp = {
    id: editingCompId || uid(),
    profileId: getActiveProfileId(),
    date: $('#c_date').value,
    event: $('#c_event').value.trim(),
    location: $('#c_location').value.trim(),
    round: $('#c_round').value,
    category: $('#c_round').value === 'bullseye' ? ($('#c_category')?.value || 'adult') : null,
    bullseye: null,
    animal: null,
    tens: clamp(safeNumber($('#c_tens')?.value), 0, 999),
    notes: $('#c_notes').value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (!comp.date || !comp.event) return;

  if (comp.round === 'bullseye') {
    comp.bullseye = collectCompetitionBullseye();
  } else {
    comp.animal = ANIMAL_DISTANCES.map((dist) => {
      const nameInp = document.querySelector(`#c_animalRows .animal-name[data-dist="${dist}"]`);
      const scoreInp = document.querySelector(`#c_animalRows .animal-score[data-dist="${dist}"]`);
      return {
        distance: dist,
        animal: (nameInp?.value || '').trim(),
        score: clamp(safeNumber(scoreInp?.value), 0, 999)
      };
    });
  }

  if (editingCompId) {
    const idx = state.competitions.findIndex(c => c.id === editingCompId);
    if (idx >= 0) state.competitions[idx] = comp;
    $('#compSaveHint').textContent = 'Saved changes.';
  } else {
    comp.createdAt = comp.updatedAt;
    state.competitions.push(comp);
    $('#compSaveHint').textContent = 'Saved!';
  }

  state.competitions.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
  saveState();
  renderCompetitions();
  renderProgress();
  resetCompForm();
});

function competitionTotal(c){
  if (c.round === 'bullseye' && c.bullseye) {
    const b = c.bullseye;
    if (b.format === '4x10') {
      return (b.m10 || []).reduce((s,n)=>s+safeNumber(n),0);
    }
    if (b.format === '2sets') {
      return (b.sets || []).reduce((sum0, set) => {
        const s10 = (set.m10 || []).reduce((s,n)=>s+safeNumber(n),0);
        const s15 = (set.m15 || []).reduce((s,n)=>s+safeNumber(n),0);
        return sum0 + s10 + s15;
      }, 0);
    }
    if (b.format === 'legacy') {
      return (b.m10 || []).reduce((s,n)=>s+safeNumber(n),0) + (b.m15 || []).reduce((s,n)=>s+safeNumber(n),0);
    }
  }
  if (c.round === 'animal' && c.animal) return c.animal.reduce((s,r)=>s+safeNumber(r.score),0);
  return 0;
}

function renderCompKpis(){
  const wrap = $('#compKpis');
  const comps = competitionsForActive();

  const totals = comps.map(competitionTotal);
  const maxes = comps.map(competitionMax);
  const pctVals = comps.map((_,i) => {
    const m = maxes[i];
    return (m && m > 0) ? (totals[i] / m * 100) : null;
  }).filter(v => v != null);

  const best = totals.length ? Math.max(...totals) : null;
  const avg = totals.length ? (totals.reduce((a,b)=>a+b,0)/totals.length) : null;

  wrap.innerHTML = '';
  wrap.appendChild(kpiItem('Competitions', String(comps.length), ''));
  wrap.appendChild(kpiItem('Avg score', totals.length ? avg.toFixed(1) : '—', totals.length ? `Best ${best}` : ''));
  wrap.appendChild(kpiItem('Avg % (bullseye only)', pctVals.length ? (pctVals.reduce((a,b)=>a+b,0)/pctVals.length).toFixed(1) : '—', pctVals.length ? 'Comparable across categories' : ''));

  const last = comps[0] ? competitionTotal(comps[0]) : null;
  const lastMax = comps[0] ? competitionMax(comps[0]) : null;
  wrap.appendChild(kpiItem('Most recent', comps[0] ? String(last) : '—', comps[0] ? (lastMax ? `${compCategoryLabel(comps[0].category)} • Max ${lastMax}` : comps[0].event) : ''));
}

function renderCompetitionsTable(){
  const tbody = $('#compTbody');
  tbody.innerHTML = '';

  const rows = competitionsForActive().slice(0, 60);
  rows.forEach(c => {
    const total = competitionTotal(c);
    const max = competitionMax(c);
    const tens = (c.tens == null || c.tens === '') ? '—' : String(c.tens);

    const tr = el('tr', {}, [
      el('td', {}, [formatDate(c.date)]),
      el('td', {}, [
        el('div', {}, [c.event]),
        el('div', { style:'font-size:12px;color:#64748b' }, [
          c.location || (c.round === 'animal' ? 'Animal round' : 'Bullseye round')
        ])
      ]),
      el('td', {}, [c.round === 'bullseye' ? compCategoryLabel(c.category) : '—']),
      el('td', { class:'num' }, [String(total)]),
      el('td', { class:'num' }, [max == null ? '—' : String(max)]),
      el('td', { class:'num' }, [tens]),
      el('td', {}, [
        el('button', { class:'btn secondary small', type:'button', onclick: () => editCompetition(c.id) }, ['Edit']),
        document.createTextNode(' '),
        el('button', { class:'btn danger small', type:'button', onclick: () => deleteCompetition(c.id) }, ['Delete'])
      ])
    ]);
    tbody.appendChild(tr);
  });

  if (!rows.length) {
    tbody.appendChild(el('tr', {}, [
      el('td', { colspan:'7', style:'color:#64748b' }, ['No competition scores yet.'])
    ]));
  }
}


function renderCompetitions(){
  renderCompKpis();
  renderCompetitionsTable();
}

// --- Charts ---
function clearCanvas(canvas){
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
}

function drawAxes(ctx, w, h, padding){
  ctx.save();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  // x-axis
  ctx.beginPath();
  ctx.moveTo(padding, h - padding);
  ctx.lineTo(w - padding, h - padding);
  ctx.stroke();
  // y-axis
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, h - padding);
  ctx.stroke();
  ctx.restore();
}

function drawText(ctx, text, x, y, align='left', color='#475569', size=12){
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawLineChart(canvas, series, opts={}){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  clearCanvas(canvas);

  const padding = 40;
  drawAxes(ctx, w, h, padding);

  if (!series.length) {
    drawText(ctx, 'No data yet', w/2, h/2, 'center');
    return;
  }

  const ys = series.map(p => p.y);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) { minY -= 1; maxY += 1; }

  const xStep = (w - padding*2) / Math.max(1, series.length - 1);
  const yScale = (h - padding*2) / (maxY - minY);

  // grid lines + y labels
  ctx.save();
  ctx.strokeStyle = '#eef2f7';
  ctx.lineWidth = 1;
  const ticks = 4;
  for (let i=0;i<=ticks;i++){
    const t = i/ticks;
    const y = padding + (h - padding*2) * t;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.stroke();
    const val = (maxY - (maxY-minY)*t).toFixed(0);
    drawText(ctx, val, padding-8, y+4, 'right');
  }
  ctx.restore();

  // line
  ctx.save();
  ctx.strokeStyle = '#0b5fff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  series.forEach((p, i) => {
    const x = padding + i*xStep;
    const y = h - padding - (p.y - minY) * yScale;
    if (i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // points
  ctx.fillStyle = '#0b5fff';
  series.forEach((p, i) => {
    const x = padding + i*xStep;
    const y = h - padding - (p.y - minY) * yScale;
    ctx.beginPath();
    ctx.arc(x,y,3.6,0,Math.PI*2);
    ctx.fill();
  });
  ctx.restore();

  // labels
  const start = series[0].label || '';
  const end = series[series.length-1].label || '';
  if (start) drawText(ctx, start, padding, h - 12, 'left');
  if (end) drawText(ctx, end, w - padding, h - 12, 'right');

  if (opts.title) drawText(ctx, opts.title, padding, 18, 'left', '#0f172a', 13);
}

function drawScatter(canvas, points, opts={}){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  clearCanvas(canvas);

  const padding = 44;
  drawAxes(ctx, w, h, padding);

  if (!points.length) {
    drawText(ctx, 'No data yet', w/2, h/2, 'center');
    return;
  }

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);

  if (minX === maxX) { minX -= 1; maxX += 1; }
  if (minY === maxY) { minY -= 1; maxY += 1; }

  const xScale = (w - padding*2) / (maxX - minX);
  const yScale = (h - padding*2) / (maxY - minY);

  // y tick labels
  const ticks = 4;
  for (let i=0;i<=ticks;i++){
    const t = i/ticks;
    const y = padding + (h - padding*2) * t;
    ctx.strokeStyle = '#eef2f7';
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.stroke();
    const val = (maxY - (maxY-minY)*t).toFixed(0);
    drawText(ctx, val, padding-8, y+4, 'right');
  }

  // x labels (integer-ish)
  if (opts.xTicks) {
    opts.xTicks.forEach(tick => {
      const x = padding + (tick - minX) * xScale;
      ctx.strokeStyle = '#eef2f7';
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, h - padding);
      ctx.stroke();
      drawText(ctx, String(tick), x, h - padding + 18, 'center');
    });
  } else {
    drawText(ctx, minX.toFixed(0), padding, h - padding + 18, 'center');
    drawText(ctx, maxX.toFixed(0), w - padding, h - padding + 18, 'center');
  }

  // points
  ctx.save();
  ctx.fillStyle = '#0b5fff';
  points.forEach(p => {
    const x = padding + (p.x - minX) * xScale;
    const y = h - padding - (p.y - minY) * yScale;
    ctx.beginPath();
    ctx.arc(x,y,4,0,Math.PI*2);
    ctx.fill();
  });
  ctx.restore();

  if (opts.title) drawText(ctx, opts.title, padding, 18, 'left', '#0f172a', 13);
}

function drawBar(canvas, bars, opts={}){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  clearCanvas(canvas);

  const padding = 46;
  drawAxes(ctx, w, h, padding);

  if (!bars.length) {
    drawText(ctx, 'No data yet', w/2, h/2, 'center');
    return;
  }

  const ys = bars.map(b => b.y);
  let maxY = Math.max(...ys);
  if (maxY === 0) maxY = 1;

  const innerW = w - padding*2;
  const innerH = h - padding*2;
  const barW = innerW / bars.length;

  // y grid
  const ticks = 4;
  for (let i=0;i<=ticks;i++){
    const t = i/ticks;
    const y = padding + innerH * t;
    ctx.strokeStyle = '#eef2f7';
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.stroke();
    const val = (maxY - maxY*t).toFixed(0);
    drawText(ctx, val, padding-8, y+4, 'right');
  }

  // bars
  ctx.save();
  ctx.fillStyle = '#0b5fff';
  bars.forEach((b, i) => {
    const x = padding + i*barW + barW*0.12;
    const bw = barW*0.76;
    const bh = (b.y / maxY) * innerH;
    const y = h - padding - bh;
    ctx.fillRect(x, y, bw, bh);
    // label
    drawText(ctx, b.label, x + bw/2, h - padding + 18, 'center', '#475569', 11);
  });
  ctx.restore();

  if (opts.title) drawText(ctx, opts.title, padding, 18, 'left', '#0f172a', 13);
}

function mean(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function pearson(xs, ys){
  if (xs.length !== ys.length || xs.length < 2) return null;
  const mx = mean(xs), my = mean(ys);
  let num=0, dx=0, dy=0;
  for (let i=0;i<xs.length;i++){
    const a = xs[i]-mx;
    const b = ys[i]-my;
    num += a*b;
    dx += a*a;
    dy += b*b;
  }
  const den = Math.sqrt(dx*dy);
  if (!den) return null;
  return num/den;
}

function linearSlope(values){
  // values over time index 0..n-1
  const n = values.length;
  if (n < 2) return null;
  const xs = [...Array(n).keys()];
  const mx = mean(xs), my = mean(values);
  let num=0, den=0;
  for (let i=0;i<n;i++){
    num += (xs[i]-mx)*(values[i]-my);
    den += (xs[i]-mx)*(xs[i]-mx);
  }
  return den ? num/den : null;
}

function getSeries(metric){
  if (metric.startsWith('bull_') || metric === 'bull_sum') {
    const list = state.practice
      .filter(s => s.bullseye)
      .slice()
      .sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));

    return list.map(s => {
      const label = new Date(s.datetime).toLocaleDateString(undefined, {month:'short', day:'2-digit'});
      const m10 = Array.isArray(s.bullseye.m10) ? s.bullseye.m10 : [];
      const m15 = Array.isArray(s.bullseye.m15) ? s.bullseye.m15 : [];
      if (metric === 'bull_sum') return { y: sum(m10) + sum(m15), label };
      if (metric === 'bull_10_avg') return { y: meanOrNull(m10) ?? 0, label };
      if (metric === 'bull_15_avg') return { y: meanOrNull(m15) ?? 0, label };
      return { y: 0, label };
    });
  }

  if (metric === 'animal_total') {
    const list = state.practice
      .filter(s => s.animal)
      .slice()
      .sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));

    return list.map(s => {
      const label = new Date(s.datetime).toLocaleDateString(undefined, {month:'short', day:'2-digit'});
      const y = s.animal.reduce((sum,r)=>sum+safeNumber(r.score),0);
      return { y, label };
    });
  }

  if (metric === 'comp_total' || metric === 'comp_percent') {
    const list = competitionsForActive()
      .slice()
      .sort((a,b)=>(a.date||'').localeCompare(b.date||''));

    return list.map(c => {
      const label = formatDate(c.date);
      const total = competitionTotal(c);
      const max = competitionMax(c);
      const y = (metric === 'comp_percent') ? (max ? (total / max * 100) : 0) : total;
      return { y, label };
    });
  }

  return [];
}

function renderProgress(){
  const metric = $('#progMetric').value;
  const windowOpt = $('#progWindow').value;

  const series = getSeries(metric);
  const limited = windowOpt === 'all' ? series : series.slice(-Number(windowOpt));

  const chart = $('#progressChart');
  drawLineChart(chart, limited, { title: metricTitle(metric) });

  // KPIs
  const wrap = $('#progKpis');
  wrap.innerHTML = '';
  const ys = limited.map(p => p.y);
  if (!ys.length) {
    wrap.appendChild(kpiItem('Entries', '0', ''));
    wrap.appendChild(kpiItem('Average', '—', ''));
    wrap.appendChild(kpiItem('Best', '—', ''));
    return;
  }
  const avg = mean(ys);
  const best = Math.max(...ys);
  const latest = ys[ys.length-1];
  const slope = linearSlope(ys);

  wrap.appendChild(kpiItem('Entries', String(ys.length), ''));
  wrap.appendChild(kpiItem('Latest', String(latest), limited[limited.length-1].label));
  wrap.appendChild(kpiItem('Average', avg.toFixed(1), `Best ${best}`));
  wrap.appendChild(kpiItem('Trend', slope == null ? '—' : (slope>0 ? 'Up' : slope<0 ? 'Down' : 'Flat'), slope == null ? '' : `~${slope.toFixed(2)} per entry`));
}

function metricTitle(metric){
  switch(metric){
    case 'bull_sum': return 'Bullseye total (sum of all rounds)';
    case 'bull_10_avg': return 'Bullseye 10m average (per session)';
    case 'bull_15_avg': return 'Bullseye 15m average (per session)';
    case 'animal_total': return 'Animal total (10–15m)';
    case 'comp_total': return 'Competition total (raw)';
    case 'comp_percent': return 'Competition % (score ÷ max)';
    default: return metric;
  }
}

$('#progMetric').addEventListener('change', renderProgress);
$('#progWindow').addEventListener('change', renderProgress);

// --- Trends ---
function practiceScoreByMetric(session, metric){
  if (metric === 'bull_sum') return session.bullseye ? (sum(session.bullseye.m10) + sum(session.bullseye.m15)) : null;
  if (metric === 'bull_10_avg') return session.bullseye ? meanOrNull(session.bullseye.m10) : null;
  if (metric === 'bull_15_avg') return session.bullseye ? meanOrNull(session.bullseye.m15) : null;
  if (metric === 'animal_total') return session.animal ? session.animal.reduce((s,r)=>s+safeNumber(r.score),0) : null;
  return null;
}

function renderTrends(){
  const metric = $('#trendMetric').value;
  const by = $('#trendBy').value;

  const chart = $('#trendChart');
  const wrap = $('#trendKpis');
  wrap.innerHTML = '';

  const sessions = state.practice
    .slice()
    .sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));

  const points = [];
  sessions.forEach(s => {
    const score = practiceScoreByMetric(s, metric);
    if (score == null) return;
    points.push({ session:s, score });
  });

  if (!points.length) {
    drawLineChart(chart, [], { title: 'No data' });
    wrap.appendChild(kpiItem('Entries', '0', ''));
    return;
  }

  if (by === 'mood' || by === 'phys') {
    const scat = points.map(p => ({ x: safeNumber(p.session[by]), y: p.score }));
    const xs = scat.map(p=>p.x);
    const ys = scat.map(p=>p.y);
    const r = pearson(xs, ys);
    drawScatter(chart, scat, { title: `${by === 'mood' ? 'Mood' : 'Physical readiness'} vs ${metricTitle(metric)}`, xTicks:[1,2,3,4,5] });

    wrap.appendChild(kpiItem('Entries', String(scat.length), ''));
    wrap.appendChild(kpiItem('Avg score', mean(ys).toFixed(1), `Best ${Math.max(...ys)}`));
    wrap.appendChild(kpiItem('Correlation (r)', r == null ? '—' : r.toFixed(2), r == null ? 'Need ≥2 points' : (Math.abs(r) < 0.2 ? 'Weak' : Math.abs(r) < 0.5 ? 'Moderate' : 'Strong')));
    return;
  }

  // tags
  const tagMap = new Map(); // tag -> {sum, count}
  points.forEach(p => {
    (p.session.tags || []).forEach(tag => {
      if (!tagMap.has(tag)) tagMap.set(tag, { sum:0, count:0 });
      const t = tagMap.get(tag);
      t.sum += p.score;
      t.count += 1;
    });
  });

  const bars = [...tagMap.entries()]
    .map(([tag, obj]) => ({ tag, label: tag.length > 8 ? tag.slice(0,8)+'…' : tag, y: obj.sum/obj.count, count: obj.count }))
    .sort((a,b) => b.count - a.count)
    .slice(0, 8);

  drawBar(chart, bars, { title: `Average ${metricTitle(metric)} by tag (top by frequency)` });

  wrap.appendChild(kpiItem('Sessions', String(points.length), ''));
  wrap.appendChild(kpiItem('Tags used', String(tagMap.size), tagMap.size ? 'Tip: keep tags consistent' : 'Add tags in practice notes'));
  if (bars.length) {
    const top = bars[0];
    wrap.appendChild(kpiItem('Most common', top.tag, `${top.count} sessions`));
  } else {
    wrap.appendChild(kpiItem('Most common', '—', 'No tags yet'));
  }
}

$('#trendMetric').addEventListener('change', renderTrends);
$('#trendBy').addEventListener('change', renderTrends);

// --- Aim maps ---
let editingAimId = null;
let aimDraft = null; // unsaved changes
let draggingMarker = null;

function defaultAimMapsIfEmpty(){
  if (state.aimMaps.length) return;
  // Paper
  state.aimMaps.push({
    id: uid(),
    name: 'Paper target',
    type: 'paper',
    imageKind: 'builtin',
    builtinKey: 'paper',
    imageData: null,
    marks: [] // {distance, x, y}
  });
  // Animals
  DEFAULT_ANIMALS.forEach(a => {
    state.aimMaps.push({
      id: uid(),
      name: a.name,
      type: 'animal',
      imageKind: 'builtin',
      builtinKey: a.key,
      imageData: null,
      marks: []
    });
  });
  saveState();
}

function renderAimList(){
  const tbody = $('#aimTbody');
  tbody.innerHTML = '';
  state.aimMaps.forEach(m => {
    const tr = el('tr', {}, [
      el('td', {}, [m.name]),
      el('td', {}, [m.type === 'paper' ? 'Paper' : 'Animal']),
      el('td', { class:'num' }, [String((m.marks||[]).length)]),
      el('td', {}, [
        el('button', { class:'btn secondary small', type:'button', onclick: () => openAimEditor(m.id) }, ['Edit'])
      ])
    ]);
    tbody.appendChild(tr);
  });

  if (!state.aimMaps.length) {
    tbody.appendChild(el('tr', {}, [
      el('td', { colspan:'4', style:'color:#64748b' }, ['No aim maps yet.'])
    ]));
  }
}

function openAimEditor(id){
  const m = state.aimMaps.find(x => x.id === id);
  if (!m) return;
  editingAimId = id;
  aimDraft = deepClone(m);

  $('#aimEditorEmpty').style.display = 'none';
  $('#aimEditor').style.display = '';

  $('#aim_name').value = aimDraft.name;

  const distSel = $('#aim_distance');
  distSel.innerHTML = '';
  const dists = aimDraft.type === 'paper' ? PAPER_DISTANCES : ANIMAL_DISTANCES;
  dists.forEach(d => distSel.appendChild(el('option', { value: String(d) }, [`${d}m`])));
  distSel.value = String(dists[0]);

  $('#aim_upload').value = '';
  $('#aimSaveHint').textContent = '';

  refreshAimImage();
  renderAimOverlay();
  updateAimSummary();
  setTab('aim');
}

function closeAimEditor(){
  editingAimId = null;
  aimDraft = null;
  draggingMarker = null;
  $('#aimEditor').style.display = 'none';
  $('#aimEditorEmpty').style.display = '';
  $('#aimSaveHint').textContent = '';
}

function refreshAimImage(){
  const img = $('#aimImg');
  if (!aimDraft) return;
  const src = aimDraft.imageData || getBuiltinImageForMap(aimDraft) || builtInPaperTargetSvg();
  img.src = src;
  // after image loads, overlay positions are valid
  img.onload = () => renderAimOverlay();
}

function getCurrentAimDistance(){
  return safeNumber($('#aim_distance').value);
}

function markForDistance(distance){
  return (aimDraft.marks || []).find(m => m.distance === distance) || null;
}

function setMark(distance, x, y){
  aimDraft.marks = (aimDraft.marks || []).filter(m => m.distance !== distance);
  aimDraft.marks.push({ distance, x, y });
}

function clearMark(distance){
  aimDraft.marks = (aimDraft.marks || []).filter(m => m.distance !== distance);
}

function renderAimOverlay(){
  const overlay = $('#aimOverlay');
  overlay.innerHTML = '';
  if (!aimDraft) return;

  const dist = getCurrentAimDistance();
  const marks = aimDraft.marks || [];

  marks.forEach(m => {
    const node = el('div', { class:'marker' + (m.distance === dist ? ' selected' : ''), dataset:{ distance: String(m.distance) } }, [
      el('span', {}, [`${m.distance}m`])
    ]);
    node.style.left = `${m.x*100}%`;
    node.style.top = `${m.y*100}%`;

    node.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      draggingMarker = { distance: m.distance, el: node };
      node.setPointerCapture(ev.pointerId);
    });

    node.addEventListener('pointermove', (ev) => {
      if (!draggingMarker || draggingMarker.distance !== m.distance) return;
      const rect = overlay.getBoundingClientRect();
      const x = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((ev.clientY - rect.top) / rect.height, 0, 1);
      // update draft
      const mm = markForDistance(m.distance);
      if (mm) { mm.x = x; mm.y = y; }
      node.style.left = `${x*100}%`;
      node.style.top = `${y*100}%`;
    });

    node.addEventListener('pointerup', () => {
      draggingMarker = null;
      updateAimSummary();
    });

    overlay.appendChild(node);
  });
}

$('#aim_distance').addEventListener('change', () => {
  renderAimOverlay();
  updateAimSummary();
});

$('#aimOverlay').addEventListener('click', (ev) => {
  if (!aimDraft) return;
  // If user is dragging marker, ignore click.
  if (draggingMarker) return;

  const overlay = $('#aimOverlay');
  const rect = overlay.getBoundingClientRect();
  const x = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((ev.clientY - rect.top) / rect.height, 0, 1);
  const dist = getCurrentAimDistance();
  setMark(dist, x, y);
  renderAimOverlay();
  updateAimSummary();
});

$('#aim_clearDistance').addEventListener('click', () => {
  if (!aimDraft) return;
  const dist = getCurrentAimDistance();
  clearMark(dist);
  renderAimOverlay();
  updateAimSummary();
});

$('#aim_delete').addEventListener('click', () => {
  if (!aimDraft) return;
  const ok = confirm('Delete this aim map? This cannot be undone.');
  if (!ok) return;
  state.aimMaps = state.aimMaps.filter(m => m.id !== editingAimId);
  saveState();
  renderAimList();
  closeAimEditor();
});

$('#aim_cancel').addEventListener('click', closeAimEditor);

$('#aim_save').addEventListener('click', () => {
  if (!aimDraft) return;
  aimDraft.name = $('#aim_name').value.trim() || aimDraft.name;
  // commit
  const idx = state.aimMaps.findIndex(m => m.id === editingAimId);
  if (idx >= 0) state.aimMaps[idx] = aimDraft;
  saveState();
  renderAimList();
  $('#aimSaveHint').textContent = 'Saved!';
  updateAimSummary();
});

$('#aim_upload').addEventListener('change', async (ev) => {
  if (!aimDraft) return;
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const dataUrl = await readFileAsDataURL(file);
  aimDraft.imageData = dataUrl;
  aimDraft.imageKind = 'upload';
  aimDraft.builtinKey = null;
  refreshAimImage();
  $('#aimSaveHint').textContent = 'Image loaded (remember to Save changes).';
});

function readFileAsDataURL(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function updateAimSummary(){
  if (!aimDraft) return;
  const dist = getCurrentAimDistance();
  const mark = markForDistance(dist);
  const totalMarks = (aimDraft.marks || []).length;
  const summary = mark
    ? `Distance ${dist}m: aim point set at x=${mark.x.toFixed(2)}, y=${mark.y.toFixed(2)} (relative to image).`
    : `Distance ${dist}m: no aim point set yet. Click the image to add one.`;
  $('#aimSummary').textContent = `${summary} Total marks: ${totalMarks}.`;
}

$('#newAimPaper').addEventListener('click', () => {
  const m = {
    id: uid(),
    name: 'New paper aim map',
    type: 'paper',
    imageKind: 'builtin',
    builtinKey: 'paper',
    imageData: null,
    marks: []
  };
  state.aimMaps.unshift(m);
  saveState();
  renderAimList();
  openAimEditor(m.id);
});

$('#newAimAnimal').addEventListener('click', () => {
  const m = {
    id: uid(),
    name: 'New animal aim map',
    type: 'animal',
    imageKind: 'builtin',
    builtinKey: 'deer',
    imageData: null,
    marks: []
  };
  state.aimMaps.unshift(m);
  saveState();
  renderAimList();
  openAimEditor(m.id);
});

window.addEventListener('resize', () => {
  if ($('#aim').classList.contains('active')) renderAimOverlay();
});

// --- Settings / Export / Import ---
function renderSettings(){
  $('#set_animalScoring').value = state.settings.animalScoring || 'nasp3d';
}
$('#set_animalScoring').addEventListener('change', () => {
  state.settings.animalScoring = $('#set_animalScoring').value;
  saveState();
});

$('#exportBtn').addEventListener('click', () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `archery-coach-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

$('#importBtn').addEventListener('click', () => $('#importFile').click());

$('#importFile').addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    // naive validation
    const st = Object.assign(defaultState(), imported);
    st.settings = Object.assign(defaultState().settings, imported.settings || {});
    st.practice = Array.isArray(imported.practice) ? imported.practice : [];
    st.competitions = Array.isArray(imported.competitions) ? imported.competitions : [];
    st.aimMaps = Array.isArray(imported.aimMaps) ? imported.aimMaps : [];
    state = st;
    saveState();
    // re-render everything
    renderAll();
    alert('Import complete.');
  } catch (e) {
    console.error(e);
    alert('Import failed: invalid JSON or incompatible format.');
  } finally {
    $('#importFile').value = '';
  }
});

$('#wipeBtn').addEventListener('click', () => {
  const ok = confirm('Delete ALL local data for this app on this device? This cannot be undone.\n\nTip: Export a backup first.');
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  saveState();
  renderAll();
  resetPracticeForm();
  resetCompForm();
  closeAimEditor();
  alert('All local data removed.');
});

// --- Init ---
function renderAll(){
  renderPractice();
  renderCompetitions();
  renderAimList();
  renderProgress();
  renderTrends();
  renderSettings();
}


function renderProfileSelect(){
  ensureProfiles();
  const sel = document.getElementById('profileSelect');
  if (!sel) return;
  sel.innerHTML = '';
  state.profiles.slice(0,5).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name || 'Archer';
    sel.appendChild(opt);
  });
  sel.value = getActiveProfileId();
}

function renderProfilesList(){
  ensureProfiles();
  const host = document.getElementById('profilesList');
  if (!host) return;
  host.innerHTML = '';
  const pid = getActiveProfileId();

  state.profiles.slice(0,5).forEach(p => {
    const row = document.createElement('div');
    row.className = 'profile-row';
    row.innerHTML = `
      <span class="badge">${p.id === pid ? 'Active' : 'Profile'}</span>
      <input type="text" value="${escapeHtml(p.name || '')}" aria-label="Profile name"/>
      <button class="btn tiny secondary" type="button" title="Set active">Use</button>
      <button class="btn tiny danger" type="button" title="Delete profile">Delete</button>
    `;
    const [badge, nameInput, useBtn, delBtn] = row.children;

    nameInput.addEventListener('change', () => {
      p.name = nameInput.value.trim().slice(0, 40) || 'Archer';
      saveState();
      renderProfileSelect();
      renderProfilesList();
    });

    useBtn.addEventListener('click', () => {
      state.activeProfileId = p.id;
      saveState();
      renderAll();
      renderProfileSelect();
      renderProfilesList();
    });

    delBtn.addEventListener('click', () => {
      if (state.profiles.length <= 1) {
        alert('You need at least one profile.');
        return;
      }
      const ok = confirm(`Delete profile "${p.name}" and all its stored sessions/scores on this device?`);
      if (!ok) return;
      // remove records tied to this profile
      state.practice = (state.practice || []).filter(r => r.profileId !== p.id);
      state.competitions = (state.competitions || []).filter(r => r.profileId !== p.id);
      state.aimMaps = (state.aimMaps || []).filter(r => r.profileId !== p.id);
      // remove profile
      state.profiles = state.profiles.filter(x => x.id !== p.id);
      if (state.activeProfileId === p.id) state.activeProfileId = state.profiles[0].id;
      saveState();
      renderAll();
      renderProfileSelect();
      renderProfilesList();
    });

    host.appendChild(row);
  });

  // show/hide add button based on limit
  const addBtn = document.getElementById('addProfileBtn');
  if (addBtn) addBtn.disabled = state.profiles.length >= 5;
}

function hookProfileUi(){
  const sel = document.getElementById('profileSelect');
  if (sel) sel.addEventListener('change', () => {
    state.activeProfileId = sel.value;
    saveState();
    renderAll();
    renderProfilesList();
  });

  const manageBtn = document.getElementById('manageProfilesBtn');
  if (manageBtn) manageBtn.addEventListener('click', () => {
    setTab('settings');
    const inp = document.getElementById('newProfileName');
    if (inp) inp.focus();
    window.scrollTo({ top: document.getElementById('settings')?.offsetTop || 0, behavior: 'smooth' });
  });

  const addBtn = document.getElementById('addProfileBtn');
  if (addBtn) addBtn.addEventListener('click', () => {
    ensureProfiles();
    if (state.profiles.length >= 5) {
      alert('You can have up to 5 profiles.');
      return;
    }
    const inp = document.getElementById('newProfileName');
    const name = (inp?.value || '').trim().slice(0, 40);
    if (!name) { alert('Enter a name for the new profile.'); return; }
    state.profiles.push({ id: uid(), name, createdAt: new Date().toISOString() });
    if (inp) inp.value = '';
    saveState();
    renderProfileSelect();
    renderProfilesList();
  });
}

function init(){
  // Build UI pieces
  renderProfileSelect();
  renderProfilesList();
  hookProfileUi();
  buildStepsPills();
  fillAnimalRows('animalRows');
  fillAnimalRows('c_animalRows');
  toggleScoreBlocks();
  toggleCompRound();

  defaultAimMapsIfEmpty();

  resetPracticeForm();
  resetCompForm();
  renderAll();

  // small PWA notice
  const pwaNotice = $('#pwaNotice');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (!isStandalone) pwaNotice.style.display = '';

  // register service worker (only works over http/https)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
}

init();
