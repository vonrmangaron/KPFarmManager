// ─────────────────────────────────────────────────────────────
// Growth chart — ALW vs Ross 308 SVG
// ─────────────────────────────────────────────────────────────
function renderGrowthChartSvg() {
  if (!farmData) return '';

  const today = new Date();
  const allSheds = farmData.sheds || [];

  // Find overall batch start
  const placed = allSheds.map(s => s.placementDate).filter(Boolean).map(d => dateOnly(d));
  if (!placed.length) return '';
  const batchStart = new Date(Math.min(...placed));
  const currentAge = Math.max(...allSheds.map(s => s.placementDate ? daysBetween(s.placementDate, today) : 0));
  const cleanouts  = allSheds.map(s => s.cleanoutDate).filter(Boolean).map(d => dateOnly(d));
  const finalAge   = cleanouts.length ? Math.max(...cleanouts.map(d => daysBetween(batchStart, d))) : currentAge + 10;
  const maxAge     = Math.min(56, Math.max(finalAge, currentAge + 4));

  // Chart geometry
  const W = 1000, H = 340, PL = 52, PR = 24, PT = 18, PB = 44;
  const cW = W - PL - PR, cH = H - PT - PB;

  // Y axis: 0 → maxRoss * 1.05
  const maxRoss = rossWeightKg(Math.min(56, maxAge));
  const yMax = Math.ceil(maxRoss * 1.1 * 10) / 10;
  const xScale = age => PL + (age / maxAge) * cW;
  const yScale = kg  => PT + cH - (kg / yMax) * cH;

  // Ross 308 target line points (key milestones)
  const rossAges = [0, 7, 14, 21, 28, 35, 42, 49, 56].filter(a => a <= maxAge);
  const rossPath = rossAges.map((a,i) => `${i===0?'M':'L'}${xScale(a).toFixed(1)},${yScale(rossWeightKg(a)).toFixed(1)}`).join(' ');

  // Actual farm ALW per day — blends in-yard samples & pickups via
  // each shed's Gompertz fit (the same growth model used elsewhere
  // in the app), rather than only the days a real pickup happened.
  // Sheds with too little data to fit a curve (<3 anchors) are
  // silently excluded from a given day's average rather than faked.
  const shedFits = allSheds.map(shed => ({ shed, fit: shed.placementDate ? getShedGompertzFit(shed) : null }));
  const actualPoints = [];
  for (let age = 1; age <= currentAge; age++) {
    const date = addDays(batchStart, age);
    let totalWt = 0, totalBirds = 0;
    shedFits.forEach(({shed, fit}) => {
      if (!shed.placementDate || !fit) return;
      const shedAge = daysBetween(shed.placementDate, date);
      if (shedAge < 0) return;
      const kg = gompertzWeightAt(fit, shedAge);
      const live = liveAtStartOfDay(shed, date);
      if (kg && live > 0) { totalWt += kg * live; totalBirds += live; }
    });
    if (totalBirds > 0) actualPoints.push({ age, kg: totalWt / totalBirds });
  }

  // Gompertz projection from current age to final age
  const projPoints = [];
  const farmFit = (() => {
    const fits = allSheds.map(s => getShedGompertzFit(s)).filter(Boolean);
    if (!fits.length) return null;
    // Average A, b, k
    const A = fits.reduce((s,f) => s + f.A, 0) / fits.length;
    const b = fits.reduce((s,f) => s + f.b, 0) / fits.length;
    const k = fits.reduce((s,f) => s + f.k, 0) / fits.length;
    return { A, b, k };
  })();
  if (farmFit) {
    for (let age = currentAge; age <= maxAge; age += 1) {
      const kg = gompertzWeightAt(farmFit, age);
      if (kg) projPoints.push({ age, kg });
    }
  }

  const actualPath = actualPoints.length
    ? actualPoints.map((p,i) => `${i===0?'M':'L'}${xScale(p.age).toFixed(1)},${yScale(p.kg).toFixed(1)}`).join(' ')
    : null;
  const projPath = projPoints.length
    ? projPoints.map((p,i) => `${i===0?'M':'L'}${xScale(p.age).toFixed(1)},${yScale(p.kg).toFixed(1)}`).join(' ')
    : null;

  // Y axis grid lines (4 lines)
  const yTicks = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0].filter(v => v <= yMax);
  const gridLines = yTicks.map(v => {
    const y = yScale(v).toFixed(1);
    return `<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--line)" stroke-width="1"/>
      <text x="${PL-5}" y="${(Number(y)+4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)">${v.toFixed(1)}</text>`;
  }).join('');

  // X axis age labels
  const xTicks = [7, 14, 21, 28, 35, 42, 49].filter(a => a <= maxAge);
  const xLabels = xTicks.map(a =>
    `<text x="${xScale(a).toFixed(1)}" y="${H-24}" text-anchor="middle" font-size="10" fill="var(--muted)">${a}</text>`
  ).join('');

  // Today line
  const todayX = xScale(currentAge).toFixed(1);
  const todayLine = `<line x1="${todayX}" y1="${PT}" x2="${todayX}" y2="${H-PB}" stroke="var(--primary)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${Number(todayX)+4}" y="${PT+11}" font-size="10" font-weight="600" fill="var(--primary-dark)">Today D${currentAge}</text>`;

  // Whether the "actual" line has any real pickup weighings behind it,
  // or is entirely derived from in-yard sample curves (no pickups yet)
  const hasAnyPickupData = allSheds.some(s => weightedPickups(s).length > 0);
  const alwLineLabel = hasAnyPickupData ? 'Actual ALW' : 'Est. ALW (from samples)';

  // Current actual dot + tooltip
  const lastActual = actualPoints[actualPoints.length - 1];
  const actualDot = lastActual ? (() => {
    const cx = xScale(lastActual.age);
    const cy = yScale(lastActual.kg);
    // Flip tooltip left if too close to right edge
    const tipW = 114, tipH = 34;
    const tipX = cx + tipW + 12 > W - PR ? cx - tipW - 8 : cx + 8;
    const tipY = cy - tipH / 2;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="var(--surface)" stroke="var(--primary-dark)" stroke-width="2.5"/>
      <rect x="${tipX.toFixed(1)}" y="${tipY.toFixed(1)}" width="${tipW}" height="${tipH}" rx="7" fill="var(--tooltip-bg)" opacity="0.92"/>
      <text x="${(tipX+6).toFixed(1)}" y="${(tipY+13).toFixed(1)}" font-size="10" fill="var(--tooltip-muted)">${hasAnyPickupData?'ALW':'Est. ALW'} · D${lastActual.age}</text>
      <text x="${(tipX+6).toFixed(1)}" y="${(tipY+28).toFixed(1)}" font-size="12" font-weight="700" fill="var(--tooltip-ink)">${lastActual.kg.toFixed(3)} kg</text>`;
  })() : '';

  return `<div class="dash-card">
    <div class="dash-card-head">
      <h2 class="dash-card-title">Growth vs Ross 308</h2>
      <div style="display:flex;gap:16px;align-items:center;font-size:11px;color:var(--muted)">
        <span style="display:flex;align-items:center;gap:5px"><span style="width:18px;height:2.5px;background:var(--primary-dark);border-radius:2px;display:inline-block"></span>${alwLineLabel}</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="width:18px;height:0;border-top:2px dashed var(--muted);display:inline-block"></span>Ross 308</span>
        ${projPath ? `<span style="display:flex;align-items:center;gap:5px"><span style="width:18px;height:0;border-top:2.5px dotted var(--primary);display:inline-block"></span>Projected</span>` : ''}
      </div>
    </div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:hidden" role="img" aria-label="Farm average liveweight vs Ross 308 target">
      ${gridLines}
      ${xLabels}
      <text x="${W/2}" y="${H-4}" text-anchor="middle" font-size="10" fill="var(--muted)">Age (days)</text>
      ${todayLine}
      <!-- Ross 308 target -->
      <path d="${rossPath}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"/>
      <!-- Projection -->
      ${projPath ? `<path d="${projPath}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round" opacity="0.8"/>` : ''}
      <!-- Actual ALW -->
      ${actualPath ? `<path d="${actualPath}" fill="none" stroke="var(--primary-dark)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${actualDot}
    </svg>
  </div>`;
}
// ─────────────────────────────────────────────────────────────
// SVG icon helper for sidebar
// ─────────────────────────────────────────────────────────────
function navIcon(type) {
  const icons = {
    pickups: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M6 11h5"/>',
    grid: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    home: '<path d="M3 10 12 4l9 6v10H3z"/><path d="M9 20v-6h6v6"/>',
    chart: '<path d="M3 20h18"/><path d="m4 16 5-5 4 3 7-8"/><path d="M15 6h5v5"/>',
    cluckwise: '<circle cx="11" cy="14" r="6"/><circle cx="14" cy="8" r="4"/><path d="m18 8 3 1-3 1"/>',
    loads: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    silo: '<path d="M6 4h12v11l-6 5-6-5z"/><path d="M6 9h12"/>',
    compare: '<path d="M8 3 4 7l4 4"/><path d="M4 7h11a5 5 0 0 1 5 5v1"/><path d="m16 21 4-4-4-4"/><path d="M20 17H9a5 5 0 0 1-5-5v-1"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    homes: '<path d="M2 11 7 7l5 4v9H2z"/><path d="M12 11l5-4 5 4v9h-10"/><path d="M5 20v-4h4v4"/><path d="M15 20v-4h4v4"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    cloud: '<path d="M17.5 19H7a5 5 0 1 1 1.4-9.8A6 6 0 0 1 20 11.5a3.8 3.8 0 0 1-2.5 7.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  };
  const p = icons[type] || icons.home;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

// ─────────────────────────────────────────────────────────────
// VERSION HISTORY VIEW
// ─────────────────────────────────────────────────────────────
function renderHistoryView() {
  const available = typeof historyIsAvailable === 'function' && historyIsAvailable();
  const head = `<div class="predictions-head" style="background:linear-gradient(135deg,#6A4FA3,#4A3F6B);"><h1>📜 Version History</h1><span class="head-note">Automatic safety net · manual checkpoints</span></div>`;
  if (!available) {
    return head + `<div class="dash-empty">
      <div class="dash-empty-icon">📜</div>
      <h2>History unavailable</h2>
      <p>Your browser doesn't support IndexedDB, or it's disabled. Version history is turned off.</p>
    </div>`;
  }
  setTimeout(() => { if (typeof historyPopulatePage === 'function') historyPopulatePage(); }, 0);
  return head + `<div class="history-toolbar">
      <button class="btn-primary" id="historySaveBtn" type="button">💾 Save current version</button>
      <span class="history-toolbar-note">Auto-snapshots fire before New Batch, Excel imports, and restores. Latest ${HISTORY_MAX_AUTO} kept — pinned versions never expire.</span>
    </div>
    <div id="historyList"><div class="history-loading">Loading…</div></div>`;
}

async function historyPopulatePage() {
  const listEl = document.getElementById('historyList');
  if (!listEl) return;
  const snaps = await historyListAll();
  if (!snaps.length) {
    listEl.innerHTML = `<div class="history-empty">
      <div class="history-empty-icon">📜</div>
      <div class="history-empty-title">No versions saved yet</div>
      <div class="history-empty-sub">The app auto-saves before risky operations like New Batch and Excel imports. You can also press <strong>Save current version</strong> above any time.</div>
    </div>`;
    return;
  }
  const groups = {};
  snaps.forEach(s => {
    const d = new Date(s.timestamp);
    const key = iso(d);
    if (!groups[key]) groups[key] = { date: d, items: [] };
    groups[key].items.push(s);
  });
  const order = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  const todayIso = iso(new Date());
  const yesterdayIso = iso(addDays(new Date(), -1));
  const html = order.map(k => {
    const g = groups[k];
    let label;
    if (k === todayIso) label = 'Today';
    else if (k === yesterdayIso) label = 'Yesterday';
    else label = fmtShort(g.date);
    const rows = g.items.map(s => historyRowHtml(s)).join('');
    return `<div class="history-group"><div class="history-group-head">${escapeHtml(label)}</div><div class="history-rows">${rows}</div></div>`;
  }).join('');
  listEl.innerHTML = html;
  listEl.querySelectorAll('[data-history-restore]').forEach(b => b.addEventListener('click', () => historyRestoreFromUi(b.dataset.historyRestore)));
  listEl.querySelectorAll('[data-history-download]').forEach(b => b.addEventListener('click', async () => {
    const snap = await historyGet(b.dataset.historyDownload);
    if (snap) historyDownloadSnapshot(snap);
  }));
  listEl.querySelectorAll('[data-history-pin]').forEach(b => b.addEventListener('click', () => historyTogglePin(b.dataset.historyPin)));
  listEl.querySelectorAll('[data-history-delete]').forEach(b => b.addEventListener('click', () => historyDeleteFromUi(b.dataset.historyDelete)));
}

function historyRowHtml(s) {
  const when = new Date(s.timestamp);
  const time = String(when.getHours()).padStart(2,'0') + ':' + String(when.getMinutes()).padStart(2,'0');
  const sum = s.summary || { sheds: 0, pickups: 0, siloReadings: 0, loads: 0, batch: '' };
  const sourceLabels = {
    'manual': 'Manual save',
    'auto-newbatch': 'Before New Batch',
    'auto-sync': 'Before sync merge',
    'auto-import': 'Before Excel import',
    'auto-restore': 'Before restore'
  };
  const sourceLabel = sourceLabels[s.source] || s.source;
  const pinned = s.pinned;
  const summary = `${sum.sheds} placed shed${sum.sheds===1?'':'s'} · ${sum.pickups} pickup${sum.pickups===1?'':'s'} · ${sum.siloReadings} silo reading${sum.siloReadings===1?'':'s'} · ${sum.loads} load${sum.loads===1?'':'s'}`;
  const batchBadge = sum.batch ? `<span class="history-row-batch">Batch ${escapeHtml(sum.batch)}</span>` : '';
  return `<div class="history-row${pinned?' pinned':''}">
    <div class="history-row-time">${time}</div>
    <div class="history-row-info">
      <div class="history-row-label">
        ${pinned ? '<span class="history-pin-chip">📌</span>' : ''}
        <span class="history-row-source">${sourceLabel}</span>
        ${s.label ? `<span class="history-row-sep">·</span><span class="history-row-custom">${escapeHtml(s.label)}</span>` : ''}
        ${batchBadge}
      </div>
      <div class="history-row-summary">${summary}</div>
    </div>
    <div class="history-row-actions">
      <button type="button" title="Restore this version" data-history-restore="${escapeAttr(s.id)}">↺ Restore</button>
      <button type="button" title="Download JSON" data-history-download="${escapeAttr(s.id)}">📥</button>
      <button type="button" title="${pinned?'Unpin':'Pin this version'}" data-history-pin="${escapeAttr(s.id)}">${pinned?'📌':'📍'}</button>
      <button type="button" class="danger" title="Delete" data-history-delete="${escapeAttr(s.id)}">✕</button>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────
// Sidebar HTML (desktop rail)
// ─────────────────────────────────────────────────────────────
// Predictions submenu open state (sidebar only — not persisted)
let sbPredOpen = true;
function toggleSidebarPredictions() {
  if (activeTab !== 'predictions') { activeTab = 'predictions'; sbPredOpen = true; }
  else sbPredOpen = !sbPredOpen;
  render();
}

// Worst days-behind severity across a group's sheds — same thresholds as
// the dashboard's shed performance table (daysBehindSeverity).
function groupSeverity(g, today) {
  const rank = { unknown: 0, ok: 1, warn: 2, bad: 3 };
  let worst = 'unknown';
  shedsForGroup(g).forEach(shed => {
    if (!shed.placementDate) return;
    const age = daysBetween(shed.placementDate, today);
    const est = currentShedWeightEstimate(shed, today);
    const sev = daysBehindSeverity((est && age > 0) ? daysVsTarget(age, est.kg) : null);
    if (rank[sev] > rank[worst]) worst = sev;
  });
  return worst;
}

function sidebarHtml() {
  const today = new Date();
  const alerts = farmData ? computeFarmAlerts() : [];
  const sevLabel = { ok: 'On target', warn: 'Slightly behind target', bad: 'Behind target' };
  const chev = '<svg class="sb-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  return NAV_ITEMS.map(item => {
    if (item.section) {
      return `<span class="sb-section-label">${escapeHtml(item.section)}</span>`;
    }
    if (item.modalBtnId) {
      const dot = item.modalBtnId === 'loadsBtn' ? '<span class="loads-dot" id="loadsDot"></span>' : '';
      return `<button class="sb-link" id="${escapeAttr(item.modalBtnId)}" type="button">
        ${navIcon(item.icon)}<span class="sb-link-label">${escapeHtml(item.label)}</span>${dot}
      </button>`;
    }
    const isActive = activeTab === item.id;
    let meta = '';
    if (item.badge && farmData) {
      const g = Number(item.id.replace('g',''));
      const count = alerts.filter(a => a.tab === item.id).length;
      const sev = groupSeverity(g, today);
      meta = `<span class="sb-link-meta">${count ? `<span class="sb-count" title="${count} open alert${count>1?'s':''}">${count}</span>` : ''}${sev !== 'unknown' ? `<span class="sb-status-dot ${sev}" title="${sevLabel[sev]}"></span>` : ''}</span>`;
    }
    if (item.id === 'farmsettings' && farmData) {
      const n = farmSettingsNotNormal().length;
      if (n) meta = `<span class="sb-link-meta"><span class="sb-count" title="${n} setting${n>1?'s':''} not at normal">${n}</span></span>`;
    }
    if (item.external) {
      meta = `<span class="sb-link-meta"><svg class="sb-ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></span>`;
    }
    // Predictions expands in place to show Group 1–4, so the group selector
    // lives in the sidebar instead of cluttering the tab bar.
    if (item.id === 'predictions' && farmData) {
      const open = isActive && sbPredOpen;
      const subnav = [1,2,3,4].map(gi => {
        const subActive = isActive && predState.predGroup === gi;
        return `<button class="sb-sub-link${subActive?' active':''}" data-predgroup="${gi}" type="button"${subActive?' aria-current="page"':''}>${pairLabel(gi)}</button>`;
      }).join('');
      return `<button class="sb-link${isActive?' active':''}" data-sb-pred type="button" aria-expanded="${open}"${isActive?' aria-current="page"':''}>
        ${navIcon(item.icon)}<span class="sb-link-label">${escapeHtml(item.label)}</span><span class="sb-link-meta">${chev}</span>
      </button>${open ? `<div class="sb-subnav">${subnav}</div>` : ''}`;
    }
    return `<button class="sb-link${isActive?' active':''}" data-tab="${escapeAttr(item.id)}" type="button"${isActive?' aria-current="page"':''}>
      ${navIcon(item.icon)}<span class="sb-link-label">${escapeHtml(item.label)}</span>${meta}
    </button>`;
  }).join('');
}

// Batch chip under the brand: batch number + current bird age
function renderSidebarBatch() {
  const el = document.getElementById('sbBatch');
  if (!el) return;
  if (!farmData) { el.hidden = true; return; }
  const batch = predState.batchNumber || farmData.batchNumber || '';
  const today = new Date();
  const age = Math.max(0, ...(farmData.sheds || []).filter(s => s.placementDate).map(s => daysBetween(s.placementDate, today)));
  el.hidden = false;
  const sheds = (farmData.sheds || []).length;
  el.innerHTML = `<button type="button" class="cur-batch" data-batch-info title="Batch details"><span class="cb-text"><span class="cb-k">Current batch</span>
    <span class="cb-v">${batch ? 'Batch ' + escapeHtml(String(batch)) : 'No batch number'}<em>${age > 0 ? ` · Day ${age}` : ''}</em></span></span><svg class="cb-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`;
}

// Mobile bottom nav: Home · Groups · [Silo reading] · Predict · More.
// Silo reading is the most common on-the-spot task, so it gets the
// raised centre button.
function mobileNavHtml() {
  const tab = (id, label, icon, active) => `<button class="mob-nav-btn${active?' active':''}" data-tab="${escapeAttr(id)}" type="button"${active?' aria-current="page"':''}>
      <span class="mob-nav-pill">${navIcon(icon)}</span>${escapeHtml(label)}
    </button>`;
  const inGroup = ['g1','g2','g3','g4'].includes(activeTab);
  const summary = typeof farmLoadsSummary === 'function' ? farmLoadsSummary() : { needsActual: 0 };
  const moreDot = summary.needsActual > 0 ? '<span class="mob-nav-dot" aria-hidden="true"></span>' : '';
  return `<div class="mob-nav-inner">
    ${tab('home', 'Home', 'home', activeTab === 'home')}
    ${tab(inGroup ? activeTab : 'g1', 'Sheds', 'grid', inGroup)}
    <button class="mob-nav-btn mob-nav-silo" id="siloBtnMob" type="button" aria-label="Record silo reading">
      <span class="mob-nav-fab">${navIcon('silo')}</span>Silo reading
    </button>
    <button class="mob-nav-btn" id="feedBtnMob" type="button"><span class="mob-nav-pill">${navIcon('loads')}${summary.needsActual > 0 ? '<span class="mob-nav-dot" aria-hidden="true"></span>' : ''}</span>Feed</button>
    <button class="mob-nav-btn${['history','predictions','dashboard','farmsettings'].includes(activeTab) ? ' active' : ''}" id="moreBtnMob" type="button" aria-haspopup="dialog">
      <span class="mob-nav-pill">${navIcon('more')}${moreDot}</span>More
    </button>
  </div>`;
}

// Mobile "More" sheet — everything the sidebar offers that the bottom
// nav doesn't, plus the header actions hidden on small screens.
let moreSheetOpen = false;
function openMoreSheet() { moreSheetOpen = true; renderMoreSheet(); }
function closeMoreSheet() { moreSheetOpen = false; renderMoreSheet(); }
function renderMoreSheet() {
  const el = document.getElementById('moreSheet');
  if (!el) return;
  el.classList.toggle('open', moreSheetOpen);
  el.setAttribute('aria-hidden', moreSheetOpen ? 'false' : 'true');
  if (!moreSheetOpen) return;
  const summary = farmLoadsSummary();
  const isDark = document.body.classList.contains('theme-dark');
  const row = (id, icon, label, sub, extra = '') => `<button type="button" class="more-row" id="${id}">
      <span class="more-row-ic">${navIcon(icon)}</span>
      <span class="more-row-text"><span class="more-row-label">${label}</span>${sub ? `<span class="more-row-sub">${sub}</span>` : ''}</span>${extra}
    </button>`;
  const syncLine = !syncFarmName ? 'Not connected'
    : syncState === 'error' ? 'Sync error'
    : syncLastSyncAt ? `Synced ${fmtRelativeTime(syncLastSyncAt)}` : 'Not yet synced';
  el.innerHTML = `<div class="more-scrim" data-more-close></div>
    <div class="more-panel" role="dialog" aria-modal="true" aria-label="More">
      <div class="more-grip" aria-hidden="true"></div>
      <div class="more-group">
        ${row('moreHome', 'grid', 'Result detail', 'Projected result, PIF, dockets and leftover')}
        ${row('morePredict', 'chart', 'Predictions', 'Per pair and per shed')}
        ${row('moreBatch', 'home', 'Batch details', 'Sheds, ages and clean-out dates')}
        ${row('morePickups', 'pickups', 'Pickups', 'Every pickup per shed, edit inline')}
        ${row('moreLoads', 'loads', 'Feed loads', 'Plan and log deliveries', summary.needsActual > 0 ? `<span class="more-count">${summary.needsActual}</span>` : '')}
        ${row('moreSilo', 'silo', 'Silo readings', 'Record today’s ring levels')}
        ${row('moreHistory', 'history', 'History', 'Checkpoints and restore')}
        ${row('moreFarmSettings', 'gear', 'Farm settings', farmData && farmSettingsNotNormal().length ? `${farmSettingsNotNormal().length} not at normal` : 'Settings that change your numbers')}
        ${row('moreCluckwise', 'cluckwise', 'CluckWise', 'Opens in a new tab')}
      </div>
      <div class="more-group">
        ${row('moreNewBatch', 'refresh', 'New batch', 'Start the next production batch')}
        ${row('moreImport', 'download', 'Import Excel', 'Load shed data from a file')}
        ${row('moreProfile', 'home', 'Farm profile', escapeHtml(displayFarmName()||'Farm name and silo numbers'))}
        ${row('moreSync', 'cloud', syncFarmName ? escapeHtml(displayFarmName()) : 'Cloud sync', escapeHtml(syncLine))}
      </div>
      <div class="more-foot">
        <div class="sb-theme-seg more-theme" role="group" aria-label="Theme">
          <button type="button" class="sb-theme-opt${!isDark?' active':''}" data-theme-value="light" aria-pressed="${!isDark}">${navIcon('sun')}<span>Light</span></button>
          <button type="button" class="sb-theme-opt${isDark?' active':''}" data-theme-value="dark" aria-pressed="${isDark}">${navIcon('moon')}<span>Dark</span></button>
        </div>
        <button type="button" class="more-settings" id="moreSettings">${navIcon('gear')}<span>Settings</span></button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Sync status pill in sidebar
// ─────────────────────────────────────────────────────────────
function renderSyncPill() {
  const el = document.getElementById('sbSync');
  const farmEl = document.getElementById('sbFarm');
  if (!el) return;
  if (!syncFarmName) {
    el.innerHTML = `<span class="sb-sync-dot"></span><span class="sb-sync-text"><b>Not connected</b></span>
      <button class="sb-sync-btn" id="sbConnectBtn" type="button">Connect</button>`;
    if (farmEl) farmEl.innerHTML = `<span class="sb-avatar" aria-hidden="true">–</span><span class="sb-farm-text"><span class="sb-farm-name">${escapeHtml(displayFarmName() || 'This device')}</span><span class="sb-farm-sub">Not synced</span></span>`;
    return;
  }
  const dotCls = syncState === 'error' ? 'error' : syncConnectedAt ? 'ok' : '';
  const stateLabel = syncState === 'pulling' ? 'Syncing…' : syncState === 'pushing' ? 'Saving…' : syncState === 'error' ? 'Sync error' : 'Synced';
  const when = syncLastSyncAt ? fmtRelativeTime(syncLastSyncAt) : 'not yet';
  el.innerHTML = `<span class="sb-sync-dot ${dotCls}"></span><span class="sb-sync-text"><b>${stateLabel}</b> · ${escapeHtml(when)}</span>
    <button class="sb-sync-btn" id="sbSyncNowBtn" type="button">Sync now</button>`;
  if (farmEl) {
    const shown = displayFarmName();
    const initials = String(shown).trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'F';
    farmEl.innerHTML = `<span class="sb-avatar" aria-hidden="true">${escapeHtml(initials)}</span><span class="sb-farm-text"><span class="sb-farm-name">${escapeHtml(shown)}</span><span class="sb-farm-sub">Cloud sync on</span></span>`;
  }
}

// ─────────────────────────────────────────────────────────────
// Page header update helper
// ─────────────────────────────────────────────────────────────
function updatePageHeader() {
  const titleEl = document.getElementById('pageTitle');
  const subEl   = document.getElementById('pageSub');
  if (!titleEl) return;
  const tabLabels = { home:'Home', farmsettings:'Farm settings', dashboard:'Result detail', g1:pairLabel(1), g2:pairLabel(2), g3:pairLabel(3), g4:pairLabel(4), predictions:'Predictions' };
  titleEl.textContent = tabLabels[activeTab] || activeTab;
  if (subEl) {
    if (farmData) {
      const batch = predState.batchNumber || farmData.batchNumber || '';
      const farm  = displayFarmName() ? `${displayFarmName()} · ` : '';
      subEl.textContent = `${farm}${batch ? 'Batch ' + batch + ' · ' : ''}${SHED_COUNT} sheds in 4 pairs`;
    } else {
      subEl.textContent = '';
    }
  }
}

function dashKpiIcon(name){
  const icons={
    birds:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c3 0 5 2 5 5"/>',
    fcr:'<path d="M6 20h12l-1.5-10h-9z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
    mortality:'<path d="M3 17 9 11l4 4 8-8"/><path d="M3 7v10h18"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Best-available "current weight" for a shed: a real pickup
// weighing if one exists, otherwise the Gompertz-fit estimate
// (which already blends in-yard samples + any pickups — the
// same model the rest of the app uses for predictions). Never
// silently mixes the two: callers get told which kind they got.
// ─────────────────────────────────────────────────────────────
// Live weight that has already left a shed via pickups on or before
// `today` — the same pickups liveAtStartOfDay() subtracts. Uses the
// weighed total when logged, else the growth-curve weight at the pickup
// age, else `fallbackKg` per bird.
function shippedWeightToDate(shed, today, fallbackKg) {
  const t = dateOnly(today);
  const fit = getShedGompertzFit(shed);
  return computeEffectivePickups(shed).reduce((sum, p) => {
    if (!p.date || dateOnly(p.date) > t) return sum;
    const birds = Number(p.birds) || 0;
    if (birds <= 0) return sum;
    if (p.totalWeightKg && p.totalWeightKg > 0) return sum + p.totalWeightKg;
    const kg = (fit && gompertzWeightAt(fit, pickupAge(shed, p))) || fallbackKg || 0;
    return sum + birds * kg;
  }, 0);
}
// Birds already shipped (pickups up to today) and Σ(age × birds) for them
function shippedBirdsToDate(shed, today) {
  const t = dateOnly(today);
  let birds = 0, ageBirdSum = 0;
  computeEffectivePickups(shed).forEach(p => {
    if (!p.date || dateOnly(p.date) > t) return;
    const b = Number(p.birds) || 0; if (b <= 0) return;
    birds += b; ageBirdSum += pickupAge(shed, p) * b;
  });
  return { birds, ageBirdSum };
}
// Batch so far (today): feed to date, live weight now + shipped, birds
// on hand + shipped, at their ages — fed into batchKpis like the projection
function batchSoFar(sheds, today) {
  const acc = { feedKg: 0, liveWeightKg: 0, birds: 0, ageBirdSum: 0, placed: 0, mortality: 0, targetBirdSum: 0, anyEstimated: false, withWeight: 0 };
  sheds.forEach(shed => {
    if (!shed.placementDate) return;
    acc.placed += Number(shed.initialPopulation) || 0;
    acc.mortality += Math.max(0, Number(shed.mortality) || 0);
    // Feed only for sheds whose weight is known, so FCR compares like with like
    const est = currentShedWeightEstimate(shed, today);
    if (!est) return;
    let d = dateOnly(shed.placementDate);
    while (d <= today) { acc.feedKg += shedFeedOn(shed, d); d = addDays(d, 1); }
    const live = liveAtStartOfDay(shed, today);
    const sh = shippedBirdsToDate(shed, today);
    const age = Math.max(0, daysBetween(shed.placementDate, today));
    acc.liveWeightKg += est.kg * live + shippedWeightToDate(shed, today, est.kg);
    acc.birds += live + sh.birds;
    acc.ageBirdSum += age * live + sh.ageBirdSum;
    acc.targetBirdSum += pairTargetKg(Math.ceil(shed.id / 2)) * (live + sh.birds);
    acc.withWeight++;
    if (est.isEstimate) acc.anyEstimated = true;
  });
  acc.targetKg = acc.birds > 0 ? acc.targetBirdSum / acc.birds : CFCR_REF_KG;
  acc.kpi = batchKpis(acc);
  return acc;
}
// Today's FCR from measured feed (feedEatenMeasured): each pair is taken
// at its latest silo reading, so feed and weight are the same moment.
// kpi is null when a placed pair has no reading or a shed has no weight.
function batchMeasured(today) {
  const t = dateOnly(today);
  const m = feedEatenMeasured();
  const acc = { feedKg: m.eaten, liveWeightKg: 0, birds: 0, ageBirdSum: 0, placed: 0, mortality: 0, targetBirdSum: 0,
    anyEstimated: false, onFarmKg: 0, shippedKg: 0, ordered: feedOrderedKg(), eaten: m.eaten, carry: m.carry, pairs: m.pairs, missing: m.missing.slice(), noWeight: [] };
  (farmData.sheds || []).forEach(shed => {
    if (!shed.placementDate) return;
    acc.placed += Number(shed.initialPopulation) || 0;
    acc.mortality += Math.max(0, Number(shed.mortality) || 0);
    const est = currentShedWeightEstimate(shed, t);
    if (!est) { acc.noWeight.push(shed.id); return; }
    acc.onFarmKg += est.kg * liveAtStartOfDay(shed, t);
    acc.shippedKg += shippedWeightToDate(shed, t, est.kg);
    if (est.isEstimate) acc.anyEstimated = true;
  });
  m.pairs.forEach(p => {
    // Morning reading = start of that day; evening = start of the next
    let wd = p.morning ? p.date : addDays(p.date, 1); if (wd > t) wd = t;
    p.sheds.forEach(shed => {
      const est = currentShedWeightEstimate(shed, wd); if (!est) return;
      // A pickup on day wd already left (kill-sheet date) — live excludes it, shipped includes it
      const live = liveAtStartOfDay(shed, wd), sh = shippedBirdsToDate(shed, wd);
      acc.liveWeightKg += est.kg * live + shippedWeightToDate(shed, wd, est.kg);
      acc.birds += live + sh.birds;
      acc.ageBirdSum += Math.max(0, daysBetween(shed.placementDate, wd)) * live + sh.ageBirdSum;
      acc.targetBirdSum += pairTargetKg(p.g) * (live + sh.birds);
    });
  });
  acc.targetKg = acc.birds > 0 ? acc.targetBirdSum / acc.birds : CFCR_REF_KG;
  acc.kpi = (!acc.missing.length && !acc.noWeight.length && acc.eaten > 0 && acc.liveWeightKg > 0) ? batchKpis(acc) : null;
  return acc;
}
function currentShedWeightEstimate(shed, today) {
  if (!shed.placementDate) return null;
  const age = daysBetween(shed.placementDate, today);
  const fit = getShedGompertzFit(shed);
  const t = dateOnly(today);
  const wp = weightedPickups(shed).filter(p => dateOnly(p.date) <= t);
  if (wp.length) {
    const last = wp[wp.length - 1];
    const lastKg = last.totalWeightKg / last.birds;
    const lastAge = pickupAge(shed, last);
    // Weighed today (or later-dated age override) — that's a measurement.
    if (age <= lastAge) return { kg: lastKg, isEstimate: false, basis: 'pickup' };
    // Birds kept growing since the weighing: carry the weighed value
    // forward along the growth curve so it stays anchored to the real
    // measurement, falling back to the observed daily gain.
    const fAt = gompertzWeightAt(fit, lastAge), fNow = gompertzWeightAt(fit, age);
    const kg = (fAt && fNow) ? lastKg * fNow / fAt : forecastFromPickups(shed, today);
    return { kg: kg || lastKg, isEstimate: true, basis: 'pickup-projected', fromAge: lastAge };
  }
  if (!fit) return null;
  const kg = gompertzWeightAt(fit, age);
  if (!kg) return null;
  return { kg, isEstimate: true, basis: 'curve' };
}
// Tooltip for an est chip next to a currentShedWeightEstimate() value
function weightEstTitle(est) {
  if (est && est.basis === 'pickup-projected') return `Projected from the last pickup weighing (day ${est.fromAge}) along the growth curve.`;
  return 'No logged pickup weight yet — estimated from the growth curve fitted to in-yard samples.';
}

// ─────────────────────────────────────────────────────────────
// Farm alerts — usable from the dashboard or the global header
// bell icon, so alerts stay visible no matter which page you're on.
// ─────────────────────────────────────────────────────────────
// Shared thresholds so the shed table's dot color and the alerts
// bell always agree on what counts as "behind" — previously the
// table turned red at -3d while alerts only turned red at -6d.
function daysBehindSeverity(daysVar) {
  if (daysVar == null) return 'unknown';
  if (daysVar < -3) return 'bad';
  if (daysVar < -0.5) return 'warn';
  return 'ok';
}

// Feed alerts look this far ahead (feed is ordered ~a week out); a reading
// this old gets a reminder
const FEED_ALERT_DAYS=8,FEED_READING_STALE_DAYS=3;
function computeFarmAlerts() {
  if (!farmData) return [];
  const today = new Date();
  const allSheds = farmData.sheds || [];
  const alerts = [];
  if (notifPrefs.feedBalance) {
    // Feed is ordered about a week ahead, so warn across that horizon.
    // "Runs out" = drops below the safety stock (Adjust → Silo readings).
    const todayD = dateOnly(today);
    [1,2,3,4].forEach(g => {
      if (!shedsForGroup(g).some(s => s.placementDate)) return;
      const latest = latestReading(g);
      if (!latest) {
        alerts.push({ kind: 'warn', msg: `<strong>${pairLabel(g)} silos</strong> — no silo reading yet, so the feed forecast can't warn you`, tab: 'g'+g, feedGroup: g });
        return;
      }
      const forecast = computeSiloForecast(g, { start: 0, end: FEED_ALERT_DAYS }, { realOnly: true });
      const age = daysBetween(dateOnly(latest.date), todayD);
      if (forecast.depletedDate) {
        const days = Math.max(0, daysBetween(todayD, forecast.depletedDate));
        const row = forecast.rows.find(r => iso(r.date) === iso(forecast.depletedDate));
        const left = row && row.balance != null ? Math.max(0, row.balance) : null;
        const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${fmtShortNoYear(forecast.depletedDate)} (${days} days)`;
        const safe = siloSafetyDays() > 0 ? 'below safety stock' : 'runs out';
        const leftTxt = left != null ? `, ${fmtFeed(left, 0)} left` : '';
        if (days <= 2) alerts.push({ kind: 'error', msg: `<strong>${pairLabel(g)} silos</strong> — ${safe} ${when}${leftTxt} · order now or check the next delivery`, tab: 'g'+g, feedGroup: g });
        else alerts.push({ kind: 'warn', msg: `<strong>${pairLabel(g)} silos</strong> — ${safe} ${when}${leftTxt} · add a load to this week's order`, tab: 'g'+g, feedGroup: g });
      }
      if (age >= FEED_READING_STALE_DAYS) alerts.push({ kind: 'warn', msg: `<strong>${pairLabel(g)} silos</strong> — last reading ${age} days ago · the forecast may be off`, tab: 'g'+g, feedGroup: g });
    });
    // Starter silo for the next batch must be empty by clean-out
    [1,2,3,4].forEach(g => { starterAlerts(g).forEach(a => alerts.push(a)); });
  }
  // A pickup whose date has passed still carries the estimated weight
  allSheds.forEach(shed => {
    (shed.pickups || []).forEach(p => {
      if (!p.weightEstimated || !p.date || dateOnly(p.date) >= dateOnly(today)) return;
      const g = Math.ceil(shed.id / 2);
      alerts.push({ kind: 'warn', msg: `<strong>Shed ${shed.id}</strong> · ${fmtShortNoYear(p.date)} pickup still has an estimated weight — enter the kill-sheet weight`, tab: 'g'+g, shedId: shed.id });
    });
  });
  if (notifPrefs.shedPerformance) {
    allSheds.forEach(shed => {
      if (!shed.placementDate) return;
      const age = daysBetween(shed.placementDate, today);
      if (age < 1) return;
      const est = currentShedWeightEstimate(shed, today);
      if (!est) return;
      const daysVar = daysVsTarget(age, est.kg);
      if (daysBehindSeverity(daysVar) === 'bad') {
        const g = Math.ceil(shed.id / 2);
        alerts.push({ kind: 'error', msg: `<strong>Shed ${shed.id}</strong> — ${Math.abs(daysVar).toFixed(1)} days behind Ross 308 standard`, tab: 'g'+g, shedId: shed.id });
      }
    });
  }
  return alerts;
}

