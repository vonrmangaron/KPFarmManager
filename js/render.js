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
    grid: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    home: '<path d="M3 10 12 4l9 6v10H3z"/><path d="M9 20v-6h6v6"/>',
    chart: '<path d="M3 20h18"/><path d="m4 16 5-5 4 3 7-8"/><path d="M15 6h5v5"/>',
    cluckwise: '<circle cx="11" cy="14" r="6"/><circle cx="14" cy="8" r="4"/><path d="m18 8 3 1-3 1"/>',
    loads: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    silo: '<path d="M6 4h12v11l-6 5-6-5z"/><path d="M6 9h12"/>',
    compare: '<path d="M8 3 4 7l4 4"/><path d="M4 7h11a5 5 0 0 1 5 5v1"/><path d="m16 21 4-4-4-4"/><path d="M20 17H9a5 5 0 0 1-5-5v-1"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
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
function sidebarHtml() {
  return NAV_ITEMS.map(item => {
    if (item.section) {
      return `<span class="sb-section-label">${escapeHtml(item.section)}</span>`;
    }
    if (item.modalBtnId) {
      const dot = item.modalBtnId === 'loadsBtn' ? '<span class="loads-dot" id="loadsDot"></span>' : '';
      return `<button class="sb-link" id="${escapeAttr(item.modalBtnId)}" type="button">
        ${navIcon(item.icon)}${escapeHtml(item.label)}${dot}
      </button>`;
    }
    const isActive = activeTab === item.id;
    const badge = item.badge && farmData
      ? (() => {
          const g = Number(item.id.replace('g',''));
          const sheds = shedsForGroup(g);
          const live = sheds.reduce((s,x) => s + liveAtStartOfDay(x, new Date()), 0);
          return live > 0 ? `<span class="sb-link-badge">${(live/1000).toFixed(0)}k</span>` : '';
        })()
      : '';
    const extIcon = item.external
      ? `<svg style="margin-left:auto;width:13px;height:13px;opacity:0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>`
      : '';
    const link = `<button class="sb-link${isActive?' active':''}" data-tab="${escapeAttr(item.id)}" type="button">
      ${navIcon(item.icon)}${escapeHtml(item.label)}${badge}${extIcon}
    </button>`;
    // Predictions expands to show Group 1–4 as sub-items once it's the active page,
    // so the group selector lives in the sidebar instead of cluttering the tab bar.
    if (item.id === 'predictions' && isActive && farmData) {
      const subnav = [1,2,3,4].map(gi => {
        const subActive = predState.predGroup === gi;
        return `<button class="sb-sub-link${subActive?' active':''}" data-predgroup="${gi}" type="button">Group ${gi}</button>`;
      }).join('');
      return link + `<div class="sb-subnav">${subnav}</div>`;
    }
    return link;
  }).join('');
}

// Mobile bottom nav (5 items max)
function mobileNavHtml() {
  const MOB = [
    { id: 'dashboard', label: 'Home',   icon: 'grid'  },
    { id: 'g1',        label: 'Groups', icon: 'home'  },
    { id: 'predictions',label: 'Predict',icon: 'chart'},
  ];
  const items = MOB.map(item => {
    const active = activeTab === item.id || (item.id === 'g1' && ['g1','g2','g3','g4'].includes(activeTab));
    return `<button class="mob-nav-btn${active?' active':''}" data-tab="${escapeAttr(item.id)}" type="button">
      <span class="mob-nav-pill">${navIcon(item.icon)}</span>${escapeHtml(item.label)}
    </button>`;
  });
  // Add loads + settings
  items.push(`<button class="mob-nav-btn" id="loadsBtnMob" type="button">
    <span class="mob-nav-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></span>Loads
  </button>`);
  items.push(`<button class="mob-nav-btn" id="settingsBtnMob" type="button">
    <span class="mob-nav-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></span>More
  </button>`);
  return `<div class="mob-nav-inner">${items.join('')}</div>`;
}

// ─────────────────────────────────────────────────────────────
// Sync status pill in sidebar
// ─────────────────────────────────────────────────────────────
function renderSyncPill() {
  const el = document.getElementById('sbSync');
  if (!el) return;
  if (!syncFarmName) {
    el.innerHTML = `<div class="sb-sync-row"><span class="sb-sync-dot"></span>Not connected</div>
      <div class="sb-sync-sub">Connect in Settings to sync</div>
      <button class="sb-sync-btn" id="sbConnectBtn" type="button">Connect farm</button>`;
    return;
  }
  const dotCls = syncState === 'error' ? 'error' : syncConnectedAt ? 'ok' : '';
  const stateLabel = syncState === 'pulling' ? 'Syncing…' : syncState === 'pushing' ? 'Saving…' : syncState === 'error' ? 'Sync error' : 'Cloud sync on';
  const sub = syncLastSyncAt ? `${escapeHtml(syncFarmName)} · ${fmtRelativeTime(syncLastSyncAt)}` : `${escapeHtml(syncFarmName)} · not yet synced`;
  el.innerHTML = `<div class="sb-sync-row"><span class="sb-sync-dot ${dotCls}"></span>${stateLabel}</div>
    <div class="sb-sync-sub">${sub}</div>
    <button class="sb-sync-btn" id="sbSyncNowBtn" type="button">Sync now</button>`;
}

// ─────────────────────────────────────────────────────────────
// Page header update helper
// ─────────────────────────────────────────────────────────────
function updatePageHeader() {
  const titleEl = document.getElementById('pageTitle');
  const subEl   = document.getElementById('pageSub');
  if (!titleEl) return;
  const tabLabels = { dashboard:'Dashboard', g1:'Group 1', g2:'Group 2', g3:'Group 3', g4:'Group 4', predictions:'Predictions' };
  titleEl.textContent = tabLabels[activeTab] || activeTab;
  if (subEl) {
    if (farmData) {
      const batch = predState.batchNumber || farmData.batchNumber || '';
      const farm  = syncFarmName ? `${syncFarmName} · ` : '';
      subEl.textContent = `${farm}${batch ? 'Batch ' + batch + ' · ' : ''}${SHED_COUNT} sheds across 4 groups`;
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
function currentShedWeightEstimate(shed, today) {
  const wp = weightedPickups(shed);
  if (wp.length) {
    const last = wp[wp.length - 1];
    return { kg: last.totalWeightKg / last.birds, isEstimate: false };
  }
  if (!shed.placementDate) return null;
  const age = daysBetween(shed.placementDate, today);
  const fit = getShedGompertzFit(shed);
  if (!fit) return null;
  const kg = gompertzWeightAt(fit, age);
  if (!kg) return null;
  return { kg, isEstimate: true };
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

function computeFarmAlerts() {
  if (!farmData) return [];
  const today = new Date();
  const allSheds = farmData.sheds || [];
  const alerts = [];
  if (notifPrefs.feedBalance) {
    [1,2,3,4].forEach(g => {
      // Walk the balance day-by-day through today's reading plus any
      // deliveries already scheduled in the future. This means a load
      // that's already been entered for tomorrow correctly postpones the
      // alert, instead of the old flat bal/dailyFeed maths which ignored
      // future loads entirely.
      const forecast = computeSiloForecast(g, { start: 0, end: 15 });
      if (!forecast.depletedDate) return;
      const days = Math.max(0, daysBetween(today, forecast.depletedDate));
      if (days < 3) {
        alerts.push({ kind: days < 1.5 ? 'error' : 'warn', msg: `<strong>Group ${g} silos</strong> — ${days} day${days===1?'':'s'} of feed remaining`, tab: 'g'+g });
      } else if (days <= 8) {
        // Not urgent by day-count alone, but if the depletion date itself
        // lands on a weekend, an emergency delivery is much harder to get —
        // worth flagging even when there'd otherwise be no alert yet.
        const dow = forecast.depletedDate.getDay();
        if (dow === 0 || dow === 6) {
          const dayName = dow === 0 ? 'Sunday' : 'Saturday';
          alerts.push({ kind: 'warn', msg: `<strong>Group ${g} silos</strong> — feed runs out ${dayName} (${days} day${days===1?'':'s'}), a weekend`, tab: 'g'+g });
        }
      }
    });
  }
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
        alerts.push({ kind: 'error', msg: `<strong>Shed ${shed.id}</strong> — ${Math.abs(daysVar).toFixed(1)} days behind Ross 308 standard`, tab: 'g'+g });
      }
    });
  }
  return alerts;
}