function starterAlerts(g){
  const st=starterSiloStatus(g);if(!st||!st.inWin)return [];
  const out=[];const P=`<strong>${pairLabel(g)} starter silo</strong>`;const co=fmtShortNoYear(st.co);
  const sn=st.silo?`Silo ${siloNumber(g,st.silo)}`:'';
  if(st.state==='pick')out.push({kind:'warn',msg:`${P} — pick which silo takes next batch's Starter (clean-out ${co})`,tab:'g'+g,feedGroup:g});
  else if(st.state==='action')out.push({kind:st.late?'error':'warn',msg:`${P} — ${sn} still holds ${fmtFeed(st.kg,0)} · ${st.late?'open it now':'open it by '+fmtShortNoYear(st.openBy)} so it's empty by clean-out (${co})`,tab:'g'+g,feedGroup:g});
  (st.wrong||[]).forEach(l=>out.push({kind:'warn',msg:`${P} — ${sn} gets ${feedTypeLabel(l.feedType)} on ${fmtShortNoYear(l.date)}; it must still be empty by ${co}`,tab:'g'+g,feedGroup:g}));
  return out;
}
function renderAlertsPopoverBody() {
  const alerts = computeFarmAlerts();
  if (!alerts.length) return `<p style="font-size:13px;color:var(--muted);margin:0;padding:14px 16px">All systems normal — no alerts.</p>`;
  return `<div class="dash-alerts" style="padding:10px">${alerts.map(a =>
    `<button class="dash-alert dash-alert-${a.kind}" ${a.shedId ? `data-alert-shed="${a.shedId}"` : a.feedGroup ? `data-alert-feed="${a.feedGroup}"` : `data-tab="${a.tab}"`} type="button" style="width:100%;text-align:left;border:none;cursor:pointer;font-family:inherit">
      <span class="dash-alert-dot dash-alert-dot-${a.kind}"></span><span>${a.msg}</span>
    </button>`
  ).join('')}</div>`;
}
function updateAlertsBell() {
  const badge = document.getElementById('alertsBadge');
  if (!badge) return;
  const alerts = computeFarmAlerts();
  if (alerts.length) { badge.textContent = String(alerts.length); badge.classList.add('show'); }
  else { badge.textContent = ''; badge.classList.remove('show'); }
  const popover = document.getElementById('alertsPopover');
  if (popover && popover.classList.contains('open')) popover.innerHTML = renderAlertsPopoverBody();
}

// ─────────────────────────────────────────────────────────────
// Per-group status grid — quick Age/Live/Weight/FCR/Feed summary
// for each of the 4 groups, one click away from that group's page.
// ─────────────────────────────────────────────────────────────
function renderGroupStatusGrid() {
  const today = new Date();
  const tiles = [1,2,3,4].map(g => {
    const sheds = shedsForGroup(g);
    const placed = sheds.filter(s => s.placementDate);
    if (!placed.length) {
      return `<div class="dash-gs-tile dash-gs-empty">
        <div class="dash-gs-head"><span class="dash-gs-name">${pairLabel(g)}</span></div>
        <p class="dash-gs-empty-msg">Not placed yet</p>
      </div>`;
    }
    const age = Math.max(...placed.map(s => daysBetween(s.placementDate, today)));
    const live = sheds.reduce((s,sh) => s + liveAtStartOfDay(sh, today), 0);

    // Weighted avg weight + today-consistent FCR, scoped to this group
    const so = batchSoFar(sheds, dateOnly(today));
    const avgWeight = so.withWeight > 0 && so.kpi.alw > 0 ? so.kpi.alw : null;
    const fcr = so.kpi.fcr > 0 ? so.kpi.fcr : null;

    // Feed-on-hand days remaining (same calc as the Feed on hand card)
    const bal = currentBalanceKg(g);
    const dailyFeed = sheds.reduce((s,sh) => {
      const shedAge = sh.placementDate ? Math.max(1, daysBetween(sh.placementDate, today)) : 14;
      const fi = ROSS_308_FEED_INTAKE[Math.max(1,Math.min(60,shedAge))] || 120;
      return s + fi * liveAtStartOfDay(sh, today) / 1000;
    }, 0);
    const feedDays = dailyFeed > 0 ? bal / dailyFeed : null;

    const cleanouts = sheds.map(s => s.cleanoutDate).filter(Boolean).map(d => dateOnly(d));
    const cleanIn = cleanouts.length ? Math.max(0, daysBetween(today, new Date(Math.min(...cleanouts)))) : null;

    return `<button class="dash-gs-tile" data-tab="g${g}" type="button">
      <div class="dash-gs-head"><span class="dash-gs-name">${pairLabel(g)}</span></div>
      <div class="dash-gs-row"><span class="dash-gs-lbl">Age</span><span class="dash-gs-val">D${age}</span></div>
      <div class="dash-gs-row"><span class="dash-gs-lbl">Live birds</span><span class="dash-gs-val">${live > 0 ? live.toLocaleString() : '—'}</span></div>
      <div class="dash-gs-row"><span class="dash-gs-lbl">Avg weight</span><span class="dash-gs-val">${avgWeight != null ? avgWeight.toFixed(2)+' kg' : '—'}</span></div>
      <div class="dash-gs-row"><span class="dash-gs-lbl">FCR</span><span class="dash-gs-val">${fcr != null ? fcr.toFixed(2) : '—'}</span></div>
      <div class="dash-gs-row"><span class="dash-gs-lbl">Feed left</span><span class="dash-gs-val">${feedDays != null ? feedDays.toFixed(1)+' days' : '—'}</span></div>
      <div class="dash-gs-foot">${cleanIn != null ? `Clean-out in ${cleanIn} day${cleanIn!==1?'s':''}` : 'No clean-out date set'}</div>
    </button>`;
  }).join('');
  return `<div class="dash-card">
    <div class="dash-card-head"><h2 class="dash-card-title">Shed status</h2></div>
    <div class="dash-gs-grid">${tiles}</div>
  </div>`;
}