function renderAlertsPopoverBody() {
  const alerts = computeFarmAlerts();
  if (!alerts.length) return `<p style="font-size:13px;color:var(--muted);margin:0;padding:14px 16px">All systems normal — no alerts.</p>`;
  return `<div class="dash-alerts" style="padding:10px">${alerts.map(a =>
    `<button class="dash-alert dash-alert-${a.kind}" data-tab="${a.tab}" type="button" style="width:100%;text-align:left;border:none;cursor:pointer;font-family:inherit">
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
        <div class="dash-gs-head"><span class="dash-gs-name">Group ${g}</span><span class="dash-gs-sub">Sheds ${sheds.map(s=>s.id).join(' & ')}</span></div>
        <p class="dash-gs-empty-msg">Not placed yet</p>
      </div>`;
    }
    const age = Math.max(...placed.map(s => daysBetween(s.placementDate, today)));
    const live = sheds.reduce((s,sh) => s + liveAtStartOfDay(sh, today), 0);

    // Weighted avg weight + today-consistent FCR, scoped to this group
    let feedToDate = 0, weightNow = 0, alwCount = 0, alwSum = 0;
    sheds.forEach(shed => {
      if (!shed.placementDate) return;
      let d = dateOnly(shed.placementDate);
      while (d <= today) { feedToDate += shedFeedOn(shed, d); d = addDays(d, 1); }
      const est = currentShedWeightEstimate(shed, today);
      if (est) {
        const shedLive = liveAtStartOfDay(shed, today);
        weightNow += est.kg * shedLive;
        alwSum += est.kg; alwCount++;
      }
    });
    const avgWeight = alwCount > 0 ? alwSum / alwCount : null;
    const fcr = weightNow > 0 ? feedToDate / weightNow : null;

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
      <div class="dash-gs-head"><span class="dash-gs-name">Group ${g}</span><span class="dash-gs-sub">Sheds ${sheds.map(s=>s.id).join(' & ')}</span></div>
      <div class="dash-gs-row"><span class="dash-gs-lbl">Age</span><span class="dash-gs-val">D${age}</span></div>
      <div class="dash-gs-row"><span class="dash-gs-lbl">Live birds</span><span class="dash-gs-val">${live > 0 ? live.toLocaleString() : '—'}</span></div>
      <div class="dash-gs-row"><span class="dash-gs-lbl">Avg weight</span><span class="dash-gs-val">${avgWeight != null ? avgWeight.toFixed(2)+' kg' : '—'}</span></div>
      <div class="dash-gs-row"><span class="dash-gs-lbl">FCR</span><span class="dash-gs-val">${fcr != null ? fcr.toFixed(2) : '—'}</span></div>
      <div class="dash-gs-row"><span class="dash-gs-lbl">Feed left</span><span class="dash-gs-val">${feedDays != null ? feedDays.toFixed(1)+' days' : '—'}</span></div>
      <div class="dash-gs-foot">${cleanIn != null ? `Clean-out in ${cleanIn} day${cleanIn!==1?'s':''}` : 'No clean-out date set'}</div>
    </button>`;
  }).join('');
  return `<div class="dash-card">
    <div class="dash-card-head"><h2 class="dash-card-title">Group status</h2></div>
    <div class="dash-gs-grid">${tiles}</div>
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
  const nextCleanout= cleanouts.length ? new Date(Math.min(...cleanouts)) : null;
  const daysToClean = nextCleanout ? Math.max(0, daysBetween(today, nextCleanout)) : null;
  const batchTotal  = batchStart && nextCleanout ? daysBetween(batchStart, nextCleanout) : null;
  const batchPct    = (batchAge != null && batchTotal) ? Math.min(100, Math.round(batchAge / batchTotal * 100)) : 0;

  // ── Today-consistent farm FCR ──────────────────────────────
  // Feed consumed to date (cumulative) ÷ current total live weight.
  // Current weight comes from a real pickup weighing when one
  // exists, otherwise the same Gompertz-fit estimate (from in-yard
  // samples) the rest of the app already uses for predictions.
  let farmFeedToDate = 0, farmLiveWeightNow = 0, farmAvgAlwNow = 0, alwCount = 0, anyEstimated = false;
  allSheds.forEach(shed => {
    if (!shed.placementDate) return;
    // Cumulative feed: sum shedFeedOn() from placement to today
    let d = dateOnly(shed.placementDate);
    while (d <= today) { farmFeedToDate += shedFeedOn(shed, d); d = addDays(d, 1); }
    // Current live weight — best available estimate
    const est = currentShedWeightEstimate(shed, today);
    if (est) {
      const live = liveAtStartOfDay(shed, today);
      farmLiveWeightNow += est.kg * live;
      farmAvgAlwNow += est.kg;
      alwCount++;
      if (est.isEstimate) anyEstimated = true;
    }
  });
  const avgAlw = alwCount > 0 ? farmAvgAlwNow / alwCount : 0;
  const fcrTodayVal  = farmLiveWeightNow > 0 ? farmFeedToDate / farmLiveWeightNow : 0;
  const beta = Number(predState.beta) || 0.27;
  const cFcrVal = fcrTodayVal > 0 ? fcrTodayVal - (avgAlw - 2.45) * beta : 0;
  // EPEF = (livability% × avg ALW) / (batch age × FCR) × 100
  const farmLivability = totalInit > 0 ? ((totalInit - totalMort) / totalInit * 100) : 0;
  const epefVal = (batchAge > 0 && fcrTodayVal > 0 && avgAlw > 0)
    ? (farmLivability * avgAlw) / (batchAge * fcrTodayVal) * 100
    : 0;

  const estChip = anyEstimated ? '<span class="est-chip" title="Some sheds have no logged pickup weight yet — using the growth-curve estimate from in-yard samples instead.">est</span>' : '';
  const fcrDisplay  = fcrTodayVal > 0  ? fcrTodayVal.toFixed(2)  : '—';
  const cFcrDisplay = cFcrVal > 0      ? cFcrVal.toFixed(2)       : '—';
  const epefDisplay = epefVal > 0      ? Math.round(epefVal)      : '—';
  const mortPct        = totalInit > 0 ? (totalMort / totalInit * 100) : 0;


  // ── Upcoming predicted pickups across all sheds ──
  const WD2 = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const MO2 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const upcomingPickups = [];
  allSheds.forEach(shed => {
    (shed.predictedPickups || []).forEach(pp => {
      if (!pp.date) return;
      const d = dateOnly(pp.date);
      if (d >= dateOnly(today)) upcomingPickups.push({ shed: shed.id, date: d, birds: pp.birds, isFinal: !!pp.isFinal });
    });
  });
  upcomingPickups.sort((a,b) => a.date - b.date);
  // Group by date
  const pickupsByDate = [];
  upcomingPickups.forEach(p => {
    const key = iso(p.date);
    let grp = pickupsByDate.find(x => x.key === key);
    if (!grp) { grp = { key, date: p.date, sheds: [], birds: 0, isFinal: false }; pickupsByDate.push(grp); }
    grp.sheds.push(p.shed);
    grp.birds += p.birds || 0;
    if (p.isFinal) grp.isFinal = true;
  });
  const pickupRows = pickupsByDate.slice(0, 3).map(p => {
    const d = p.date;
    const loads = Math.ceil((p.birds || 0) / 6000) || 1;
    return `<div class="dash-pickup-item">
      <div class="dash-pickup-date-block">
        <span class="dash-pickup-dow">${WD2[d.getDay()]}</span>
        <span class="dash-pickup-day">${d.getDate()}</span>
        <span style="font-size:9px;color:var(--muted)">${MO2[d.getMonth()]}</span>
      </div>
      <div class="dash-pickup-info">
        <span class="dash-pickup-kind ${p.isFinal ? 'dash-pickup-kind-final' : 'dash-pickup-kind-thin'}">${p.isFinal ? 'FINAL' : 'THIN-OUT'}</span>
        <span class="dash-pickup-sheds">Shed${p.sheds.length > 1 ? 's' : ''} ${p.sheds.join(' &amp; ')}</span>
        <span class="dash-pickup-detail">${p.birds ? (p.birds/1000).toFixed(1)+'k birds · ' : ''}~${loads} load${loads!==1?'s':''}</span>
      </div>
    </div>`;
  }).join('');

  // ── Per-shed table rows ──
  const shedRows = allSheds.map(shed => {
    if (!shed.placementDate) return `<tr><td class="shed-name-cell">Shed ${shed.id}</td><td colspan="6" style="color:var(--muted)">No placement date</td></tr>`;
    const age  = daysBetween(shed.placementDate, today);
    const live = liveAtStartOfDay(shed, today);
    const est  = currentShedWeightEstimate(shed, today);
    const alw  = est ? est.kg : null;
    const daysVar = (alw && age > 0) ? daysVsTarget(age, alw) : null;
    const sev = daysBehindSeverity(daysVar);
    const mort = shed.initialPopulation > 0 ? ((Number(shed.mortality)||0) / shed.initialPopulation * 100) : 0;
    const dotColor = sev === 'unknown' ? '#9CA3AF' : sev === 'bad' ? 'var(--danger)' : sev === 'warn' ? 'var(--primary)' : 'var(--success)';
    const rowClass = sev === 'bad' ? 'shed-row-bad' : sev === 'warn' ? 'shed-row-warn' : '';
    const behindText = daysVar == null ? '—' : Math.abs(daysVar) < 0.1 ? 'On target' : `${Math.abs(daysVar).toFixed(1)}d ${daysVar > 0 ? 'ahead' : 'behind'}`;
    const alwChip = est && est.isEstimate ? '<span class="est-chip" title="No logged pickup weight yet — estimated from the growth curve fitted to in-yard samples.">est</span>' : '';
    return `<tr class="${rowClass}">
      <td class="shed-name-cell">Shed ${shed.id}</td>
      <td>D${age}</td>
      <td>${alw ? alw.toFixed(2)+' kg'+alwChip : '—'}</td>
      <td><span class="dash-status-dot" style="background:${dotColor}"></span>${behindText}</td>
      <td>${live > 0 ? Math.round(live/1000)+'k' : '—'}</td>
      <td>${mort.toFixed(1)}%</td>
    </tr>`;
  }).join('');

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
        <span class="dash-silo-name">Group ${g}</span>
        <span class="dash-silo-days ${cls}">${label}</span>
      </div>
      <div class="dash-silo-bar"><div class="dash-silo-fill ${cls}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');

  // ── Livability donut ──
  const livR = 46, livC = 52, livCirc = 2 * Math.PI * livR;
  const livFill = livability != null ? (livability / 100) * livCirc : 0;
  const donut = `<svg width="110" height="110" viewBox="0 0 ${livC*2} ${livC*2}" role="img" aria-label="Livability ${livability != null ? livability.toFixed(1) : '—'}%">
    <circle cx="${livC}" cy="${livC}" r="${livR}" fill="none" stroke="var(--danger-soft)" stroke-width="14"/>
    <circle cx="${livC}" cy="${livC}" r="${livR}" fill="none" stroke="var(--success)" stroke-width="14"
      stroke-dasharray="${livFill.toFixed(1)} ${livCirc.toFixed(1)}" transform="rotate(-90 ${livC} ${livC})"/>
    <text x="${livC}" y="${livC+4}" text-anchor="middle" font-family="Sora,sans-serif" font-size="14" font-weight="700" fill="var(--ink)">
      ${livability != null ? livability.toFixed(1)+'%' : '—'}
    </text>
  </svg>`;

  // ── Assemble ──
  const ageStr  = batchAge != null ? `Day ${batchAge}` : '—';
  const cleanStr= daysToClean != null ? `Clean-out in ${daysToClean} day${daysToClean!==1?'s':''}` : '';

  return `<div class="dash-wrap">
  <div class="dash-grid dash-row-kpi">
    <div class="dash-kpi dash-kpi-neutral">
      <span class="dash-kpi-label">Batch progress</span>
      <span class="dash-kpi-value">${ageStr}</span>
      <span class="dash-kpi-sub">${cleanStr || 'No clean-out date set'}</span>
      <div class="dash-kpi-progress"><div class="dash-kpi-progress-fill" style="width:${batchPct}%"></div></div>
      <button class="dash-kpi-link" data-tab="g1" type="button">Open Group 1</button>
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
      <span class="dash-kpi-value">${fcrDisplay} <span>/ cFCR ${cFcrDisplay}</span></span>
      <span class="dash-kpi-sub">Projected EPEF ${epefDisplay}</span>
    </div>
    <div class="dash-kpi dash-kpi-red">
      <span class="dash-kpi-icon">${dashKpiIcon('mortality')}</span>
      <span class="dash-kpi-label">Mortality</span>
      <span class="dash-kpi-value">${mortPct.toFixed(1)}<span>%</span></span>
      <span class="dash-kpi-sub">${totalMort.toLocaleString()} birds${livability != null ? ' · ' + livability.toFixed(1) + '% livability' : ''}</span>
    </div>
  </div>

  ${renderGroupStatusGrid()}

  <div class="dash-grid dash-row-triple">
    <div class="dash-card">
      <div class="dash-card-head"><h2 class="dash-card-title">Livability</h2></div>
      <div class="dash-donut-wrap">
        ${donut}
        <div class="dash-donut-legend">
          <div class="dash-donut-legend-item"><span class="dash-donut-swatch" style="background:var(--success)"></span>Alive</div>
          <div class="dash-donut-legend-item"><span class="dash-donut-swatch" style="background:var(--danger-soft);border:1px solid var(--danger)"></span>Dead + culls</div>
          <span style="font-size:12px;color:var(--muted)">Target ≥ 96%</span>
        </div>
      </div>
    </div>
    <div class="dash-card">
      <div class="dash-card-head">
        <h2 class="dash-card-title">Feed on hand</h2>
        <button class="dash-card-action" id="siloFromDash" type="button">Silos</button>
      </div>
      <div class="dash-silo-list">${siloBars}</div>
    </div>
    <div class="dash-card">
      <div class="dash-card-head">
        <h2 class="dash-card-title">Upcoming pickups</h2>
        <button class="dash-card-action" data-open-loads-modal type="button">All loads</button>
      </div>
      ${pickupRows || '<p style="font-size:13px;color:var(--muted);margin:0">No predicted pickups yet. Go to Predictions to plan them.</p>'}
    </div>
  </div>

  ${renderGrowthChartSvg()}

  <div class="dash-card">
    <div class="dash-card-head">
      <h2 class="dash-card-title">Shed performance</h2>
      <button class="dash-card-action" data-tab="g1" type="button">All groups</button>
    </div>
    <table class="dash-shed-table">
      <thead><tr>
        <th>Shed</th><th>Age</th><th>Last ALW</th><th>Days behind</th><th>Live</th><th>Mort.</th>
      </tr></thead>
      <tbody>${shedRows}</tbody>
    </table>
  </div>

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
function render(){
  try{
    gompertzCache=new Map();
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
    renderSyncPill();
    updatePageHeader();
    updateAlertsBell();
    // Main content
    const app=document.getElementById('app');
    if(activeTab==='history'){app.innerHTML=renderHistoryView();return;}
    if(!farmData){
      if(activeTab!=='dashboard')activeTab='dashboard';
      app.innerHTML=renderDashboardView();
      if(feedCompareState.modalOpen){feedCompareState.modalOpen=false;const cm=document.getElementById('compareFeedModal');if(cm)cm.classList.remove('open');}
      return;
    }
    if(activeTab==='dashboard'){app.innerHTML=renderDashboardView();return;}
    if(activeTab==='predictions'){app.innerHTML=renderPredictionsView();if(feedCompareState.modalOpen){feedCompareState.modalOpen=false;const cm=document.getElementById('compareFeedModal');if(cm)cm.classList.remove('open');}return;}
    if(!['g1','g2','g3','g4'].includes(activeTab))activeTab='dashboard';
    const g=Number(activeTab.replace('g',''));
    app.innerHTML=groupViewHtml(g);
    if(feedCompareState.modalOpen)renderCompareModalBody();
    if(loadsModalState.open)renderLoadsModalBody();
    if(inlineDeliveryState&&!feedCompareState.modalOpen){requestAnimationFrame(()=>{const input=app.querySelector('.inline-del-input');if(input)input.focus();});}
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
  const tabs=[{id:'g1',label:'Group 1'},{id:'g2',label:'Group 2'},{id:'g3',label:'Group 3'},{id:'g4',label:'Group 4'},{id:'predictions',label:'📊 Predictions',cls:'tab-predictions'}];
  const mainTabs=tabs.map(t=>`<button class="tab-btn ${t.id===activeTab?'active':''} ${t.cls||''}" data-tab="${t.id}">${t.label}</button>`).join('');
  const cluckwiseTab=`<button class="tab-btn tab-cluckwise" id="cluckwiseBtn" type="button" title="Open CluckWise">🐔 CluckWise</button>`;
  return mainTabs+cluckwiseTab;
}
function groupViewHtml(g){
  const sheds=shedsForGroup(g);if(sheds.length===0)return `<div class="empty-card">Group ${g} has no data.</div>`;
  const today=new Date();
  const init=sheds.reduce((s,x)=>s+(x.initialPopulation||0),0);
  const mort=sheds.reduce((s,x)=>s+Number(x.mortality||0),0);
  const picked=sheds.reduce((s,x)=>s+totalPicked(x),0);
  const live=sheds.reduce((s,x)=>s+liveAtStartOfDay(x,today),0);
  const mortRate=init>0?(mort/init)*100:0;
  const feedToday=groupFeedToday(sheds,today);
  const grad=g===1?'linear-gradient(135deg,#E0A339,#A8721F)':g===2?'linear-gradient(135deg,#B08463,#5E2E22)':g===3?'linear-gradient(135deg,#C9774A,#8F4A28)':'linear-gradient(135deg,#A89055,#6E5A32)';
  const view=shedViewByGroup[g]||'planner';let contentHtml='';
  if(view==='planner')contentHtml=renderFeedPlanner(g,sheds,today);
  else{const visibleSheds=view==='shed1'?[sheds[0]]:view==='shed2'?[sheds[1]||sheds[0]]:sheds;const gridClass=view==='both'&&sheds.length>1?'sheds-grid compare':'sheds-grid';contentHtml=`<div class="${gridClass}">${visibleSheds.map(s=>shedCardHtml(s,today)).join('')}</div>`;}
  return `<div class="group-view-head" style="background:${grad}"><h1>Group ${g} <span>Sheds ${sheds.map(s=>s.id).join(' & ')}</span></h1><div class="pills"><span>Live <strong>${live.toLocaleString()}</strong></span><span class="feed-pill">Feed today <strong>${fmtFeed(feedToday)}</strong></span><span>Mort <strong>${mort.toLocaleString()}</strong> (${mortRate.toFixed(2)}%)</span><span>Picked <strong>${picked.toLocaleString()}</strong></span></div></div>${shedTabsHtml(g,view,sheds)}${contentHtml}`;
}
function shedTabsHtml(g,view,sheds){
  if(sheds.length<2)return '';
  const sA=sheds[0].id,sB=sheds[1].id;
  return `<div class="sticky-sentinel" aria-hidden="true"></div><div class="shed-tabs sticky-tabs"><button class="stab ${view==='shed1'?'active':''}" data-shedview="shed1" data-group="${g}"><span class="stab-icon">🏠</span> Shed ${sA}</button><button class="stab ${view==='shed2'?'active':''}" data-shedview="shed2" data-group="${g}"><span class="stab-icon">🏠</span> Shed ${sB}</button><button class="stab both-btn ${view==='both'?'active':''}" data-shedview="both" data-group="${g}"><span class="stab-icon">🏘️</span> Both sheds</button><button class="stab planner-btn ${view==='planner'?'active':''}" data-shedview="planner" data-group="${g}"><span class="stab-icon">🌾</span> Feed &amp; Silo</button></div>`;
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
  return `<article class="shed-card"><div class="shed-card-head"><h3>Shed ${shed.id}</h3><div class="pills">${pills}</div></div><div class="shed-body"><div class="shed-grid"><div class="panel"><h4>Inputs (editable)</h4><div class="field-row"><label for="placement_${idx}">Placement Date</label><input id="placement_${idx}" type="date" value="${iso(shed.placementDate)}" data-shed="${idx}" data-field="placementDate" /></div><div class="field-row"><label for="pop_${idx}">Initial Population</label><input id="pop_${idx}" type="number" min="0" value="${shed.initialPopulation}" data-shed="${idx}" data-field="initialPopulation" /></div><div class="field-row"><label for="mort_${idx}">Mortality</label><input id="mort_${idx}" type="number" min="0" value="${shed.mortality}" data-shed="${idx}" data-field="mortality" /></div><div class="field-row"><label for="chickWeight_${idx}">Chick weight (g)</label><input id="chickWeight_${idx}" type="number" step="0.1" min="30" max="80" value="${Math.round(chickW*1000)}" data-shed="${idx}" data-field="chickWeightGrams" /></div><div class="field-row"><label for="customFeed_${idx}">Custom Feed (kg/bird)</label><input id="customFeed_${idx}" type="number" step="0.001" min="0" value="${shed.customFeedKg??''}" placeholder="blank = Standard" data-shed="${idx}" data-field="customFeedKg" /></div><div class="field-row"><label for="cleanout_${idx}">Cleanout Date</label><input id="cleanout_${idx}" type="date" value="${iso(shed.cleanoutDate)}" data-shed="${idx}" data-field="cleanoutDate" ${fp?'title="Set automatically from the final pickup"':''} /></div></div><div class="panel"><h4>Snapshot (today)</h4><div class="snapshot-row"><span class="lbl">Age</span><span class="val">${age} days</span></div><div class="snapshot-row"><span class="lbl">Live birds</span><span class="val big">${live.toLocaleString()}</span></div><div class="snapshot-row"><span class="lbl">Mortality</span><span class="val">${shed.mortality.toLocaleString()} <span class="mort-pct">(${mRate.toFixed(2)}%)</span></span></div><div class="snapshot-row"><span class="lbl">Total picked</span><span class="val">${picked.toLocaleString()}</span></div><div class="snapshot-row"><span class="lbl">Cleanout</span><span class="val">${shed.cleanoutDate?fmtShort(shed.cleanoutDate):'—'}</span></div></div></div><div class="pickups-block"><h4 class="pickup-header"><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span>Pickups (${shed.pickups.length}/${ds.targetPickups})</span>${pill}</span><button class="btn-pickup-add" data-goto-predpickup="${shed.id}" type="button" ${canAddPickup?'':'disabled'} title="${canAddPickup?'Add a pickup on the Predictions tab':'Maximum 5 pickups reached'}">＋ Add Pickup</button></h4>${pickupsHtml}</div><div class="forecast-section">${rangeBarHtml(shedRange,'shed')}${forecastHtml}</div></div></article>`;
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
function renderShedForecastTable(shed,forecast){
  const lbl=rangeLabel(shedRange);
  if(forecast.notStarted)return `<div class="forecast-block"><h4>📈 Forecast <span class="window-label">${lbl}</span></h4><div class="forecast-empty">Shed hasn't been placed yet — set a placement date to see the forecast.</div></div>`;
  if(forecast.rows.length===0)return `<div class="forecast-block"><h4>📈 Forecast <span class="window-label">${lbl}</span></h4><div class="forecast-empty">No forecast data available.</div></div>`;
  const rows=forecast.rows.map(r=>{
    const weekend=isWeekend(r.date);
    const rowClasses=[weekend?'is-weekend':'',r.isPast?'is-past':'',r.isToday?'is-today':'',r.pickupsBirds>0&&!r.hasPredicted?'pickup-day':'',r.hasPredicted?'predicted-pickup-day':'',r.isFinalDay?'is-final':''].filter(Boolean).join(' ');
    const todayTag=r.isToday?' · <span style="color:var(--secondary);font-weight:700;">Today</span>':'';
    const weekendTag=weekend?' <span class="weekend-pill">Weekend</span>':'';
    return `<tr class="${rowClasses}"><td>${fmtShort(r.date)}${todayTag}${weekendTag}</td><td class="num">${r.age}d</td><td class="num">${r.liveStart.toLocaleString()}</td><td class="num">${r.dailyFeed.toFixed(1)} kg</td><td>—</td></tr>`;
  }).join('');
  return `<div class="forecast-block"><h4>📈 Forecast <span class="window-label">${lbl} · ${forecast.rows.length} rows</span></h4><div class="forecast-table-wrap"><table class="forecast-table"><thead><tr><th>Date</th><th class="num">Age</th><th class="num">Live birds</th><th class="num">Daily Feed</th><th>Pickup</th></tr></thead><tbody>${rows}<tr class="total-row"><td colspan="3">Total over range</td><td class="num">${forecast.totalFeed.toFixed(1)} kg</td><td style="font-size:12px;font-weight:600;color:var(--muted);">${(forecast.totalFeed/1000).toFixed(2)} tonnes</td></tr></tbody></table></div></div>`;
}
function renderSiloInput(group,siloNum,rings){
  const isOff=(rings===null||rings===undefined||rings==='');
  const kg=ringsToKg(rings);
  return `<div class="silo-input ${isOff?'off':''}"><div class="silo-title"><span>Silo ${siloNum}</span>${isOff?`<span class="off-badge">Off</span>`:`<span class="cap">Max 50 t</span>`}</div><div class="ring-picker"><button class="ring-off ${isOff?'active':''}" type="button" data-silo-group="${group}" data-silo-num="${siloNum}" data-silo-ring="off">Off</button>${[0,1,2,3,4,5].map(r=>`<div class="ring-slot ${r===rings?'active':''}"><button class="ring-btn ${r===rings?'active':''}" type="button" data-silo-group="${group}" data-silo-num="${siloNum}" data-silo-ring="${r}" title="${r} ring${r===1?'':'s'} — ${(ringsToKg(r)/1000).toFixed(0)} t">${r}</button><span class="ring-t">${(ringsToKg(r)/1000).toFixed(0)}t</span></div>`).join('')}</div><div class="silo-total"><span class="lbl">${isOff?'Not in use':'This silo'}</span><span class="val">${isOff?'0 kg':(kg/1000).toFixed(2)+' t <span class="kg">('+kg.toLocaleString()+' kg)</span>'}</span></div></div>`;
}
function renderReadingHistory(group){
  const all=readingsSorted(group);
  const limit=all.length<=30?all.length:30;
  const arr=all.slice().reverse().slice(0,limit);
  if(!arr.length)return `<details class="reading-history"><summary>🕘 Reading history (empty)</summary><div style="font-size:12.5px;color:var(--muted);padding:8px 0;">Once you tap a ring level, each reading is saved with today's date.</div></details>`;
  const todayIso=iso(new Date());
  return `<details class="reading-history"><summary>🕘 Reading history (${all.length===arr.length?arr.length:`last ${arr.length} of ${all.length}`})</summary><table><thead><tr><th>Date</th><th>Silo 1</th><th>Silo 2</th><th>Silo 3</th><th class="num">Total</th><th style="width:44px;text-align:right;">Actions</th></tr></thead><tbody>${arr.map(r=>{const total=readingTotalKg(r);const cls=r.date===todayIso?'today':'';return `<tr class="${cls}"><td>${fmtShort(dateOnly(r.date))}</td><td>${r.silo1Rings===null?'—':r.silo1Rings+'r'}</td><td>${r.silo2Rings===null?'—':r.silo2Rings+'r'}</td><td>${r.silo3Rings===null?'—':r.silo3Rings+'r'}</td><td class="num">${(total/1000).toFixed(2)} t</td><td style="text-align:right;"><button class="reading-delete-btn" type="button" data-delete-reading="${group}|${r.date}" title="Delete this reading">✕</button></td></tr>`;}).join('')}</tbody></table></details>`;
}
function renderGroupLoadsCard(group){
  const arr=loadsAffectingGroup(group);
  if(arr.length===0)return `<div class="group-loads-empty">No loads routed to this group yet — open 🚛 Loads to plan one.</div><div class="group-loads-footnote">These loads are shared across groups. <button type="button" data-open-loads-modal="1">Open 🚛 Loads</button></div>`;
  const rows=arr.map(l=>{
    const share=Number(l.splitKg[group])||0;
    const actualStr=(l.actualKg!=null)?`✓ actual ${(l.actualKg/1000).toFixed(2)} t`:'';
    return `<div class="group-load-row"><span class="glr-date">${fmtShort(l.date)}</span><span class="glr-type">${feedTypeTagHtml(l.feedType)}</span><span class="glr-actual">${actualStr}</span><span class="glr-share">${(share/1000).toFixed(2)} t</span><button type="button" class="glr-edit" data-load-edit="${escapeAttr(l.id)}" title="Edit this load">✎</button></div>`;
  }).join('');
  return `<div class="group-loads-list">${rows}</div><div class="group-loads-footnote">These loads are shared across groups. <button type="button" data-open-loads-modal="1">Open 🚛 Loads</button> to add or edit.</div>`;
}
function renderFeedSummary(group){
  const summary=groupLoadSummary(group);
  const activeRows=['starter','grower','finisher','withdrawal','unspecified'].map(k=>summary.buckets[k]).filter(b=>b.tonnes>0);
  if(activeRows.length===0)return `<div class="feed-summary"><div class="feed-summary-title">📊 Feed Summary <span class="sub">· per feed type · 1 block = 60 T · 30 T = 0.5</span></div><div class="feed-summary-empty">No loads scheduled yet — add one via 🚛 Loads to see the block count.</div></div>`;
  const rows=activeRows.map(b=>`<tr class="${b.blocks>=0.5?'has-blocks':''}"><td>${feedTypeTagHtml(b.id)}</td><td class="num">${b.tonnes.toFixed(2)} t</td><td class="num">${b.loads}</td><td class="num">${b.blocks>0?`<span class="block-count">${fmtBlocks(b.blocks)}</span>`:`<span class="block-count zero">0</span>`}</td></tr>`).join('');
  return `<div class="feed-summary"><div class="feed-summary-title">📊 Feed Summary (this group's share) <span class="sub">· 1 block = 60 T · 30 T = 0.5</span></div><table class="feed-summary-table"><thead><tr><th>Type</th><th class="num">Total</th><th class="num">Loads</th><th class="num">60 T blocks</th></tr></thead><tbody>${rows}<tr style="background:var(--surface-soft);font-weight:800;font-family:'Sora',sans-serif;"><td>Total</td><td class="num">${summary.totalTonnes.toFixed(2)} t</td><td class="num">${activeRows.reduce((s,b)=>s+b.loads,0)}</td><td class="num">${fmtBlocks(summary.totalBlocks)}</td></tr></tbody></table><div style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.5;">Each 60 T of the same feed type counts as <strong>1 block</strong>. Half blocks count as <strong>0.5</strong> (30 T = 0.5).</div></div>`;
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
  const leftoverStr=leftoverOk?`${(leftover.balance/1000).toFixed(2)} t at cleanout`:'—';
  const headerActionsHtml=`<span style="margin-left:auto; display:inline-flex; gap:6px; align-items:center; flex-wrap:wrap;">${hasTests?`<button class="btn-clear-tests" data-clear-tests="${group}" type="button" title="Remove all test deliveries for this group">🧹 Clear test deliver${testCount===1?'y':'ies'} (${testCount})</button>`:''}<span class="forecast-leftover-chip${leftoverOk?'':' muted'}" title="Projected silo balance at this group's latest cleanout">🧺 ${leftoverStr}</span></span>`;
  return `<div class="planner-wrap">
    <div class="planner-summary">
      <div class="summary-card"><div class="sc-label">Projected Stock Today</div><div class="sc-value amber">${hasReading?fmtFeed(projected):'—'}</div><div class="sc-sub">${hasReading?`${Math.round(projected).toLocaleString()} kg at end of today`:'Tap ring levels below to record stock'}</div></div>
      <div class="summary-card"><div class="sc-label">${depletedWithinWindow?'Depletes On':'Feed Lasts'}</div><div class="sc-value ${statusTone}">${depletedWithinWindow?fmtShort(forecast.depletedDate):(hasReading?`> ${siloRange.end} days`:'—')}</div><div class="sc-sub">${depletedWithinWindow?`${daysUntilDepletion} day${daysUntilDepletion===1?'':'s'} from now`:(hasReading?`Balance at end: ${fmtFeed(forecast.endBalance)}`:'')}</div></div>
      <div class="summary-card"><div class="sc-label">Status</div><div class="sc-value ${statusTone}">${statusText}</div><div class="sc-sub">${statusSub}</div></div>
      <div class="summary-card"><div class="sc-label">${forecast.shortfall>0?'Shortfall':'Coverage'}</div><div class="sc-value ${forecast.shortfall>0?'red':'green'}">${forecast.shortfall>0?fmtFeed(forecast.shortfall):'✅ Covered'}</div><div class="sc-sub">${forecast.shortfall>0?'Consumption exceeds supply over range':`Range consumption: ${fmtFeed(forecast.totalConsumption)}`}</div></div>
    </div>
    ${hasReading?`<div class="reading-info"><div class="ri-item"><span class="ri-label">Last reading:</span><span class="ri-value">${fmtShort(latestDate)} · ${readingAgeBadge}</span></div><div class="ri-item"><span class="ri-label">Consumed since:</span><span class="ri-value red">−${fmtFeed(consumedSince)}</span></div>${deliveredSince>0?`<div class="ri-item"><span class="ri-label">Delivered since:</span><span class="ri-value">+${fmtFeed(deliveredSince)}</span></div>`:''}<div class="ri-item"><span class="ri-label">Projected today:</span><span class="ri-value amber">${fmtFeed(projected)}</span></div></div>`:''}
    <div class="planner-card"><h3>📦 Current Silo Stock <span class="count">Tap a ring to record today's reading. Tap the same ring again to turn silo off.</span></h3><div class="silo-inputs">${[1,2,3].map(n=>renderSiloInput(group,n,latest?latest[`silo${n}Rings`]:null)).join('')}</div><div class="silo-grand-total"><span class="lbl">Reading Total</span><span class="val">${hasReading?(readingTotalKg(latest)/1000).toFixed(2)+' t':'—'}<span style="font-size:13px;color:var(--muted);font-weight:600;">${hasReading?`(${readingTotalKg(latest).toLocaleString()} kg on ${fmtShortNoYear(latestDate)})`:''}</span></span></div>${renderReadingHistory(group)}</div>
    <div class="planner-card"><button type="button" class="planner-card-toggle ${deliveriesOpen?'open':''}" data-toggle-deliveries="${group}" aria-expanded="${deliveriesOpen?'true':'false'}"><h3>🚛 Loads affecting Group ${group} ${renderDeliveriesSummary(group)}</h3><span class="collapse-caret">▾</span></button><div class="planner-card-body ${deliveriesOpen?'':'collapsed'}">${renderGroupLoadsCard(group)}${renderFeedSummary(group)}</div></div>
    ${rangeBarHtml(siloRange,'silo',`<button class="btn-compare-toggle" id="compareFeedBtn" type="button" title="Compare with other groups">⇄ Compare groups</button>`)}
    <div class="planner-card"><h3>📈 Feed Balance Forecast <span class="count">${rangeLabel(siloRange)} · weekends shaded</span>${headerActionsHtml}</h3>${renderSiloForecastTable(forecast,group)}<div style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5;">💡 Click any future weekday row to plan a load — <strong>🚜 Test</strong> (hypothetical, session only) or <strong>✅ Order</strong> (creates an official order). Rows with a load already scheduled show a small <strong>✎</strong> button to edit it. Rows with a silo reading show a <strong>📖 Reading</strong> badge — click it to delete that reading.</div></div>
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
      realDels.forEach(rd=>{const kg=Number(rd.amountKg)||0;const typeTag=rd.feedType?feedTypeTagHtml(rd.feedType):'';chunks.push(`<span class="delivery-pill">+${(kg/1000).toFixed(1)} t</span>${typeTag}<button class="delivery-edit-btn" type="button" data-load-edit="${escapeAttr(rd.loadId||rd.id)}" title="Edit this load">✎</button>`);});
      testDels.forEach(td=>{const kg=Number(td.amountKg)||0;chunks.push(`<span class="delivery-pill test">🚜 +${(kg/1000).toFixed(1)} t</span><button class="test-x" type="button" data-remove-test="${group}|${td.id}" title="Remove this test delivery">✕</button>`);});
      deliveryCell=chunks.join(' ');
    }
    if(isInlineOpen){deliveryCell+=`<div class="inline-del"><input type="number" class="inline-del-input" placeholder="tonnes" min="0.1" step="0.1" value="" /><button type="button" class="inline-del-btn test" data-inline-test="${group}|${iso(r.date)}" title="Add as test delivery (session only)">🚜 Test</button><button type="button" class="inline-del-btn actual" data-inline-actual="${group}|${iso(r.date)}" title="Record this load as ordered">✅ Order</button><button type="button" class="inline-del-btn cancel" data-inline-cancel="1" title="Cancel">✕</button></div>`;}
    let dateCls='';
    if(r.isToday)dateCls='fb-date-today';else if(r.isWeekend)dateCls='fb-date-weekend';
    const reading=readingOnDate(group,iso(r.date));
    let readingBadge='';
    if(reading){const s1=reading.silo1Rings===null||reading.silo1Rings===undefined?'off':reading.silo1Rings+'r';const s2=reading.silo2Rings===null||reading.silo2Rings===undefined?'off':reading.silo2Rings+'r';const s3=reading.silo3Rings===null||reading.silo3Rings===undefined?'off':reading.silo3Rings+'r';const totalT=(readingTotalKg(reading)/1000).toFixed(2);const tip=`Silo 1: ${s1} · Silo 2: ${s2} · Silo 3: ${s3} · Total ${totalT} t — click to delete this reading`;readingBadge=`<button type="button" class="reading-badge" data-delete-reading="${group}|${reading.date}" title="${escapeAttr(tip)}">📖</button>`;}
    const ages=shedAgesAtDateForGroup(group,r.date);const agesStr=formatAgesPair(ages);
    const liveBirds=r.liveBirds||0;
    let pickupIndicator='';
    if(r.pickupsBirds>0){const pickCls=r.hasPredicted?'fb-pickup-predicted':'fb-pickup-actual';pickupIndicator=` <span class="${pickCls}">−${r.pickupsBirds.toLocaleString()}</span>`;}
    let balanceCls='';let balanceText='—';
    if(r.balance!==null){balanceText=Math.round(r.balance).toLocaleString()+' kg';if(r.isPast)balanceCls='fb-balance-past';else if(r.balance<=0)balanceCls='fb-balance-empty';else if(r.balance<5000)balanceCls='fb-balance-low';else balanceCls='fb-balance-ok';}
    const cells=[];
    if(c.date)cells.push(`<td class="${dateCls}">${fmtShort(r.date)}${readingBadge}</td>`);
    if(c.age)cells.push(`<td class="num">${agesStr}</td>`);
    if(c.liveBirds)cells.push(`<td class="num">${liveBirds.toLocaleString()}${pickupIndicator}</td>`);
    if(c.dailyFeed)cells.push(`<td class="num">${Math.round(r.consumption).toLocaleString()} kg</td>`);
    if(c.delivery)cells.push(`<td>${deliveryCell}</td>`);
    if(c.endBalance)cells.push(`<td class="num ${balanceCls}">${balanceText}</td>`);
    return `<tr class="${rowClasses}"${clickAttrs}>${cells.join('')}</tr>`;
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
function computePredictions(shed,group){
  const today=dateOnly(new Date());
  const initialPop=Number(shed.initialPopulation)||0;
  const currentMort=Number(shed.mortality)||0;
  const currentAge=ageInDays(shed,today);
  const liveNow=liveAtStartOfDay(shed,today);
  const pickups=computeEffectivePickups(shed);
  const finalAge=shed.cleanoutDate?Math.max(currentAge,ageInDays(shed,shed.cleanoutDate)):currentAge+30;
  const targetALW=Number(predState.targetHarvestWeightKg[group])||2.65;
  const beta=Number(predState.beta)||0.27;
  let perfSum=0,perfCount=0;
  for(const p of pickups){const avg=pickupAvgKg(p);if(avg&&avg>0){const pAge=pickupAge(shed,p);const curveW=rossWeightKg(pAge);if(curveW>0){perfSum+=(avg/curveW);perfCount++;}}}
  const perfFactor=perfCount>0?(perfSum/perfCount):1.0;
  const curveFinal=rossWeightKg(finalAge);
  const perfAdjustedFinal=curveFinal*perfFactor;
  const fit=getShedGompertzFit(shed);
  let estFinalALW;
  if(fit){const gompFinal=gompertzWeightAt(fit,finalAge);const progressT=Math.min(1,currentAge/Math.max(1,finalAge));if(gompFinal!=null)estFinalALW=gompFinal*(1-progressT*0.3)+targetALW*(progressT*0.3);else estFinalALW=(perfCount>0)?(perfAdjustedFinal*(1-progressT*0.5)+targetALW*(progressT*0.5)):targetALW;}
  else{const progressT=Math.min(1,currentAge/Math.max(1,finalAge));estFinalALW=(perfCount>0)?(perfAdjustedFinal*(1-progressT*0.5)+targetALW*(progressT*0.5)):targetALW;}
  const mortEstimate=estimateShedFinalMortality(shed,finalAge,currentAge);
  const estFinalMort=mortEstimate.estFinalMort;const estFinalLive=mortEstimate.estFinalLive;const estLivability=mortEstimate.estLivability;
  let totalWeightKg=0;const pickupDetails=[];let cumBirds=0;
  for(const p of pickups){
    const pAge=pickupAge(shed,p);const curveAtAge=rossWeightKg(pAge);const avgFromExcel=pickupAvgKg(p);
    const avgUsed=(avgFromExcel&&avgFromExcel>0)?avgFromExcel:(curveAtAge*perfFactor);
    const pickupWeightKg=Number(p.birds||0)*avgUsed;
    totalWeightKg+=pickupWeightKg;cumBirds+=Number(p.birds||0);
    pickupDetails.push({date:p.date,age:pAge,birds:Number(p.birds||0),avgWeightKg:avgUsed,totalWeightKg:Number(p.birds||0)*avgUsed,isFinal:!!p.isFinal,isPredicted:p.__source==='predicted',cumBirds,isEstWeight:!(avgFromExcel&&avgFromExcel>0)});
  }
  const finalLiveBirds=Math.max(0,estFinalLive-cumBirds);
  totalWeightKg+=finalLiveBirds*estFinalALW;
  let totalFeedKg=0;
  if(shed.placementDate&&shed.cleanoutDate){let d=dateOnly(shed.placementDate);const end=dateOnly(shed.cleanoutDate);while(d<=end){totalFeedKg+=shedFeedOn(shed,d);d=addDays(d,1);}}
  else if(shed.placementDate){let d=dateOnly(shed.placementDate);const end=dateOnly(new Date());while(d<=end){totalFeedKg+=shedFeedOn(shed,d);d=addDays(d,1);}}
  const fcr=totalWeightKg>0?(totalFeedKg/totalWeightKg):0;
  const cfcr=fcr-(estFinalALW-2.45)*beta;
  const pif=(finalAge>0&&fcr>0)?((estLivability*estFinalALW)/(finalAge*fcr)*100):0;
  const remainingWeightKg=liveNow*rossWeightKg(currentAge)*perfFactor;
  const confidence=computeConfidence(shed,finalAge);
  return {initialPop,currentMort,currentAge,liveNow,pickupsCompleted:pickups.length,remainingBirds:liveNow,remainingWeightKg,finalAge,estFinalALW,estFinalMort,estFinalLive,estLivability,totalWeightKg,totalFeedKg,fcr,cfcr,pif,beta,perfFactor,confidence,pickupDetails,hasWeightData:perfCount>0,gompertzFit:fit};
}
function computeGroupPredictions(group){
  const sheds=shedsForGroup(group);
  let totalLiveWeight=0,totalFeedKg=0,totalPlaced=0,totalMortalityEst=0,totalBirdsAtHarvest=0,weightedAgeSum=0,shedsWithData=0,confidenceSum=0;
  for(const shed of sheds){
    if(!shed.placementDate)continue;
    const pred=computePredictions(shed,group);
    totalLiveWeight+=pred.totalWeightKg;totalFeedKg+=pred.totalFeedKg;totalPlaced+=pred.initialPop;totalMortalityEst+=pred.estFinalMort;
    const harvestedBirds=pred.pickupDetails.reduce((s,p)=>s+p.birds,0);
    const remainingBirds=Math.max(0,pred.estFinalLive-harvestedBirds);
    const batchBirds=harvestedBirds+remainingBirds;
    totalBirdsAtHarvest+=batchBirds;weightedAgeSum+=pred.finalAge*batchBirds;confidenceSum+=pred.confidence;shedsWithData++;
  }
  if(shedsWithData===0)return {hasData:false,shedsWithData:0,shedIds:sheds.map(s=>s.id),totalLiveWeight:0,totalFeedKg:0,totalPlaced:0,totalMortalityEst:0,totalBirdsAtHarvest:0,avgWeight:0,weightedAge:0,livability:0,fcr:0,cfcr:0,pif:0,confidence:0};
  const avgWeight=totalBirdsAtHarvest>0?totalLiveWeight/totalBirdsAtHarvest:0;
  const weightedAge=totalBirdsAtHarvest>0?weightedAgeSum/totalBirdsAtHarvest:0;
  const livability=totalPlaced>0?((totalPlaced-totalMortalityEst)/totalPlaced)*100:0;
  const fcr=totalLiveWeight>0?totalFeedKg/totalLiveWeight:0;
  const beta=Number(predState.beta)||0.27;
  const cfcr=fcr>0?fcr-(avgWeight-2.45)*beta:0;
  const pif=(weightedAge>0&&fcr>0)?((livability*avgWeight)/(weightedAge*fcr)*100):0;
  const confidence=Math.round(confidenceSum/shedsWithData);
  return {hasData:true,shedsWithData,shedIds:sheds.map(s=>s.id),totalLiveWeight,totalFeedKg,totalPlaced,totalMortalityEst,totalBirdsAtHarvest,avgWeight,weightedAge,livability,fcr,cfcr,pif,confidence};
}
function computeConfidence(shed,finalAge){
  const age=ageInDays(shed,new Date());
  const pickups=shed.pickups||[];const samples=shed.inYardSamples||[];
  const gridPoints=TARGET_DAYS.filter(d=>Number(shed.targetCurve&&shed.targetCurve[d])>0).length;
  const hasWeight=pickups.some(p=>pickupAvgKg(p)!=null);
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
  let totalLiveWeight=0,totalFeedAuto=0,totalPlaced=0,totalMortalityEst=0,totalBirdsAtHarvest=0,weightedAgeSum=0,shedsWithData=0,totalCurrentMort=0;
  for(const shed of sheds){
    if(!shed.placementDate)continue;
    const g=Math.floor((shed.id-1)/2)+1;
    const pred=computePredictions(shed,g);
    totalLiveWeight+=pred.totalWeightKg;totalFeedAuto+=pred.totalFeedKg;totalPlaced+=pred.initialPop;totalMortalityEst+=pred.estFinalMort;totalCurrentMort+=Math.max(0,Number(shed.mortality)||0);
    const harvestedBirds=pred.pickupDetails.reduce((s,p)=>s+p.birds,0);
    const remainingBirds=Math.max(0,pred.estFinalLive-harvestedBirds);
    const batchBirds=harvestedBirds+remainingBirds;
    totalBirdsAtHarvest+=batchBirds;weightedAgeSum+=pred.finalAge*batchBirds;shedsWithData++;
  }
  const autoLeftover=totalFarmLeftover();
  const leftoverKg=(predState.farmLeftoverKg!=null&&Number.isFinite(Number(predState.farmLeftoverKg))&&Number(predState.farmLeftoverKg)>0)?Number(predState.farmLeftoverKg):0;
  const leftoverApplied=leftoverKg>0;
  if(shedsWithData===0)return {hasData:false,shedsWithData:0,totalLiveWeight:0,totalFeedAuto:0,totalFeed:0,fcr:0,cfcr:0,pif:0,avgWeight:0,livability:0,weightedAge:0,placed:0,mortality:0,birdsAtHarvest:0,usingManualFeed:false,autoLeftover:null,leftoverApplied:false,leftoverKg:0,totalCurrentMortality:0,currentMortRate:0,estMortRate:0};
  const avgWeight=totalBirdsAtHarvest>0?totalLiveWeight/totalBirdsAtHarvest:0;
  const weightedAge=totalBirdsAtHarvest>0?weightedAgeSum/totalBirdsAtHarvest:0;
  const livability=totalPlaced>0?((totalPlaced-totalMortalityEst)/totalPlaced)*100:0;
  const usingManualFeed=predState.farmFeedOverride!=null&&predState.farmFeedOverride>0;
  const baseFeed=usingManualFeed?predState.farmFeedOverride:totalFeedAuto;
  const totalFeed=Math.max(0,baseFeed-leftoverKg);
  const fcr=totalLiveWeight>0?totalFeed/totalLiveWeight:0;
  const beta=Number(predState.beta)||0.27;
  const cfcr=fcr>0?fcr-(avgWeight-2.45)*beta:0;
  const pif=(weightedAge>0&&fcr>0)?((livability*avgWeight)/(weightedAge*fcr)*100):0;
  return {hasData:true,shedsWithData,totalLiveWeight,totalFeedAuto,totalFeed,fcr,cfcr,pif,avgWeight,livability,weightedAge,placed:totalPlaced,mortality:totalMortalityEst,birdsAtHarvest:totalBirdsAtHarvest,usingManualFeed,autoLeftover,leftoverApplied,leftoverKg,totalCurrentMortality:totalCurrentMort,currentMortRate:totalPlaced>0?(totalCurrentMort/totalPlaced)*100:0,estMortRate:totalPlaced>0?(totalMortalityEst/totalPlaced)*100:0};
}
function farmFeedSubText(t){
  if(t.usingManualFeed&&t.leftoverApplied)return `Manual override − leftover · auto: ${fmtTonnesAlways(t.totalFeedAuto)}`;
  if(t.usingManualFeed)return `Manual override · auto: ${fmtTonnesAlways(t.totalFeedAuto)}`;
  if(t.leftoverApplied)return `Auto − ${Math.round(t.leftoverKg).toLocaleString()} kg leftover · auto: ${fmtTonnesAlways(t.totalFeedAuto)}`;
  return `Auto-estimated from ${t.shedsWithData} shed${t.shedsWithData===1?'':'s'}`;
}

/* ---------- Predictions page ---------- */
function renderFarmKpiCard(){
  const t=computeFarmTotals();
  if(!t.hasData)return `<div class="farm-kpi-card"><div class="farm-kpi-head"><h2>🏭 Whole Farm KPIs · Estimates</h2><span class="sub">Projected end-of-batch totals across all 8 sheds</span></div><div class="farm-kpi-empty">No sheds placed yet — import Excel or add a placement date to see farm estimates.</div></div>`;
  const overrideVal=predState.farmFeedOverride!=null?predState.farmFeedOverride:'';
  const overrideCls=t.usingManualFeed?'manual':'';
  const feedSub=farmFeedSubText(t);
  const leftoverVal=(predState.farmLeftoverKg!=null&&predState.farmLeftoverKg>0)?predState.farmLeftoverKg:'';
  const leftoverCls=t.leftoverApplied?'manual':'';
  const leftoverPlaceholder=t.autoLeftover!=null?`auto: ${Math.round(t.autoLeftover).toLocaleString()}`:'auto: —';
  return `<div class="farm-kpi-card"><div class="farm-kpi-head"><h2>🏭 Whole Farm KPIs · Estimates</h2><span class="sub">Projected end-of-batch totals across ${t.shedsWithData} placed shed${t.shedsWithData===1?'':'s'} of ${SHED_COUNT}</span></div><div class="farm-kpi-grid">
    <div class="farm-kpi-tile amber"><div class="fkt-lbl">Est. Total Live Weight</div><div class="fkt-val" id="kpiLiveWeight">${fmtKgAlways(t.totalLiveWeight)}</div><div class="fkt-sub">${t.birdsAtHarvest.toLocaleString()} birds at harvest</div></div>
    <div class="farm-kpi-tile"><div class="fkt-lbl">Est. Total Feed Consumption</div><div class="fkt-val" id="kpiFeed">${fmtTonnesAlways(t.totalFeed)}</div><div class="fkt-sub" id="kpiFeedSub">${feedSub}</div><input id="farmFeedOverride" class="farm-feed-override ${overrideCls}" type="number" step="100" min="0" placeholder="Manual override (kg)" value="${overrideVal}" /><label class="farm-leftover-label" for="farmLeftoverInput">🧺 Leftover at cleanout (kg)</label><input id="farmLeftoverInput" class="farm-leftover-input ${leftoverCls}" type="number" step="1" min="0" placeholder="${leftoverPlaceholder}" value="${leftoverVal}" /></div>
    <div class="farm-kpi-tile green"><div class="fkt-lbl">Est. FCR</div><div class="fkt-val" id="kpiFCR">${t.fcr.toFixed(3)}</div><div class="fkt-sub">Feed ÷ weight gained</div></div>
    <div class="farm-kpi-tile green"><div class="fkt-lbl">Est. cFCR</div><div class="fkt-val" id="kpiCFCR">${t.cfcr.toFixed(3)}</div><div class="fkt-sub">FCR adjusted for final weight (${t.avgWeight.toFixed(2)} kg)</div></div>
    <div class="farm-kpi-tile blue"><div class="fkt-lbl">Est. PIF</div><div class="fkt-val" id="kpiPIF">${t.pif.toFixed(2)}</div><div class="fkt-sub">Overall score: weight × survival ÷ (age × FCR)</div></div>
    <div class="farm-kpi-tile"><div class="fkt-lbl">Est. Total Average Weight</div><div class="fkt-val" id="kpiAvgWeight">${t.avgWeight.toFixed(3)} <span style="font-size:12px;font-weight:600;color:var(--muted);">kg</span></div><div class="fkt-sub">Weighted across ${t.birdsAtHarvest.toLocaleString()} birds</div></div>
    <div class="farm-kpi-tile"><div class="fkt-lbl">Est. Livability</div><div class="fkt-val" id="kpiLivability">${t.livability.toFixed(2)}%</div><div class="fkt-sub">${t.placed.toLocaleString()} placed · ${t.mortality.toLocaleString()} est. mort</div></div>
    <div class="farm-kpi-tile red"><div class="fkt-lbl">Est. Total Mortality</div><div class="fkt-val" id="kpiMortality">${t.mortality.toLocaleString()}</div><div class="fkt-sub" id="kpiMortalitySub">${t.totalCurrentMortality.toLocaleString()} recorded now · est. ${t.estMortRate.toFixed(2)}% of placed</div></div>
  </div></div>`;
}
function updateFarmKpiValues(){
  const t=computeFarmTotals();
  const el=id=>document.getElementById(id);
  const set=(id,html)=>{const e=el(id);if(e)e.innerHTML=html;};
  if(!t.hasData)return;
  set('kpiLiveWeight',fmtKgAlways(t.totalLiveWeight));
  set('kpiFeed',fmtTonnesAlways(t.totalFeed));
  const sub=el('kpiFeedSub');if(sub)sub.textContent=farmFeedSubText(t);
  set('kpiFCR',t.fcr.toFixed(3));
  set('kpiCFCR',t.cfcr.toFixed(3));
  set('kpiPIF',t.pif.toFixed(2));
  set('kpiAvgWeight',t.avgWeight.toFixed(3)+' <span style="font-size:12px;font-weight:600;color:var(--muted);">kg</span>');
  set('kpiLivability',t.livability.toFixed(2)+'%');
  set('kpiMortality',t.mortality.toLocaleString());
  const msub=el('kpiMortalitySub');if(msub)msub.textContent=`${t.totalCurrentMortality.toLocaleString()} recorded now · est. ${t.estMortRate.toFixed(2)}% of placed`;
  const lo=el('farmLeftoverInput');
  if(lo){const want=t.autoLeftover!=null?`auto: ${Math.round(t.autoLeftover).toLocaleString()}`:'auto: —';if(lo.placeholder!==want)lo.placeholder=want;}
}
function renderAdjustmentCollapse(group){
  const isOpen=predState.adjOpen===true;
  const biasPct=Math.round(currentBiasFactor()*100);
  const betaVal=predState.beta;
  const targetKg=predState.targetHarvestWeightKg[group];
  const dg=predState.densityGlobal||{...DEFAULT_DENSITY_GLOBAL};
  const tp=Number.isFinite(Number(dg.targetPickups))?Number(dg.targetPickups):DEFAULT_DENSITY_GLOBAL.targetPickups;
  return `<div class="adj-collapse adj-collapse-highlight ${isOpen?'open':''}"><button type="button" class="adj-collapse-head" data-toggle-adjustments="1" aria-expanded="${isOpen?'true':'false'}"><span class="adj-collapse-title">⚙️ Prediction adjustments</span><span class="adj-collapse-summary"><span class="adj-chip" id="adjChipBeta">cFCR β <strong>${betaVal.toFixed(3)}</strong></span><span class="adj-chip" id="adjChipScale">Scale <strong>${biasPct}%</strong></span><span class="adj-chip" id="adjChipTarget">Target <strong>${targetKg.toFixed(2)} kg</strong></span><span class="adj-chip" id="adjChipDensity">Density <strong>${dg.triggerDensity}/${dg.targetDensity}</strong></span><span class="adj-chip" id="adjChipPickups">Pickups <strong>${tp}</strong></span></span><span class="adj-collapse-caret">▾</span></button><div class="adj-collapse-body"><div class="adj-row"><label>📊 cFCR β factor</label><input type="range" id="predBetaSlider" min="0" max="0.6" step="0.002" value="${betaVal}" /><input type="number" id="predBetaNumber" min="0" max="0.6" step="0.002" value="${betaVal.toFixed(3)}" /><span class="adj-hint">How strongly cFCR is adjusted for final weight.</span></div><div class="adj-row"><label>📐 Scale correction</label><input type="range" id="biasSlider" min="${MIN_BIAS_FACTOR*100}" max="${MAX_BIAS_FACTOR*100}" step="1" value="${biasPct}" /><input type="number" id="biasNumber" min="${MIN_BIAS_FACTOR*100}" max="${MAX_BIAS_FACTOR*100}" step="1" value="${biasPct}" /><span class="adj-unit">%</span><span class="adj-hint">How much your shed scale reads heavier than the plant weight.</span></div><div class="adj-row"><label>🎯 Target weight at harvest</label><input type="number" id="predTargetWeight_${group}" min="0.5" max="5" step="0.01" value="${targetKg.toFixed(2)}" /><span class="adj-unit">kg</span><span class="adj-hint">The weight you're aiming to send birds to the plant.</span></div><div class="density-settings-title"><span>🎯 Pickup density (global defaults)</span><span style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" class="btn-global-autofill-sm" data-global-autofill="1" title="Auto-generate predicted pickups for every placed shed">✨ Auto-fill all sheds</button><button type="button" class="btn-global-clear-sm" data-global-clear-pickups="1" title="Remove all predicted pickups from every shed">🗑️ Clear all</button></span></div><div class="adj-row"><label>Trigger density</label><input type="number" id="densityTrigger" min="20" max="45" step="0.5" value="${dg.triggerDensity}" /><span class="adj-unit">kg/m²</span><span class="adj-hint">Schedule a pickup when density is forecast to reach this.</span></div><div class="adj-row"><label>Target after pickup</label><input type="number" id="densityTarget" min="15" max="35" step="0.5" value="${dg.targetDensity}" /><span class="adj-unit">kg/m²</span><span class="adj-hint">What density to aim for after each pickup.</span></div><div class="adj-row"><label>Hard maximum</label><input type="number" id="densityMax" min="28" max="45" step="0.5" value="${dg.maxDensity}" /><span class="adj-unit">kg/m²</span><span class="adj-hint">Welfare ceiling.</span></div><div class="adj-row"><label>Target pickups per shed</label><input type="number" id="targetPickupsGlobal" min="${MIN_PICKUPS_PER_SHED}" max="${MAX_PICKUPS_PER_SHED}" step="1" value="${tp}" /><span class="adj-unit">pickups</span><span class="adj-hint">Total pickups per shed (${MIN_PICKUPS_PER_SHED} or ${MAX_PICKUPS_PER_SHED}).</span></div></div></div>`;
}
function renderPredictionsView(){
  const g=predState.predGroup;
  const sheds=shedsForGroup(g);
  if(sheds.length===0)return `<div class="empty-card">Group ${g} has no data.</div>`;
  const view=predState.predView;
  const visibleSheds=view==='shed1'?[sheds[0]]:view==='shed2'?[sheds[1]||sheds[0]]:sheds;
  const gridClass=view==='both'&&sheds.length>1?'pred-grid compare':'pred-grid';
  const groupNames={1:'Group 1',2:'Group 2',3:'Group 3',4:'Group 4'};
  return `<div class="predictions-head"><h1>📊 Results Predictions <span style="color:var(--muted);font-weight:600">— ${groupNames[g]}</span></h1><span class="head-note">Whole-farm estimates · group result · per-shed detail below</span></div>${renderFarmKpiCard()}<div class="pred-group-mobile">${[1,2,3,4].map(gi=>`<button class="stab ${predState.predGroup===gi?'active':''}" data-predgroup="${gi}">${groupNames[gi]}</button>`).join('')}</div><div class="sticky-sentinel" aria-hidden="true"></div><div class="shed-tabs sticky-tabs tabs-left" style="margin-bottom:14px;"><button class="stab planner-btn ${view==='both'?'active':''}" data-predview="both">🏘️ Both sheds</button><button class="stab ${view==='shed1'?'active':''}" data-predview="shed1">🏠 Shed ${sheds[0]?.id||''}</button>${sheds[1]?`<button class="stab ${view==='shed2'?'active':''}" data-predview="shed2">🏠 Shed ${sheds[1].id}</button>`:''}</div>${renderAdjustmentCollapse(g)}<div class="${gridClass}" style="margin-top:14px;">${visibleSheds.map(s=>renderPredictionsShedCard(s,g)).join('')}</div>`;
}
function renderInYardCurvePanel(shed){
  const tc=shed.targetCurve||{};
  const fit=getShedGompertzFit(shed);const hasFit=!!fit;
  const samples=shed.inYardSamples||[];
  const biasPct=(currentBiasFactor()*100).toFixed(0);
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
  if(hasFit){sourcePill='<span class="pill gompertz">AI curve</span>';const nGrid=TARGET_DAYS.filter(d=>tc[d]>0).length;const nCustom=samples.length;const nPickups=(shed.pickups||[]).filter(p=>pickupAvgKg(p)).length;const parts=[];if(nGrid>0)parts.push(`${nGrid} check-day${nGrid===1?'':'s'}`);if(nCustom>0)parts.push(`${nCustom} extra reading${nCustom===1?'':'s'}`);if(nPickups>0)parts.push(`${nPickups} pickup weight${nPickups===1?'':'s'}`);sourceText=`Based on <strong>${parts.join(' + ')||'chick weight only'}</strong>`;}
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
  if(!shed.placementDate)return `<div class="pickups-block" style="margin-top:14px;"><h4>📅 Daily Performance — Actual + AI Forecast</h4><div class="forecast-empty">No placement date set — forecast unavailable.</div></div>`;
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
  if(fit){const nGrid=TARGET_DAYS.filter(d=>shed.targetCurve&&shed.targetCurve[d]>0).length;const nCustom=(shed.inYardSamples||[]).length;const nPickups=(shed.pickups||[]).filter(p=>pickupAvgKg(p)).length;const parts=[];if(nGrid>0)parts.push(`${nGrid} check-day${nGrid===1?'':'s'}`);if(nCustom>0)parts.push(`${nCustom} extra reading${nCustom===1?'':'s'}`);if(nPickups>0)parts.push(`${nPickups} pickup weight${nPickups===1?'':'s'}`);sourceNote=`Based on ${parts.join(', ')||'chick weight only'}.`;}
  else if(last){const gain=observedDailyGain(shed);sourceNote=gain!=null?`Based on pickup weights — observed gain of ${(gain*1000).toFixed(1)} g/day.`:`Based on pickup weights.`;}
  else if(TARGET_DAYS.some(d=>shed.targetCurve&&shed.targetCurve[d]>0)||(shed.inYardSamples||[]).length>0){sourceNote=`Based on your shed scale readings.`;}
  else sourceNote=`No readings yet — showing the standard growth curve.`;
  const hasAnyPredicted=effective.some(p=>p.__source==='predicted');
  if(hasAnyPredicted)sourceNote+=` <strong style="color:var(--secondary);">Planned pickups are included in this forecast.</strong>`;
  return `<div class="pickups-block" style="margin-top:14px;"><h4>📅 Daily Performance — Actual + AI Forecast <span style="font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted);font-size:11px;">· Day ${startDay}–${endDay} of cycle · ⭐ = check day · 📏 = weighed</span></h4><div class="forecast-table-wrap"><table class="pred-daily-table" style="min-width:820px;"><thead><tr><th>Date</th><th class="num">Age</th><th class="num">Live birds</th><th class="num">Weight (kg)</th><th class="num">Standard (kg)</th><th class="num">Days vs Standard</th></tr></thead><tbody>${rows.map(r=>{
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
    let daysCell='—';let daysCls='';
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
  const targetInputHtml=`<div class="pp-target-row"><span class="pp-target-label">🎯 Target pickups for this shed</span><input type="number" class="pp-target-input" min="${MIN_PICKUPS_PER_SHED}" max="${MAX_PICKUPS_PER_SHED}" step="1" value="${targetN}" data-shed-target-pickups="${shed.id}" title="Total pickups including the final cleanout" /><span class="pp-target-hint">${MIN_PICKUPS_PER_SHED} or ${MAX_PICKUPS_PER_SHED} (includes the final cleanout)</span></div>`;
  const densityOverrideHtml=`<div class="shed-density-override"><label><input type="checkbox" data-density-use-global="${shed.id}" ${useGlobalDensity?'checked':''} /> Use global density settings</label>${!useGlobalDensity?`<span class="ovr-inputs"><span>Trigger</span><input type="number" min="20" max="45" step="0.5" value="${ds.triggerDensity}" data-density-override="${shed.id}|triggerDensity" /><span>Target</span><input type="number" min="15" max="35" step="0.5" value="${ds.targetDensity}" data-density-override="${shed.id}|targetDensity" /><span>Max</span><input type="number" min="28" max="45" step="0.5" value="${ds.maxDensity}" data-density-override="${shed.id}|maxDensity" /></span>`:''}</div>`;
  if(hasRealFinal)return `<div class="pickup-plan-block"><h4><span>🎯 Predicted Pickups</span><span style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn-pp-clear" data-pp-clear="${shed.id}" type="button" title="Remove any leftover predicted pickups">🗑️ Clear</button></span></h4><div class="pp-empty" style="background:linear-gradient(135deg,rgba(76,122,59,0.10),rgba(76,122,59,0.04));border-color:var(--success);color:var(--success);font-weight:600;">✅ Target reached — a cleanout pickup is already recorded for this shed.<br>No predicted pickups needed.</div><div class="pp-summary" style="margin-top:10px;"><div>${progressHtml}</div><div><span class="lbl">Real pickups on record:</span> <strong>${realCount}</strong></div></div>${targetInputHtml}${densityOverrideHtml}</div>`;
  if(pps.length===0)return `<div class="pickup-plan-block"><h4><span>🎯 Predicted Pickups</span></h4><div class="pp-empty">Plan hypothetical pickups to see how the whole-batch forecast changes. The last pickup is the <strong>final cleanout</strong> and sits on the shed's cleanout date. Regular predicted pickups trigger when density reaches <strong>${ds.triggerDensity} kg/m²</strong> and bring it back to <strong>${ds.targetDensity} kg/m²</strong>.</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn-pp-add" data-pp-add="${shed.id}" type="button">＋ Add Predicted Pickup</button><button class="btn-pp-autofill" data-pp-autofill="${shed.id}" type="button" title="Auto-generate the optimal pickup plan">✨ Auto-fill Plan</button></div><div class="pp-summary" style="margin-top:10px;"><div>${progressHtml}</div></div>${targetInputHtml}${densityOverrideHtml}</div>`;
  const totalActiveRemoval=activePps.reduce((s,pp)=>s+(Number(pp.birds)||0),0);
  return `<div class="pickup-plan-block"><h4><span>🎯 Predicted Pickups (${predictedCount})</span><span style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn-pp-autofill" data-pp-autofill="${shed.id}" type="button" title="Auto-generate the optimal pickup plan">✨ Auto-fill</button><button class="btn-pp-add" data-pp-add="${shed.id}" type="button">＋ Add</button><button class="btn-pp-clear" data-pp-clear="${shed.id}" type="button" title="Remove all predicted pickups for this shed">🗑️ Clear</button></span></h4><div class="pp-list">${rows.map(r=>{const classes=['pp-row'];if(r.isSuperseded)classes.push('pp-superseded');if(r.pp.isFinal)classes.push('pp-final');const badges=[];if(r.isSuperseded)badges.push('<span class="pp-badge">Replaced by actual</span>');if(r.pp.isFinal)badges.push('<span class="pp-badge final">FINAL CLEANOUT</span>');const badgeHtml=badges.join('');return `<div class="${classes.join(' ')}"><div class="pp-info"><div class="pp-date">${fmtShort(r.pp.date)} · Day ${r.age} ${badgeHtml}</div><div class="pp-meta">Remove <strong>${(Number(r.pp.birds)||0).toLocaleString()}</strong> birds · Density ${r.densityBefore.toFixed(1)} → ${r.densityAfter.toFixed(1)} kg/m²</div></div><div class="pp-actions"><button type="button" data-pp-edit="${shed.id}|${r.pp.id}" title="Edit">✎</button><button type="button" class="danger" data-pp-delete="${shed.id}|${r.pp.id}" title="Delete">✕</button></div></div>`;}).join('')}</div><div class="pp-summary"><div>${progressHtml}</div><div><span class="lbl">Total planned removal:</span> <strong>${totalActiveRemoval.toLocaleString()}</strong> birds</div></div>${targetInputHtml}${densityOverrideHtml}</div>`;
}
function renderPredictionsShedCard(shed,group){
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
  const snapshotHtml=`<div class="pred-snapshot"><div class="pred-snap-item"><div class="lbl">🐥 Birds placed</div><div class="val">${pred.initialPop.toLocaleString()}</div></div><div class="pred-snap-item"><div class="lbl">📆 Current age</div><div class="val">${pred.currentAge}d</div></div><div class="pred-snap-item"><div class="lbl">⚠️ Mortality</div><div class="val"><input type="number" class="snapshot-mort-input" min="0" step="1" value="${Math.max(0,Number(shed.mortality)||0)}" data-shed="${shed.id-1}" data-field="mortality" id="snapshotMortP_${shed.id}" title="Edit actual mortality count for this shed" /></div><div class="sub">${currentMortRate}% of placed</div></div><div class="pred-snap-item"><div class="lbl">🐔 Live birds</div><div class="val">${pred.liveNow.toLocaleString()}</div></div><div class="pred-snap-item"><div class="lbl">🔄 Pickups done</div><div class="val">${(shed.pickups||[]).length} of ${dsCurrent.targetPickups}</div></div><div class="pred-snap-item"><div class="lbl">📐 Density today</div><div class="val" style="${densityStyle}">${densityDisplay} <span style="font-size:11px;font-weight:600;color:var(--muted);">kg/m²</span></div><div class="sub">${pred.liveNow.toLocaleString()} × ${forecastKg.toFixed(3)} kg ÷ 3,162 m²</div></div></div>`;
  const ratePct=shedMortRate(shed);
  const rateBarHtml=`<div class="mort-rate-bar"><span class="mr-label">🩺 Daily mortality rate</span><input type="range" id="mortRateSlider_${shed.id}" min="0" max="1" step="0.01" value="${ratePct}" data-mortrate-shed="${shed.id}" /><input type="number" id="mortRateNum_${shed.id}" min="0" max="${MAX_MORT_RATE_PCT}" step="0.01" value="${ratePct.toFixed(2)}" data-mortrate-shed="${shed.id}" /><span class="mr-unit">% of live birds / day</span></div>`;
  const curvePanelHtml=renderInYardCurvePanel(shed);
  const planBlockHtml=renderPickupPlanBlock(shed);
  const pickupRows=pickups.filter(p=>!p.isPredicted).map(p=>{
    const stored=(shed.pickups||[]).find(x=>iso(x.date)===iso(p.date))||{};
    const isManualWeight=!!stored.totalWeightKgManual;
    const hasExcelFrom=stored.totalWeightKgFromExcel!=null;
    const isManualSource=stored.source==='manual';
    const totalValue=(stored.totalWeightKg!=null)?stored.totalWeightKg:'';
    const warn=totalValue&&(totalValue<100||totalValue>40000);
    const avgRaw=(stored.totalWeightKg!=null&&stored.birds>0)?(stored.totalWeightKg/stored.birds):null;
    const avgInputVal=(avgRaw!=null)?Number(avgRaw.toFixed(5)):'';
    const avgWarn=(avgRaw!=null)&&(avgRaw<0.3||avgRaw>5);
    const estAvg=p.avgWeightKg?p.avgWeightKg.toFixed(3):'';
    const avgPlaceholder=(avgRaw==null&&estAvg)?estAvg:'kg/bird';
    const ageBadge=stored.ageOverride!=null?' *':'';
    const sourceBadge=isManualSource?`<span class="tag manual-source" style="font-size:9px;padding:1px 6px;margin-left:6px;">Manual</span>`:'';
    const showRevert=isManualWeight&&hasExcelFrom;
    return `<tr class="${p.isFinal?'is-final':''}"><td>${fmtShort(p.date)}${sourceBadge}</td><td class="num" title="${stored.ageOverride!=null?'Age manually set':'Age derived from placement date'}">${p.age}d${ageBadge}</td><td class="num">${p.birds.toLocaleString()}</td><td class="num"><input class="pred-pickup-input ${isManualWeight?'manual':''} ${warn?'warn':''}" type="number" step="1" min="0" value="${totalValue}" placeholder="${p.isEstWeight?'Standard est.':'total kg'}" data-pickup-shed="${shed.id}" data-pickup-date="${iso(p.date)}" data-pickup-field="total" title="${isManualWeight?'Manually edited':(p.isEstWeight?'No Excel weight — using standard curve estimate':'From Excel')}" /></td><td class="num"><input class="pred-pickup-input avg-input ${isManualWeight?'manual':''} ${avgWarn?'warn':''}" type="number" step="0.001" min="0" value="${avgInputVal}" placeholder="${avgPlaceholder}" data-pickup-shed="${shed.id}" data-pickup-date="${iso(p.date)}" data-pickup-field="avg" title="Average weight (kg/bird)" /></td><td style="text-align:right;"><div class="pickup-actions"><button class="pickup-actions-btn" type="button" data-pickup-actions-btn="${shed.id}|${iso(p.date)}" aria-label="Pickup actions">⋯</button><div class="pickup-actions-menu"><button type="button" data-pickup-edit="${shed.id}|${iso(p.date)}">✎ Edit pickup</button>${showRevert?`<button type="button" data-pickup-revert="${shed.id}|${iso(p.date)}">↺ Revert weight to Excel</button>`:''}<button type="button" class="danger" data-pickup-delete="${shed.id}|${iso(p.date)}">✕ Delete pickup</button></div></div></td></tr>`;
  }).join('');
  const realPickupCount=(shed.pickups||[]).length;
  const pickupTableHtml=realPickupCount===0?`<div class="forecast-empty">No pickups yet — estimates unlock after the first pickup.</div>`:`<div class="pickups-scroll"><table class="pickups-table" style="font-size:12.5px;min-width:560px;"><thead><tr><th>Date</th><th class="num">Age</th><th class="num">Birds</th><th class="num">Total wt (kg)</th><th class="num">Avg wt (kg/bird)</th><th style="width:44px;text-align:right;">Actions</th></tr></thead><tbody>${pickupRows}</tbody></table></div>`;
  const canAdd=realPickupCount<MAX_PICKUPS_PER_SHED;
  const pill=pickupPlanPillHtml(shed);
  const pickupHeaderHtml=`<h4 class="pickup-header"><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span>Pickup History — edit total or avg, both auto-compute</span>${pill}</span><button class="btn-pickup-add" data-pickup-add="${shed.id}" type="button" ${canAdd?'':'disabled'} title="${canAdd?'Add a pickup manually':'Maximum 5 pickups reached'}">＋ Add Actual Pickup</button></h4>`;
  const groupLabel=grp&&grp.hasData?`Group ${group} Combined Result`:`Group ${group} Result`;
  const groupShedsLabel=groupSheds.map(s=>`Shed ${s.id}`).join(' + ');
  const estimatesHtml=(groupHasData&&grp&&grp.hasData)?`<div class="pred-estimates-head"><span>📊 ${groupLabel}</span><span class="sub">· ${groupShedsLabel} · batch result</span></div><div class="pred-estimates"><div class="pred-est-tile amber"><div class="lbl">Est. Final Avg Weight</div><div class="val">${grp.avgWeight.toFixed(3)} <span style="font-size:12px;font-weight:600;color:var(--muted);">kg</span></div></div><div class="pred-est-tile"><div class="lbl">Est. Final FCR</div><div class="val">${grp.fcr.toFixed(3)}</div></div><div class="pred-est-tile green"><div class="lbl">Est. Final cFCR</div><div class="val">${grp.cfcr.toFixed(3)}</div></div><div class="pred-est-tile green"><div class="lbl">Est. Livability</div><div class="val">${grp.livability.toFixed(2)}%</div></div><div class="pred-est-tile"><div class="lbl">Est. Mortality</div><div class="val">${grp.totalMortalityEst.toLocaleString()}</div></div><div class="pred-est-tile"><div class="lbl">Est. Total Live Wt</div><div class="val">${fmtFeed(grp.totalLiveWeight)}</div></div><div class="pred-est-tile amber" style="grid-column: span 2;"><div class="lbl">Est. Final PIF</div><div class="val">${grp.pif.toFixed(2)}</div><div style="font-size:10px;color:var(--muted);margin-top:2px;">Overall score: weight × survival ÷ (age × FCR)</div></div></div>`:`<div class="pred-empty" style="margin-top:14px;"><strong>Group estimates unlock after the first reading or pickup.</strong><br>Enter shed scale readings at Day 7/14/21/28, or import Excel with pickup data.</div>`;
  const confidenceHtml=(groupHasData&&grp&&grp.hasData)?`<div class="pred-confidence"><span style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);">Group Confidence</span><div class="bar"><div class="bar-fill ${groupConf.cls}" style="width:${grp.confidence}%"></div></div><span class="pct" style="color:${groupConf.cls==='low'?'var(--danger)':(groupConf.cls==='medium'?'var(--primary-dark)':'var(--success)')};">${grp.confidence}%</span><span style="font-size:11px;color:var(--muted);">${groupConf.label}</span></div>`:'';
  const daysBehindHtml=renderDaysBehind(shed);
  const dailyPerfHtml=renderDailyPerformance(shed);
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