// Dashboard: clean-out outlook for every shed (same numbers as the
// Predictions snapshot cards — shedCleanoutInfo)
// Clean-out date, editable in place (same setter as the shed card). A logged
// final pickup fixes the date, so those rows stay read-only.
function dcoDateCell(shed,co,fb){
  const idx=farmData.sheds.indexOf(shed);
  if(finalPickupOf(shed))return `${fmtShortNoYear(co.endDate)}<span class="dco-lock" title="Set by the final pickup">✓</span>`;
  return `<input type="date" class="dco-date${fb?' dco-date-unset':''}" value="${iso(shed.cleanoutDate)}" data-shed="${idx}" data-field="cleanoutDate" aria-label="Shed ${shed.id} clean-out date"${fb?` title="Not set — using the ${co.endSrc} (${fmtShortNoYear(co.endDate)})"`:''}>`;
}
// Dashboard: one row per shed — where it is today and where it ends at clean-out
// (same numbers as before: currentShedWeightEstimate today, shedCleanoutInfo to clean-out)
function renderCleanoutDashCard(){
  if(!farmData)return '';
  const today=dateOnly(new Date());
  const sheds=(farmData.sheds||[]).filter(s=>s.placementDate);
  if(!sheds.length)return '';
  let totBirds=0,totKg=0,finBirds=0,finKg=0,anyFallback=false,liveNow=0;
  const rows=(farmData.sheds||[]).map(shed=>{
    if(!shed.placementDate)return `<tr><td class="shed-name-cell">Shed ${shed.id}</td><td colspan="6" class="dco-none">No placement date</td></tr>`;
    // today
    const age=daysBetween(shed.placementDate,today);const live=liveAtStartOfDay(shed,today);liveNow+=live;
    const est=currentShedWeightEstimate(shed,today);const alw=est?est.kg:null;
    const daysVar=(alw&&age>0)?daysVsTarget(age,alw):null;const sev=daysBehindSeverity(daysVar);
    const mort=shed.initialPopulation>0?((Number(shed.mortality)||0)/shed.initialPopulation*100):0;
    const dotColor=sev==='unknown'?'#9CA3AF':sev==='bad'?'var(--danger)':sev==='warn'?'var(--primary)':'var(--success)';
    const behind=daysVar==null?'—':Math.abs(daysVar)<0.1?'On target':`${Math.abs(daysVar).toFixed(1)}d ${daysVar>0?'ahead':'behind'}`;
    const alwChip=est&&est.isEstimate?`<span class="est-chip" title="${escapeAttr(weightEstTitle(est))}">est</span>`:'';
    const nowCells=`<td class="num">D${age}<div class="dco-birds">${live>0?live.toLocaleString():'—'} birds · ${mort.toFixed(1)}% mort.</div></td>
      <td class="num">${alw?alw.toFixed(3):'—'} <span class="dco-sub">kg</span>${alwChip}<div class="dco-birds"><span class="dash-status-dot" style="background:${dotColor}"></span>${behind}</div></td>`;
    // to clean-out
    const co=shedCleanoutInfo(shed,today);
    if(!co)return `<tr><td class="shed-name-cell">Shed ${shed.id}</td>${nowCells}<td colspan="4" class="dco-none">Not enough data yet</td></tr>`;
    totBirds+=co.birdsAll;totKg+=co.totalKgAll;finBirds+=co.finalBirds;finKg+=co.finalBirds*co.finalKg;
    const fb=co.endSrc!=='clean-out date';if(fb)anyFallback=true;
    const when=co.daysToEnd>0?`${co.daysToEnd}d left`:co.daysToEnd===0?'today':'done';
    return `<tr${co.daysToEnd<0?' class="dco-past"':''}><td class="shed-name-cell">Shed ${shed.id}</td>
      ${nowCells}
      <td class="dco-co">${dcoDateCell(shed,co,fb)}<div class="dco-birds">D${co.cleanAge} · ${when}</div></td>
      <td class="num">${co.finalKg?co.finalKg.toFixed(3):'—'} <span class="dco-sub">kg</span><div class="dco-birds">${co.finalBirds.toLocaleString()} birds</div></td>
      <td class="num">${co.avgAll?co.avgAll.toFixed(3):'—'} <span class="dco-sub">kg</span><div class="dco-birds">${co.pickupCount} pickups</div></td>
      <td class="num dco-total">${Math.round(co.totalKgAll).toLocaleString()} <span class="dco-sub">kg</span><div class="dco-birds">${co.birdsAll.toLocaleString()} birds</div></td></tr>`;
  }).join('');
  const avgAll=totBirds>0?totKg/totBirds:0,avgFin=finBirds>0?finKg/finBirds:0;
  const open=sheds.filter(s=>!finalPickupOf(s));
  const setAll=open.length>1?`<tbody class="dco-setall"><tr><td class="shed-name-cell">All</td><td colspan="2"></td><td colspan="4"><div class="dco-setall-row"><input type="date" class="dco-date" id="dcoSetAllDate" aria-label="Clean-out date for all sheds"><button type="button" class="btn-secondary dco-setall-btn" id="dcoSetAllBtn">Set all ${open.length} sheds</button></div></td></tr></tbody>`:'';
  return `<div class="dash-card dash-cleanout">
    <div class="dash-card-head"><h2 class="dash-card-title">Shed forecast until clean-out</h2><span class="dco-head-sub">Today, then the outlook to each shed's clean-out</span><button class="dash-card-action" data-tab="g1" type="button">All sheds</button></div>
    <div class="dco-scroll"><table class="dash-shed-table dco-table">
      <thead>
        <tr class="dco-group"><th></th><th colspan="2">Today</th><th colspan="4">To clean-out</th></tr>
        <tr><th>Shed</th><th class="num">Age · birds</th><th class="num">Weight · vs Ross</th><th>Clean-out</th><th class="num" title="Predicted average weight of the last (clean-out) pickup">Last pickup</th><th class="num" title="Average weight across ALL pickups (logged, planned and auto)">Avg all pickups</th><th class="num" title="Sum of all pickups' live weight">Total live wt</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      ${setAll}
      <tfoot><tr><td>Farm</td><td class="num"><div class="dco-birds">${liveNow.toLocaleString()} birds</div></td><td></td><td></td><td class="num">${avgFin?avgFin.toFixed(3):'—'} <span class="dco-sub">kg</span></td><td class="num">${avgAll?avgAll.toFixed(3):'—'} <span class="dco-sub">kg</span></td><td class="num dco-total">${Math.round(totKg).toLocaleString()} <span class="dco-sub">kg</span><div class="dco-birds">${totBirds.toLocaleString()} birds</div></td></tr></tfoot>
    </table></div>
    <p class="dco-note">Clean-out weights use the same projection as the Projected batch result: logged + your planned + auto-planned pickups.${anyFallback?' Empty date = not set yet, using the shed\'s last pickup.':''} Tap a date to change it.</p>
  </div>`;
}
function renderDashboardView() {
  if (!farmData) {
    const isConnected = !!(syncFarmName && syncConnectedAt);
    return `<div class="dash-empty">
      <div class="dash-empty-icon">🐔</div>
      <h2>Welcome to ProdWise<span class="accent">.VM</span></h2>
      <p>Import your sheds Excel file to get started, or connect to cloud sync to load your data from another device.</p>
      <div class="dash-empty-actions">
        <button class="btn-primary" id="emptyImportBtn" type="button">Import Excel</button>
        ${isConnected ? '' : '<button class="btn-secondary" id="emptyConnectBtn" type="button">Connect farm</button>'}
      </div>
    </div>`;
  }

  const today = new Date();

  // ── Farm-wide totals ──
  const allSheds = farmData.sheds || [];
  const totalInit   = allSheds.reduce((s,x) => s + (Number(x.initialPopulation)||0), 0);
  const totalMort   = allSheds.reduce((s,x) => s + (Number(x.mortality)||0), 0);
  const totalPick   = allSheds.reduce((s,x) => s + totalPicked(x), 0);
  const totalLive   = allSheds.reduce((s,x) => s + liveAtStartOfDay(x, today), 0);
  const livability  = totalInit > 0 ? ((totalInit - totalMort) / totalInit * 100) : null;

  // Batch age (oldest placed shed)
  const placedDates = allSheds.map(s => s.placementDate).filter(Boolean).map(d => dateOnly(d));
  const batchStart  = placedDates.length ? new Date(Math.min(...placedDates)) : null;
  const batchAge    = batchStart ? daysBetween(batchStart, today) : null;
  const cleanouts   = allSheds.map(s => s.cleanoutDate).filter(Boolean).map(d => dateOnly(d));
  // End of batch: the last clean-out date if set, otherwise the last
  // (final) pickup — logged or planned — across all sheds.
  const lastCleanout = cleanouts.length ? new Date(Math.max(...cleanouts)) : null;
  let batchEnd = lastCleanout, batchEndSrc = lastCleanout ? 'clean-out' : null;
  if (!batchEnd) {
    let latest = null, planned = false;
    allSheds.forEach(sh => computeEffectivePickups(sh).forEach(p => {
      if (!p.date) return; const d = dateOnly(p.date);
      if (!latest || d > latest) { latest = d; planned = p.__source === 'predicted'; }
    }));
    if (latest) { batchEnd = latest; batchEndSrc = planned ? 'final pickup, planned' : 'final pickup'; }
  }
  const batchTotal  = batchStart && batchEnd ? daysBetween(batchStart, batchEnd) : null;
  const batchPct    = (batchAge != null && batchTotal) ? Math.min(100, Math.round(batchAge / batchTotal * 100)) : 0;

  // ── Today-consistent farm FCR ──────────────────────────────
  // Feed consumed to date (cumulative) ÷ current total live weight.
  // Current weight comes from a real pickup weighing when one
  // exists, otherwise the same Gompertz-fit estimate (from in-yard
  // samples) the rest of the app already uses for predictions.
  // Feed to date ÷ (live weight now + weight already shipped — the feed
  // includes what picked-up birds ate). Same formulas as the projection.
  // Current only — no projection, no intake model: feed eaten is measured
  // (carry-over + dockets − silo stock at the latest readings) and divided
  // by the weight at those readings (on farm + already shipped).
  const so = batchMeasured(today);
  const k = so.kpi || {};
  const anyEstimated = so.anyEstimated;
  const avgAlw = k.alw || 0;
  const fcrTodayVal = k.fcr || 0;
  const cFcrVal = k.cfcr || 0;
  const cFcrIndVal = k.cfcrInd || 0;
  const epefVal = (k.avgAge > 0 && fcrTodayVal > 0 && avgAlw > 0) ? k.pif : 0;
  const readDates = so.pairs.map(p => fmtShortNoYear(p.date) + (p.morning ? ' am' : ' pm'));
  const fcrWhy = so.missing.length ? `Needs a silo reading for ${so.missing.map(pairLabel).join(', ')}`
    : so.noWeight.length ? `No weight yet for shed ${so.noWeight.join(', ')}`
    : !(so.eaten > 0) ? 'Silo stock is above feed delivered — check readings and dockets' : '';
  const fcrRows = `<div class="dash-fcr-rows">
        <span>Feed ordered</span><b>${fmtFeed(so.ordered)}</b>
        <span title="Carry-over ${fmtFeed(so.carry)} + dockets delivered − silo stock at the latest readings (${readDates.join(', ') || 'none'})">Eaten so far</span><b>${so.missing.length ? '—' : fmtFeed(so.eaten)}</b>
        <span>Live weight now</span><b>${fmtKgAlways(so.onFarmKg)}</b>
        <span>Shipped so far</span><b>${fmtKgAlways(so.shippedKg)}</b>
      </div>`;

  const estChip = anyEstimated ? '<span class="est-chip" title="Some shed weights are estimates — projected from the last pickup weighing or from the growth curve fitted to in-yard samples.">est</span>' : '';
  const fcrDisplay  = fcrTodayVal > 0  ? fcrTodayVal.toFixed(2)  : '—';
  const cFcrDisplay = cFcrVal > 0      ? cFcrVal.toFixed(2)       : '—';
  const epefDisplay = epefVal > 0      ? Math.round(epefVal)      : '—';
  const mortPct        = totalInit > 0 ? (totalMort / totalInit * 100) : 0;


  // ── Upcoming feed deliveries (farm loads) ──
  const WD2 = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const MO2 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const todayD = dateOnly(today);
  const upcomingLoads = (farmLoads || [])
    .filter(l => l.date && dateOnly(l.date) >= todayD)
    .sort((a,b) => dateOnly(a.date) - dateOnly(b.date));
  const deliveryRows = upcomingLoads.slice(0, 3).map(l => {
    const d = dateOnly(l.date);
    const groups = [1,2,3,4].filter(g => (Number(l.splitKg[g])||0) > 0);
    const typeCls = FEED_TYPES.some(f => f.id === l.feedType) ? l.feedType : 'unspecified';
    const totalKg = l.actualKg != null ? l.actualKg : l.plannedKg;
    const splitText = groups.length > 1 ? ' · ' + groups.map(g => `${pairShort(g)}: ${fmtFeed(l.splitKg[g],1)}`).join(', ') : '';
    return `<div class="dash-pickup-item">
      <div class="dash-pickup-date-block">
        <span class="dash-pickup-dow">${WD2[d.getDay()]}</span>
        <span class="dash-pickup-day">${d.getDate()}</span>
        <span style="font-size:9px;color:var(--muted)">${MO2[d.getMonth()]}</span>
      </div>
      <div class="dash-pickup-info">
        <span class="dash-pickup-kind dash-delivery-kind-${typeCls}">${escapeHtml(feedTypeLabel(l.feedType)).toUpperCase()}</span>
        <span class="dash-pickup-sheds">${groups.length ? `Sheds ${groups.map(pairShort).join(' &amp; ')}` : 'Unassigned'}</span>
        <span class="dash-pickup-detail">${fmtFeed(totalKg)}${splitText}${l.note ? ' · ' + escapeHtml(l.note) : ''}</span>
      </div>
    </div>`;
  }).join('');

  // ── Per-shed table rows ──
  // ── Silo bars ──
  const siloBars = [1,2,3,4].map(g => {
    const bal  = currentBalanceKg(g);
    const sheds = shedsForGroup(g);
    const cap  = sheds.length * 3 * (CONE_KG + MAX_RINGS * RING_KG);
    const pct  = cap > 0 ? Math.min(100, Math.round(bal / cap * 100)) : 0;
    const dailyFeed = sheds.reduce((s,sh) => {
      const age = sh.placementDate ? Math.max(1, daysBetween(sh.placementDate, today)) : 14;
      const fi  = ROSS_308_FEED_INTAKE[Math.max(1,Math.min(60,age))] || 120;
      return s + fi * liveAtStartOfDay(sh, today) / 1000;
    }, 0);
    const days = dailyFeed > 0 ? bal / dailyFeed : null;
    const cls  = days == null ? 'ok' : days < 1.5 ? 'low' : days < 3 ? 'warn' : 'ok';
    const label= days != null ? days.toFixed(1)+' days' : '—';
    return `<div class="dash-silo-item">
      <div class="dash-silo-row">
        <span class="dash-silo-name">${pairLabel(g)}</span>
        <span class="dash-silo-days ${cls}">${label}</span>
      </div>
      <div class="dash-silo-bar"><div class="dash-silo-fill ${cls}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');

  // Compact livability ring for the Mortality tile
  const ringR = 19, ringC = 2 * Math.PI * ringR;
  const ringFill = livability != null ? (livability / 100) * ringC : 0;
  const livRing = `<span class="dash-liv-ring" title="Livability ${livability != null ? livability.toFixed(1) + '%' : '—'} · target ≥ 96%">
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <circle cx="24" cy="24" r="${ringR}" fill="none" stroke="var(--ring-track)" stroke-width="5"/>
      <circle cx="24" cy="24" r="${ringR}" fill="none" stroke="var(--ring-fill)" stroke-width="5" stroke-linecap="round"
        stroke-dasharray="${ringFill.toFixed(1)} ${ringC.toFixed(1)}" transform="rotate(-90 24 24)"/>
    </svg>
    <span class="dash-liv-ring-val">${livability != null ? livability.toFixed(1) + '%' : '—'}</span>
    <span class="dash-liv-ring-lbl">Livability</span>
  </span>`;

  // ── Assemble ──
  const ageStr  = batchAge != null ? `Day ${batchAge}` : '—';
  const daysLeft = batchEnd ? daysBetween(today, batchEnd) : null;
  const endStr  = batchEnd
    ? `Ends <strong>${fmtShort(batchEnd)}</strong> · ${daysLeft > 0 ? `${daysLeft} day${daysLeft!==1?'s':''} left` : daysLeft === 0 ? 'today' : 'ended'}<br><span class="dash-kpi-src">${batchEndSrc}</span>`
    : 'No end date yet — plan pickups in Predictions';

  return `<div class="dash-wrap">
  <div class="dash-grid dash-row-kpi">
    <div class="dash-kpi dash-kpi-neutral">
      <span class="dash-kpi-label">Batch progress</span>
      <span class="dash-kpi-value">${ageStr}</span>
      <span class="dash-kpi-sub">${endStr}</span>
      <div class="dash-kpi-progress" title="${batchPct}% of the batch complete"><div class="dash-kpi-progress-fill" style="width:${batchPct}%"></div></div>
    </div>
    <div class="dash-kpi dash-kpi-amber">
      <span class="dash-kpi-icon">${dashKpiIcon('birds')}</span>
      <span class="dash-kpi-label">Birds on hand</span>
      <span class="dash-kpi-value">${totalLive > 0 ? totalLive.toLocaleString() : '—'}</span>
      <span class="dash-kpi-sub">of ${totalInit.toLocaleString()} placed · ${totalPick.toLocaleString()} picked up</span>
    </div>
    <div class="dash-kpi dash-kpi-green">
      <span class="dash-kpi-icon">${dashKpiIcon('fcr')}</span>
      <span class="dash-kpi-label">FCR today${estChip}</span>
      <span class="dash-kpi-value" title="FCR = feed eaten ÷ live weight (on farm + shipped) at the latest silo readings. cFCR (Baiada) = FCR − (ALW − 2.45) × ${CFCR_BAIADA_BETA}. ALW = live weight ÷ birds (${avgAlw ? avgAlw.toFixed(3) : '—'} kg).">${fcrDisplay} <span>/ cFCR ${cFcrDisplay}</span></span>
      ${fcrWhy ? `<span class="dash-kpi-sub">${escapeHtml(fcrWhy)}</span>` : `<span class="dash-kpi-sub" title="cFCR (Industry) = FCR − (ALW − ${so.targetKg.toFixed(2)} target) ÷ 3.2. PIF = livability × ALW ÷ (avg age ${k.avgAge ? k.avgAge.toFixed(1) : '—'} d × FCR) × 100. Higher PIF is better.">cFCR Ind. ${cFcrIndVal > 0 ? cFcrIndVal.toFixed(2) : '—'} · PIF today ${epefDisplay}</span>`}
      ${fcrRows}
    </div>
    <div class="dash-kpi dash-kpi-red">
      <div class="dash-kpi-top">
        <span class="dash-kpi-icon">${dashKpiIcon('mortality')}</span>
        ${livRing}
      </div>
      <span class="dash-kpi-label">Mortality</span>
      <span class="dash-kpi-value">${mortPct.toFixed(1)}<span>%</span></span>
      <span class="dash-kpi-sub">${totalMort.toLocaleString()} birds · livability ${livability != null ? livability.toFixed(1) + '%' : '—'} <span class="dash-kpi-src">(target ≥ 96%)</span></span>
    </div>
  </div>

  <!-- Featured: whole-batch projection -->
  ${renderFarmKpiCard()}

  <!-- Per shed pair: status tiles beside feed (on hand + deliveries) -->
  <div class="dash-split dash-split-half">
    ${renderGroupStatusGrid()}
    <div class="dash-card dash-feed">
      <div class="dash-card-head">
        <h2 class="dash-card-title">Feed</h2>
        <span class="dash-feed-actions"><button class="dash-card-action" id="siloFromDash" type="button">Silos</button><button class="dash-card-action" data-open-loads-modal type="button">All loads</button></span>
      </div>
      <div class="dash-feed-sec">
        <div class="dash-feed-sub">On hand</div>
        <div class="dash-silo-list">${siloBars}</div>
        ${feedToOrderLineHtml(farmFeedToOrder())}
      </div>
      <div class="dash-feed-sec">
        <div class="dash-feed-sub">Upcoming deliveries</div>
        ${deliveryRows || '<p class="dash-feed-empty">No feed deliveries scheduled. Open All loads to plan one.</p>'}
      </div>
    </div>
  </div>

  <!-- Per shed: today and the outlook to clean-out -->
  ${renderCleanoutDashCard()}

  <!-- Trend -->
  ${renderGrowthChartSvg()}

  </div>`;
}

function scheduleRender(delay=50){
  const active=document.activeElement;const activeId=active?active.id:null;
  let selStart=null,selEnd=null;
  if(active&&(active.tagName==='INPUT'||active.tagName==='TEXTAREA')){try{selStart=active.selectionStart;selEnd=active.selectionEnd;}catch(e){}}
  clearTimeout(renderTimer);
  renderTimer=setTimeout(()=>{
    render();
    if(activeId){const el=document.getElementById(activeId);if(el){el.focus();if(selStart!=null&&typeof el.setSelectionRange==='function'){try{el.setSelectionRange(selStart,selEnd);}catch(e){}}}}
  },delay);
}
// Key identifying the page the user is looking at. When it changes
// between renders, the content eases in and the scroll resets.
let lastPageKey=null;
function currentPageKey(){
  if(activeTab==='predictions')return `pred:${predState.predGroup}:${predState.predView}`;
  if(/^g[1-4]$/.test(activeTab))return `${activeTab}:${shedViewByGroup[Number(activeTab.slice(1))]||''}`;
  return activeTab;
}
function renderViewDock(){
  // Phones: the view bar (Shed 1 · Shed 2 · Both · …) collapses into one button bottom-left
  const vdRoot=document.getElementById('viewDockRoot');
  if(vdRoot){const rail=document.querySelector('#app .pred-rail');vdRoot.innerHTML=rail?viewDockHtml(rail):'';document.body.classList.toggle('has-vdock',!!rail);}
}
function render(){
  try{
    const pageKey=currentPageKey();
    if(pageKey!==lastPageKey){
      const appEl=document.getElementById('app');
      if(appEl&&lastPageKey!==null){
        // Changing tab (not just the shed view) starts at the top.
        if(String(pageKey).split(':')[0]!==String(lastPageKey).split(':')[0])appEl.scrollTo({top:0,behavior:'instant'});
        appEl.classList.remove('page-enter');void appEl.offsetWidth;appEl.classList.add('page-enter');
        clearTimeout(render._pe);render._pe=setTimeout(()=>appEl.classList.remove('page-enter'),500);
      }
      lastPageKey=pageKey;
    }
    gompertzCache=new Map();autoPlanCache=new Map();farmRangeCache=null;thinPatternCache=null;intakeCalCache=null;finalPickupCache=null;
    if(farmData){let estMoved=false;(farmData.sheds||[]).forEach(s=>{if(refreshEstimatedPickupWeights(s))estMoved=true;});if(estMoved){autoPlanCache=new Map();finalPickupCache=null;saveState();schedulePush();}}
    // Batch number field
    const batchEl=document.getElementById('batchNumber');
    if(batchEl){const want=predState.batchNumber||(farmData?farmData.batchNumber:'')||'';if(batchEl.value!==want)batchEl.value=want;batchEl.readOnly=!!want;batchEl.title=want?'Batch number is locked. Use "New Batch" to change it.':'Enter or import a batch number';}
    if(settingsDrawerOpen)renderSettingsDrawerBody();
    updateLoadsDot();
    // Sidebar + mobile nav
    const sbNav=document.getElementById('sidebarNav');
    if(sbNav)sbNav.innerHTML=sidebarHtml();
    const mobNav=document.getElementById('mobileNav');
    if(mobNav)mobNav.innerHTML=mobileNavHtml();
    if(moreSheetOpen)renderMoreSheet();
    renderSyncPill();
    renderSidebarBatch();
    // Phones/tablets: the shed-pair switcher is one floating button that expands upwards
    const gdRoot=document.getElementById('groupDockRoot');
    if(gdRoot){const gm=/^g([1-4])$/.exec(activeTab);const ctx=gm?'sheds':activeTab==='predictions'?'pred':null;const g=gm?Number(gm[1]):predState.predGroup;
      gdRoot.innerHTML='';document.body.classList.remove('has-gdock');}
    // Adjustments: one floating button on every page (bottom-right)
    const adjFab=document.getElementById('adjFab');
    if(adjFab){adjFab.hidden=!farmData;if(!adjFab.firstChild)adjFab.innerHTML=navIcon('gear');adjFab.classList.toggle('active',!!adjModalOpen);adjFab.setAttribute('aria-expanded',String(!!adjModalOpen));}
    // Adjustments modal lives at body level so it stacks above the nav
    const adjRoot=document.getElementById('adjModalRoot');
    if(adjRoot){const show=adjModalOpen&&farmData&&shedsForGroup(predState.predGroup).length;if(!show){adjModalOpen=false;adjDraft=null;adjRoot.innerHTML='';adjRoot.dataset.g='';}else if(!adjRoot.querySelector('.adj-modal')||adjRoot.dataset.g!==String(predState.predGroup)){adjRoot.innerHTML=renderAdjustmentModal(predState.predGroup);adjRoot.dataset.g=String(predState.predGroup);}else if(!adjIsDirty()){const fresh=adjDraftFromState(predState.predGroup);const fs=JSON.stringify(fresh);if(fs!==adjDraftBase){adjDraft=fresh;adjDraftBase=fs;}refreshAdjModal(true);}}
    updatePageHeader();
    updateAlertsBell();
    // Main content
    const app=document.getElementById('app');
    if(activeTab==='history'){app.innerHTML=renderHistoryView();}
    else if(!farmData){
      if(activeTab!=='dashboard'&&activeTab!=='home')activeTab='home';
      app.innerHTML=renderDashboardView();
      // Nothing to compare without data
      if(feedCompareState.modalOpen){feedCompareState.modalOpen=false;const cm=document.getElementById('compareFeedModal');if(cm)cm.classList.remove('open');}
    }
    else if(activeTab==='home'){app.innerHTML=renderHomeView();}
    else if(activeTab==='farmsettings'){app.innerHTML=renderFarmSettingsView();}
    else if(activeTab==='dashboard'){app.innerHTML=renderDashboardView();}
    else if(activeTab==='predictions'){app.innerHTML=renderPredictionsView();}
    else{
      if(!['g1','g2','g3','g4'].includes(activeTab))activeTab='home';
      app.innerHTML=activeTab==='dashboard'?renderDashboardView():groupViewHtml(Number(activeTab.replace('g','')));
    }
    // Pop-ups opened from the sidebar (Compare feed, Feed loads) can sit over
    // any page, so refresh them on every render — not just on shed pages.
    renderViewDock();
    if(typeof refreshPickupsModal==='function')refreshPickupsModal();
    if(feedCompareState.modalOpen)renderCompareModalBody();
    refreshLoadsViews();
    if(inlinePickupState)requestAnimationFrame(sizeTestPickupForms);
    if(inlineDeliveryState||inlinePickupState){
      const scope=feedCompareState.modalOpen?document.getElementById('compareFeedModal'):app;
      const sel=inlinePickupState?'.tp-input':'.inline-del-input';
      requestAnimationFrame(()=>{const input=scope&&scope.querySelector(sel);if(input){input.focus({preventScroll:true});if(input.select)input.select();}});
    }
  }finally{requestAnimationFrame(updateStickyHeaderHeight);requestAnimationFrame(setupStickyTabObservers);}
}
let _stickyTabObserver=null;
function setupStickyTabObservers(){
  if(_stickyTabObserver)_stickyTabObserver.disconnect();
  const app=document.getElementById('app');
  if(!app)return;
  const sentinels=app.querySelectorAll('.sticky-sentinel');
  if(!sentinels.length)return;
  _stickyTabObserver=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      const bar=entry.target.nextElementSibling;
      if(!bar||!bar.classList.contains('sticky-tabs'))return;
      // Stuck when the sentinel has scrolled above the visible area (not just out of view below)
      const stuck=!entry.isIntersecting&&entry.boundingClientRect.top<0;
      bar.classList.toggle('is-stuck',stuck);
    });
  },{root:app,threshold:0});
  sentinels.forEach(s=>_stickyTabObserver.observe(s));
}
function emptyStateHtml(){
  const isConnected=!!(syncFarmName&&syncConnectedAt);
  const farmLabel=syncFarmName||'';
  const batchLabel=predState.batchNumber?` · batch ${predState.batchNumber}`:'';
  if(isConnected){return `<div class="empty-state"><div class="empty-card"><div class="emoji">🐔</div><h1>Ready for a fresh batch</h1><p>Connected to <strong>${escapeHtml(farmLabel)}${escapeHtml(batchLabel)}</strong>.<br>Import the sheds Excel file to begin.</p><div class="empty-actions"><button class="btn-primary" id="emptyImportBtn" type="button">📥 Import Excel</button></div><div class="hint">Excel: look for a file named like <strong>sheds.xlsx</strong> or <strong>KP-2026.xlsx</strong></div></div></div>`;}
  return `<div class="empty-state"><div class="empty-card"><div class="emoji">🐔</div><h1>Welcome to <span class="accent">ProdWise.VM</span></h1><p>Start by importing your sheds Excel file, or connect to cloud sync to load your data from another device.</p><div class="empty-actions"><button class="btn-primary" id="emptyImportBtn" type="button">📥 Import Excel</button><span class="empty-or">or</span><button class="btn-cloud" id="emptyConnectBtn" type="button">☁️ Connect to cloud</button></div><div class="hint">Excel: look for a file named like <strong>sheds.xlsx</strong> or <strong>KP-2026.xlsx</strong></div><div class="hint small">Cloud: enter the same farm name you used on your other device.</div></div></div>`;
}
function tabsHtml(){
  const tabs=[{id:'g1',label:pairLabel(1)},{id:'g2',label:pairLabel(2)},{id:'g3',label:pairLabel(3)},{id:'g4',label:pairLabel(4)},{id:'predictions',label:'📊 Predictions',cls:'tab-predictions'}];
  const mainTabs=tabs.map(t=>`<button class="tab-btn ${t.id===activeTab?'active':''} ${t.cls||''}" data-tab="${t.id}">${t.label}</button>`).join('');
  const cluckwiseTab=`<button class="tab-btn tab-cluckwise" id="cluckwiseBtn" type="button" title="Open CluckWise">🐔 CluckWise</button>`;
  return mainTabs+cluckwiseTab;
}
function groupViewHtml(g){
  const sheds=shedsForGroup(g);if(sheds.length===0)return `<div class="empty-card">${pairLabel(g)} has no data.</div>`;
  const today=new Date();
  const init=sheds.reduce((s,x)=>s+(x.initialPopulation||0),0);
  const mort=sheds.reduce((s,x)=>s+Number(x.mortality||0),0);
  const picked=sheds.reduce((s,x)=>s+totalPicked(x),0);
  const live=sheds.reduce((s,x)=>s+liveAtStartOfDay(x,today),0);
  const mortRate=init>0?(mort/init)*100:0;
  const feedToday=groupFeedToday(sheds,today);
  const grad=g===1?'linear-gradient(135deg,#E0A339,#A8721F)':g===2?'linear-gradient(135deg,#B08463,#5E2E22)':g===3?'linear-gradient(135deg,#C9774A,#8F4A28)':'linear-gradient(135deg,#A89055,#6E5A32)';
  let view=shedViewByGroup[g]||'overview';if(!['overview','planner','pickups','growth','setup'].includes(view))view='overview';let contentHtml='';
  if(view==='planner')contentHtml=renderFeedPlanner(g,sheds,today);
  else if(view==='overview')contentHtml=pairOverviewHtml(g);
  else if(view==='pickups'||view==='growth'||view==='setup'){const both=sheds.length>1;contentHtml=`<div class="pred-grid${both?' compare':''} pair-part-${view}">${sheds.map(s=>renderPredictionsShedCard(s,g,view)).join('')}</div>`;}
  else{const visibleSheds=view==='shed1'?[sheds[0]]:view==='shed2'?[sheds[1]||sheds[0]]:sheds;const gridClass=view==='both'&&sheds.length>1?'sheds-grid compare':'sheds-grid';contentHtml=`<div class="${gridClass}">${visibleSheds.map(s=>shedCardHtml(s,today)).join('')}</div>`;}
  const groupSwitch=pairSwitchHtml(g,'sheds');
  return groupSwitch+`<div class="pred-layout"><div class="group-view-head" style="background:${grad}"><h1>${pairStepHtml(g,'shed')}${pairLabel(g)}${pairStepHtml(g,'shed',1)}</h1><div class="pills"><span>Live <strong>${live.toLocaleString()}</strong></span><span class="feed-pill">Feed today <strong>${fmtFeed(feedToday)}</strong></span><span>Mort <strong>${mort.toLocaleString()}</strong> (${mortRate.toFixed(2)}%)</span><span>Picked <strong>${picked.toLocaleString()}</strong></span></div></div>${pairTabsHtml(g,view)}${contentHtml}</div>`;
}
function shedTabsHtml(g,view,sheds){
  if(sheds.length<2)return '';
  const btn=(v,icon,label,title)=>`<button type="button" class="pred-rail-btn${view===v?' active':''}" data-shedview="${v}" data-group="${g}" aria-pressed="${view===v}" title="${title}">${navIcon(icon)}<span>${label}</span></button>`;
  return `<nav class="pred-rail" aria-label="Shed view">
    ${btn('shed1','home',`Shed ${sheds[0].id}`,`Show shed ${sheds[0].id}`)}
    ${btn('shed2','home',`Shed ${sheds[1].id}`,`Show shed ${sheds[1].id}`)}
    ${btn('both','homes','Both','Show both sheds side by side')}
    <span class="pred-rail-sep" aria-hidden="true"></span>
    ${btn('planner','silo','Feed & Silo','Feed and silo planner')}
    <button type="button" class="pred-rail-btn" data-goto-predgroup="${g}" title="Predictions for ${pairLabel(g)}">${navIcon('chart')}<span>Predict</span></button>
  </nav>`;
}
function rangeBarHtml(range,ctx,extraHtml){
  const presets=[{label:'Last 7',start:-7,end:0},{label:'Today',start:0,end:0},{label:'Next 7',start:0,end:7},{label:'Next 14',start:0,end:14},{label:'Next 21',start:0,end:21}];
  const isShed=ctx==='shed';const isCompare=ctx==='compare';
  const attr=isShed?'data-days':'data-silodays';
  const barCls=isShed?'range-bar':'planner-range-bar';
  const startId=isShed?'shedCustomStart':(isCompare?'compareCustomStart':'siloCustomStart');
  const endId=isShed?'shedCustomEnd':(isCompare?'compareCustomEnd':'siloCustomEnd');
  return `<div class="${barCls}"><span class="forecast-label">Range:</span>${presets.map(p=>{const active=(p.start===range.start&&p.end===range.end);return `<button class="fpill ${active?'active':''}" ${attr}="${p.start},${p.end}">${p.label}</button>`;}).join('')}<div class="custom-range"><input type="number" min="-90" max="90" id="${startId}" value="${range.start}" data-customrange-ctx="${ctx}" data-customrange-bound="start" /><span>to</span><input type="number" min="-90" max="90" id="${endId}" value="${range.end}" data-customrange-ctx="${ctx}" data-customrange-bound="end" /><span>days</span></div>${extraHtml||''}</div>`;
}
function rangeLabel(range){
  if(range.start===-7&&range.end===0)return 'Last 7 days';
  if(range.start===0&&range.end===0)return 'Today only';
  if(range.start===0&&range.end===7)return 'Next 7 days';
  if(range.start===0&&range.end===14)return 'Next 14 days';
  if(range.start===0&&range.end===21)return 'Next 21 days';
  if(range.start<0&&range.end===0)return `Last ${Math.abs(range.start)} days`;
  if(range.start===0&&range.end>0)return `Next ${range.end} days`;
  return `${range.start} to ${range.end} days`;
}
function shedCardHtml(shed,today){
  const idx=shed.id-1;
  const age=ageInDays(shed,today);
  const live=liveAtStartOfDay(shed,today);
  const picked=totalPicked(shed);
  const mRate=mortalityRate(shed);
  const fp=finalPickupOf(shed);
  const canAddPickup=(shed.pickups||[]).length<MAX_PICKUPS_PER_SHED;
  const chickW=shedChickWeight(shed);
  const fit=getShedGompertzFit(shed);
  const predictedCount=(shed.predictedPickups||[]).length;
  const ds=getShedDensitySettings(shed);
  const pills=[`<span class="tag muted">Age ${age}d</span>`,`<span class="tag amber">Live ${live.toLocaleString()}</span>`,picked>0?`<span class="tag brown">Picked ${picked.toLocaleString()}</span>`:'',shed.mortality>0?`<span class="tag red">Mort ${shed.mortality.toLocaleString()} (${mRate.toFixed(2)}%)</span>`:'',fit?`<span class="tag green">AI Curve</span>`:'',chickW?`<span class="tag muted">Chick ${Math.round(chickW*1000)}g</span>`:'',`<span class="tag muted">${shed.pickups.length}/${ds.targetPickups} pickups</span>`,predictedCount>0?`<span class="tag predicted-source">${predictedCount} planned</span>`:'',fp?`<span class="tag amber">FINAL</span>`:''].filter(Boolean).join('');
  const pickupsHtml=shed.pickups.length===0?`<div class="pickups-empty">No pickups recorded for this shed.</div>`:`<table class="pickups-table"><thead><tr><th>Date</th><th class="num">Birds</th><th class="num">Variance</th><th>Note</th></tr></thead><tbody>${shed.pickups.map(p=>{const v=Number(p.variance);let varHtml='—';if(Number.isFinite(v)){const cls=v>0?'var-pos':(v<0?'var-neg':'');varHtml=`<span class="${cls}">${v>0?'+':''}${v.toLocaleString()}</span>`;}const srcBadge=p.source==='manual'?`<span class="tag manual-source" style="font-size:9px;padding:1px 6px;margin-left:6px;">Manual</span>`:'';return `<tr class="${p.isFinal?'is-final':''}"><td>${fmtShort(p.date)}${srcBadge}</td><td class="num">${p.birds.toLocaleString()}</td><td class="num">${varHtml}</td><td>${p.isFinal?'<span class="tag amber">FINAL</span>':''}</td></tr>`;}).join('')}</tbody></table>`;
  const forecast=computeForecast(shed,shedRange);
  const forecastHtml=renderShedForecastTable(shed,forecast);
  const pill=pickupPlanPillHtml(shed);
  return `<article class="shed-card"><div class="shed-card-head"><h3>Shed ${shed.id}</h3><div class="pills">${pills}</div></div><div class="shed-body"><div class="shed-grid"><div class="panel"><h4>Inputs (editable)</h4><div class="field-row"><label for="placement_${idx}">Placement Date</label><input id="placement_${idx}" type="date" value="${iso(shed.placementDate)}" data-shed="${idx}" data-field="placementDate" /></div><div class="field-row"><label for="pop_${idx}">Initial Population</label><input id="pop_${idx}" type="number" min="0" value="${shed.initialPopulation}" data-shed="${idx}" data-field="initialPopulation" /></div><div class="field-row"><label for="mort_${idx}">Mortality</label><input id="mort_${idx}" type="number" min="0" value="${shed.mortality}" data-shed="${idx}" data-field="mortality" /></div><div class="field-row"><label for="chickWeight_${idx}">Chick weight (g)</label><input id="chickWeight_${idx}" type="number" step="0.1" min="30" max="80" value="${Math.round(chickW*1000)}" data-shed="${idx}" data-field="chickWeightGrams" /></div><div class="field-row"><label for="feedPct_${idx}">Feed intake (% of Ross)</label><input id="feedPct_${idx}" type="number" step="1" min="50" max="150" value="${shed.feedAdjustPct!=null?shed.feedAdjustPct:''}" placeholder="${FARM_LEARNING&&intakeCalibration().ok?`auto ${Math.round(intakeCalibration().factor*100)}% (silo readings)`:"100 = standard"}" data-shed="${idx}" data-field="feedAdjustPct" title="Daily feed per bird as a % of the Ross 308 intake for each age. Leave empty for the standard (100%)." /></div><div class="field-row"><label for="cleanout_${idx}">Cleanout Date</label><input id="cleanout_${idx}" type="date" value="${iso(shed.cleanoutDate)}" data-shed="${idx}" data-field="cleanoutDate" ${fp?'title="Set automatically from the final pickup"':''} /></div></div><div class="panel"><h4>Snapshot (today)</h4><div class="snapshot-row"><span class="lbl">Age</span><span class="val">${age} days</span></div><div class="snapshot-row"><span class="lbl">Live birds</span><span class="val big">${live.toLocaleString()}</span></div><div class="snapshot-row"><span class="lbl">Mortality</span><span class="val">${shed.mortality.toLocaleString()} <span class="mort-pct">(${mRate.toFixed(2)}%)</span></span></div><div class="snapshot-row"><span class="lbl">Total picked</span><span class="val">${picked.toLocaleString()}</span></div><div class="snapshot-row"><span class="lbl">Cleanout</span><span class="val">${shed.cleanoutDate?fmtShort(shed.cleanoutDate):'—'}</span></div></div></div><div class="pickups-block"><h4 class="pickup-header"><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span>Pickups (${shed.pickups.length}/${ds.targetPickups})</span>${pill}</span><button class="btn-pickup-add" data-goto-predpickup="${shed.id}" type="button" ${canAddPickup?'':'disabled'} title="${canAddPickup?'Add a pickup on the Predictions tab':'Maximum 5 pickups reached'}">＋ Add Pickup</button></h4>${pickupsHtml}</div><div class="forecast-section">${rangeBarHtml(shedRange,'shed')}${forecastHtml}</div></div></article>`;
}
function computeForecast(shed,range){
  const today=dateOnly(new Date());const rows=[];let totalFeed=0;
  if(!shed.placementDate)return {rows:[],totalFeed:0,notStarted:true};
  const effective=computeEffectivePickups(shed);
  for(let off=range.start;off<=range.end;off++){
    const d=addDays(today,off);const isPast=off<0;const isToday=off===0;
    if(dateOnly(d)<dateOnly(shed.placementDate)){rows.push({date:d,age:0,liveStart:0,perBird:0,dailyFeed:0,pickups:[],pickupsBirds:0,liveAfter:0,isFinalDay:false,isToday,isPast,beforePlacement:true});continue;}
    if(shed.cleanoutDate&&dateOnly(d)>dateOnly(shed.cleanoutDate)){const pickupsToday=effective.filter(p=>iso(p.date)===iso(d));rows.push({date:d,age:ageInDays(shed,d),liveStart:0,perBird:0,dailyFeed:0,pickups:pickupsToday,pickupsBirds:pickupsToday.reduce((s,p)=>s+p.birds,0),liveAfter:0,isFinalDay:false,isToday,isPast,afterCleanout:true});continue;}
    const age=ageInDays(shed,d);const live=liveAtStartOfDay(shed,d);
    const pickupsToday=effective.filter(p=>iso(p.date)===iso(d));
    const pickupsBirds=pickupsToday.reduce((s,p)=>s+p.birds,0);
    const isFinalDay=pickupsToday.some(p=>p.isFinal);
    const hasPredicted=pickupsToday.some(p=>p.__source==='predicted');
    const perBird=feedPerBirdKg(shed,age);const dailyFeed=live*perBird;const liveAfter=Math.max(0,live-pickupsBirds);
    totalFeed+=dailyFeed;
    rows.push({date:d,age,liveStart:live,perBird,dailyFeed,pickups:pickupsToday,pickupsBirds,liveAfter,isFinalDay,hasPredicted,isToday,isPast});
  }
  return {rows,totalFeed};
}
// Pickup cell for the shed forecast: birds taken plus whether it's an
// official (logged) pickup or a planned (predicted) one.
function forecastPickupCell(pickups){
  const list=(pickups||[]).filter(p=>(Number(p.birds)||0)>0);
  if(!list.length)return '<span class="fc-none">—</span>';
  return list.map(p=>{
    const planned=p.__source==='predicted';
    return `<span class="fc-pickup"><span class="fc-birds">−${(Number(p.birds)||0).toLocaleString()}</span><span class="fc-tag ${planned?'planned':'official'}">${planned?'Planned':'Official'}</span>${p.isFinal?'<span class="fc-tag final">Final</span>':''}</span>`;
  }).join('');
}
function renderShedForecastTable(shed,forecast){
  const lbl=rangeLabel(shedRange);
  if(forecast.notStarted)return `<div class="forecast-block"><h4>📈 Forecast <span class="window-label">${lbl}</span></h4><div class="forecast-empty">Shed hasn't been placed yet — set a placement date to see the forecast.</div></div>`;
  if(forecast.rows.length===0)return `<div class="forecast-block"><h4>📈 Forecast <span class="window-label">${lbl}</span></h4><div class="forecast-empty">No forecast data available.</div></div>`;
  const rows=forecast.rows.map(r=>{
    const weekend=isWeekend(r.date);
    const rowClasses=[weekend?'is-weekend':'',r.isPast?'is-past':'',r.isToday?'is-today':'',r.pickupsBirds>0&&!r.hasPredicted?'pickup-day':'',r.hasPredicted?'predicted-pickup-day':'',r.isFinalDay?'is-final':''].filter(Boolean).join(' ');
    const todayTag=r.isToday?' · <span style="color:var(--secondary);font-weight:700;">Today</span>':'';
    const weekendTag=weekend?' <span class="weekend-pill">Weekend</span>':'';
    return `<tr class="${rowClasses}"><td>${fmtShort(r.date)}${todayTag}${weekendTag}</td><td class="num">${r.age}d</td><td class="num">${r.liveStart.toLocaleString()}</td><td class="num">${fmtFeed(r.dailyFeed)}</td><td>${forecastPickupCell(r.pickups)}</td></tr>`;
  }).join('');
  return `<div class="forecast-block"><h4>📈 Forecast <span class="window-label">${lbl} · ${forecast.rows.length} rows</span></h4><div class="forecast-table-wrap"><table class="forecast-table"><thead><tr><th>Date</th><th class="num">Age</th><th class="num">Live birds</th><th class="num">Daily Feed</th><th>Pickup</th></tr></thead><tbody>${rows}<tr class="total-row"><td colspan="3">Total over range</td><td class="num">${fmtFeed(forecast.totalFeed)}</td><td style="font-size:12px;font-weight:600;color:var(--muted);"></td></tr></tbody></table></div></div>`;
}
// ── Silo level: the three silos drawn at each day's end, one open at a time ──
function siloDrawingHtml(kg,badge){
  const body=Math.max(0,Math.min(1,(kg-CONE_KG)/(RING_KG*MAX_RINGS)))*100;
  const cone=Math.max(0,Math.min(1,kg/CONE_KG))*100;
  let lit=0;
  const rings=[1,2,3,4,5].map(n=>{const on=kg>=CONE_KG+RING_KG*(n-1)+RING_KG/2;if(on)lit++;return `<div class="sl-ring" style="top:${(MAX_RINGS-n)*100/MAX_RINGS}%"><span class="sl-win${on?' on':''}"></span></div>`;}).join('');
  const win=kg<=0.5?'Empty':lit===0?'Below the windows':`${lit} of 5 windows`;
  return {html:`<span class="sl-badge sl-b-${badge.kind}">${badge.text}</span><div class="sl-roof"></div><div class="sl-body"><div class="sl-fill${body>0?' has':''}" style="height:${body.toFixed(1)}%"></div>${rings}</div><div class="sl-cone"><div class="sl-fill" style="height:${cone.toFixed(1)}%"></div></div><div class="sl-legs"></div>`,win};
}
function siloLevelCardHtml(g){
  const plan=siloLevelPlan(g,{until:addDays(new Date(),9)});
  if(!plan)return '';
  const today=dateOnly(new Date());
  // The latest reading always has its own day (exactly as read), then the end of
  // each day from today on. A new reading or open/closed change shows the reading.
  const rows=[{...plan.start,isReading:true,key:'r'+iso(plan.start.date)}];
  plan.days.forEach(r=>{if(dateOnly(r.date)>=today&&!(iso(r.date)===iso(plan.start.date)&&!readingIsMorning(plan.reading)))rows.push({...r,key:iso(r.date)});});
  const readToday=iso(plan.start.date)===iso(today);
  const want=siloLevelSel[g]||(readToday?'r'+iso(today):iso(today));
  let sel=rows.findIndex(r=>r.key===want);
  if(sel<0)sel=rows.findIndex(r=>r.key===iso(today));if(sel<0)sel=0;
  const cur=rows[sel];
  const nextEat=d=>{const n=groupDailyFeedOn(shedsForGroup(g),addDays(d,1));return n>0?n:null;};
  const statusOf=r=>{const ne=nextEat(r.date);if(r.total<=0.5&&ne)return 'empty';if(ne&&r.total<ne*siloSafetyDays())return 'low';return 'ok';};
  const starter=plan.starter;
  const badgeFor=(r,i)=>{
    const n=i+1;const del=(r.del||[]).find(d=>d.silo===n);
    if(r.locked&&r.locked.includes(n))return {kind:'starter',text:'Next batch'};
    if((r.open||[]).includes(n))return {kind:'open',text:'Open'};
    if(del)return {kind:'in',text:`+${fmtFeedCompact(del.kg)} in`};
    if(r.next===n)return {kind:'next',text:'Next'};
    if(starter===n)return {kind:'starter',text:'Starter'};
    return {kind:'closed',text:r.kg[i]>0.5?'Closed':'Empty'};
  };
  const silos=[0,1,2].map(i=>{const k=cur.kg[i];const d=siloDrawingHtml(k,badgeFor(cur,i));
    return `<div class="sl-silo">${d.html}<div class="sl-meta"><span class="sl-name">Silo ${siloNumber(g,i+1)}</span><span class="sl-kg${k<4000&&k>0.5?' low':''}">${fmtFeed(k,0)}</span><span class="sl-win-l">${d.win}</span></div></div>`;}).join('');
  const st=statusOf(cur);
  const lasts=(()=>{const ne=nextEat(cur.date);return ne?cur.total/ne:null;})();
  const chip=cur.isReading?['muted','Your reading']:st==='empty'?['bad','Empty — feed runs out']:st==='low'?['warn','Below safety stock — order']:['ok','OK'];
  const info=[];
  if(cur.isReading){info.push(['Open',(cur.open||[]).length?cur.open.map(n=>'Silo '+siloNumber(g,n)).join(' + ')+(plan.start.marked?'':' (guessed)'):'—']);}
  else{
    info.push(['Open silo',(cur.open||[]).length?cur.open.map(n=>'Silo '+siloNumber(g,n)).join(' + ')+((cur.sw||[]).length?' · switched today':''):'none — all empty']);
    info.push(['Delivered',(cur.del||[]).length?cur.del.map(d=>`+${fmtFeed(d.kg,0)} → Silo ${siloNumber(g,d.silo)}${d.spill?' (overflow)':d.set?'':' (silo not set)'}`).join('<br>'):'—']);
    info.push(['Birds ate',cur.eat>0?'−'+fmtFeed(cur.eat,0):'—']);
    info.push(['Feed lasts',lasts!=null?(lasts>=10?'10+ days':lasts.toFixed(1)+' days'):'—']);
    if(cur.short>0.5)info.push(['Short',fmtFeed(cur.short,0)]);
  }
  const warns=(cur.overflow||[]).map(o=>`<div class="sl-warn">Silo ${siloNumber(g,o.silo)} overflows by ${fmtFeed(o.kg,0)} — the rest goes into another silo. Pick a silo with room on that load.</div>`).join('');
  const strip=rows.map((r,i)=>{const s=statusOf(r);const on=i===sel;
    const tag=r.isReading?'Reading':s==='empty'?'Empty':(r.sw||[]).length?'Open S'+siloNumber(g,r.sw[r.sw.length-1]):(r.del||[]).length?'+'+fmtFeedCompact(r.del.reduce((a,d)=>a+d.kg,0))+' → S'+[...new Set(r.del.map(d=>siloNumber(g,d.silo)))].join('+'):s==='low'?'Low':iso(r.date)===iso(today)?'Today':'';
    const tone=r.isReading?'muted':s!=='ok'?'bad':(r.sw||[]).length?'amber':(r.del||[]).length?'ok':'amber';
    return `<button type="button" class="sl-day${on?' on':''}${s!=='ok'&&!r.isReading?' bad':''}" data-sl-day="${g}|${r.key}" aria-pressed="${on}"><span class="sl-d">${dateOnly(r.date).toLocaleDateString('en-GB',{weekday:'short',day:'2-digit'})}${r.isReading&&plan.reading.at?' · '+fmtClock(plan.reading.at):''}</span><span class="sl-t">${fmtFeedCompact(r.total)}</span><span class="sl-bar"><span style="width:${Math.min(100,Math.round(r.total/(SILO_CAP_KG*3)*100))}%"></span></span><span class="sl-tag sl-tone-${tone}">${tag||'&nbsp;'}</span></button>`;}).join('');
  return `<div class="planner-card sl-card"><h3>Silo level <span class="count">${cur.isReading?`your reading · ${fmtShortNoYear(cur.date)}${plan.reading.at?' '+fmtClock(plan.reading.at):''}`:'end of '+fmtShortNoYear(cur.date)} · tap a day</span></h3>
    <div class="sl-main"><div class="sl-silos">${silos}</div>
      <div class="sl-side"><div class="sl-total">${fmtFeed(cur.total,0)}</div><span class="sl-chip sl-chip-${chip[0]}">${chip[1]}</span>
        <dl class="sl-info">${info.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>${warns}</div></div>
    <div class="sl-strip">${strip}</div>
    ${starterRowHtml(g)}
  </div>`;
}
function starterRowHtml(g){
  const st=starterSiloStatus(g);const n=starterSiloOf(g);
  const chips=[1,2,3].map(i=>`<button type="button" class="sl-st-btn${n===i?' on':''}" data-starter-silo="${g}|${i}" aria-pressed="${n===i}">${siloNumber(g,i)}</button>`).join('');
  let chip='',line='';
  if(st){const co=fmtShortNoYear(st.co);
    if(st.state==='pick'){chip=['warn','Pick one'];line=`Choose the silo that takes next batch's Starter · clean-out ${co}.`;}
    else if(st.state==='ready'){chip=['ok','Ready'];line=`Silo ${siloNumber(g,n)} is empty and kept for Starter.`;}
    else if(st.state==='watch'){chip=['warn','Watch'];line=`Silo ${siloNumber(g,n)} is empty now but gets other feed before clean-out — it must empty again by ${co}.`;}
    else if(st.state==='ontrack'){chip=['ok','On track'];line=`Silo ${siloNumber(g,n)} has ${fmtFeed(st.kg,0)} · empty by about ${fmtShortNoYear(st.emptyOn)} (clean-out ${co}).`;}
    else if(st.state==='action'){chip=[st.late?'bad':'warn',st.late?'Open now':'Plan'];line=`Silo ${siloNumber(g,n)} has ${fmtFeed(st.kg,0)} and won't empty by clean-out (${co}) — ${st.late?'open it now':'open it by '+fmtShortNoYear(st.openBy)}.`;}
    else if(st.state==='noreading'){chip=['muted','No reading'];line='Record a silo reading to check it.';}
    if(st.state!=='pick'&&!st.inWin&&st.win)line+=` Kept for Starter from ${fmtShortNoYear(st.win)}.`;
  }
  const buf=starterBufferDays();
  return `<div class="sl-starter"><span class="sl-st-lbl">Starter silo · next batch</span><span class="sl-st-pick">${chips}</span>${chip?`<span class="sl-chip sl-chip-${chip[0]}">${chip[1]}</span>`:''}<span class="sl-st-line">${line}</span><span class="sl-st-buf">Plan from <button type="button" class="sl-buf${buf===14?' on':''}" data-starter-buf="14">14d</button><button type="button" class="sl-buf${buf===21?' on':''}" data-starter-buf="21">21d</button></span></div>`;
}
function renderSiloInput(group,siloNum,rings){
  const isOff=(rings===null||rings===undefined||rings==='');
  const kg=ringsToKg(rings);
  return `<div class="silo-input ${isOff?'off':''}"><div class="silo-title"><span>Silo ${siloNumber(group,siloNum)}${starterSiloOf(group)===siloNum?' <span class="silo-starter-tag">Starter</span>':''}</span>${isOff?`<span class="off-badge">Off</span>`:`<span class="cap">Max ${fmtFeed(50000,0)}</span>`}</div><div class="ring-picker"><button class="ring-off ${isOff?'active':''}" type="button" data-silo-group="${group}" data-silo-num="${siloNum}" data-silo-ring="off">Off</button>${[0,1,2,3,4,5].map(r=>`<div class="ring-slot ${r===rings?'active':''}"><button class="ring-btn ${r===rings?'active':''}" type="button" data-silo-group="${group}" data-silo-num="${siloNum}" data-silo-ring="${r}" title="${r} ring${r===1?'':'s'} — ${fmtFeed(ringsToKg(r),0)}">${r}</button><span class="ring-t">${fmtFeedCompact(ringsToKg(r))}</span></div>`).join('')}</div><div class="silo-total">${isOff?'<span class="lbl">Not in use</span>':siloOpenSegHtml(group,siloNum)}<span class="val">${isOff?fmtFeed(0):fmtFeed(kg)}</span></div></div>`;
}
function renderReadingHistory(group){
  // Every reading session with its time (newest first); older days recorded
  // before times were kept show the day only. The day's latest session is the
  // one the forecast uses.
  const log=(siloData[group]&&siloData[group].log)||[];const logDays=new Set(log.map(e=>e.date));
  const rows=[...log.map(e=>({kind:'e',key:'e:'+e.id,id:e.id,date:e.date,at:e.at,time:e.time,r:e})),
    ...readingsSorted(group).filter(r=>!logDays.has(r.date)).map(r=>({kind:'d',key:'d:'+r.date,date:r.date,at:r.at||null,time:r.time,r}))]
    .sort((a,b)=>(b.date.localeCompare(a.date))||String(b.at||'').localeCompare(String(a.at||'')));
  if(!rows.length)return `<details class="reading-history"><summary>🕘 Reading history (empty)</summary><div style="font-size:12.5px;color:var(--muted);padding:8px 0;">Each time you tap ring levels, the reading is saved here with the date and time.</div></details>`;
  const perDay={};rows.forEach(x=>{perDay[x.date]=(perDay[x.date]||0)+1;});
  const usedKey={};rows.forEach(x=>{if(!usedKey[x.date])usedKey[x.date]=x.key;});   // newest of each day
  const limit=Math.min(rows.length,40);const list=rows.slice(0,limit);
  const todayIso=iso(new Date());
  const rk='rd:'+group;const on=bulkActive(rk);
  const ring=v=>v===null||v===undefined?'—':v+'r';
  return `<details class="reading-history"${on?' open':''}><summary>🕘 Reading history (${rows.length===limit?rows.length:`last ${limit} of ${rows.length}`})</summary><div class="rh-bulk">${bulkToolbar(rk,list.map(x=>x.key),'readings')}</div><table><thead><tr>${on?'<th class="bulk-cell"></th>':''}<th>Date &amp; time</th><th>Silo ${siloNumber(group,1)}</th><th>Silo ${siloNumber(group,2)}</th><th>Silo ${siloNumber(group,3)}</th><th class="num">Total</th><th style="width:44px;text-align:right;">Actions</th></tr></thead><tbody>${list.map(x=>{
    const r=x.r;const total=readingTotalKg(r);const used=perDay[x.date]>1&&usedKey[x.date]===x.key;const older=perDay[x.date]>1&&!used;
    const del=x.kind==='e'?`data-delete-session="${group}|${escapeAttr(x.id)}"`:`data-delete-reading="${group}|${x.date}"`;
    return `<tr class="${x.date===todayIso?'today':''}${older?' rh-older':''}">${on?`<td class="bulk-cell">${bulkCheckbox(rk,x.key,fmtShort(dateOnly(x.date)))}</td>`:''}<td>${fmtShort(dateOnly(x.date))}${x.at?` <span class="rh-time">${fmtClock(x.at)}</span>`:''} <span class="rt-chip ${x.time==='am'?'am':'pm'}" title="${x.time==='am'?'Morning — start-of-day stock':'Evening — end-of-day stock'}">${x.time==='am'?'AM':'PM'}</span>${used?' <span class="rh-used" title="The latest reading of the day — the one the forecast uses">used</span>':''}</td><td>${ring(r.silo1Rings)}</td><td>${ring(r.silo2Rings)}</td><td>${ring(r.silo3Rings)}</td><td class="num">${fmtFeed(total)}</td><td style="text-align:right;"><button class="reading-delete-btn" type="button" ${del} title="Delete this reading">✕</button></td></tr>`;}).join('')}</tbody></table></details>`;
}
function renderGroupLoadsCard(group){
  const arr=loadsAffectingGroup(group);
  if(arr.length===0)return `<div class="group-loads-empty">No loads routed to these sheds yet — open 🚛 Loads to plan one.</div><div class="group-loads-footnote">These loads are shared across groups. <button type="button" data-open-loads-modal="1">Open 🚛 Loads</button></div>`;
  const rows=arr.map(l=>{
    const share=Number(l.splitKg[group])||0;
    const actualStr=(l.actualKg!=null)?`✓ actual ${fmtFeed(l.actualKg)}`:'';
    return `<div class="group-load-row"><span class="glr-date">${fmtShort(l.date)}</span><span class="glr-type">${feedTypeTagHtml(l.feedType)}</span><span class="glr-actual">${actualStr}</span><span class="glr-share">${fmtFeed(share)}</span><button type="button" class="glr-edit" data-load-edit="${escapeAttr(l.id)}" title="Edit this load">✎</button></div>`;
  }).join('');
  return `<div class="group-loads-list">${rows}</div><div class="group-loads-footnote">These loads are shared across groups. <button type="button" data-open-loads-modal="1">Open 🚛 Loads</button> to add or edit.</div>`;
}
function renderFeedSummary(group){
  const summary=groupLoadSummary(group);
  const co=carryoverKg(group);
  const activeRows=['starter','grower','finisher','withdrawal','unspecified'].map(k=>summary.buckets[k]).filter(b=>b.tonnes>0);
  if(activeRows.length===0&&!co)return `<div class="feed-summary"><div class="feed-summary-title">📊 Feed Summary <span class="sub">· per feed type · 1 block = 60 T · 30 T = 0.5</span></div><div class="feed-summary-empty">No loads scheduled yet — add one via 🚛 Loads to see the block count.</div></div>`;
  const rows=activeRows.map(b=>`<tr class="${b.blocks>=0.5?'has-blocks':''}"><td>${feedTypeTagHtml(b.id)}</td><td class="num">${fmtFeed(b.tonnes*1000)}</td><td class="num">${b.loads}</td><td class="num">${b.blocks>0?`<span class="block-count">${fmtBlocks(b.blocks)}</span>`:`<span class="block-count zero">0</span>`}</td></tr>`).join('');
  // Carry-over: counted in the total, never in the feed-type / block counts
  const coRow=co?`<tr class="carry-row"><td><span class="carry-tag">↩ Carry-over</span> <span class="carry-sub">last batch</span></td><td class="num">${fmtFeed(co)}</td><td class="num">—</td><td class="num">—</td></tr>`:'';
  return `<div class="feed-summary"><div class="feed-summary-title">📊 Feed Summary (these sheds' share) <span class="sub">· 1 block = 60 T · 30 T = 0.5</span></div><table class="feed-summary-table"><thead><tr><th>Type</th><th class="num">Total</th><th class="num">Loads</th><th class="num">60 T blocks</th></tr></thead><tbody>${rows}${coRow}<tr style="background:var(--surface-soft);font-weight:800;font-family:'Sora',sans-serif;"><td>Total${co?' incl. carry-over':''}</td><td class="num">${fmtFeed(summary.totalTonnes*1000+co)}</td><td class="num">${activeRows.reduce((s,b)=>s+b.loads,0)}</td><td class="num">${fmtBlocks(summary.totalBlocks)}</td></tr></tbody></table><div style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.5;">Each 60 T of the same feed type counts as <strong>1 block</strong>. Half blocks count as <strong>0.5</strong> (30 T = 0.5).${co?' Carry-over from last batch is included in the total but not in feed-type blocks.':''}</div></div>`;
}
function renderFeedPlanner(group,sheds,today){
  const forecast=computeSiloForecast(group,siloRange);
  const latest=latestReading(group);
  const latestDate=latest?dateOnly(latest.date):null;
  const daysSinceReading=latestDate?Math.max(0,daysBetween(latestDate,today)):null;
  const projected=currentBalanceKg(group);
  const consumedSince=consumptionSinceLatestReading(group);
  const deliveredSince=deliveriesSinceLatestReading(group);
  const hasReading=!!latest;
  const depletedWithinWindow=!!forecast.depletedDate;
  const daysUntilDepletion=forecast.depletedDate?Math.max(0,daysBetween(today,forecast.depletedDate)):null;
  let statusTone='green';let statusText='Sufficient';let statusSub=`Feed lasts past ${siloRange.end} days`;
  if(!hasReading){statusTone='amber';statusText='No reading';statusSub='Tap ring levels below';}
  else if(depletedWithinWindow){
    if(daysUntilDepletion<=2){statusTone='red';statusText='Critical';statusSub='Order now!';}
    else if(daysUntilDepletion<=7){statusTone='amber';statusText='Low';statusSub='Order soon';}
    else{statusTone='green';statusText='Planning needed';statusSub=`Runs out in ${daysUntilDepletion} days`;}
  }
  const readingAgeBadge=hasReading?(daysSinceReading===0?'Updated today':`${daysSinceReading} day${daysSinceReading===1?'':'s'} ago`):'No reading yet';
  const deliveriesOpen=predState.deliveriesOpen!==false;
  const hasTests=(testDeliveries[group]||[]).length>0;
  const testCount=(testDeliveries[group]||[]).length;
  const leftover=projectedLeftoverForGroup(group);
  const leftoverOk=leftover&&leftover.balance!==null;
  const leftoverStr=leftoverOk?(leftover.balance>=0?`${fmtFeed(leftover.balance,1)} left at clean-out`:`short ${fmtFeed(leftover.short,1)} to clean-out`):'—';
  const tpCount=testPickupCountForGroup(group);
  const headerActionsHtml=`<span style="margin-left:auto; display:inline-flex; gap:6px; align-items:center; flex-wrap:wrap;">${tpCount?`<button class="btn-clear-tests" data-tp-clear="${group}" type="button" title="Remove all test pickups for these sheds">🧹 Clear test pickup${tpCount===1?'':'s'} (${tpCount})</button>`:''}${hasTests?`<button class="btn-clear-tests" data-clear-tests="${group}" type="button" title="Remove all test deliveries for this group">🧹 Clear test deliver${testCount===1?'y':'ies'} (${testCount})</button>`:''}<span class="forecast-leftover-chip${leftoverOk?(leftover.balance<0?' short':''):' muted'}" title="${leftoverOk?`With expected pickups: ${leftover.balance>=0?fmtFeed(leftover.balance,1)+' left at clean-out':'short '+fmtFeed(leftover.short,1)} · if no more pickups: short ${fmtFeed(leftover.safeShort,1)}`:'No clean-out date'}">🧺 ${leftoverStr}</span></span>`;
  return `<div class="planner-wrap">
    ${siloSettingsBarHtml()}
    <div class="planner-summary">
      <div class="summary-card"><div class="sc-label">Projected Stock Today</div><div class="sc-value amber">${hasReading?fmtFeed(projected):'—'}</div><div class="sc-sub">${hasReading?`Expected at end of today${siloConfidence()<1?` · planning with ${Math.round(siloConfidence()*100)}% of your reading`:''}`:'Tap ring levels below to record stock'}</div></div>
      <div class="summary-card"><div class="sc-label">${depletedWithinWindow?(siloSafetyDays()>0?'Below Safety Stock':'Depletes On'):'Feed Lasts'}</div><div class="sc-value ${statusTone}">${depletedWithinWindow?fmtShort(forecast.depletedDate):(hasReading?`> ${siloRange.end} days`:'—')}</div><div class="sc-sub">${depletedWithinWindow?`${daysUntilDepletion} day${daysUntilDepletion===1?'':'s'} from now${siloSafetyDays()>0?` · keeps ${siloSafetyDays()} day${siloSafetyDays()===1?'':'s'} of feed`:''}`:(hasReading?`Balance at end: ${fmtFeed(forecast.endBalance)}`:'')}</div></div>
      <div class="summary-card"><div class="sc-label">Status</div><div class="sc-value ${statusTone}">${statusText}</div><div class="sc-sub">${statusSub}</div></div>
      <div class="summary-card"><div class="sc-label">${forecast.shortfall>0?'Shortfall':'Coverage'}</div><div class="sc-value ${forecast.shortfall>0?'red':'green'}">${forecast.shortfall>0?fmtFeed(forecast.shortfall):'✅ Covered'}</div><div class="sc-sub">${forecast.shortfall>0?'Consumption exceeds supply over range':`Range consumption: ${fmtFeed(forecast.totalConsumption)}`}</div></div>
    </div>
    ${hasReading?`<div class="reading-info"><div class="ri-item"><span class="ri-label">Last reading:</span><span class="ri-value">${fmtShort(latestDate)}${latest&&latest.at?` ${fmtClock(latest.at)}`:''} · ${readingAgeBadge}</span></div><div class="ri-item"><span class="ri-label">Consumed since:</span><span class="ri-value red">−${fmtFeed(consumedSince)}</span></div>${deliveredSince>0?`<div class="ri-item"><span class="ri-label">Delivered since:</span><span class="ri-value">+${fmtFeed(deliveredSince)}</span></div>`:''}<div class="ri-item"><span class="ri-label">Projected today:</span><span class="ri-value amber">${fmtFeed(projected)}</span></div></div>`:''}
    <div class="planner-card"><h3>📦 Current Silo Stock <span class="count">Tap a ring to record today's reading. Tap the same ring again to turn silo off.</span>${readTimeToggleHtml()}</h3><div class="silo-inputs">${[1,2,3].map(n=>renderSiloInput(group,n,latest?latest[`silo${n}Rings`]:null)).join('')}</div><div class="silo-grand-total"><span class="lbl">Reading Total</span><span class="val">${hasReading?fmtFeed(readingTotalKg(latest)):'—'}<span style="font-size:13px;color:var(--muted);font-weight:600;">${hasReading?`(on ${fmtShortNoYear(latestDate)})`:''}</span></span></div>${renderReadingHistory(group)}</div>
    ${siloLevelCardHtml(group)}
    <div class="planner-card"><button type="button" class="planner-card-toggle ${deliveriesOpen?'open':''}" data-toggle-deliveries="${group}" aria-expanded="${deliveriesOpen?'true':'false'}"><h3>🚛 Loads affecting ${pairLabel(group)} ${renderDeliveriesSummary(group)}</h3><span class="collapse-caret">▾</span></button><div class="planner-card-body ${deliveriesOpen?'':'collapsed'}">${renderGroupLoadsCard(group)}${renderFeedSummary(group)}</div></div>
    ${rangeBarHtml(siloRange,'silo')}
    <div class="planner-card" id="feedForecast-${group}"><h3>📈 Feed Balance Forecast <span class="count">${rangeLabel(siloRange)} · weekends shaded</span>${headerActionsHtml}</h3>${renderSiloForecastTable(forecast,group)}<div style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5;">💡 Click any future weekday row to plan a load — <strong>🚜 Test</strong> (hypothetical, session only) or <strong>✅ Order</strong> (creates an official order). Rows with a load already scheduled show a small <strong>✎</strong> button to edit it. Rows with a silo reading show a <strong>📖 Reading</strong> badge — click it to delete that reading.</div></div>
  </div>`;
}
// The forecast table can be wider than its (scrolling) wrapper — e.g. the
// Compare Feed grid. Pin the test-pickup form to the wrapper's VISIBLE
// width so its buttons and note wrap in view instead of running off-screen.
function sizeTestPickupForms(){
  document.querySelectorAll('.forecast-table-wrap').forEach(wrap=>{
    const form=wrap.querySelector('.tp-form');if(!form)return;
    form.style.width=wrap.clientWidth+'px';
  });
}
window.addEventListener('resize',()=>{if(inlinePickupState)sizeTestPickupForms();});
// Inline "test pickup" form under a forecast row
function renderTestPickupForm(group,date){
  const st=inlinePickupState;const sheds=shedsForGroup(group);
  const sug=suggestTestPickup(st.shedId,st.dateIso);
  const d=dateOnly(date);const dayName=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
  const blocked=(predState.noPickupDays||[]).includes(d.getDay());
  const warn=blocked?`⚠ ${dayName} is one of your no-pickup days`:(isWeekend(d)?`⚠ ${dayName} is a weekend`:'');
  const canMove=!!sug.recMove;
  const fmtN=n=>Number(n||0).toLocaleString();
  const moveN=sug.recMove?sug.recMove.recommendedRemove:0;const addN=sug.recAdd?sug.recAdd.recommendedRemove:0;
  // Field shows the primary action's recommendation until the user types
  const shown=st.userEdited?st.birdsDraft:(canMove?moveN:addN);
  const rec=sug.recAdd;
  const densityLine=rec?`Density ${rec.densityBefore.toFixed(1)} kg/m² that day → recommendation brings it to ${rec.targetDensity} kg/m² (same as Predictions)`:'';
  const plannedLine=sug.planned?(canMove?`nearest planned pickup: ${fmtShortNoYear(dateOnly(sug.planned.date))}, ${fmtN(sug.planned.birds)} birds`:`a planned pickup of ${fmtN(sug.planned.birds)} is already on this day`):'no planned pickups left for this shed';
  const shedBtns=sheds.map(s=>`<button type="button" class="tp-shed${s.id===st.shedId?' active':''}" data-tp-shed="${s.id}" aria-pressed="${s.id===st.shedId}">Shed ${s.id}</button>`).join('');
  const num=n=>st.userEdited?'':` <span class="tp-btn-n">${fmtN(n)}</span>`;
  return `<div class="tp-form" role="group" aria-label="Test pickup">
    <span class="tp-title">🐔 Test pickup · ${fmtShortNoYear(d)}</span>
    <div class="tp-sheds">${shedBtns}</div>
    <label class="tp-field"><input type="number" class="tp-input" min="1" step="50" value="${shown===''||shown==null?'':shown}" placeholder="birds" aria-label="Birds to pick up" /><span>birds</span></label>
    <div class="tp-actions">
      ${canMove?`<button type="button" class="tp-btn primary" data-tp-add="move" title="Simulate the planned pickup happening on this day instead">↪ Move planned pickup here${num(moveN)}</button>`:''}
      <button type="button" class="tp-btn${canMove?'':' primary'}" data-tp-add="add" title="An extra pickup on top of the plan">+ Add extra pickup${num(addN)}</button>
      <button type="button" class="tp-btn ghost" data-tp-cancel="1" aria-label="Cancel">✕</button>
    </div>
    <div class="tp-hint">${densityLine}${densityLine?' · ':''}${plannedLine} · ${fmtN(sug.live)} birds in Shed ${st.shedId} · session only${warn?` · <strong class="tp-warn">${warn}</strong>`:''}</div>
  </div>`;
}
function renderSiloForecastTable(forecast,group,opts){
  opts=opts||{};
  const inModal=!!opts.inModal;
  const cols=opts.columns||{date:true,age:true,liveBirds:true,dailyFeed:true,delivery:true,endBalance:true};
  const c={date:true,age:!!cols.age,liveBirds:!!cols.liveBirds,dailyFeed:!!cols.dailyFeed,delivery:!!cols.delivery,endBalance:!!cols.endBalance};
  if(forecast.rows.length===0)return `<div class="forecast-empty">No forecast available.</div>`;
  let minW=40;
  if(c.date)minW+=160;if(c.age)minW+=70;if(c.liveBirds)minW+=140;if(c.dailyFeed)minW+=115;if(c.delivery)minW+=180;if(c.endBalance)minW+=130;
  const headerCells=[];
  if(c.date)headerCells.push('<th>Date</th>');
  if(c.age)headerCells.push('<th class="num">Age</th>');
  if(c.liveBirds)headerCells.push('<th class="num">Live birds</th>');
  if(c.dailyFeed)headerCells.push('<th class="num">Daily Feed</th>');
  if(c.delivery)headerCells.push('<th>Delivery</th>');
  if(c.endBalance)headerCells.push('<th class="num">End Balance</th>');
  const rows=forecast.rows.map(r=>{
    const baseClickable=!r.isPast&&!r.isWeekend&&c.delivery;
    const hasRealDelivery=(r.deliveries||[]).some(d=>!d.isTest);
    const isBlocked=baseClickable&&hasRealDelivery;
    const isClickable=baseClickable;
    const isInlineOpen=!!(inlineDeliveryState)&&inlineDeliveryState.group===group&&inlineDeliveryState.dateIso===iso(r.date)&&isClickable&&c.delivery&&(inModal===!!feedCompareState.modalOpen);
    const rowClasses=[r.isWeekend?'is-weekend':'',r.isPast?'is-past':'',r.isToday?'is-today':'',r.delivery>0?'pickup-day':'',isClickable?'fdr-clickable':'',isInlineOpen?'fdr-open':''].filter(Boolean).join(' ');
    const clickAttrs=baseClickable?` data-forecast-date="${iso(r.date)}" data-forecast-group="${group}"${isBlocked?' data-has-load="1"':''}`:'';
    let deliveryCell='—';
    if(r.delivery>0){
      const realDels=r.deliveries.filter(d=>!d.isTest);
      const testDels=r.deliveries.filter(d=>d.isTest);
      const chunks=[];
      realDels.forEach(rd=>{const kg=Number(rd.amountKg)||0;const typeTag=rd.feedType?feedTypeTagHtml(rd.feedType):'';chunks.push(`<span class="delivery-pill">+${fmtFeed(kg,1)}</span>${typeTag}<button class="delivery-edit-btn" type="button" data-load-edit="${escapeAttr(rd.loadId||rd.id)}" title="Edit this load">✎</button>`);});
      testDels.forEach(td=>{const kg=Number(td.amountKg)||0;chunks.push(`<span class="delivery-pill test">🚜 +${fmtFeed(kg,1)}</span><button class="test-x" type="button" data-remove-test="${group}|${td.id}" title="Remove this test delivery">✕</button>`);});
      deliveryCell=chunks.join(' ');
    }
    if(isInlineOpen){deliveryCell+=`<div class="inline-del"><input type="number" class="inline-del-input" placeholder="${feedUnitWord()}" min="0" step="${feedStep(true)}" value="" /><button type="button" class="inline-del-btn test" data-inline-test="${group}|${iso(r.date)}" title="Add as test delivery (session only)">🚜 Test</button><button type="button" class="inline-del-btn actual" data-inline-actual="${group}|${iso(r.date)}" title="Record this load as ordered">✅ Order</button><button type="button" class="inline-del-btn cancel" data-inline-cancel="1" title="Cancel">✕</button></div>`;}
    let dateCls='';
    if(r.isToday)dateCls='fb-date-today';else if(r.isWeekend)dateCls='fb-date-weekend';
    const reading=readingOnDate(group,iso(r.date));
    let readingBadge='';
    if(reading){const s1=reading.silo1Rings===null||reading.silo1Rings===undefined?'off':reading.silo1Rings+'r';const s2=reading.silo2Rings===null||reading.silo2Rings===undefined?'off':reading.silo2Rings+'r';const s3=reading.silo3Rings===null||reading.silo3Rings===undefined?'off':reading.silo3Rings+'r';const totalT=fmtFeed(readingTotalKg(reading));const tip=`${reading.time==='am'?'Morning':'Evening'} reading · Silo 1: ${s1} · Silo 2: ${s2} · Silo 3: ${s3} · Total ${totalT} — click to delete this reading`;readingBadge=`<button type="button" class="reading-badge" data-delete-reading="${group}|${reading.date}" title="${escapeAttr(tip)}">📖</button>`;}
    const ages=shedAgesAtDateForGroup(group,r.date);const agesStr=formatAgesPair(ages);
    const liveBirds=r.liveBirds||0;
    let pickupIndicator='';
    if(r.pickupsBirds>0){const pickCls=r.hasPredicted?'fb-pickup-predicted':'fb-pickup-actual';pickupIndicator=` <span class="${pickCls}">−${r.pickupsBirds.toLocaleString()}</span>`;}
    let balanceCls='';let balanceText='—';
    if(r.balance!==null){balanceText=fmtFeed(r.balance);if(r.isPast)balanceCls='fb-balance-past';else if(r.balance<=0)balanceCls='fb-balance-empty';else if(r.safety>0&&r.balance<r.safety*1.5)balanceCls='fb-balance-low';else balanceCls='fb-balance-ok';}
    const cells=[];
    if(c.date)cells.push(`<td class="${dateCls}">${fmtShort(r.date)}${readingBadge}</td>`);
    if(c.age)cells.push(`<td class="num">${agesStr}</td>`);
    if(c.liveBirds){
      // Test pickups (session what-if) and planned pickups a test moved away
      const tpChips=(r.testPickups||[]).map(t=>`<span class="tp-chip" title="Test pickup — session only">🐔 −${t.birds.toLocaleString()} <small>S${t.shedId}${t.movedFrom?' · moved':''}</small><button type="button" class="tp-commit" data-tp-commit="${t.shedId}|${t.id}" title="Save as a planned pickup (updates Predictions and syncs)">✓ Make planned</button><button type="button" class="test-x" data-tp-remove="${t.shedId}|${t.id}" title="Remove this test pickup">✕</button></span>`).join('');
      const movedChips=(r.movedAway||[]).map(m=>`<span class="tp-moved" title="Planned pickup moved by a test">↪ S${m.shedId} −${m.birds.toLocaleString()} → ${fmtShortNoYear(dateOnly(m.to))}</span>`).join('');
      const tpClickable=!r.isPast;
      cells.push(`<td class="num${tpClickable?' tp-cell':''}"${tpClickable?` data-tp-cell="${group}|${iso(r.date)}" title="Click to add a test pickup"`:''}>${liveBirds.toLocaleString()}${pickupIndicator}${tpChips||movedChips?`<div class="tp-chips">${tpChips}${movedChips}</div>`:''}</td>`);
    }
    if(c.dailyFeed)cells.push(`<td class="num">${fmtFeed(r.consumption)}</td>`);
    if(c.delivery)cells.push(`<td>${deliveryCell}</td>`);
    if(c.endBalance)cells.push(`<td class="num ${balanceCls}">${balanceText}</td>`);
    const tpOpen=!!inlinePickupState&&inlinePickupState.group===group&&inlinePickupState.dateIso===iso(r.date)&&c.liveBirds&&(inModal===!!feedCompareState.modalOpen);
    return `<tr class="${rowClasses}${tpOpen?' tp-open':''}"${clickAttrs}>${cells.join('')}</tr>${tpOpen?`<tr class="tp-form-row"><td colspan="${cells.length}">${renderTestPickupForm(group,r.date)}</td></tr>`:''}`;
  }).join('');
  const leadingCols=(c.date?1:0)+(c.age?1:0)+(c.liveBirds?1:0);
  const totalsCells=[];
  totalsCells.push(`<td colspan="${Math.max(1,leadingCols)}">Totals</td>`);
  if(c.dailyFeed)totalsCells.push(`<td class="num">${fmtFeed(forecast.totalConsumption)}</td>`);
  if(c.delivery)totalsCells.push(`<td>${forecast.totalDelivered>0?'+'+fmtFeed(forecast.totalDelivered):'—'}</td>`);
  if(c.endBalance){let totalBalanceCls='';let totalBalanceText='—';if(forecast.endBalance!==null){totalBalanceText=fmtFeed(forecast.endBalance);if(forecast.endBalance<=0)totalBalanceCls='fb-balance-empty';else if(forecast.endBalance<5000)totalBalanceCls='fb-balance-low';else totalBalanceCls='fb-balance-ok';}totalsCells.push(`<td class="num ${totalBalanceCls}">${totalBalanceText}</td>`);}
  return `<div class="forecast-table-wrap"><table class="forecast-table" style="min-width:${minW}px;"><thead><tr>${headerCells.join('')}</tr></thead><tbody>${rows}<tr class="total-row">${totalsCells.join('')}</tr></tbody></table></div>`;
}

/* ---------- Prediction engine ---------- */
// Projections always include the background auto plan (see autoPlanForShed)
function computePredictions(shed,group){return withResultPlan(()=>computePredictionsInner(shed,group));}
function computePredictionsInner(shed,group){
  const today=dateOnly(new Date());
  const initialPop=Number(shed.initialPopulation)||0;
  const currentMort=Number(shed.mortality)||0;
  const currentAge=ageInDays(shed,today);
  const liveNow=liveAtStartOfDay(shed,today);
  const pickups=computeEffectivePickups(shed);
  const finalAge=shed.cleanoutDate?Math.max(currentAge,ageInDays(shed,shed.cleanoutDate)):currentAge+30;
  const targetALW=Number(predState.targetHarvestWeightKg[group])||2.65;
  const beta=CFCR_BAIADA_BETA;
  let perfSum=0,perfCount=0;
  for(const p of pickups){if(p.weightEstimated)continue;const avg=pickupAvgKg(p);if(avg&&avg>0){const pAge=pickupAge(shed,p);const curveW=rossWeightKg(pAge);if(curveW>0){perfSum+=(avg/curveW);perfCount++;}}}
  const perfFactor=perfCount>0?(perfSum/perfCount):1.0;
  const curveFinal=rossWeightKg(finalAge);
  const perfAdjustedFinal=curveFinal*perfFactor;
  const fit=getShedGompertzFit(shed);
  let estFinalALW;
  if(fit){const gompFinal=gompertzWeightAt(fit,finalAge);const progressT=Math.min(1,currentAge/Math.max(1,finalAge));if(gompFinal!=null)estFinalALW=gompFinal*(1-progressT*0.3)+targetALW*(progressT*0.3);else estFinalALW=(perfCount>0)?(perfAdjustedFinal*(1-progressT*0.5)+targetALW*(progressT*0.5)):targetALW;}
  else{const progressT=Math.min(1,currentAge/Math.max(1,finalAge));estFinalALW=(perfCount>0)?(perfAdjustedFinal*(1-progressT*0.5)+targetALW*(progressT*0.5)):targetALW;}
  const mortEstimate=estimateShedFinalMortality(shed,finalAge,currentAge);
  let estFinalMort=mortEstimate.estFinalMort;let estFinalLive=mortEstimate.estFinalLive;let estLivability=mortEstimate.estLivability;
  let totalWeightKg=0;const pickupDetails=[];let cumBirds=0,ageBirdSum=0;
  for(const p of pickups){
    const pAge=pickupAge(shed,p);const curveAtAge=rossWeightKg(pAge);const avgFromExcel=pickupAvgKg(p);
    const fwP=forecastWeightModeAware(shed,p.date);
    let avgUsed=(avgFromExcel&&avgFromExcel>0)?avgFromExcel:((fwP&&fwP.kg)?fwP.kg:(curveAtAge*perfFactor));
    // Final pickup not weighed yet: final birds run heavier than the thin-weighted curve
    if(p.isFinal&&!(avgFromExcel>0))avgUsed*=finalUpliftFactor();
    const pickupWeightKg=Number(p.birds||0)*avgUsed;
    totalWeightKg+=pickupWeightKg;cumBirds+=Number(p.birds||0);ageBirdSum+=pAge*Number(p.birds||0);
    pickupDetails.push({date:p.date,age:pAge,birds:Number(p.birds||0),avgWeightKg:avgUsed,totalWeightKg:Number(p.birds||0)*avgUsed,isFinal:!!p.isFinal,isPredicted:p.__source==='predicted'||p.__source==='auto',isAuto:p.__source==='auto',cumBirds,isEstWeight:!(avgFromExcel&&avgFromExcel>0)});
  }
  const finalLiveBirds=Math.max(0,estFinalLive-cumBirds);
  totalWeightKg+=finalLiveBirds*estFinalALW*finalUpliftFactor();ageBirdSum+=finalAge*finalLiveBirds;
  // Every bird that leaves is counted; the rest died (livability = 100 − mortality %)
  const birdsAll=cumBirds+finalLiveBirds;
  if(initialPop>0){estFinalLive=birdsAll;estFinalMort=Math.max(0,initialPop-birdsAll);estLivability=birdsAll/initialPop*100;}
  let totalFeedKg=0;
  if(shed.placementDate&&shed.cleanoutDate){let d=dateOnly(shed.placementDate);const end=dateOnly(shed.cleanoutDate);while(d<=end){totalFeedKg+=shedFeedOn(shed,d);d=addDays(d,1);}}
  // No clean-out date yet: project feed to the same horizon the weight uses
  // (final age), not just to today — otherwise today's feed gets divided
  // by the projected harvest weight. Feed stops by itself once pickups
  // have taken every bird (liveAtStartOfDay → 0).
  else if(shed.placementDate){
    // Horizon: the age birds reach the estimated harvest weight (never
    // before the last planned pickup, never past finalAge).
    const wAt=a=>{const g=fit?gompertzWeightAt(fit,a):null;return g!=null?g:rossWeightKg(a)*perfFactor;};
    let horizon=currentAge;while(horizon<finalAge&&wAt(horizon)<estFinalALW)horizon++;
    const lastPickupAge=pickups.length?pickupAge(shed,pickups[pickups.length-1]):0;
    horizon=Math.min(finalAge,Math.max(horizon,lastPickupAge));
    let d=dateOnly(shed.placementDate);const end=addDays(dateOnly(shed.placementDate),horizon);while(d<=end){totalFeedKg+=shedFeedOn(shed,d);d=addDays(d,1);}
  }
  const k=batchKpis({feedKg:totalFeedKg,liveWeightKg:totalWeightKg,birds:birdsAll,ageBirdSum,placed:initialPop,mortality:estFinalMort,targetKg:targetALW});
  const {fcr,cfcr,cfcrInd,pif,alw,avgAge}=k;
  const remainingWeightKg=liveNow*rossWeightKg(currentAge)*perfFactor;
  const confidence=computeConfidence(shed,finalAge);
  return {initialPop,currentMort,currentAge,liveNow,pickupsCompleted:pickups.length,remainingBirds:liveNow,remainingWeightKg,finalAge,estFinalALW,estFinalMort,estFinalLive,estLivability,totalWeightKg,totalFeedKg,fcr,cfcr,cfcrInd,pif,alw,avgAge,birdsAll,ageBirdSum,targetALW,beta,perfFactor,confidence,pickupDetails,hasWeightData:perfCount>0,gompertzFit:fit};
}
function computeGroupPredictions(group){
  const sheds=shedsForGroup(group);
  let totalLiveWeight=0,totalFeedKg=0,totalPlaced=0,totalMortalityEst=0,totalBirdsAtHarvest=0,weightedAgeSum=0,shedsWithData=0,confidenceSum=0;
  for(const shed of sheds){
    if(!shed.placementDate)continue;
    const pred=computePredictions(shed,group);
    totalLiveWeight+=pred.totalWeightKg;totalFeedKg+=pred.totalFeedKg;totalPlaced+=pred.initialPop;totalMortalityEst+=pred.estFinalMort;
    totalBirdsAtHarvest+=pred.birdsAll;weightedAgeSum+=pred.ageBirdSum;confidenceSum+=pred.confidence;shedsWithData++;
  }
  if(shedsWithData===0)return {hasData:false,shedsWithData:0,shedIds:sheds.map(s=>s.id),totalLiveWeight:0,totalFeedKg:0,totalPlaced:0,totalMortalityEst:0,totalBirdsAtHarvest:0,avgWeight:0,weightedAge:0,livability:0,fcr:0,cfcr:0,cfcrInd:0,pif:0,confidence:0};
  const k=batchKpis({feedKg:totalFeedKg,liveWeightKg:totalLiveWeight,birds:totalBirdsAtHarvest,ageBirdSum:weightedAgeSum,placed:totalPlaced,mortality:totalMortalityEst,targetKg:pairTargetKg(group)});
  const confidence=Math.round(confidenceSum/shedsWithData);
  return {hasData:true,shedsWithData,shedIds:sheds.map(s=>s.id),totalLiveWeight,totalFeedKg,totalPlaced,totalMortalityEst,totalBirdsAtHarvest,avgWeight:k.alw,weightedAge:k.avgAge,livability:k.livability,fcr:k.fcr,cfcr:k.cfcr,cfcrInd:k.cfcrInd,pif:k.pif,target:k.target,cage:cAge245ForSheds(sheds.filter(s=>s.placementDate)),confidence};
}
function computeConfidence(shed,finalAge){
  const age=ageInDays(shed,new Date());
  const pickups=shed.pickups||[];const samples=shed.inYardSamples||[];
  const gridPoints=TARGET_DAYS.filter(d=>Number(shed.targetCurve&&shed.targetCurve[d])>0).length;
  const hasWeight=pickups.some(p=>!p.weightEstimated&&pickupAvgKg(p)!=null);
  const hasSamples=samples.length>0||gridPoints>0;
  const hasFinal=pickups.some(p=>p.isFinal);
  const hasFit=!!getShedGompertzFit(shed);
  if(hasFinal)return 100;
  let c=25;
  c+=pickups.length*8;c+=gridPoints*4;c+=samples.length*3;
  c+=hasWeight?8:0;c+=hasSamples?5:0;c+=hasFit?8:0;
  c+=Math.floor((age/Math.max(1,finalAge))*10);
  return Math.min(95,c);
}
function confidenceLabel(pct){if(pct>=80)return {label:'High',cls:'high'};if(pct>=50)return {label:'Medium',cls:'medium'};return {label:'Low',cls:'low'};}
function computeFarmTotals(){
  const sheds=(farmData&&farmData.sheds)?farmData.sheds:[];
  let totalLiveWeight=0,totalFeedAuto=0,totalPlaced=0,totalMortalityEst=0,totalBirdsAtHarvest=0,weightedAgeSum=0,shedsWithData=0,totalCurrentMort=0,targetBirdSum=0;
  for(const shed of sheds){
    if(!shed.placementDate)continue;
    const g=Math.floor((shed.id-1)/2)+1;
    const pred=computePredictions(shed,g);
    totalLiveWeight+=pred.totalWeightKg;totalFeedAuto+=pred.totalFeedKg;totalPlaced+=pred.initialPop;totalMortalityEst+=pred.estFinalMort;totalCurrentMort+=Math.max(0,Number(shed.mortality)||0);
    totalBirdsAtHarvest+=pred.birdsAll;weightedAgeSum+=pred.ageBirdSum;targetBirdSum+=pred.targetALW*pred.birdsAll;shedsWithData++;
  }
  // The result uses the Ross intake standard for the whole batch: backtested on 2606/2607,
  // and those batches finished 2–3% under it. Feed measured from silo readings (dockets +
  // carry-over − stock, 8 t rings) is only shown as a check: on 2701 it read 7% over the
  // standard and pushed cFCR to 1.72, out of line with the farm (2026-10-08).
  let feedMeasured=null;
  try{const m=measuredFeedToDate();
    if(m){let modelPast=0;
      withResultPlan(()=>Object.keys(m.cut).forEach(g=>{const end=m.cut[g];shedsForGroup(Number(g)).filter(s=>s.placementDate).forEach(s=>{for(let d=dateOnly(s.placementDate);d<=end;d=addDays(d,1))modelPast+=shedFeedOn(s,d);});}));
      feedMeasured={eaten:m.eaten,modelPast,asOf:m.asOf,fitted:m.fitted,points:m.points};}
  }catch(e){console.warn('Measured feed-to-date failed',e);feedMeasured=null;}
  const autoLeftover=totalFarmLeftover();
  const leftoverKg=(predState.farmLeftoverKg!=null&&Number.isFinite(Number(predState.farmLeftoverKg))&&Number(predState.farmLeftoverKg)>0)?Number(predState.farmLeftoverKg):0;
  const leftoverApplied=leftoverKg>0;
  if(shedsWithData===0)return {hasData:false,shedsWithData:0,totalLiveWeight:0,totalFeedAuto:0,totalFeed:0,fcr:0,cfcr:0,cfcrInd:0,pif:0,avgWeight:0,livability:0,weightedAge:0,placed:0,mortality:0,birdsAtHarvest:0,usingManualFeed:false,autoLeftover:null,leftoverApplied:false,leftoverKg:0,totalCurrentMortality:0,currentMortRate:0,estMortRate:0};
  const usingManualFeed=predState.farmFeedOverride!=null&&predState.farmFeedOverride>0;
  // Docket-based total (manual override) + feed carried in from last batch
  // − feed left at clean-out. The auto estimate is bird intake, which
  // already includes eating the carry-over, so it isn't added there.
  const carryKg=carryoverTotalKg();
  const carryInDocket=usingManualFeed&&docketIncludesCarry(predState.farmFeedOverride,feedOrderedKg(),carryKg);
  // A finished batch (every shed has had its final pickup or is past its clean-out) whose loads all
  // have their docket weight uses the real feed: deliveries + carry-over − leftover. No docket total to type.
  const todayD=dateOnly(new Date()),placedSheds=sheds.filter(s=>s.placementDate);
  const shedDone=s=>(s.cleanoutDate&&dateOnly(s.cleanoutDate)<todayD)||(s.pickups||[]).some(p=>p.isFinal&&p.date&&dateOnly(p.date)<=todayD);
  const batchDone=placedSheds.length>0&&placedSheds.every(shedDone);
  const fromDockets=!usingManualFeed&&batchDone&&farmLoads.length>0&&farmLoads.every(l=>l.actualKg!=null);
  const baseFeed=usingManualFeed?Number(predState.farmFeedOverride)+(carryInDocket?0:carryKg):fromDockets?feedOrderedKg()+carryKg:totalFeedAuto;
  // Leftover only comes off the docket-based total (delivered + carry-over − leftover).
  // The auto estimate is feed the birds eat, so the leftover was never in it.
  const totalFeed=Math.max(0,usingManualFeed||fromDockets?baseFeed-leftoverKg:baseFeed);
  const targetKg=totalBirdsAtHarvest>0?targetBirdSum/totalBirdsAtHarvest:CFCR_REF_KG;
  const k=batchKpis({feedKg:totalFeed,liveWeightKg:totalLiveWeight,birds:totalBirdsAtHarvest,ageBirdSum:weightedAgeSum,placed:totalPlaced,mortality:totalMortalityEst,targetKg});
  const {fcr,cfcr,cfcrInd,pif}=k,avgWeight=k.alw,livability=k.livability,weightedAge=k.avgAge;
  const cage=cAge245ForSheds(sheds.filter(s=>s.placementDate));
  return {feedMeasured,hasData:true,carryKg,carryInDocket,fromDockets,shedsWithData,totalLiveWeight,totalFeedAuto,totalFeed,fcr,cfcr,cfcrInd,pif,targetKg,cage,avgWeight,livability,weightedAge,placed:totalPlaced,mortality:totalMortalityEst,birdsAtHarvest:totalBirdsAtHarvest,usingManualFeed,autoLeftover,leftoverApplied,leftoverKg,totalCurrentMortality:totalCurrentMort,currentMortRate:totalPlaced>0?(totalCurrentMort/totalPlaced)*100:0,estMortRate:totalPlaced>0?(totalMortalityEst/totalPlaced)*100:0};
}
// Leftover hint: with expected pickups; never a negative 'leftover'
// "Still to order" line: expected (with auto pickups) and safe (no future pickups)
function feedToOrderLineHtml(f){
  if(!f)return '';
  const t=v=>fmtFeed(v,0);
  return `<div class="to-order" title="Feed still needed to clean-out, minus silo stock now and loads already booked. Expected = with the auto pickup plan (realistic). Safe = if no more pickups happen (conservative — what the feed forecast assumes).">Still to order: <b>${t(f.expected)}</b> expected <span>· ${t(f.safe)} safe</span></div>`;
}
// What the projection has learned from this batch's own data
function learnedBasisHtml(t){
  if(!FARM_LEARNING){const fm=t&&t.feedMeasured;
    const chk=fm&&fm.modelPast>0?Math.round((fm.eaten/fm.modelPast-1)*100):null;
    const feedPart=`<span title="Feed for the whole batch follows the Ross 308 intake table for the birds on the farm each day.">Feed: <b>Ross 308 intake</b></span>${chk!=null?`<span class="fk-sep"> · </span><span title="Check only, not used in the result: carry-over + docket loads − silo stock to ${fmtShortNoYear(fm.asOf)} = ${fmtFeed(fm.eaten)}; the Ross table says ${fmtFeed(fm.modelPast)}. Ring readings (8 t a ring), unread silos and loads arriving after a reading make this swing.">Silo readings: <b>${chk>0?'+':''}${chk}%</b> vs standard so far</span>`:''}`;
    return `<div class="fk-basis fk-learned">${feedPart}<span class="fk-sep"> · </span><span title="Growth from the Ross 308 curve, fitted to your in-yard and pickup weighings.">Growth: <b>Ross 308 fitted to your weighings</b></span><span class="fk-sep"> · </span><span title="First thin from your density rules; last pickup at the plant's clean-out date (the ranges show ${PROJ_EARLY_DAYS} days earlier too).">Last pickup: <b>clean-out date</b>, <b>${Math.round((finalUpliftFactor()-1)*100)}%</b> heavier than thins</span></div>`;}
  const parts=[];
  const cal=intakeCalibration();
  if(cal.ok&&cal.fromHistory){parts.push(`<span title="No usable silo readings yet this batch — starting from the average of ${cal.fromHistory} past batch${cal.fromHistory>1?'es':''} in Farm history. Switches to this batch's own readings once every pair has one.">Intake <b>${Math.round(cal.factor*100)}%</b> of Ross · from past batches</span>`);}
  else if(cal.ok){const pct=Math.round(cal.factor*100);parts.push(`<span title="Daily intake learned from ${cal.points} silo-reading dates over ${cal.span} days: feed eaten between readings (dockets + carry-over − silo stock) vs the Ross table for the same birds. A fixed ${fmtFeed(Math.abs(cal.fixed||0))} ${cal.fixed>=0?'extra':'shortfall'} (feed in lines, carry-over or ring-reading bias) is kept out of the rate. Feed up to the latest readings is the measured ${fmtFeed(cal.measured)}; later days use ${pct}%.${cal.capped?' Limited to 85–115%; measured rate was '+Math.round(cal.raw*100)+'%.':''}">Intake <b>${pct}%</b> of Ross per day · from ${cal.points} silo readings</span>`);}
  else parts.push(`<span title="${escapeAttr(cal.reason||'')} — the Ross intake table is used as is for future days${cal.pastScale!=null?'; feed already eaten is the measured amount':''}.">Intake 100% of Ross · ${escapeHtml((cal.reason||'').toLowerCase())}</span>`);
  const lp=learnedThinPattern();
  if(lp.age&&lp.fromHistory)parts.push(`<span title="No shed thinned yet this batch — first auto thin at the median of ${lp.fromHistory} past batch${lp.fromHistory>1?'es':''} in Farm history.">First thin <b>day ${lp.age}</b>, <b>${Math.round(lp.share*100)}%</b> of birds · from past batches</span>`);
  else if(lp.age)parts.push(`<span title="Sheds without a pickup yet get their first auto thin at this age and size — the median of the sheds already thinned this batch.">First thin <b>day ${lp.age}</b>, <b>${Math.round(lp.share*100)}%</b> of birds · learned from Shed${lp.from.length>1?'s':''} ${lp.from.join(', ')}</span>`);
  const lf=learnedFinalPickup();
  if(lf){const from=[lf.src.batch.length?`Shed${lf.src.batch.length>1?'s':''} ${lf.src.batch.join(', ')}`:'',lf.src.history?`${lf.src.history} past batch${lf.src.history>1?'es':''}`:''].filter(Boolean).join(' + ');
    const rng=lf.min!==lf.max?` (${lf.min}–${lf.max})`:'';
    parts.push(`<span title="The plant's clean-out date is only an estimate, so each shed's last pickup is planned ${lf.weight?`on the day its birds reach ${lf.weight.toFixed(2)} kg — the farm's usual last-pickup weight (bigger birds go earlier) — within days ${lf.min}–${lf.max}`:`at day ${lf.age}, the farm's typical last-pickup age`}, never after the clean-out date. Learned from ${from}.">Last pickup ${lf.weight?`at <b>${lf.weight.toFixed(2)} kg</b>, ${lf.min===lf.max?`by day <b>${lf.max}</b>`:`days <b>${lf.min}–${lf.max}</b>`}`:`<b>day ${lf.age}</b>${rng}`} · from ${from}</span>`);}
  else parts.push(`<span title="No last-pickup data yet (Farm history or a finished shed) — using the plant's clean-out dates. Add the last pickup age to a past batch in Settings → Farm history.">Last pickup at clean-out date · no history yet</span>`);
  return `<div class="fk-basis fk-learned">${parts.join('<span class="fk-sep"> · </span>')}</div>`;
}
function farmFeedSubText(t){
  const co=t.carryKg>0?t.carryKg:0;
  if(t.usingManualFeed){
    const parts=[t.carryInDocket?'Manual (dockets, incl. carry-over)':'Manual (dockets)'];if(co&&!t.carryInDocket)parts.push(`+ ${fmtFeed(co)} carried over`);if(t.leftoverApplied)parts.push(`− ${fmtFeed(t.leftoverKg)} leftover`);
    return `${parts.join(' ')} · auto: ${fmtTonnesAlways(t.totalFeedAuto)}`;
  }
  if(t.fromDockets){
    const parts=[`Delivery dockets ${fmtFeed(feedOrderedKg())}`];if(co)parts.push(`+ ${fmtFeed(co)} carried over`);if(t.leftoverApplied)parts.push(`− ${fmtFeed(t.leftoverKg)} leftover`);
    return `${parts.join(' ')} · batch finished, so the real feed is used · auto: ${fmtTonnesAlways(t.totalFeedAuto)}`;
  }
  const base=`Auto-estimated from ${t.shedsWithData} shed${t.shedsWithData===1?'':'s'}${t.leftoverApplied?` · ${fmtFeed(t.leftoverKg)} leftover not deducted (the birds didn't eat it)`:''}`;
  return co?`${base} · carry-over ${fmtFeed(co)} is already in the birds' intake`:base;
}

/* ---------- Predictions page ---------- */
// "<Farm> · Projected batch result" — farm name from cloud sync when set.
function farmResultTitle(){
  const farm=displayFarmName()?escapeHtml(String(displayFarmName())):'';
  return farm?`${farm} <span class="farm-kpi-title-sep">·</span> Projected batch result`:'Projected batch result';
}
let fkHowOpen=false,fkFeedOpen=false;
function renderFarmKpiCard(){
  const t=computeFarmTotals();
  if(!t.hasData)return `<div class="farm-kpi-card"><div class="farm-kpi-head"><h2 id="farmResultTitle">${farmResultTitle()}</h2><span class="sub">Projected end-of-batch totals across all 8 sheds</span></div><div class="farm-kpi-empty">No sheds placed yet — import Excel or add a placement date to see farm estimates.</div></div>`;
  const rg=kpiRanges(t);
  try{recordProjectionSnapshot(t);}catch(e){console.warn('Projection snapshot failed',e);}
  const overrideVal=feedIn(predState.farmFeedOverride);
  const overrideCls=t.usingManualFeed?'manual':'';
  const feedSub=farmFeedSubText(t);
  const leftoverVal=(predState.farmLeftoverKg!=null&&predState.farmLeftoverKg>0)?feedIn(predState.farmLeftoverKg):'';
  const leftoverCls=t.leftoverApplied?'manual':'';
  // What the projection is built on: logged + your planned + auto-planned pickups
  let nLog=0,nPlan=0,nAuto=0;
  (farmData.sheds||[]).filter(sh=>sh.placementDate).forEach(sh=>{const rd=new Set((sh.pickups||[]).map(x=>iso(x.date)));nLog+=(sh.pickups||[]).length;nPlan+=(sh.predictedPickups||[]).filter(pp=>pp.date&&!rd.has(iso(pp.date))).length;nAuto+=autoPlanForShed(sh).length;});
  const howHtml=fkHowOpen?`<div class="fk-how-body"><div class="fk-basis" title="Auto-planned pickups follow your density rules, target pickups, no-pickup days and clean-out dates. They're used only for this projection — never for the feed forecast.">Pickups: <b>${nLog}</b> logged · <b>${nPlan}</b> your-planned · <b>${nAuto}</b> auto-planned</div>${learnedBasisHtml(t)}<div class="fk-basis">Ranges: last pickups up to ${PROJ_EARLY_DAYS} days before the plant's clean-out dates · ${escapeHtml(farmFeedSubText(t))}</div>${projectionLogHtml()}</div>`:'';
  // Last batch, shown inside each tile instead of a separate line
  const lr=lastHistoryRec(),lk=lr?historyKpis(lr):null;
  const vs=(now,last,dp,unit,lowerBetter)=>{if(last==null)return '';const d=now-last;const cls=Math.abs(d)<Math.pow(10,-dp)/2?'':((lowerBetter?d<0:d>0)?' good':' bad');return `<div class="fkt-last${cls}" title="Batch ${escapeAttr(lr.batch||'')} from Farm history">last batch ${last.toFixed(dp)}${unit}</div>`;};
  const fpb=t.birdsAtHarvest>0?t.totalFeed/t.birdsAtHarvest:0;
  const feedPanelOpen=fkFeedOpen||t.usingManualFeed||t.leftoverApplied;
  const feedPanel=feedPanelOpen?`<div class="fkt-panel"><div class="fkt-sub" id="kpiFeedSub">${feedSub}</div><label class="farm-leftover-label" for="farmFeedOverride">🧾 Docket total (${feedUnit()}) <span class="fkt-hint">this batch's deliveries only, without carry-over</span></label><input id="farmFeedOverride" class="farm-feed-override ${overrideCls}" type="number" step="${feedStep(true)}" min="0" placeholder="all dockets for the batch" value="${overrideVal}" /><div id="kpiDocketWarn">${docketCarryWarningHtml()}</div><label class="farm-leftover-label" for="farmLeftoverInput">🧺 Leftover at clean-out (${feedUnit()})</label><input id="farmLeftoverInput" class="farm-leftover-input ${leftoverCls}" type="number" step="${feedStep()}" min="0" placeholder="0" value="${leftoverVal}" /><div class="fkt-note" id="kpiLeftoverNote">${leftoverNoteText(t)}</div><div class="fkt-proj" id="kpiProjLeftover">${projLeftoverText(t)}</div>${feedToOrderLineHtml(farmFeedToOrder())}</div>`:'';
  return `<div class="farm-kpi-card"><div class="farm-kpi-head"><h2 id="farmResultTitle">${farmResultTitle()}</h2><span class="sub">${t.shedsWithData} of ${SHED_COUNT} sheds</span><button type="button" class="fk-how-toggle" data-fk-toggle="how" aria-expanded="${fkHowOpen}">How it's calculated ${fkHowOpen?'▴':'▾'}</button>${howHtml}</div><div class="farm-kpi-grid">
    <div class="farm-kpi-tile amber"><div class="fkt-lbl">Est. Total Live Weight</div><div class="fkt-val" id="kpiLiveWeight">${fmtKgAlways(t.totalLiveWeight)}</div><div class="fkt-sub">${t.birdsAtHarvest.toLocaleString()} birds at harvest</div></div>
    <div class="farm-kpi-tile"><div class="fkt-lbl">Est. Total Feed Consumption</div><div class="fkt-val" id="kpiFeed">${fmtTonnesAlways(t.totalFeed)}</div><span id="kpiFeedRange">${rg.feed}</span><div class="fkt-sub">${fpb.toFixed(2)} kg per bird</div>${lr?vs(fpb,lr.feedKg/lr.picked,2,' kg/bird',true):''}<button type="button" class="fkt-more" data-fk-toggle="feed" aria-expanded="${feedPanelOpen}">Dockets &amp; leftover ${feedPanelOpen?'▴':'▾'}</button>${feedPanel}</div>
    <div class="farm-kpi-tile green"><div class="fkt-lbl">Est. FCR</div><div class="fkt-val" id="kpiFCR">${t.fcr.toFixed(3)}</div><span id="kpiFCRRange">${rg.fcr}</span>${lk?vs(t.fcr,lk.fcr,3,'',true):''}</div>
    <div class="farm-kpi-tile green"><div class="fkt-lbl">Est. cFCR (Baiada)</div><div class="fkt-val" id="kpiCFCR">${t.cfcr.toFixed(3)}</div><span id="kpiCFCRRange">${rg.cfcr}</span>${lk?vs(t.cfcr,lk.cfcr,3,'',true):''}<div class="fkt-sub" id="kpiCFCRSub" title="FCR − (ALW − 2.45) × ${CFCR_BAIADA_BETA}">${cfcrSubText(t)}</div></div>
    <div class="farm-kpi-tile green"><div class="fkt-lbl">Est. cFCR (Industry)</div><div class="fkt-val" id="kpiCFCRInd">${t.cfcrInd.toFixed(3)}</div><div class="fkt-sub" id="kpiCFCRIndSub" title="FCR − (ALW − target) ÷ 3.2">${cfcrIndSubText(t)}</div></div>
    <div class="farm-kpi-tile blue"><div class="fkt-lbl">Est. PIF</div><div class="fkt-val" id="kpiPIF">${t.pif.toFixed(0)}</div><span id="kpiPIFRange">${rg.pif}</span>${lk?vs(t.pif,lk.pif,0,'',false):''}</div>
    <div class="farm-kpi-tile blue"><div class="fkt-lbl">Est. CAge 2.45</div><div class="fkt-val" id="kpiCAge">${cageText(t.cage)}</div><div class="fkt-sub" title="Age when cumulative FCR (cumulative intake ÷ weight per bird) reaches 2.45, along each shed's growth curve; farm value weighted by birds placed. Past day 60 the intake table is held at its last value.">Higher is better</div></div>
    <div class="farm-kpi-tile"><div class="fkt-lbl">Est. Average Weight</div><div class="fkt-val" id="kpiAvgWeight">${t.avgWeight.toFixed(3)} <span style="font-size:12px;font-weight:600;color:var(--muted);">kg</span></div><div class="fkt-sub" id="kpiPIFSub">avg age ${t.weightedAge.toFixed(1)} d</div>${lk?vs(t.avgWeight,lk.alw,2,' kg',false):''}<div class="fkt-pairs">${[1,2,3,4].map(g=>{const gp=computeGroupPredictions(g);return gp.hasData?`<span title="${pairLabel(g)} average">${pairShort(g)}: <b>${gp.avgWeight.toFixed(2)}</b></span>`:'';}).join('')}</div></div>
    <div class="farm-kpi-tile"><div class="fkt-lbl">Est. Livability</div><div class="fkt-val" id="kpiLivability">${t.livability.toFixed(2)}%</div><div class="fkt-sub">${t.placed.toLocaleString()} placed</div>${lk?vs(t.livability,lk.livability,1,'%',false):''}</div>
    <div class="farm-kpi-tile red"><div class="fkt-lbl">Est. Total Mortality</div><div class="fkt-val" id="kpiMortality">${t.mortality.toLocaleString()}</div><div class="fkt-sub" id="kpiMortalitySub">${t.totalCurrentMortality.toLocaleString()} recorded now · est. ${t.estMortRate.toFixed(2)}% of placed</div></div>
  </div></div>`;
}
// Range: the same projection with every last pickup PROJ_EARLY_DAYS before
// the plant's clean-out date (plants usually take the last birds early)
const PROJ_EARLY_DAYS=4;let farmRangeCache=null;
function farmTotalsEarly(){
  if(farmRangeCache)return farmRangeCache;
  let t=null;projEndShiftDays=PROJ_EARLY_DAYS;autoPlanCache=new Map();
  try{t=computeFarmTotals();}catch(e){t=null;}finally{projEndShiftDays=0;autoPlanCache=new Map();}
  farmRangeCache=t;return t;
}
function rangeText(a,b,fmt){if(a==null||b==null)return '';const lo=Math.min(a,b),hi=Math.max(a,b);return fmt(lo,hi);}
function kpiRanges(t){
  const e=farmTotalsEarly();if(!e||!e.hasData||!t.hasData)return {feed:'',fcr:'',cfcr:'',pif:''};
  const tip=`title="Low end if every shed's last pickup is ${PROJ_EARLY_DAYS} days before the plant's clean-out date; high end at the clean-out date."`;
  return {
    feed:t.usingManualFeed?'':`<div class="fkt-range" ${tip}>Range ${rangeText(e.totalFeed,t.totalFeed,(lo,hi)=>`${fmtFeedNum(lo,0)}–${fmtFeed(hi,0)}`)}</div>`,
    fcr:`<div class="fkt-range" ${tip}>Range ${rangeText(e.fcr,t.fcr,(lo,hi)=>`${lo.toFixed(3)}–${hi.toFixed(3)}`)}</div>`,
    cfcr:`<div class="fkt-range" ${tip}>Range ${rangeText(e.cfcr,t.cfcr,(lo,hi)=>`${lo.toFixed(3)}–${hi.toFixed(3)}`)}</div>`,
    pif:`<div class="fkt-range" ${tip}>Range ${rangeText(e.pif,t.pif,(lo,hi)=>`${lo.toFixed(0)}–${hi.toFixed(0)}`)}</div>`};
}
// Last week of the projection, so any change can be traced (data or model)
function projectionLogHtml(){
  const log=(predState.projectionLog||[]).slice(-7);if(log.length<2)return '';
  const rows=log.map((x,i)=>{const p=i?log[i-1]:null;const changed=p&&p.m!==x.m;
    return `<tr><td>${escapeHtml(fmtShortNoYear(dateOnly(x.d)))}</td><td class="num">${x.feed!=null?fmtFeed(x.feed,0):'—'}</td><td class="num">${x.fcr!=null?x.fcr.toFixed(3):'—'}</td><td class="num">${x.cfcr!=null?x.cfcr.toFixed(3):'—'}</td><td class="num">${x.alw!=null?x.alw.toFixed(2):'—'}</td><td>${changed?`<span class="pl-model" title="${escapeAttr(MODEL_NOTES[x.m]||'')}">model updated</span>`:''}</td></tr>`;}).join('');
  return `<div class="fk-plog"><div class="fk-plog-title">Projection by day</div><div class="fk-plog-wrap"><table><thead><tr><th>Day</th><th class="num">Feed</th><th class="num">FCR</th><th class="num">cFCR</th><th class="num">ALW</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="fk-plog-note">Model: ${escapeHtml(MODEL_NOTES[MODEL_VERSION]||MODEL_VERSION)}</div></div>`;
}
// Leftover only comes off the docket total; say so where it's typed
function leftoverNoteText(t){
  if(t.usingManualFeed&&t.carryInDocket)return `Total = docket total (already holds the ${fmtFeed(t.carryKg||0)} carry-over) − leftover`;
  if(t.usingManualFeed)return `Total = docket total + ${fmtFeed(t.carryKg||0)} carry-over − leftover`;
  if(t.fromDockets)return `Total = delivery dockets + ${fmtFeed(t.carryKg||0)} carry-over − leftover`;
  return `Only used with the docket total — the estimate above already counts just what the birds eat.`;
}
function projLeftoverText(t){
  const v=t.autoLeftover;if(v==null)return '';
  return `Projected leftover with loads booked so far: <b>${v>=0?fmtFeed(v,1):'0'}</b>${v<0?` · short ${fmtFeed(-v,1)}`:''}`;
}
function cfcrSubText(t){return `vs 2.45 kg reference`;}
function cfcrIndSubText(t){return `vs ${t.targetKg.toFixed(2)} kg target`;}
function pifSubText(t){return `avg age ${t.weightedAge.toFixed(1)} d`;}
function cageText(a){return a?`${a.toFixed(1)} <span style="font-size:12px;font-weight:600;color:var(--muted);">days</span>`:'—';}
function updateFarmKpiValues(){
  const t=computeFarmTotals();
  const el=id=>document.getElementById(id);
  const set=(id,html)=>{const e=el(id);if(e)e.innerHTML=html;};
  if(!t.hasData)return;
  set('kpiLiveWeight',fmtKgAlways(t.totalLiveWeight));
  set('kpiFeed',fmtTonnesAlways(t.totalFeed));
  const sub=el('kpiFeedSub');if(sub)sub.textContent=farmFeedSubText(t);
  farmRangeCache=null;const rg=kpiRanges(t);set('kpiFeedRange',rg.feed);set('kpiFCRRange',rg.fcr);set('kpiCFCRRange',rg.cfcr);set('kpiPIFRange',rg.pif);
  set('kpiFCR',t.fcr.toFixed(3));
  set('kpiCFCR',t.cfcr.toFixed(3));set('kpiCFCRSub',cfcrSubText(t));
  set('kpiCFCRInd',t.cfcrInd.toFixed(3));set('kpiCFCRIndSub',cfcrIndSubText(t));
  set('kpiPIF',t.pif.toFixed(0));set('kpiPIFSub',pifSubText(t));
  set('kpiCAge',cageText(t.cage));
  set('kpiAvgWeight',t.avgWeight.toFixed(3)+' <span style="font-size:12px;font-weight:600;color:var(--muted);">kg</span>');
  set('kpiLivability',t.livability.toFixed(2)+'%');
  set('kpiMortality',t.mortality.toLocaleString());
  const msub=el('kpiMortalitySub');if(msub)msub.textContent=`${t.totalCurrentMortality.toLocaleString()} recorded now · est. ${t.estMortRate.toFixed(2)}% of placed`;
  const lo=el('farmLeftoverInput');
  if(lo)lo.classList.toggle('manual',t.leftoverApplied);
  set('kpiLeftoverNote',leftoverNoteText(t));set('kpiProjLeftover',projLeftoverText(t));
  set('kpiDocketWarn',docketCarryWarningHtml());
}
// Says so when the typed docket total already holds the carry-over (it's then counted once).
function docketCarryWarningHtml(){
  const over=Number(predState.farmFeedOverride)||0,carry=carryoverTotalKg();
  if(!docketIncludesCarry(over,feedOrderedKg(),carry))return '';
  return `<div class="fkt-note fkt-incl">Includes the ${fmtFeed(carry)} carry-over, so it's counted once.</div>`;
}
// Prediction adjustments — opened from the gear on the floating rail.
// Not persisted: a reload never reopens it.
let adjModalOpen=false;
// ── Adjustments modal works on a DRAFT: nothing is applied (or re-rendered)
// until "Apply changes", so editing never re-pops the modal.
let adjDraft=null,adjDraftBase='';
function adjDraftFromState(g){
  const dg=predState.densityGlobal||{...DEFAULT_DENSITY_GLOBAL};
  const ovr={};shedsForGroup(g).forEach(s=>{ovr[s.id]=(s.scaleOverride!=null&&Number(s.scaleOverride)>0)?Math.round(Number(s.scaleOverride)*1000)/10:null;});
  return {group:g,beta:Number(predState.beta)||0,scale:Math.round(currentBiasFactor()*1000)/10,target:Number(predState.targetHarvestWeightKg[g])||2.65,
    trig:Number(dg.triggerDensity),tgt:Number(dg.targetDensity),max:Number(dg.maxDensity),
    tp:Number.isFinite(Number(dg.targetPickups))?Number(dg.targetPickups):DEFAULT_DENSITY_GLOBAL.targetPickups,
    npd:[...(predState.noPickupDays||[])].sort((a,b)=>a-b),ovr,uplift:Math.round((finalUpliftFactor()-1)*100)};
}
// Dirty = draft differs from what the modal opened with (not from live
// state, so a background sync never shows up as 'your' change)
function adjIsDirty(){if(!adjDraft)return false;return JSON.stringify(adjDraft)!==adjDraftBase;}
function adjSuggestHtml(sug,btnAttr,noun){
  if(!sug)return `<span class="adj-sug muted">Needs a weighed pickup (with in-yard readings within 7 days of it) to suggest a value.</span>`;
  const pct=(sug.value*100).toFixed(1);
  const range=sug.n>1?` · range ${(sug.min*100).toFixed(1)}–${(sug.max*100).toFixed(1)}%`:'';
  return `<span class="adj-sug">Plant weighings suggest <strong>${pct}%</strong> (from ${sug.n} ${noun}${sug.n===1?'':'s'}${range})${btnAttr?` <button type="button" class="adj-sug-btn" ${btnAttr}="${pct}">Use ${pct}%</button>`:''}</span>`;
}
function adjModalBodyHtml(){
  const d=adjDraft;const g=d.group;const sheds=shedsForGroup(g);
  const sugG=farmData?suggestScaleCorrection(farmData.sheds||[]):null;
  const shedRows=sheds.map(sh=>{
    const own=suggestScaleCorrection([sh]);const ov=d.ovr[sh.id];const useG=ov==null;
    const differs=own&&own.n>=2&&Math.abs(own.value*100-d.scale)>3;
    return `<div class="adj-shed-row">
      <span class="adj-shed-name">Shed ${sh.id}</span>
      <label class="adj-check"><input type="checkbox" data-adj-useglobal="${sh.id}" ${useG?'checked':''} /> Use global</label>
      ${useG?`<span class="adj-shed-val muted">${d.scale.toFixed(1)}%</span>`:`<span class="adj-shed-val"><input type="number" class="adj-num" data-adj-override="${sh.id}" min="${MIN_BIAS_FACTOR*100}" max="${MAX_BIAS_FACTOR*100}" step="0.5" value="${ov}" /> %</span>`}
      <span class="adj-shed-sug">${own?`This shed: <strong>${(own.value*100).toFixed(1)}%</strong> (${own.n} weighing${own.n===1?'':'s'})${!useG?` <button type="button" class="adj-sug-btn" data-adj-suggest-shed="${sh.id}" data-pct="${(own.value*100).toFixed(1)}">Use</button>`:''}${differs?` <span class="adj-warn">⚠ consistently differs from global — check catching / weighing method</span>`:''}`:'<span class="muted">No plant weighing yet</span>'}</span>
    </div>`;
  }).join('');
  const DAYS=[{i:1,l:'Mon'},{i:2,l:'Tue'},{i:3,l:'Wed'},{i:4,l:'Thu'},{i:5,l:'Fri'},{i:6,l:'Sat'},{i:0,l:'Sun'}];
  const npd=DAYS.map(x=>`<button class="npd-btn${d.npd.includes(x.i)?' active':''}" type="button" data-adj-npd="${x.i}" aria-pressed="${d.npd.includes(x.i)}">${x.l}</button>`).join('');
  let blockedCount=0;if(farmData)farmData.sheds.forEach(s=>{blockedCount+=countPredictedPickupsOnBlockedDays(s);});
  const dirty=adjIsDirty();
  return `
  <section class="adj-sec">
    <h4 class="adj-sec-title">📐 Scale correction <span>in-yard (shed-scale) readings only — plant weights are never scaled</span></h4>
    <div class="adj-row"><label>Farm-wide (global)</label><input type="range" data-adj="scale" min="${MIN_BIAS_FACTOR*100}" max="${MAX_BIAS_FACTOR*100}" step="0.5" value="${d.scale}" /><input type="number" class="adj-num" data-adj="scale" min="${MIN_BIAS_FACTOR*100}" max="${MAX_BIAS_FACTOR*100}" step="0.5" value="${d.scale}" /><span class="adj-unit">%</span>${adjSuggestHtml(sugG,'data-adj-suggest-global','plant weighing')}</div>
    <div class="adj-shed-list">${shedRows}</div>
  </section>
  <section class="adj-sec">
    <h4 class="adj-sec-title">📊 Results</h4>
    <div class="adj-row"><label>Target weight at harvest · ${pairLabel(g)}</label><input type="number" class="adj-num" data-adj="target" min="0.5" max="5" step="0.01" value="${d.target.toFixed(2)}" /><span class="adj-unit">kg</span><span class="adj-hint">The weight you're aiming to send birds to the plant. Also the reference for cFCR (Industry) = FCR − (ALW − target) ÷ 3.2. cFCR (Baiada) always uses 2.45 kg × 0.27.</span></div>
    <div class="adj-row"><label>Final pickup weight vs thins</label><input type="number" class="adj-num" data-adj="uplift" min="0" max="15" step="1" value="${d.uplift}" /><span class="adj-unit">% heavier</span><span class="adj-hint">Final birds weigh more than thinned birds compared with the Ross standard — thins take lighter birds and the rest grow on with more room. Your 2606 and 2607 batches: +8–10%. 0% = use the growth curve as is.</span></div>
  </section>
  <section class="adj-sec">
    <h4 class="adj-sec-title">🎯 Pickup planning <span>global defaults</span></h4>
    ${adjHistorySuggestionHtml(d)}
    <div class="adj-row"><label>Trigger density</label><input type="number" class="adj-num" data-adj="trig" min="20" max="45" step="0.5" value="${d.trig}" /><span class="adj-unit">kg/m²</span><span class="adj-hint">Plan a pickup when density is forecast to reach this.</span></div>
    <div class="adj-row"><label>Target after pickup</label><input type="number" class="adj-num" data-adj="tgt" min="15" max="35" step="0.5" value="${d.tgt}" /><span class="adj-unit">kg/m²</span><span class="adj-hint">Density to aim for after each pickup.</span></div>
    <div class="adj-row"><label>Hard maximum</label><input type="number" class="adj-num" data-adj="max" min="28" max="45" step="0.5" value="${d.max}" /><span class="adj-unit">kg/m²</span><span class="adj-hint">Welfare ceiling.</span></div>
    <div class="adj-row"><label>Target pickups per shed</label><input type="number" class="adj-num" data-adj="tp" min="${MIN_PICKUPS_PER_SHED}" max="${MAX_PICKUPS_PER_SHED}" step="1" value="${d.tp}" /><span class="adj-unit">pickups</span><span class="adj-hint">Including the final clean-out (${MIN_PICKUPS_PER_SHED} or ${MAX_PICKUPS_PER_SHED}).</span></div>
    <div class="adj-row"><label>No-pickup days</label><div class="no-pickup-days">${npd}</div></div>
  </section>
  <section class="adj-sec adj-actions-sec">
    <h4 class="adj-sec-title">⚡ Actions <span>run now with the applied settings</span></h4>
    ${dirty?'<p class="adj-actions-note">Apply or cancel your changes first — these actions use the applied settings.</p>':''}
    <div class="adj-actions">
      <button type="button" class="btn-global-autofill-sm" data-global-autofill="1" ${dirty?'disabled':''}>✨ Auto-fill all sheds</button>
      <button type="button" class="btn-global-clear-sm" data-global-clear-pickups="1" ${dirty?'disabled':''}>🗑️ Clear all planned pickups</button>
      ${blockedCount>0?`<button type="button" class="btn-replan-sm" data-replan-blocked="1" ${dirty?'disabled':''}>📅 Re-plan ${blockedCount} pickup${blockedCount===1?'':'s'} on blocked days</button>`:''}
    </div>
  </section>`;
}
function adjFooterHtml(){
  const dirty=adjIsDirty();
  return `<span class="adj-dirty${dirty?' on':''}">${dirty?'● Unapplied changes':'No changes'}</span><button type="button" class="adj-btn" data-adj-cancel="1">${dirty?'Cancel':'Close'}</button><button type="button" class="adj-btn primary" data-adj-apply="1" ${dirty?'':'disabled'}>Apply changes</button>`;
}
// Refresh body + footer in place (keeps the panel — no re-pop animation)
// "From your last batches" — the thinning pattern of past batches in Farm
// history (density when thins started / after them / highest, pickups per
// shed). A suggestion only: "Use these" fills the draft; Apply saves it.
function adjHistorySuggestionHtml(d){
  if(typeof fhCloud!=='undefined'&&syncFarmName&&fhCloud.farm!==syncFarmName&&fhCloud.state!=='loading')setTimeout(findCloudBatchesForHistory,0);
  const p=historyDensityPrior();
  if(!p)return `<p class="adj-hist-note">Add finished batches to <b>Settings → Farm history</b> to get settings suggested from how you actually thinned.</p>`;
  const same=d.trig===p.trig&&d.tgt===p.tgt&&d.max===p.max&&(!p.tp||d.tp===p.tp);
  const src=p.batches.length?p.batches.slice(0,3).join(', ')+(p.batches.length>3?'…':''):`${p.n} batch${p.n>1?'es':''}`;
  return `<div class="adj-hist" title="Measured from each past batch's real pickups (plant weight × birds ÷ ${FIXED_FLOOR_AREA_M2.toLocaleString()} m²): density when thins started, density after them, the highest density reached, and pickups per shed — median across batches.">
      <div class="adj-hist-text">From your last batch${p.n>1?'es':''} <b>${escapeHtml(src)}</b>: trigger <b>${p.trig}</b> · target <b>${p.tgt}</b> · max <b>${p.max}</b> kg/m²${p.tp?` · <b>${p.tp}</b> pickups`:''}</div>
      <button type="button" class="adj-btn adj-hist-use" data-adj-use-history ${same?'disabled':''}>${same?'In use':'Use these'}</button>
    </div>`;
}
function refreshAdjModal(bodyToo){
  const root=document.querySelector('#adjModalRoot .adj-modal');if(!root)return;
  if(bodyToo){const body=root.querySelector('.adj-modal-body');if(body){const y=body.scrollTop;body.innerHTML=adjModalBodyHtml();body.scrollTop=y;}}
  const foot=root.querySelector('.adj-modal-foot');if(foot)foot.innerHTML=adjFooterHtml();
  const note=root.querySelector('.adj-actions-note');const dirty=adjIsDirty();
  root.querySelectorAll('.adj-actions button').forEach(b=>b.disabled=dirty);
  if(!bodyToo&&dirty&&!note){const sec=root.querySelector('.adj-actions-sec h4');if(sec)sec.insertAdjacentHTML('afterend','<p class="adj-actions-note">Apply or cancel your changes first — these actions use the applied settings.</p>');}
  if(!dirty&&note)note.remove();
}
function renderAdjustmentModal(group){
  if(!adjDraft||adjDraft.group!==group){adjDraft=adjDraftFromState(group);adjDraftBase=JSON.stringify(adjDraft);}
  return `<div class="adj-modal" role="dialog" aria-modal="true" aria-labelledby="adjModalTitle"><div class="adj-modal-scrim" data-toggle-adjustments="1"></div><div class="adj-modal-panel"><div class="adj-modal-head"><h3 id="adjModalTitle">${navIcon('gear')}Prediction adjustments <span>${pairLabel(group)}</span></h3><button type="button" class="adj-modal-close" data-toggle-adjustments="1" aria-label="Close">✕</button></div><div class="adj-modal-body">${adjModalBodyHtml()}</div><div class="adj-modal-foot">${adjFooterHtml()}</div></div></div>`;
}
function applyAdjDraft(){
  const d=adjDraft;if(!d)return;
  const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number(v)));
  if(farmData)farmData.biasFactor=cl(d.scale/100,MIN_BIAS_FACTOR,MAX_BIAS_FACTOR);
  predState.targetHarvestWeightKg[d.group]=cl(d.target,0.5,5);
  const dg={...(predState.densityGlobal||DEFAULT_DENSITY_GLOBAL)};
  dg.triggerDensity=cl(d.trig,20,45);dg.targetDensity=cl(d.tgt,15,35);dg.maxDensity=cl(d.max,28,45);dg.targetPickups=Math.round(cl(d.tp,MIN_PICKUPS_PER_SHED,MAX_PICKUPS_PER_SHED));
  predState.densityGlobal=dg;
  predState.noPickupDays=[...d.npd].sort((a,b)=>a-b);
  predState.finalUpliftPct=Math.round(cl(d.uplift,0,15));
  shedsForGroup(d.group).forEach(s=>{const v=d.ovr[s.id];s.scaleOverride=(v==null||!(Number(v)>0))?null:cl(Number(v)/100,MIN_BIAS_FACTOR,MAX_BIAS_FACTOR);});
  savePredState();saveState();schedulePush();
  adjDraft=null;adjDraftBase='';closeAdjModal(true);
  showToast('✓ Adjustments applied.');
}

function renderNoPickupDaysRow(){
  const DAYS=[{i:1,l:'Mon'},{i:2,l:'Tue'},{i:3,l:'Wed'},{i:4,l:'Thu'},{i:5,l:'Fri'},{i:6,l:'Sat'},{i:0,l:'Sun'}];
  const blocked=predState.noPickupDays||[];
  const pills=DAYS.map(d=>{
    const active=blocked.includes(d.i);
    return `<button class="npd-btn${active?' active':''}" type="button" data-npd="${d.i}" aria-pressed="${active?'true':'false'}">${d.l}</button>`;
  }).join('');
  const label=blocked.length===0
    ? 'Pickups can be scheduled any day.'
    : `Pickups will be blocked on ${DAYS.filter(d=>blocked.includes(d.i)).map(d=>d.l).join(', ')}.`;
  // Count any existing predicted pickups sitting on now-blocked days
  let blockedCount=0;
  if(farmData){
    farmData.sheds.forEach(s=>{blockedCount+=countPredictedPickupsOnBlockedDays(s);});
  }
  const warnHtml=blockedCount>0
    ? `<div class="blocked-days-warning">
         <span class="bdw-icon">⚠️</span>
         <span class="bdw-text">${blockedCount} predicted pickup${blockedCount===1?'':'s'} sit on blocked days.</span>
         <button class="bdw-btn" type="button" data-replan-blocked="1">Re-plan around blocked days</button>
       </div>`
    : '';
  return `<div class="adj-row"><label>📅 No-pickup days</label><div class="no-pickup-days">${pills}</div><span class="adj-hint">${label} Existing pickups stay where they are — use Auto-fill or Re-plan to update them.</span></div>${warnHtml}`;
}
// Floating rail on the Predictions page: shed view switcher + settings.
// Vertical on the left on desktop, a pill above the bottom nav on phones.
function predRailHtml(g,view,sheds){
  const btn=(v,icon,label,title)=>`<button type="button" class="pred-rail-btn${view===v?' active':''}" data-predview="${v}" aria-pressed="${view===v}" title="${title}">${navIcon(icon)}<span>${label}</span></button>`;
  const shedBtns=sheds.map((s,i)=>btn(i===0?'shed1':'shed2','home',`Shed ${s.id}`,`Show shed ${s.id} only`)).join('');
  return `<nav class="pred-rail" aria-label="Prediction view">
    ${shedBtns}
    ${sheds.length>1?btn('both','homes','Both','Show both sheds side by side'):''}
    <span class="pred-rail-sep" aria-hidden="true"></span>
    <button type="button" class="pred-rail-btn" data-goto-shedgroup="${g}" title="Back to ${pairLabel(g)}">${navIcon('grid')}<span>Sheds</span></button>
  </nav>`;
}
function renderPredictionsView(){
  const g=predState.predGroup;
  const sheds=shedsForGroup(g);
  if(sheds.length===0)return `<div class="empty-card">${pairLabel(g)} has no data.</div>`;
  const view=predState.predView;
  const visibleSheds=view==='shed1'?[sheds[0]]:view==='shed2'?[sheds[1]||sheds[0]]:sheds;
  const gridClass=view==='both'&&sheds.length>1?'pred-grid compare':'pred-grid';
  const groupNames={1:pairLabel(1),2:pairLabel(2),3:pairLabel(3),4:pairLabel(4)};
  return `${pairSwitchHtml(g,'pred')}<div class="pred-layout"><div class="predictions-head"><h1>${pairStepHtml(g,'pred')}📊 ${groupNames[g]} Prediction${pairStepHtml(g,'pred',1)}</h1><span class="head-note">Pair result · per-shed detail below · farm total on the Dashboard</span></div>${predRailHtml(g,view,sheds)}<div class="${gridClass}" style="margin-top:14px;">${visibleSheds.map(s=>renderPredictionsShedCard(s,g)).join('')}</div></div>`;
}
// Shed-pair switcher — the same segmented bar on the Sheds and Predictions
// pages; sticks to the top while scrolling on phones and tablets
// ‹ › on the pair title: previous / next pair, wrapping 4 → 1
function pairStepHtml(g,ctx,dir=-1){
  const n=((g-1+dir+4)%4)+1;
  const attr=ctx==='pred'?`data-predgroup="${n}"`:`data-tab="g${n}"`;
  return `<button type="button" class="pair-step" ${attr} aria-label="${dir<0?'Previous':'Next'}: ${pairLabel(n)}" title="${pairLabel(n)}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="${dir<0?'M15 6l-6 6 6 6':'M9 6l6 6-6 6'}"/></svg></button>`;
}
function pairSwitchHtml(g,ctx){
  return `<div class="group-switch-mobile" role="tablist" aria-label="Shed pair">${[1,2,3,4].map(gi=>`<button type="button" role="tab" class="gsm-btn${gi===g?' active':''}" ${ctx==='pred'?`data-predgroup="${gi}"`:`data-tab="g${gi}"`} aria-selected="${gi===g}">${pairShort(gi)}</button>`).join('')}</div>`;
}
function renderInYardCurvePanel(shed){
  const tc=shed.targetCurve||{};
  const fit=getShedGompertzFit(shed);const hasFit=!!fit;
  const samples=shed.inYardSamples||[];
  const biasPct=(shedBiasFactor(shed)*100).toFixed(0);
  const inputs=TARGET_DAYS.map(day=>{
    const v=tc[day];const filled=v!=null&&Number.isFinite(Number(v))&&Number(v)>0;
    const ref=rossWeightKg(day).toFixed(3);let warn=false;
    if(filled){const num=Number(v);if(num<ROSS_308_WEIGHTS_KG[0]||num>6)warn=true;const prevDay=TARGET_DAYS[TARGET_DAYS.indexOf(day)-1];if(prevDay!=null){const prevV=tc[prevDay];if(prevV!=null&&Number.isFinite(Number(prevV))&&Number(prevV)>0&&num<=Number(prevV))warn=true;}}
    const cls=warn?'warn':(filled?'filled':'');
    return `<div class="ptc-input"><label>Day ${day}</label><div class="ptc-field"><input type="number" step="0.001" min="0" placeholder="${ref}" value="${filled?Number(v).toFixed(3):''}" class="${cls}" data-target-shed="${shed.id}" data-target-day="${day}" title="Standard: ${ref} kg" /><span class="unit">kg</span></div><span class="ref">Standard: ${ref} kg</span></div>`;
  }).join('');
  let customRows='';
  if(samples.length>0){customRows=`<div class="custom-day-list"><div class="custom-day-list-title">Extra reading days</div>${samples.map((x,i)=>{const age=sampleAge(shed,x);const officialBadge=x.isOfficial?'<span class="tag official-source" style="font-size:9px;padding:1px 6px;">Plant</span>':'';return `<div class="custom-day-row"><span class="cd-day">Day ${age}</span><span class="cd-date">${fmtShortNoYear(x.date)}</span>${officialBadge}<span class="cd-weight">${x.avgWeightKg.toFixed(3)} kg</span><span class="cd-actions"><button class="edit" type="button" data-sample-edit="${shed.id}|${i}" title="Edit">✎</button><button class="del" type="button" data-sample-delete="${shed.id}|${i}" title="Delete">✕</button></span></div>`;}).join('')}</div>`;}
  let sourcePill,sourceText;
  if(hasFit){sourcePill='<span class="pill gompertz">AI curve</span>';const nGrid=TARGET_DAYS.filter(d=>tc[d]>0).length;const nCustom=samples.length;const nPickups=(shed.pickups||[]).filter(p=>!p.weightEstimated&&pickupAvgKg(p)).length;const parts=[];if(nGrid>0)parts.push(`${nGrid} check-day${nGrid===1?'':'s'}`);if(nCustom>0)parts.push(`${nCustom} extra reading${nCustom===1?'':'s'}`);if(nPickups>0)parts.push(`${nPickups} pickup weight${nPickups===1?'':'s'}`);sourceText=`Based on <strong>${parts.join(' + ')||'chick weight only'}</strong>`;if(fit&&fit.guideCount>0)sourceText+=` <span title="Until readings past day ~28 exist, light Ross 308-shaped guide points (scaled to how this shed is tracking) keep the later weeks realistic. Real readings and weighed pickups always take priority.">· later weeks guided by the Ross 308 shape</span>`;}
  else{const nTotal=TARGET_DAYS.filter(d=>tc[d]>0).length+samples.length;if(nTotal===0){sourcePill='<span class="pill standard">Standard curve</span>';sourceText='Enter your shed scale readings above to sharpen the forecast';}else if(nTotal===1){sourcePill='<span class="pill target">Reading only</span>';sourceText='One reading logged — enter more to unlock the AI curve';}else{sourcePill='<span class="pill target">Adjusted standard</span>';sourceText='Not enough readings for the AI curve — using the adjusted standard curve';}}
  return `<div class="pred-target-curve"><div class="ptc-head"><span class="ptc-title">📏 In-Yard Growth Curve</span><button class="btn-sample-add" data-sample-add="${shed.id}" type="button" title="Add a reading for a day other than 7/14/21/28">＋ Extra reading day</button></div><div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5;">Enter your shed scale readings on the standard check days. The app adjusts them ×${biasPct}% to match the plant weight. Use <strong>＋ Extra reading day</strong> for off-schedule weigh-ins.</div><div class="ptc-inputs">${inputs}</div>${customRows}<div class="ptc-status">Using: ${sourcePill} · ${sourceText}</div></div>`;
}
function forecastDayBarHtml(){
  const s=dailyRangeState;
  const presets=[{label:'Last 7',start:-7,end:0},{label:'Today',start:0,end:0},{label:'Next 7',start:0,end:7},{label:'Next 14',start:0,end:14},{label:'Next 21',start:0,end:21}];
  let resolvedLabel;
  if(s.mode==='today'){const fmtOff=n=>n===0?'today':(n>0?`+${n}d`:`${n}d`);resolvedLabel=s.start===s.end?`Showing: ${fmtOff(s.start)} (today-relative)`:`Showing: ${fmtOff(s.start)} to ${fmtOff(s.end)} (today-relative)`;}
  else resolvedLabel=`Showing: Day ${s.start} to Day ${s.end} of cycle`;
  return `<div class="pred-daily-range-bar" style="margin:14px 0 10px;"><label>📅 Forecast Day</label>${presets.map(p=>{const active=(s.mode==='today'&&p.start===s.start&&p.end===s.end);return `<button class="fpill ${active?'active':''}" data-preddays="${p.start},${p.end}">${p.label}</button>`;}).join('')}<span class="pdrb-sep">· or ·</span><span class="pdrb-cycle-inputs"><span>Day</span><input type="number" min="0" max="200" step="1" data-pred-cycle="start" value="${s.start}" /><span>to</span><span>Day</span><input type="number" min="0" max="200" step="1" data-pred-cycle="end" value="${s.end}" /><button class="pdrb-apply" type="button" data-pred-cycle-apply="1">Go</button></span><span class="pdrb-resolved">${resolvedLabel}</span></div>`;
}
function renderDailyPerformance(shed){
  if(!shed.placementDate)return `<div class="pickups-block" id="dailyPerf-${shed.id}" style="margin-top:14px;"><h4>📅 Daily Performance — Actual + AI Forecast</h4><div class="forecast-empty">No placement date set — forecast unavailable.</div></div>`;
  const today=dateOnly(new Date());
  const last=lastWeightedPickup(shed);
  const currentAge=ageInDays(shed,today);
  const fit=getShedGompertzFit(shed);
  const effective=computeEffectivePickups(shed);
  let startDay,endDay;
  if(dailyRangeState.mode==='cycle'){startDay=Math.max(0,Math.floor(dailyRangeState.start));endDay=Math.max(startDay,Math.floor(dailyRangeState.end));}
  else{startDay=Math.max(0,currentAge+Math.floor(dailyRangeState.start));endDay=Math.max(startDay,currentAge+Math.floor(dailyRangeState.end));}
  const rows=[];
  for(let day=startDay;day<=endDay;day++){
    const d=addDays(shed.placementDate,day);
    const age=day;const live=liveAtStartOfDay(shed,d);
    const pickupsToday=effective.filter(p=>iso(p.date)===iso(d));
    const pickupsBirds=pickupsToday.reduce((s,p)=>s+p.birds,0);
    const hasPredicted=pickupsToday.some(p=>p.__source==='predicted');
    const isToday=iso(d)===iso(today);const isPast=d<today;const wknd=isWeekend(d);
    const standard=age>0?rossWeightKg(age):0;
    const isMilestone=isMilestoneDay(age);
    const gridVal=(shed.targetCurve&&shed.targetCurve[age]!=null&&Number(shed.targetCurve[age])>0)?Number(shed.targetCurve[age]):null;
    const customOn=(shed.inYardSamples||[]).find(x=>sampleAge(shed,x)===age);
    let weight=null;let weightType=null;let band=null;
    if(age>0){const f=forecastWeightModeAware(shed,d);if(f.kg!=null){weight=f.kg;band=f.band||null;if(f.mode==='gompertz')weightType='gompertz';else if(f.mode==='ross-scaled')weightType='ross-scaled';else if(f.mode==='ai-pickup')weightType='ai-pickup';else if(f.mode==='ai-target')weightType='ai-target';else weightType='standard';}}
    let daysVar=null;
    if(weight!=null&&age>0)daysVar=daysVsTarget(age,weight);
    rows.push({date:d,day,age,live,pickupsBirds,hasPredicted,standard,weight,weightType,daysVar,band,isToday,isPast,isWeekend:wknd,isMilestone,gridVal,customOn});
  }
  let sourceNote='';
  if(fit){const nGrid=TARGET_DAYS.filter(d=>shed.targetCurve&&shed.targetCurve[d]>0).length;const nCustom=(shed.inYardSamples||[]).length;const nPickups=(shed.pickups||[]).filter(p=>!p.weightEstimated&&pickupAvgKg(p)).length;const parts=[];if(nGrid>0)parts.push(`${nGrid} check-day${nGrid===1?'':'s'}`);if(nCustom>0)parts.push(`${nCustom} extra reading${nCustom===1?'':'s'}`);if(nPickups>0)parts.push(`${nPickups} pickup weight${nPickups===1?'':'s'}`);sourceNote=`Based on ${parts.join(', ')||'chick weight only'}.`;}
  else if(last){const gain=observedDailyGain(shed);sourceNote=gain!=null?`Based on pickup weights — observed gain of ${(gain*1000).toFixed(1)} g/day.`:`Based on pickup weights.`;}
  else if(TARGET_DAYS.some(d=>shed.targetCurve&&shed.targetCurve[d]>0)||(shed.inYardSamples||[]).length>0){sourceNote=`Based on your shed scale readings.`;}
  else sourceNote=`No readings yet — showing the standard growth curve.`;
  const hasAnyPredicted=effective.some(p=>p.__source==='predicted');
  if(hasAnyPredicted)sourceNote+=` <strong style="color:var(--secondary);">Planned pickups are included in this forecast.</strong>`;
  return `<div class="pickups-block" id="dailyPerf-${shed.id}" style="margin-top:14px;"><h4>📅 Daily Performance — Actual + AI Forecast <span style="font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted);font-size:11px;">· Day ${startDay}–${endDay} of cycle · ⭐ = check day · 📏 = weighed</span></h4><div class="forecast-table-wrap"><table class="pred-daily-table" style="min-width:820px;"><thead><tr><th>Date</th><th class="num">Age</th><th class="num">Live birds</th><th class="num">Weight (kg)</th><th class="num">Standard (kg)</th><th class="num">Days vs Standard</th></tr></thead><tbody>${rows.map(r=>{
    const cls=[r.isToday?'is-today':'',r.isWeekend?'is-weekend':'',r.hasPredicted?'predicted-pickup-row':'',(r.weightType==='gompertz'||r.weightType==='ai-pickup'||r.weightType==='ai-target'||r.weightType==='ross-scaled')?'is-forecast-row':''].filter(Boolean).join(' ');
    const todayTag=r.isToday?' · <span style="color:var(--secondary);font-weight:700;">Today</span>':'';
    const wkndTag=r.isWeekend?' <span class="weekend-pill">Weekend</span>':'';
    const pickupNote=r.pickupsBirds>0?` <span style="font-size:10px;color:${r.hasPredicted?'var(--secondary)':'var(--primary-dark)'};font-weight:700;">−${r.pickupsBirds.toLocaleString()}${r.hasPredicted?' (plan)':''}</span>`:'';
    const milestoneBadge=r.isMilestone?`<span class="milestone-pill" title="Check day">★ Day ${r.age}</span>`:'';
    let readingBadge='';
    if(r.gridVal!=null)readingBadge=`<span class="sample-pill" title="Shed scale reading: ${r.gridVal.toFixed(3)} kg">📏</span>`;
    else if(r.customOn)readingBadge=`<span class="sample-pill" title="${r.customOn.isOfficial?'Plant weight':'Shed scale'}: ${r.customOn.avgWeightKg.toFixed(3)} kg">📏</span>`;
    let weightCell='—';
    if(r.weight!=null){const bandStr=(r.band!=null&&r.weightType==='gompertz')?`<span class="conf-band">±${(r.band*100).toFixed(0)}%</span>`:'';if(r.weightType==='gompertz')weightCell=`<span class="w-forecast">${r.weight.toFixed(3)}</span>${bandStr}<span class="w-pill gompertz">AI curve</span>`;else if(r.weightType==='ross-scaled')weightCell=`<span class="w-forecast">${r.weight.toFixed(3)}</span><span class="w-pill forecast">Adjusted</span>`;else if(r.weightType==='ai-pickup')weightCell=`<span class="w-forecast">${r.weight.toFixed(3)}</span><span class="w-pill forecast">From pickup</span>`;else if(r.weightType==='ai-target')weightCell=`<span class="w-forecast">${r.weight.toFixed(3)}</span><span class="w-pill ai-target">From targets</span>`;else if(r.weightType==='standard')weightCell=`<span class="w-forecast">${r.weight.toFixed(3)}</span><span class="w-pill standard">Standard</span>`;}
    // Pickup day: show the kill-sheet weight (or its estimate) instead of the curve — display only
    const lp=(shed.pickups||[]).find(p=>p.date&&iso(p.date)===iso(r.date)&&pickupAvgKg(p)>0);
    let dv=r.daysVar;
    if(lp){const avg=pickupAvgKg(lp);
      weightCell=lp.weightEstimated?`<span class="w-forecast">${avg.toFixed(3)}</span><span class="w-pill est" title="Estimated from your latest kill-sheet weight — enter the real weight when it arrives">Est</span>`
        :`<span class="w-actual">${avg.toFixed(3)}</span><span class="w-pill actual" title="Kill-sheet weight${r.weight!=null?` · AI curve ${r.weight.toFixed(3)}`:''}">Kill sheet</span>`;
      if(r.age>0)dv=daysVsTarget(r.age,avg);}
    let daysCell='—';let daysCls='';
    if(dv!=null){const v=dv;r={...r,daysVar:v};}
    if(r.daysVar!=null){if(Math.abs(r.daysVar)<0.1){daysCell='On target';daysCls='days-neu';}else if(r.daysVar>0){daysCell=`${r.daysVar.toFixed(1)}d ahead`;daysCls='days-pos';}else{daysCell=`${Math.abs(r.daysVar).toFixed(1)}d behind`;daysCls='days-neg';}}
    const stdCell=r.age>0?r.standard.toFixed(3):'—';
    return `<tr class="${cls}"><td>${fmtShort(r.date)}${todayTag}${wkndTag}${readingBadge}</td><td class="num">${r.age}d${milestoneBadge}</td><td class="num">${r.live.toLocaleString()}${pickupNote}</td><td class="num">${weightCell}</td><td class="num" style="color:var(--muted);">${stdCell}</td><td class="num ${daysCls}">${daysCell}</td></tr>`;
  }).join('')}</tbody></table></div><div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.5;">${sourceNote}</div></div>`;
}
function renderDaysBehind(shed){
  const today=dateOnly(new Date());
  const currentAge=ageInDays(shed,today);
  if(currentAge<=0)return '';
  const f=forecastWeightModeAware(shed,today);
  if(!f||f.kg==null)return '';
  const currentWeight=f.kg;const band=f.band||null;const daysVar=daysVsTarget(currentAge,currentWeight);
  let status,cls,icon;
  if(daysVar==null||Math.abs(daysVar)<0.5){status='On Target';cls='on-track';icon='✅';}
  else if(daysVar>0){status='Ahead of Standard';cls='ahead';icon='🟢';}
  else if(daysVar>=-3){status='Slightly Behind';cls='behind';icon='🟡';}
  else{status='Significantly Behind';cls='behind-major';icon='🔴';}
  let daysText;
  if(daysVar==null||Math.abs(daysVar)<0.1)daysText='Matching the standard growth curve';
  else if(daysVar>0)daysText=`${daysVar.toFixed(1)} day${Math.abs(daysVar-1)<0.05?'':'s'} ahead of the standard`;
  else daysText=`${Math.abs(daysVar).toFixed(1)} day${Math.abs(daysVar-1)<0.05?'':'s'} behind the standard`;
  const bandStr=band!=null?` <span style="color:var(--muted);font-weight:500;">(±${(band*100).toFixed(0)}% margin)</span>`:'';
  return `<div class="pred-days-behind ${cls}"><span class="dbi-lbl">📏 vs standard growth</span><span class="dbi-val">${icon} ${status}</span><span class="dbi-note"><strong>${daysText}</strong> · Currently <strong>${currentWeight.toFixed(3)} kg</strong>${bandStr} at day <strong>${currentAge}</strong></span></div>`;
}
function pickupPlanPillHtml(shed){
  if(!shed)return '';
  const hasRealFinal=(shed.pickups||[]).some(p=>p.isFinal);
  if(hasRealFinal)return `<button class="pickup-plan-pill complete" data-goto-predcard="${shed.id}" type="button" title="Jump to Predictions for Shed ${shed.id}">✅ Batch complete</button>`;
  const realDates=new Set((shed.pickups||[]).map(p=>iso(p.date)));
  const activePredicted=(shed.predictedPickups||[]).filter(pp=>!realDates.has(iso(pp.date)));
  if(activePredicted.length>0)return `<button class="pickup-plan-pill planned" data-goto-predcard="${shed.id}" type="button" title="Jump to Predictions for Shed ${shed.id}">🎯 ${activePredicted.length} planned</button>`;
  return '';
}
function renderPickupPlanBlock(shed){
  const pps=(shed.predictedPickups||[]).slice().sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  const realDates=new Set((shed.pickups||[]).map(p=>iso(p.date)));
  const realPickups=(shed.pickups||[]);
  const hasRealFinal=realPickups.some(p=>p.isFinal);
  const ds=getShedDensitySettings(shed);
  const useGlobalDensity=ds.useGlobal!==false;
  const targetN=ds.targetPickups;
  const realCount=realPickups.length;
  const activePps=pps.filter(pp=>!realDates.has(iso(pp.date)));
  let simList=[...realPickups.map(p=>({date:p.date,birds:Number(p.birds)||0}))];
  const rows=[];
  for(const pp of pps){
    const isSuperseded=realDates.has(iso(pp.date));
    const dateObj=pp.date;
    const age=ageInDays(shed,dateObj);
    const weight=(forecastWeightModeAware(shed,dateObj).kg)||0;
    const beforeBirds=Math.max(0,(shed.initialPopulation||0)-Number(shed.mortality||0)-simList.filter(x=>dateOnly(x.date)<dateOnly(dateObj)).reduce((s,x)=>s+(Number(x.birds)||0),0));
    const densityBefore=(beforeBirds*weight)/FIXED_FLOOR_AREA_M2;
    const afterBirds=Math.max(0,beforeBirds-(Number(pp.birds)||0));
    const densityAfter=(afterBirds*weight)/FIXED_FLOOR_AREA_M2;
    rows.push({pp,age,weight,beforeBirds,afterBirds,densityBefore,densityAfter,isSuperseded});
    if(!isSuperseded)simList.push({date:pp.date,birds:Number(pp.birds)||0});
  }
  simList.sort((a,b)=>dateOnly(a.date)-dateOnly(b.date));
  const predictedCount=pps.length;
  const totalPlannedCount=realCount+predictedCount;
  let progressHtml='';
  if(hasRealFinal)progressHtml=`<span class="progress-done">✅ Batch complete — cleanout recorded</span>`;
  else if(totalPlannedCount>=targetN&&predictedCount>0)progressHtml=`<span class="progress-ok">✅ Plan complete — ${realCount} real + ${predictedCount} planned = ${totalPlannedCount}/${targetN}</span>`;
  else if(totalPlannedCount>=targetN)progressHtml=`<span class="progress-ok">✅ Target reached — ${realCount} real pickups</span>`;
  else progressHtml=`<span class="progress-short">⚠️ ${realCount} real + ${predictedCount} planned = ${totalPlannedCount}/${targetN} — ${targetN-totalPlannedCount} more needed</span>`;

  // Background auto plan (projection only) — shown faintly, adoptable
  const autos=hasRealFinal?[]:autoPlanForShed(shed);
  const autoHtml=autos.length?`<div class="pp-auto"><div class="pp-auto-head"><span>🤖 Auto plan <small>used only for the projection · follows your density rules</small></span><button type="button" class="pp-adopt" data-pp-adopt-auto="${shed.id}" title="Add these to your planned pickups (they will then also change the feed forecast)">Use as my plan</button></div>${autos.map(a=>`<div class="pp-row pp-auto-row${a.isFinal?' pp-final':''}"><div class="pp-info"><div class="pp-date">${fmtShort(a.date)} · Day ${ageInDays(shed,a.date)} <span class="pp-badge auto">AUTO</span>${a.isFinal?'<span class="pp-badge final">FINAL CLEANOUT</span>':''}</div><div class="pp-meta">Remove <strong>${(Number(a.birds)||0).toLocaleString()}</strong> birds</div></div></div>`).join('')}</div>`:'';
  const targetInputHtml=`<div class="pp-target-row"><span class="pp-target-label">🎯 Target pickups for this shed</span><input type="number" class="pp-target-input" min="${MIN_PICKUPS_PER_SHED}" max="${MAX_PICKUPS_PER_SHED}" step="1" value="${targetN}" data-shed-target-pickups="${shed.id}" title="Total pickups including the final cleanout" /><span class="pp-target-hint">${MIN_PICKUPS_PER_SHED} or ${MAX_PICKUPS_PER_SHED} (includes the final cleanout)</span></div>`;
  const densityOverrideHtml=`<div class="shed-density-override"><label><input type="checkbox" data-density-use-global="${shed.id}" ${useGlobalDensity?'checked':''} /> Use global density settings</label>${!useGlobalDensity?`<span class="ovr-inputs"><span>Trigger</span><input type="number" min="20" max="45" step="0.5" value="${ds.triggerDensity}" data-density-override="${shed.id}|triggerDensity" /><span>Target</span><input type="number" min="15" max="35" step="0.5" value="${ds.targetDensity}" data-density-override="${shed.id}|targetDensity" /><span>Max</span><input type="number" min="28" max="45" step="0.5" value="${ds.maxDensity}" data-density-override="${shed.id}|maxDensity" /></span>`:''}</div>`;
if(hasRealFinal)return `<div class="pickup-plan-block"><h4><span>🎯 Predicted Pickups <span class="pp-count-badge">${realCount} of ${targetN}</span></span><span style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn-pp-clear" data-pp-clear="${shed.id}" type="button" title="Remove any leftover predicted pickups">🗑️ Clear</button></span></h4><div class="pp-empty" style="background:linear-gradient(135deg,rgba(76,122,59,0.10),rgba(76,122,59,0.04));border-color:var(--success);color:var(--success);font-weight:600;">✅ Target reached — a cleanout pickup is already recorded for this shed.<br>No predicted pickups needed.</div><div class="pp-summary" style="margin-top:10px;"><div>${progressHtml}</div><div><span class="lbl">Real pickups on record:</span> <strong>${realCount}</strong></div></div>${targetInputHtml}${densityOverrideHtml}</div>`;
  if(pps.length===0)return `<div class="pickup-plan-block"><h4><span>🎯 Predicted Pickups <span class="pp-count-badge">${realCount} of ${targetN}</span></span></h4><div class="pp-empty">Plan hypothetical pickups to see how the whole-batch forecast changes. The last pickup is the <strong>final cleanout</strong> and sits on the shed's cleanout date. Regular predicted pickups trigger when density reaches <strong>${ds.triggerDensity} kg/m²</strong> and bring it back to <strong>${ds.targetDensity} kg/m²</strong>.</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn-pp-add" data-pp-add="${shed.id}" type="button">＋ Add Predicted Pickup</button><button class="btn-pp-autofill" data-pp-autofill="${shed.id}" type="button" title="Auto-generate the optimal pickup plan">✨ Auto-fill Plan</button></div>${autoHtml}<div class="pp-summary" style="margin-top:10px;"><div>${progressHtml}</div></div>${targetInputHtml}${densityOverrideHtml}</div>`;
  const totalActiveRemoval=activePps.reduce((s,pp)=>s+(Number(pp.birds)||0),0);
  const atTarget=(realCount+predictedCount)>=targetN;
  return `<div class="pickup-plan-block"><h4><span>🎯 Predicted Pickups <span class="pp-count-badge">${realCount + predictedCount} of ${targetN}</span></span><span style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn-pp-autofill" data-pp-autofill="${shed.id}" type="button" title="Auto-generate the optimal pickup plan">✨ Auto-fill</button><button class="btn-pp-add" data-pp-add="${shed.id}" type="button" ${atTarget?'disabled':''} title="${atTarget?'Target of '+targetN+' already reached':'Add a predicted pickup'}">＋ Add</button><button class="btn-pp-clear" data-pp-clear="${shed.id}" type="button" title="Remove all predicted pickups for this shed">🗑️ Clear</button>${bulkToolbar('pp:'+shed.id,pps.map(x=>String(x.id)),'planned')}</span></h4><div class="pp-list">${rows.map(r=>{const classes=['pp-row'];if(bulkActive('pp:'+shed.id))classes.push('bulk-on');if(r.isSuperseded)classes.push('pp-superseded');if(r.pp.isFinal)classes.push('pp-final');const badges=[];if(r.isSuperseded)badges.push('<span class="pp-badge">Replaced by actual</span>');if(r.pp.isFinal)badges.push('<span class="pp-badge final">FINAL CLEANOUT</span>');const badgeHtml=badges.join('');return `<div class="${classes.join(' ')}">${bulkCheckbox('pp:'+shed.id,String(r.pp.id),fmtShort(r.pp.date))}<div class="pp-info"><div class="pp-date">${fmtShort(r.pp.date)} · Day ${r.age} ${badgeHtml}</div><div class="pp-meta">Remove <strong>${(Number(r.pp.birds)||0).toLocaleString()}</strong> birds · Density ${r.densityBefore.toFixed(1)} → ${r.densityAfter.toFixed(1)} kg/m²</div></div><div class="pp-actions"><button type="button" data-pp-edit="${shed.id}|${r.pp.id}" title="Edit">✎</button><button type="button" class="danger" data-pp-delete="${shed.id}|${r.pp.id}" title="Delete">✕</button></div></div>`;}).join('')}</div>${autoHtml}<div class="pp-summary"><div>${progressHtml}</div><div><span class="lbl">Total planned removal:</span> <strong>${totalActiveRemoval.toLocaleString()}</strong> birds</div></div>${targetInputHtml}${densityOverrideHtml}</div>`;
}
// Clean-out outlook for a shed: the clean-out date, else its last pickup
// (logged or planned). Birds present that morning × growth-forecast weight
// (same forecast as the planned-pickup rows). Used by the Predictions
// snapshot card and the Dashboard Clean-out card.
function shedCleanoutInfo(shed,today){return withResultPlan(()=>shedCleanoutInfoInner(shed,today));}
// Built on the SAME per-shed prediction as the projection (logged + your
// planned + auto-planned pickups): the last pickup (clean-out) and the
// shed's whole-batch total live weight across ALL pickups.
function shedCleanoutInfoInner(shed,today){
  if(!shed||!shed.placementDate)return null;
  today=dateOnly(today||new Date());
  const g=Math.ceil(shed.id/2);
  const pred=computePredictionsInner(shed,g);
  const det=(pred.pickupDetails||[]).slice().sort((x,y)=>dateOnly(x.date)-dateOnly(y.date));
  const pickedBirds=det.reduce((n,p)=>n+(Number(p.birds)||0),0);
  const remaining=Math.max(0,Math.round((pred.estFinalLive||0)-pickedBirds));
  const lastDet=det.length?det[det.length-1]:null;
  // Last pickup: the final clean-out pickup, or (if none) the birds left at the end
  let endDate,endSrc,finalBirds,finalKg;
  if(remaining>0||!lastDet){
    endDate=shed.cleanoutDate?dateOnly(shed.cleanoutDate):(lastDet?dateOnly(lastDet.date):null);
    endSrc=shed.cleanoutDate?'clean-out date':'last pickup';
    finalBirds=remaining;finalKg=pred.estFinalALW||0;
  }else{
    endDate=shed.cleanoutDate?dateOnly(shed.cleanoutDate):dateOnly(lastDet.date);
    endSrc=shed.cleanoutDate?'clean-out date':(lastDet.isAuto?'last auto-planned pickup':lastDet.isPredicted?'last planned pickup':'last logged pickup');
    finalBirds=Number(lastDet.birds)||0;finalKg=Number(lastDet.avgWeightKg)||0;
  }
  if(!endDate)return null;
  const birdsAll=pickedBirds+remaining;
  const totalKgAll=Number(pred.totalWeightKg)||0;
  const fw=forecastWeightModeAware(shed,endDate);
  const bandPct=fw&&fw.band?Math.round(fw.band*100):null;
  return {endDate,endSrc,cleanAge:daysBetween(shed.placementDate,endDate),daysToEnd:daysBetween(today,endDate),
    finalBirds,finalKg,bandPct,birdsAll,totalKgAll,avgAll:birdsAll>0?totalKgAll/birdsAll:0,pickupCount:det.length+(remaining>0?1:0)};
}
function renderPredictionsShedCard(shed,group,part){
  const pred=computePredictions(shed,group);
  const grp=computeGroupPredictions(group);
  const groupSheds=shedsForGroup(group);
  const groupHasData=groupSheds.some(s=>(s.pickups||[]).length>0)||groupSheds.some(s=>(s.inYardSamples||[]).length>0)||groupSheds.some(s=>TARGET_DAYS.some(d=>s.targetCurve&&s.targetCurve[d]>0));
  const groupConf=confidenceLabel(grp&&grp.hasData?grp.confidence:pred.confidence);
  const pickups=pred.pickupDetails;
  const today=dateOnly(new Date());
  const fToday=forecastWeightModeAware(shed,today);
  const forecastKg=fToday&&fToday.kg?fToday.kg:0;
  const densityKg=pred.liveNow*forecastKg;
  const densityVal=densityKg/FIXED_FLOOR_AREA_M2;
  const densityDisplay=pred.liveNow===0?'0.0':densityVal.toFixed(1);
  const dsCurrent=getShedDensitySettings(shed);
  const densityTone=densityVal>dsCurrent.maxDensity?'red':(densityVal>dsCurrent.triggerDensity?'amber':'');
  const densityStyle=densityTone==='red'?'color:var(--danger);':(densityTone==='amber'?'color:var(--primary-dark);':'');
  const currentMortRate=pred.initialPop>0?((pred.currentMort/pred.initialPop)*100).toFixed(2):'0.00';
  // ── Clean-out card (shared calculation: shedCleanoutInfo)
  const co=shedCleanoutInfo(shed,today);
  let cleanoutCardHtml;
  if(co){
    const {endDate,endSrc,cleanAge,daysToEnd,finalBirds,finalKg,bandPct,totalKgAll,birdsAll,avgAll,pickupCount}=co;
    const whenTxt=daysToEnd>0?`in ${daysToEnd} day${daysToEnd===1?'':'s'}`:daysToEnd===0?'today':`${-daysToEnd} day${daysToEnd===-1?'':'s'} ago`;
    cleanoutCardHtml=`<div class="pred-snap-item pred-cleanout" title="Based on the ${endSrc}">
      <div class="pco-head"><span class="lbl">🧹 Clean-out</span><span class="pco-src">${endSrc==='clean-out date'?'':`from the ${endSrc}`}</span></div>
      <div class="pco-grid">
        <div><div class="pco-k">Date</div><div class="pco-v">${fmtShortNoYear(endDate)}</div><div class="pco-s">${whenTxt}</div></div>
        <div><div class="pco-k">Bird age</div><div class="pco-v">${cleanAge}d</div><div class="pco-s">at clean-out</div></div>
        <div><div class="pco-k">Last pickup weight</div><div class="pco-v">${finalKg?finalKg.toFixed(3):'—'} <small>kg</small></div><div class="pco-s">${finalBirds.toLocaleString()} birds${bandPct?` · ±${bandPct}%`:''}</div></div>
        <div><div class="pco-k">Total live weight</div><div class="pco-v">${Math.round(totalKgAll).toLocaleString()} <small>kg</small></div><div class="pco-s">all ${pickupCount} pickups · avg ${avgAll?avgAll.toFixed(3):'—'} kg</div></div>
      </div>
    </div>`;
  }else{
    cleanoutCardHtml=`<div class="pred-snap-item pred-cleanout empty"><div class="pco-head"><span class="lbl">🧹 Clean-out</span></div><div class="pco-s">No clean-out date or pickups planned yet — add them to see age, weight and total live weight at clean-out.</div></div>`;
  }
  const snapshotHtml=`<div class="pred-snapshot"><div class="pred-snap-item"><div class="lbl">🐥 Birds placed</div><div class="val">${pred.initialPop.toLocaleString()}</div></div><div class="pred-snap-item"><div class="lbl">📆 Current age</div><div class="val">${pred.currentAge}d</div></div><div class="pred-snap-item"><div class="lbl">⚠️ Mortality</div><div class="val"><input type="number" class="snapshot-mort-input" min="0" step="1" value="${Math.max(0,Number(shed.mortality)||0)}" data-shed="${shed.id-1}" data-field="mortality" id="snapshotMortP_${shed.id}" title="Edit actual mortality count for this shed" /></div><div class="sub">${currentMortRate}% of placed</div></div><div class="pred-snap-item"><div class="lbl">🐔 Live birds</div><div class="val">${pred.liveNow.toLocaleString()}</div></div><div class="pred-snap-item"><div class="lbl">🔄 Pickups done</div><div class="val">${(shed.pickups||[]).length} of ${dsCurrent.targetPickups}</div></div><div class="pred-snap-item"><div class="lbl">📐 Density today</div><div class="val" style="${densityStyle}">${densityDisplay} <span style="font-size:11px;font-weight:600;color:var(--muted);">kg/m²</span></div><div class="sub">${pred.liveNow.toLocaleString()} × ${forecastKg.toFixed(3)} kg ÷ 3,162 m²</div></div>${cleanoutCardHtml}</div>`;
  const ratePct=shedMortRate(shed);
  const rateBarHtml=`<div class="mort-rate-bar"><span class="mr-label">🩺 Daily mortality rate</span><input type="range" id="mortRateSlider_${shed.id}" min="0" max="1" step="0.01" value="${ratePct}" data-mortrate-shed="${shed.id}" /><input type="number" id="mortRateNum_${shed.id}" min="0" max="${MAX_MORT_RATE_PCT}" step="0.01" value="${ratePct.toFixed(2)}" data-mortrate-shed="${shed.id}" /><span class="mr-unit">% of live birds / day</span></div>`;
  const curvePanelHtml=renderInYardCurvePanel(shed);
  const planBlockHtml=renderPickupPlanBlock(shed);
  const pickupRows=pickups.filter(p=>!p.isPredicted).map(p=>{
    const stored=(shed.pickups||[]).find(x=>iso(x.date)===iso(p.date))||{};
    const isManualWeight=!!stored.totalWeightKgManual;
    const hasExcelFrom=stored.totalWeightKgFromExcel!=null;
    const isManualSource=stored.source==='manual';
    // Whole kg / 3 decimals on screen (estimated kill-sheet weights are birds × an average)
    const totalValue=(stored.totalWeightKg!=null)?Math.round(stored.totalWeightKg):'';
    const warn=totalValue&&(totalValue<100||totalValue>40000);
    const avgRaw=(stored.totalWeightKg!=null&&stored.birds>0)?(stored.totalWeightKg/stored.birds):null;
    const avgInputVal=(avgRaw!=null)?Number(avgRaw.toFixed(3)):'';
    const avgWarn=(avgRaw!=null)&&(avgRaw<0.3||avgRaw>5);
    const estAvg=p.avgWeightKg?p.avgWeightKg.toFixed(3):'';
    const avgPlaceholder=(avgRaw==null&&estAvg)?estAvg:'kg/bird';
    const ageBadge=stored.ageOverride!=null?' *':'';
    const sourceBadge=(isManualSource?`<span class="tag manual-source" style="font-size:9px;padding:1px 6px;margin-left:6px;">Manual</span>`:'')
      +(stored.weightEstimated?`<span class="est-chip" style="margin-left:6px;" title="Weight is the growth-curve estimate — enter the kill-sheet weight when it arrives. Not used as a real weighing.">est. weight</span>`:'');
    const showRevert=isManualWeight&&hasExcelFrom;
    const pkCb=bulkActive('pk:'+shed.id)?`<td class="bulk-cell">${bulkCheckbox('pk:'+shed.id,iso(p.date),fmtShort(p.date))}</td>`:'';
    return `<tr class="${p.isFinal?'is-final':''}">${pkCb}<td>${fmtShort(p.date)}${sourceBadge}</td><td class="num" title="${stored.ageOverride!=null?'Age manually set':'Age derived from placement date'}">${p.age}d${ageBadge}</td><td class="num"><input class="pred-pickup-input pk-birds" type="number" step="1" min="1" inputmode="numeric" value="${Number(stored.birds)||''}" data-pickup-shed="${shed.id}" data-pickup-date="${iso(p.date)}" data-pickup-field="birds" title="Birds picked up — the kill-sheet total stays, the average updates" /></td><td class="num"><input class="pred-pickup-input ${isManualWeight?'manual':''} ${warn?'warn':''}" type="number" step="1" min="0" value="${totalValue}" placeholder="${p.isEstWeight?'Standard est.':'total kg'}" data-pickup-shed="${shed.id}" data-pickup-date="${iso(p.date)}" data-pickup-field="total" title="${isManualWeight?'Manually edited':(p.isEstWeight?'No Excel weight — using standard curve estimate':'From Excel')}" /></td><td class="num"><input class="pred-pickup-input avg-input ${isManualWeight?'manual':''} ${avgWarn?'warn':''}" type="number" step="0.001" min="0" value="${avgInputVal}" placeholder="${avgPlaceholder}" data-pickup-shed="${shed.id}" data-pickup-date="${iso(p.date)}" data-pickup-field="avg" title="Average weight (kg/bird)" /></td><td style="text-align:right;"><div class="pickup-actions"><button class="pickup-actions-btn" type="button" data-pickup-actions-btn="${shed.id}|${iso(p.date)}" aria-label="Pickup actions">⋯</button><div class="pickup-actions-menu"><button type="button" data-pickup-edit="${shed.id}|${iso(p.date)}">✎ Edit pickup</button>${showRevert?`<button type="button" data-pickup-revert="${shed.id}|${iso(p.date)}">↺ Revert weight to Excel</button>`:''}<button type="button" class="danger" data-pickup-delete="${shed.id}|${iso(p.date)}">✕ Delete pickup</button></div></div></td></tr>`;
  }).join('');
  const realPickupCount=(shed.pickups||[]).length;
  const pickupTableHtml=realPickupCount===0?`<div class="forecast-empty">No pickups yet — estimates unlock after the first pickup.</div>`:`<div class="pickups-scroll"><table class="pickups-table" style="font-size:12.5px;min-width:560px;"><thead><tr>${bulkActive('pk:'+shed.id)?'<th class="bulk-cell"></th>':''}<th>Date</th><th class="num">Age</th><th class="num">Birds</th><th class="num">Total wt (kg)</th><th class="num">Avg wt (kg/bird)</th><th style="width:44px;text-align:right;">Actions</th></tr></thead><tbody>${pickupRows}</tbody></table></div>`;
  const canAdd=realPickupCount<MAX_PICKUPS_PER_SHED;
  const pill=pickupPlanPillHtml(shed);
  const pickupHeaderHtml=`<h4 class="pickup-header"><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span>Pickup History — edit birds, total or avg inline</span>${pill}</span><span style="display:inline-flex;gap:6px;flex-wrap:wrap;align-items:center;">${bulkToolbar('pk:'+shed.id,(shed.pickups||[]).map(x=>iso(x.date)),'logged')}<button class="btn-pickup-add" data-pickup-add="${shed.id}" type="button" ${canAdd?'':'disabled'} title="${canAdd?'Add a pickup manually':'Maximum 5 pickups reached'}">＋ Add Actual Pickup</button></span></h4>`;
  const groupLabel=grp&&grp.hasData?`${pairLabel(group)} combined result`:`${pairLabel(group)} result`;
  const groupShedsLabel=groupSheds.map(s=>`Shed ${s.id}`).join(' + ');
  const estimatesHtml=(groupHasData&&grp&&grp.hasData)?`<div class="pred-estimates-head"><span>📊 ${groupLabel}</span><span class="sub">· ${groupShedsLabel} · batch result</span></div><div class="pred-estimates"><div class="pred-est-tile amber"><div class="lbl">Est. Final Avg Weight</div><div class="val">${grp.avgWeight.toFixed(3)} <span style="font-size:12px;font-weight:600;color:var(--muted);">kg</span></div></div><div class="pred-est-tile"><div class="lbl">Est. Final FCR</div><div class="val">${grp.fcr.toFixed(3)}</div></div><div class="pred-est-tile green"><div class="lbl">Est. cFCR (Baiada)</div><div class="val">${grp.cfcr.toFixed(3)}</div></div><div class="pred-est-tile green"><div class="lbl">Est. cFCR (Industry)</div><div class="val">${grp.cfcrInd.toFixed(3)}</div></div><div class="pred-est-tile"><div class="lbl">Est. Avg Age</div><div class="val">${grp.weightedAge.toFixed(1)} d</div></div><div class="pred-est-tile"><div class="lbl">Est. CAge 2.45</div><div class="val">${grp.cage?grp.cage.toFixed(1)+' d':'—'}</div></div><div class="pred-est-tile green"><div class="lbl">Est. Livability</div><div class="val">${grp.livability.toFixed(2)}%</div></div><div class="pred-est-tile"><div class="lbl">Est. Mortality</div><div class="val">${grp.totalMortalityEst.toLocaleString()}</div></div><div class="pred-est-tile"><div class="lbl">Est. Total Live Wt</div><div class="val">${fmtMass(grp.totalLiveWeight)}</div></div><div class="pred-est-tile amber" style="grid-column: span 2;"><div class="lbl">Est. Final PIF</div><div class="val">${grp.pif.toFixed(2)}</div><div style="font-size:10px;color:var(--muted);margin-top:2px;">Livability × ALW ÷ (avg age × FCR) × 100</div></div></div>`:`<div class="pred-empty" style="margin-top:14px;"><strong>Pair estimates unlock after the first reading or pickup.</strong><br>Enter shed scale readings at Day 7/14/21/28, or import Excel with pickup data.</div>`;
  const confidenceHtml=(groupHasData&&grp&&grp.hasData)?`<div class="pred-confidence"><span style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);">Pair confidence</span><div class="bar"><div class="bar-fill ${groupConf.cls}" style="width:${grp.confidence}%"></div></div><span class="pct" style="color:${groupConf.cls==='low'?'var(--danger)':(groupConf.cls==='medium'?'var(--primary-dark)':'var(--success)')};">${grp.confidence}%</span><span style="font-size:11px;color:var(--muted);">${groupConf.label}</span></div>`:'';
  const daysBehindHtml=renderDaysBehind(shed);
  const dailyPerfHtml=renderDailyPerformance(shed);
  if(part){
    const head=`<div class="pred-shed-head"><h3>Shed ${shed.id}</h3><div style="display:flex;gap:6px;flex-wrap:wrap;"><span class="tag muted">Age ${pred.currentAge}d</span><span class="tag amber">Live ${pred.liveNow.toLocaleString()}</span></div></div>`;
    const body=part==='growth'?`${curvePanelHtml}${daysBehindHtml}${forecastDayBarHtml()}${dailyPerfHtml}`
      :part==='pickups'?`<div class="pickups-block">${pickupHeaderHtml}${pickupTableHtml}</div>${planBlockHtml}`
      :`${shedSetupHtml(shed)}${rateBarHtml}`;
    return `<article class="pred-shed-card" id="pred-shed-card-${shed.id}">${head}<div class="pred-shed-body">${body}</div></article>`;
  }
  return `<article class="pred-shed-card" id="pred-shed-card-${shed.id}"><div class="pred-shed-head"><h3>🏠 Shed ${shed.id}</h3><div style="display:flex;gap:6px;flex-wrap:wrap;"><span class="tag muted">Age ${pred.currentAge}d</span><span class="tag amber">Live ${pred.liveNow.toLocaleString()}</span>${pred.gompertzFit?`<span class="tag green">AI curve</span>`:''}${realPickupCount>0?`<span class="tag green">${realPickupCount} pickup${realPickupCount===1?'':'s'}</span>`:''}</div></div><div class="pred-shed-body">${snapshotHtml}${rateBarHtml}${curvePanelHtml}${daysBehindHtml}${forecastDayBarHtml()}${dailyPerfHtml}<div class="pickups-block" style="margin-top:14px;">${pickupHeaderHtml}${pickupTableHtml}</div>${planBlockHtml}${estimatesHtml}${confidenceHtml}</div></article>`;
}
function closeAllPickupActionsMenus(exceptWrap){document.querySelectorAll('.pickup-actions.open').forEach(el=>{if(el!==exceptWrap)el.classList.remove('open');});}
function openPickupActionsMenu(wrap){
  closeAllPickupActionsMenus(wrap);wrap.classList.add('open');
  const btn=wrap.querySelector('.pickup-actions-btn');const menu=wrap.querySelector('.pickup-actions-menu');if(!btn||!menu)return;
  const r=btn.getBoundingClientRect();const mr=menu.getBoundingClientRect();const vh=window.innerHeight;const vw=window.innerWidth;
  let top=r.bottom+4;
  if(top+mr.height>vh-8){const altTop=r.top-mr.height-4;if(altTop>=8)top=altTop;else top=Math.max(8,vh-mr.height-8);}
  let left=r.right-mr.width;if(left<8)left=8;if(left+mr.width>vw-8)left=vw-mr.width-8;
  menu.style.top=top+'px';menu.style.left=left+'px';
}

/* ---------- DOMContentLoaded ---------- */

// Floating shed-pair switcher for phones and tablets (Sheds and Predict pages).
// Tap to expand upwards: Sheds 1–2 … 7–8, plus Adjustments.
let groupDockOpen=false;
function groupDockHtml(g,ctx){
  const item=gi=>`<button type="button" class="gdock-item${gi===g?' active':''}" ${ctx==='pred'?`data-predgroup="${gi}"`:`data-tab="g${gi}"`} data-label="${escapeAttr(pairLabel(gi))}"><span>${pairShort(gi)}</span></button>`;
  return `<div class="gdock${groupDockOpen?' open':''}" id="gdock"><div class="gdock-scrim" data-gdock-close></div>
    <div class="gdock-items">${[1,2,3,4].map(item).join('')}
      <button type="button" class="gdock-item gdock-adj" data-toggle-adjustments="1" data-label="Adjustments">${navIcon('gear')}</button>
    </div>
    <button type="button" class="gdock-toggle" id="gdockToggle" aria-expanded="${groupDockOpen}" aria-label="Change shed pair"><svg class="gdock-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg><span class="gdock-cur">${pairShort(g)}</span><small>${ctx==='pred'?'Predict':'Sheds'}</small></button>
  </div>`;
}

// Phones: the Sheds/Predict view bar as one button that expands upwards (bottom-left).
// Items are copies of the bar's own buttons, so the normal click handlers apply.
let viewDockOpen=false;
function viewDockHtml(rail){
  const btns=[...rail.querySelectorAll('.pred-rail-btn')];
  const active=btns.find(b=>b.classList.contains('active'))||btns[0];
  const item=b=>{const c=b.cloneNode(true);c.className='vdock-item'+(b===active?' active':'');c.removeAttribute('aria-pressed');const lbl=(b.querySelector('span')||b).textContent.trim();c.setAttribute('data-label',lbl);const sp=c.querySelector('span');if(sp)sp.remove();return c.outerHTML;};
  const actIcon=active?(active.querySelector('svg')||{}).outerHTML||'':'';
  const actLbl=active?(active.querySelector('span')||active).textContent.trim():'View';
  return `<div class="vdock${viewDockOpen?' open':''}" id="vdock"><div class="gdock-scrim" data-vdock-close></div>
    <div class="vdock-items">${btns.map(item).join('')}<button type="button" class="vdock-item vdock-adj" data-toggle-adjustments="1" data-label="Adjustments">${navIcon('gear')}</button></div>
    <button type="button" class="vdock-toggle" id="vdockToggle" aria-expanded="${viewDockOpen}" aria-label="Views and adjustments — now: ${escapeAttr(actLbl)}" title="Views and adjustments"><svg class="vd-open" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="7" r="2.2"/><circle cx="7" cy="17" r="2.2"/><circle cx="17" cy="17" r="2.2"/></svg><svg class="vd-close" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  </div>`;
}
