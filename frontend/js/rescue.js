// =========================================================
// GovConnect – Rescue Module JS  (rescue.js)
// Phase 1 MVP – isolated, no civic.js dependency
// =========================================================

const API_BASE = 'http://127.0.0.1:5000';

// ─── Helpers ──────────────────────────────────────────────

async function apiGet(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiPatch(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function formatTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function severityBadge(severity) {
  const s = (severity || '').toLowerCase();
  const icons = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
  return `<span class="badge-severity ${s}">${icons[s] || ''} ${severity}</span>`;
}

function statusBadge(status) {
  const map = {
    'Auto Dispatched':            'auto-dispatch',
    'Pending Supervisor Approval':'pending-approval',
    'Pending Review':             'pending-review',
    'Team Dispatched':            'team-dispatched',
    'Case Closed':                'case-closed',
    'Rescue Completed':           'rescue-completed',
  };
  const cls = map[status] || 'pending-review';
  return `<span class="badge-rstate ${cls}">${status}</span>`;
}

// ─── GEOLOCATION ──────────────────────────────────────────

export function initGeolocation() {
  const btn         = document.getElementById('btn-locate');
  const latInput    = document.getElementById('lat-input');
  const lngInput    = document.getElementById('lng-input');
  const statusEl    = document.getElementById('location-status');
  const landmarkEl  = document.getElementById('landmark-fallback');

  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      statusEl.innerHTML = `<span class="location-error-label">❌ Geolocation not supported by your browser.</span>`;
      landmarkEl.style.display = 'block';
      return;
    }
    statusEl.innerHTML = `<span style="color:var(--text-muted);font-size:0.8rem;">📍 Detecting location...</span>`;
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        latInput.value = pos.coords.latitude.toFixed(6);
        lngInput.value = pos.coords.longitude.toFixed(6);
        statusEl.innerHTML = `<span class="location-detected-label">✓ Location detected (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})</span>`;
        btn.disabled = false;
        landmarkEl.style.display = 'none';
      },
      (err) => {
        statusEl.innerHTML = `<span class="location-error-label">⚠ Could not detect location. Please enter a landmark.</span>`;
        landmarkEl.style.display = 'block';
        btn.disabled = false;
      },
      { timeout: 8000 }
    );
  });
}

// ─── IMAGE UPLOAD PREVIEW ─────────────────────────────────

export function initImageUpload() {
  const fileInput   = document.getElementById('image-file');
  const previewZone = document.getElementById('image-preview-zone');
  if (!fileInput || !previewZone) return;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewZone.innerHTML = `<img src="${e.target.result}" class="image-preview-thumb" alt="Emergency photo">`;
      // Store base64 in a hidden field
      document.getElementById('image-b64').value = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── AI PROCESSING SCREEN ─────────────────────────────────

function showProcessing() {
  const overlay = document.getElementById('ai-processing-overlay');
  if (overlay) overlay.classList.add('active');

  // Animate steps
  const steps = document.querySelectorAll('.ai-step-item');
  steps.forEach((step, i) => {
    setTimeout(() => {
      // Mark previous as done
      if (i > 0) steps[i - 1].classList.remove('active');
      if (i > 0) steps[i - 1].classList.add('done');
      step.classList.add('active');
    }, i * 800);
  });
}

function hideProcessing() {
  const overlay = document.getElementById('ai-processing-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ─── SUBMISSION FORM ───────────────────────────────────────

export function initSubmissionForm() {
  const form = document.getElementById('rescue-submit-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const description = document.getElementById('description').value.trim();
    const landmark    = document.getElementById('landmark')?.value.trim() || '';
    const lat         = parseFloat(document.getElementById('lat-input').value) || null;
    const lng         = parseFloat(document.getElementById('lng-input').value) || null;
    const image_path  = document.getElementById('image-b64')?.value || null;

    if (!description) {
      showToast('Emergency description is required.', 'error');
      return;
    }

    showProcessing();
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const result = await apiPost('/api/rescue/submit', {
        description, landmark, lat, lng, image_path
      });

      // Short delay so the processing animation is visible
      await new Promise(r => setTimeout(r, 2800));
      hideProcessing();

      // Redirect to result page
      const eid = result.emergency_id;
      window.location.href = `result.html?id=${eid}`;

    } catch (err) {
      hideProcessing();
      if (submitBtn) submitBtn.disabled = false;
      showToast(`Submission failed: ${err.message}`, 'error');
    }
  });
}

// ─── RESULT PAGE ───────────────────────────────────────────

export async function initResultPage() {
  const params = new URLSearchParams(window.location.search);
  const eid    = params.get('id');
  const root   = document.getElementById('result-root');

  if (!root) return;

  if (!eid) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>No Emergency ID provided in URL.</p></div>`;
    return;
  }

  root.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading emergency data…</p></div>`;

  try {
    const data = await apiGet(`/api/rescue/emergencies/${eid}`);
    renderResultPage(data, root);
  } catch (err) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Could not load emergency ${eid}. ${err.message}</p></div>`;
  }
}

function renderResultPage(e, root) {
  const sevClass = e.severity.toLowerCase();

  const statusBannerClass = {
    'Auto Dispatched':             'auto-dispatch',
    'Pending Supervisor Approval': 'pending-approval',
    'Pending Review':              'pending-review',
  }[e.status] || 'pending-review';

  const statusIcon = {
    'Auto Dispatched':             '🚨',
    'Pending Supervisor Approval': '⏳',
    'Pending Review':              '📋',
  }[e.status] || '📋';

  const confidenceCircumference = 2 * Math.PI * 42; // r=42
  const dashOffset = confidenceCircumference * (1 - e.confidence_score / 100);

  const strokeColor = {
    critical: '#ec4899',
    high:     '#ef4444',
    medium:   '#f59e0b',
    low:      '#10b981'
  }[sevClass] || '#f59e0b';

  root.innerHTML = `
    <div class="result-layout">
      <!-- LEFT: Main result card -->
      <div class="result-hero-card glass-card severity-${sevClass}">
        <div class="emergency-id-badge">Emergency ID: ${e.emergency_id}</div>
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.5rem;">
          ${severityBadge(e.severity)}
        </div>
        <div class="result-incident-type">${e.incident_type}</div>
        <p style="color:var(--text-secondary);font-size:0.88rem;line-height:1.6;margin-top:0.5rem;">${e.description}</p>

        <div class="result-meta-grid">
          <div class="result-meta-item">
            <div class="label">🚒 Rescue Team</div>
            <div class="value" style="font-size:0.9rem;">${e.recommended_team}</div>
          </div>
          <div class="result-meta-item">
            <div class="label">⏱ Est. Response</div>
            <div class="value">${e.response_time_minutes} min</div>
          </div>
          <div class="result-meta-item">
            <div class="label">🏢 Depts Involved</div>
            <div class="value" style="font-size:0.82rem;">${e.recommended_departments || 'N/A'}</div>
          </div>
          <div class="result-meta-item">
            <div class="label">📍 Nearest Team</div>
            <div class="value" style="font-size:0.82rem;">${e.nearest_rescue_team || 'N/A'}</div>
          </div>
          <div class="result-meta-item">
            <div class="label">📍 Location</div>
            <div class="value" style="font-size:0.82rem;">${e.landmark || (e.lat ? `${e.lat}, ${e.lng}` : 'Not specified')}</div>
          </div>
          <div class="result-meta-item">
            <div class="label">🕐 Submitted</div>
            <div class="value" style="font-size:0.82rem;">${formatTime(e.submitted_at)}</div>
          </div>
        </div>

        <div class="result-status-banner ${statusBannerClass}">
          <span>${statusIcon}</span>
          <span>${e.status}</span>
        </div>
      </div>

      <!-- RIGHT: Confidence + actions -->
      <div style="display:flex;flex-direction:column;gap:1rem;">

        <!-- Confidence ring -->
        <div class="glass-card" style="text-align:center;">
          <p style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:1rem;">AI Confidence Score</p>
          <div class="confidence-ring-wrapper">
            <svg class="confidence-ring-svg" viewBox="0 0 100 100">
              <circle class="confidence-ring-bg" cx="50" cy="50" r="42"/>
              <circle class="confidence-ring-fg" cx="50" cy="50" r="42"
                stroke="${strokeColor}"
                stroke-dasharray="${confidenceCircumference.toFixed(1)}"
                stroke-dashoffset="${dashOffset.toFixed(1)}"
                style="transition: stroke-dashoffset 1.2s ease;"/>
            </svg>
            <div class="confidence-ring-label" style="color:${strokeColor};">${e.confidence_score}%</div>
          </div>
          <p style="font-size:0.78rem;color:var(--text-secondary);">Rule-based AI classification confidence</p>
        </div>

        <!-- Decision summary -->
        <div class="glass-card" style="background:rgba(245,158,11,0.05);border-color:rgba(245,158,11,0.15);">
          <h4 style="font-size:0.85rem;font-weight:700;color:var(--rescue-primary);margin-bottom:0.75rem;">📋 Decision Policy Applied</h4>
          <p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6;">${getPolicyExplanation(e.severity, e.status)}</p>
        </div>

        <!-- Track link -->
        <a href="track.html?id=${e.emergency_id}" class="btn" style="background:linear-gradient(135deg,#f59e0b,#fb923c);box-shadow:0 4px 20px rgba(245,158,11,.3);text-align:center;width:100%;">
          📡 Track This Emergency
        </a>

        <a href="index.html" class="btn btn-outline" style="width:100%;text-align:center;">
          ← Report Another Emergency
        </a>
      </div>
    </div>
  `;
}

function getPolicyExplanation(severity, status) {
  if (severity === 'Critical')
    return `🚨 <strong>Critical severity detected.</strong> As per Decision Policy, the ${status} has been automatically triggered and the Control Room has been notified.`;
  if (severity === 'High' || severity === 'Medium')
    return `⚠️ <strong>${severity} severity detected.</strong> This emergency is awaiting Supervisor approval before team dispatch. Response will begin once approved.`;
  return `📋 <strong>Low severity detected.</strong> This emergency has been logged and is in the Pending Review queue. A team will be assigned during regular assessment.`;
}

// ─── TRACKING PAGE ─────────────────────────────────────────

export async function initTrackingPage() {
  const params = new URLSearchParams(window.location.search);
  const eid    = params.get('id');
  const root   = document.getElementById('track-root');

  if (!root) return;

  if (!eid) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>No Emergency ID in URL. Add ?id=RES-XXXX</p></div>`;
    return;
  }

  root.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading tracking data…</p></div>`;

  try {
    const data = await apiGet(`/api/rescue/track/${eid}`);
    renderTrackingPage(data, root);
  } catch (err) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Could not load tracking for ${eid}.</p></div>`;
  }
}

const STEP_DESCRIPTIONS = [
  'Your emergency report has been received by the system.',
  'Our AI engine has analysed the emergency and classified it.',
  'A rescue team has been assigned to your emergency.',
  'The rescue team has accepted the assigned mission.',
  'The rescue team has started the journey to your location.',
  'The rescue team has reached the incident location.',
  'Rescue operation is currently in progress.',
  'Rescue operation has been completed successfully.'
];

function renderTrackingPage(data, root) {
  const { emergency: e, tracking_steps, current_step_index } = data;

  const stepsHTML = tracking_steps.map((step, i) => {
    let cls = '';
    if (i < current_step_index) cls = 'completed';
    else if (i === current_step_index) cls = 'active';

    return `
      <div class="step-item ${cls}">
        <div class="step-dot"></div>
        <div class="step-content">
          <div class="step-title">${step}</div>
          <div class="step-desc">${STEP_DESCRIPTIONS[i] || ''}</div>
        </div>
      </div>
    `;
  }).join('');

  root.innerHTML = `
    <div class="tracking-wrapper">
      <div class="tracking-hero glass-card">
        <div class="eid">Emergency ID: ${e.emergency_id}</div>
        ${severityBadge(e.severity)}
        <div class="current-status-label">${e.status}</div>
        <p style="font-size:0.82rem;color:var(--text-secondary);margin-top:0.5rem;">${e.incident_type} · ${e.recommended_team}</p>
      </div>

      <div class="glass-card" style="margin-bottom:1.5rem;">
        <div class="rescue-section-title">📡 Live Status Tracker</div>
        <div class="tracking-stepper">${stepsHTML}</div>
      </div>

      <!-- Emergency details -->
      <div class="glass-card" style="margin-bottom:1.5rem;">
        <div class="rescue-section-title">🔍 Emergency Details</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div>
            <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:.25rem;">DESCRIPTION</p>
            <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.5;">${e.description}</p>
          </div>
          <div style="display:flex;flex-direction:column;gap:.75rem;">
            <div>
              <p style="font-size:0.72rem;color:var(--text-muted);">LOCATION</p>
              <p style="font-size:0.88rem;">${e.landmark || (e.lat ? `${e.lat}, ${e.lng}` : 'Not specified')}</p>
            </div>
            <div>
              <p style="font-size:0.72rem;color:var(--text-muted);">DEPARTMENTS</p>
              <p style="font-size:0.88rem;">${e.recommended_departments || 'N/A'}</p>
            </div>
            <div>
              <p style="font-size:0.72rem;color:var(--text-muted);">NEAREST TEAM</p>
              <p style="font-size:0.88rem;">${e.nearest_rescue_team || 'N/A'}</p>
            </div>
            <div>
              <p style="font-size:0.72rem;color:var(--text-muted);">RESPONSE ETA</p>
              <p style="font-size:0.88rem;">${e.response_time_minutes} minutes</p>
            </div>
            <div>
              <p style="font-size:0.72rem;color:var(--text-muted);">SUBMITTED</p>
              <p style="font-size:0.88rem;">${formatTime(e.submitted_at)}</p>
            </div>
          </div>
        </div>
        ${e.supervisor_note ? `
        <div style="margin-top:1rem;padding:0.75rem 1rem;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;">
          <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:.25rem;">SUPERVISOR NOTE</p>
          <p style="font-size:0.85rem;">${e.supervisor_note}</p>
        </div>` : ''}
      </div>

      <div style="display:flex;gap:1rem;flex-wrap:wrap;">
        <a href="index.html" class="btn btn-outline" style="flex:1;min-width:160px;justify-content:center;">← Report New Emergency</a>
        <a href="control-room.html" class="btn" style="flex:1;min-width:160px;justify-content:center;background:linear-gradient(135deg,#f59e0b,#fb923c);box-shadow:0 4px 20px rgba(245,158,11,.3);">🖥 Control Room</a>
      </div>
    </div>
  `;
}

// ─── CONTROL ROOM ──────────────────────────────────────────

let controlData = [];
let activeFilter = 'all';
let pendingActionEid = null;
let pendingAction    = null;

export async function initControlRoom() {
  const root    = document.getElementById('control-root');
  const statsEl = document.getElementById('control-stats');
  if (!root) return;

  root.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading emergencies…</p></div>`;

  try {
    controlData = await apiGet('/api/rescue/emergencies');
    renderStats(statsEl);
    renderEmergencies(root, controlData);
    initFilters(root, statsEl);
  } catch (err) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Failed to load: ${err.message}. Is the Flask backend running?</p></div>`;
  }
}

function renderStats(el) {
  if (!el) return;
  const critical = controlData.filter(e => e.severity === 'Critical').length;
  const high     = controlData.filter(e => e.severity === 'High').length;
  const medium   = controlData.filter(e => e.severity === 'Medium').length;
  const total    = controlData.length;

  el.innerHTML = `
    <div class="control-stat-card total-stat">
      <div class="stat-label">Total Emergencies</div>
      <div class="stat-num">${total}</div>
    </div>
    <div class="control-stat-card critical-stat">
      <div class="stat-label">🔴 Critical</div>
      <div class="stat-num">${critical}</div>
    </div>
    <div class="control-stat-card high-stat">
      <div class="stat-label">🟠 High</div>
      <div class="stat-num">${high}</div>
    </div>
    <div class="control-stat-card medium-stat">
      <div class="stat-label">🟡 Medium</div>
      <div class="stat-num">${medium}</div>
    </div>
  `;
}

function renderEmergencies(root, data) {
  if (!data.length) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>No emergencies found for this filter.</p></div>`;
    return;
  }

  root.innerHTML = data.map(e => buildEmergencyCard(e)).join('');
  attachCardActions();
}

function buildEmergencyCard(e) {
  const sevClass = e.severity.toLowerCase();

  let actionsHTML = '';
  if (e.status === 'Case Closed') {
    actionsHTML = statusBadge(e.status);
  } else {
    let buttonsHTML = '';
    if (e.status === 'Pending Supervisor Approval' || e.status === 'Pending Review') {
      buttonsHTML = `
        <button class="btn-ec-approve" data-eid="${e.emergency_id}" data-action="approve">✅ Approve</button>
        <button class="btn-ec-close"   data-eid="${e.emergency_id}" data-action="close">✖ Close</button>
      `;
    } else {
      buttonsHTML = statusBadge(e.status);
    }

    const statuses = [
      'Complaint Submitted',
      'AI Analysis Complete',
      'Pending Supervisor Approval',
      'Pending Review',
      'Auto Dispatched',
      'Team Assigned',
      'Team Dispatched',
      'Team Arrived',
      'Rescue Completed',
      'Case Closed'
    ];

    const options = statuses.map(st => 
      `<option value="${st}" ${e.status === st ? 'selected' : ''}>${st}</option>`
    ).join('');

    actionsHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;width:100%;">
        <div style="display:flex;gap:0.5rem;align-items:center;">
          ${buttonsHTML}
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span style="font-size:0.75rem;color:var(--text-muted);">Status:</span>
          <select class="status-select" data-eid="${e.emergency_id}" style="background:rgba(255,255,255,0.05);color:var(--text-primary);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.25rem 0.5rem;font-size:0.8rem;outline:none;cursor:pointer;">
            ${options}
          </select>
        </div>
      </div>
    `;
  }

  return `
    <div class="emergency-card sev-${sevClass}">
      <div class="ec-top">
        <div>
          <div class="ec-id-row">
            <span class="ec-eid">${e.emergency_id}</span>
            ${severityBadge(e.severity)}
          </div>
          <div style="font-size:1rem;font-weight:700;font-family:var(--font-display);margin-top:.5rem;">${e.incident_type}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div class="ec-time">${formatTime(e.submitted_at)}</div>
        </div>
      </div>
      <div class="ec-description">${e.description}</div>
      <div class="ec-meta-row">
        <span class="ec-meta-item">🚒 Team: ${e.nearest_rescue_team || e.recommended_team}</span>
        <span class="ec-meta-item">🏢 Depts: ${e.recommended_departments || 'N/A'}</span>
        <span class="ec-meta-item">⏱ ${e.response_time_minutes} min ETA</span>
        <span class="ec-meta-item">🎯 ${e.confidence_score}% confidence</span>
        ${e.landmark ? `<span class="ec-meta-item">📍 ${e.landmark}</span>` : ''}
      </div>
      <div class="ec-actions">${actionsHTML}</div>
    </div>
  `;
}

function attachCardActions() {
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const eid    = btn.dataset.eid;
      const action = btn.dataset.action;

      if (action === 'approve' || action === 'close') {
        pendingActionEid = eid;
        pendingAction    = action;
        const modal = document.getElementById('action-modal');
        const title = document.getElementById('modal-action-title');
        if (title) title.textContent = action === 'approve' ? 'Approve & Dispatch Team' : 'Close Case';
        if (modal) modal.classList.add('active');
      } else if (action === 'modify') {
        pendingActionEid = eid;
        pendingAction    = 'modify';
        const modal = document.getElementById('action-modal');
        const title = document.getElementById('modal-action-title');
        if (title) title.textContent = 'Modify Emergency';
        if (modal) modal.classList.add('active');
      }
    });
  });

  // Wire up status-select change listeners
  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async (event) => {
      const eid = select.dataset.eid;
      const newStatus = event.target.value;
      
      try {
        const res = await apiPatch(`/api/rescue/emergencies/${eid}`, {
          status: newStatus,
          note: `Status manually updated to ${newStatus}`,
          actor: 'Supervisor'
        });
        showToast(res.message || 'Status updated.', 'success');
        
        // Reload data
        const root    = document.getElementById('control-root');
        const statsEl = document.getElementById('control-stats');
        controlData = await apiGet('/api/rescue/emergencies');
        renderStats(statsEl);
        const filtered = activeFilter === 'all'
          ? controlData
          : controlData.filter(e => e.severity.toLowerCase() === activeFilter || e.status.toLowerCase().includes(activeFilter));
        renderEmergencies(root, filtered);
      } catch (err) {
        showToast(`Failed to update status: ${err.message}`, 'error');
      }
    });
  });
}

export function initControlRoomModal() {
  const modal     = document.getElementById('action-modal');
  const closeBtn  = document.getElementById('modal-close');
  const confirmBtn= document.getElementById('modal-confirm');
  const noteInput = document.getElementById('supervisor-note');

  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!pendingActionEid || !pendingAction) return;
      const note = noteInput?.value.trim() || '';

      try {
        const res = await apiPatch(`/api/rescue/emergencies/${pendingActionEid}`, {
          action: pendingAction,
          note,
          actor: 'Supervisor'
        });
        modal.classList.remove('active');
        showToast(res.message || 'Action completed.', 'success');
        if (noteInput) noteInput.value = '';

        // Reload data
        const root    = document.getElementById('control-root');
        const statsEl = document.getElementById('control-stats');
        controlData = await apiGet('/api/rescue/emergencies');
        renderStats(statsEl);
        const filtered = activeFilter === 'all'
          ? controlData
          : controlData.filter(e => e.severity.toLowerCase() === activeFilter || e.status.toLowerCase().includes(activeFilter));
        renderEmergencies(root, filtered);

      } catch (err) {
        showToast(`Action failed: ${err.message}`, 'error');
      }
    });
  }
}

function initFilters(root, statsEl) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      const filtered = activeFilter === 'all'
        ? controlData
        : controlData.filter(e => e.severity.toLowerCase() === activeFilter || e.status.toLowerCase().includes(activeFilter));
      renderEmergencies(root, filtered);
    });
  });
}

// ─── RESCUE TEAM DASHBOARD ──────────────────────────────────
let teamData = [];
let selectedEid = null;
let simulatedLocation = null; // { lat, lng }

function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export async function initTeamDashboard() {
  const listEl = document.getElementById('missions-list');
  const detailsEl = document.getElementById('details-panel');
  if (!listEl) return;

  async function loadMissions() {
    try {
      const emergencies = await apiGet('/api/rescue/emergencies');
      
      const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
      teamData = emergencies.sort((a, b) => {
        const pA = priorityOrder[a.severity.toLowerCase()] ?? 99;
        const pB = priorityOrder[b.severity.toLowerCase()] ?? 99;
        return pA - pB;
      });

      const activeMissions = teamData.filter(e => e.status !== 'Case Closed');
      
      document.getElementById('mission-count').textContent = `${activeMissions.length} active`;
      
      if (!activeMissions.length) {
        listEl.innerHTML = `
          <div class="empty-state" style="padding: 2rem 1rem;">
            <div class="empty-icon">✅</div>
            <p>No active missions assigned.</p>
          </div>`;
        detailsEl.innerHTML = `
          <div class="empty-state" style="padding: 5rem 1rem;">
            <div class="empty-icon">🚒</div>
            <h3>No Mission Selected</h3>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.5rem;">Select an active mission from the left panel to begin field operations.</p>
          </div>`;
        return;
      }

      listEl.innerHTML = activeMissions.map(m => {
        const activeClass = selectedEid === m.emergency_id ? 'active' : '';
        const sev = m.severity.toLowerCase();
        
        return `
          <div class="mission-item ${activeClass} border-severity-${sev}" data-eid="${m.emergency_id}" style="padding: 1rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-left: 4px solid var(--border-color, #fff); border-radius: 8px; cursor: pointer; transition: all 0.2s ease; margin-bottom: 0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.35rem;">
              <span style="font-weight: 700; font-family: monospace; color: var(--rescue-primary);">${m.emergency_id}</span>
              ${severityBadge(m.severity)}
            </div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">${m.incident_type}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items:center;">
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">📍 ${m.landmark || 'No landmark'}</span>
              <span>${statusBadge(m.status)}</span>
            </div>
          </div>
        `;
      }).join('');

      document.querySelectorAll('.mission-item').forEach(item => {
        item.addEventListener('click', () => {
          selectedEid = item.dataset.eid;
          document.querySelectorAll('.mission-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          renderDetails();
        });
      });

      if (selectedEid) {
        renderDetails();
      }

    } catch (err) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <p>Error loading missions: ${err.message}</p>
        </div>`;
    }
  }

  function renderDetails() {
    const m = teamData.find(e => e.emergency_id === selectedEid);
    if (!m) {
      detailsEl.innerHTML = `
        <div class="empty-state" style="padding: 5rem 1rem;">
          <div class="empty-icon">🚒</div>
          <h3>Select a Mission</h3>
          <p style="color:var(--text-muted); font-size:0.85rem;">Select an emergency mission on the left to see details and perform actions.</p>
        </div>`;
      return;
    }

    const sev = m.severity.toLowerCase();
    
    const dispatchType = m.severity === 'Critical' ? 'Automatic Dispatch' : 'Manual Dispatch / Supervisor Approved';
    
    // Mission Action logic based on status
    const btnAcceptActive = (m.status === 'Team Assigned' || m.status === 'Auto Dispatched' || m.status === 'Complaint Submitted' || m.status === 'Complaint Received') ? 'btn-active' : 'btn-disabled';
    const btnJourneyActive = (m.status === 'Mission Accepted') ? 'btn-active' : 'btn-disabled';
    const btnArrivedActive = (m.status === 'Start Journey' || m.status === 'Team Dispatched') ? 'btn-active' : 'btn-disabled';
    const btnProgressActive = (m.status === 'Reached Location' || m.status === 'Team Arrived') ? 'btn-active' : 'btn-disabled';
    const btnCompleteActive = (m.status === 'Rescue in Progress') ? 'btn-active' : 'btn-disabled';

    const steps = [
      'Complaint Received',
      'AI Analysis Completed',
      'Team Assigned',
      'Mission Accepted',
      'Start Journey',
      'Reached Location',
      'Rescue in Progress',
      'Mission Completed'
    ];
    
    const statusMapping = {
      'Complaint Received': 0,
      'Complaint Submitted': 0,
      'AI Analysis Completed': 1,
      'AI Analysis Complete': 1,
      'Pending Supervisor Approval': 1,
      'Pending Review': 1,
      'Auto Dispatched': 2,
      'Team Assigned': 2,
      'Mission Accepted': 3,
      'Start Journey': 4,
      'Team Dispatched': 4,
      'Reached Location': 5,
      'Team Arrived': 5,
      'Rescue in Progress': 6,
      'Mission Completed': 7,
      'Rescue Completed': 7,
      'Case Closed': 7
    };
    
    const currentIndex = statusMapping[m.status] ?? 0;
    
    const timelineHTML = steps.map((step, idx) => {
      let cls = '';
      if (idx < currentIndex) cls = 'completed';
      else if (idx === currentIndex) cls = 'active';
      return `
        <div class="team-step-item ${cls}">
          <div class="team-step-dot"></div>
          <div class="team-step-title">${step}</div>
        </div>
      `;
    }).join('');

    detailsEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1.25rem;">
        
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:0.75rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <h2 style="font-family:var(--font-display); font-size:1.4rem; font-weight:700; color:var(--text-primary); margin:0;">${m.emergency_id}</h2>
              ${severityBadge(m.severity)}
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">Submitted: ${formatTime(m.submitted_at)}</p>
          </div>
          <div>
            ${statusBadge(m.status)}
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.85rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:1rem;">
          <div>
            <div style="color:var(--text-muted); font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">Incident Type</div>
            <div style="font-weight:700; font-size: 1rem; color:var(--text-primary);">${m.incident_type}</div>
          </div>
          <div>
            <div style="color:var(--text-muted); font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">ETA / Response Time</div>
            <div style="font-weight:700; font-size: 1rem; color:var(--text-primary);">${m.response_time_minutes} minutes</div>
          </div>
          <div>
            <div style="color:var(--text-muted); font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">Required Departments</div>
            <div style="color:var(--text-secondary);">${m.recommended_departments || 'Rescue Emergency Services'}</div>
          </div>
          <div>
            <div style="color:var(--text-muted); font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">Location Landmark</div>
            <div style="color:var(--text-secondary);">${m.landmark || (m.lat ? `${m.lat}, ${m.lng}` : 'Not Specified')}</div>
          </div>
        </div>

        <div>
          <div style="color:var(--text-muted); font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.35rem;">Description</div>
          <div style="font-size:0.9rem; color:var(--text-secondary); line-height:1.6; background:rgba(255,255,255,0.02); padding:0.75rem; border: 1px solid rgba(255,255,255,0.05); border-radius:6px;">
            ${m.description}
          </div>
        </div>

        ${m.image_path ? `
        <div>
          <div style="color:var(--text-muted); font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.35rem;">Incident Image</div>
          <div style="text-align:center; background:rgba(0,0,0,0.2); border-radius:6px; padding:0.5rem; border:1px solid rgba(255,255,255,0.05);">
            <img src="${m.image_path}" alt="Emergency Scene Photo" style="max-height: 200px; max-width: 100%; border-radius:4px; object-fit: contain;">
          </div>
        </div>` : ''}

        <div style="background: rgba(245, 158, 11, 0.04); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: 8px; padding: 0.85rem; font-size: 0.82rem;">
          <h4 style="color: var(--rescue-primary); margin:0 0 0.5rem 0; font-size:0.88rem; font-weight:700; display:flex; justify-content:space-between;">
            <span>🤖 AI Dispatch Summary</span>
            <span style="color:var(--rescue-primary); font-weight:700;">Confidence: ${m.confidence_score}%</span>
          </h4>
          <div style="display:flex; flex-direction:column; gap:0.35rem; color: var(--text-secondary);">
            <span><strong>Priority:</strong> ${m.severity}</span>
            <span><strong>Dispatch Type:</strong> ${dispatchType}</span>
            <span><strong>Assignment Reason:</strong> Keyword check matched incident type context "${m.incident_type}".</span>
          </div>
        </div>

        <div>
          <div style="color:var(--text-muted); font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">Mission Progress Timeline</div>
          <div class="team-timeline-stepper" style="display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.5rem;">
            ${timelineHTML}
          </div>
        </div>

        <!-- Geolocation Tracker Box -->
        <div id="distance-tracker-box" style="margin-bottom: 0.5rem; font-size: 0.82rem; padding: 0.6rem 0.85rem; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: 8px; display: none; justify-content: space-between; align-items: center; flex-wrap:wrap; gap: 0.5rem;">
          <span>📍 <strong>Distance to scene:</strong> <span id="distance-value">Checking GPS...</span></span>
          <button class="team-btn btn-secondary" id="btn-simulate-gps" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; margin: 0; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);">🎯 Simulate GPS at Scene</button>
        </div>

        <div>
          <div style="color:var(--text-muted); font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">Perform Actions</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; flex-wrap:wrap;">
            
            <button class="team-btn ${btnAcceptActive}" id="act-accept" data-status="Mission Accepted">
              🤝 Accept Mission
            </button>
            <button class="team-btn ${btnJourneyActive}" id="act-journey" data-status="Start Journey">
              ⚡ Start Journey
            </button>
            <button class="team-btn btn-disabled" id="act-arrived" data-status="Reached Location" disabled>
              📍 Reached Location
            </button>
            <button class="team-btn ${btnProgressActive}" id="act-progress" data-status="Rescue in Progress">
              🔨 Rescue in Progress
            </button>
            <button class="team-btn ${btnCompleteActive}" id="act-complete" data-status="Mission Completed" style="grid-column: span 2;">
              🏆 Mission Completed
            </button>
            
            <button class="team-btn btn-secondary" id="act-backup" style="font-size:0.8rem;">
              ⚠️ Request Backup
            </button>
            <button class="team-btn btn-secondary" id="act-contact" style="font-size:0.8rem;">
              📞 Contact Control
            </button>

          </div>
        </div>

      </div>
    `;

    // Distance computation and activation checks
    function checkDistanceAndRender() {
      const distBox = document.getElementById('distance-tracker-box');
      const distValEl = document.getElementById('distance-value');
      const actArrivedBtn = document.getElementById('act-arrived');
      
      if (!m.lat || !m.lng) {
        if (distBox) distBox.style.display = 'none';
        if (actArrivedBtn && (m.status === 'Start Journey' || m.status === 'Team Dispatched')) {
          actArrivedBtn.className = 'team-btn btn-active';
          actArrivedBtn.removeAttribute('disabled');
        }
        return;
      }
      
      if (distBox) distBox.style.display = 'flex';
      
      // Default to Hyderabad center if no GPS yet
      let crewLat = 17.3850;
      let crewLng = 78.4867;
      
      if (simulatedLocation) {
        crewLat = simulatedLocation.lat;
        crewLng = simulatedLocation.lng;
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          if (!simulatedLocation) {
            crewLat = pos.coords.latitude;
            crewLng = pos.coords.longitude;
            updateDistance(crewLat, crewLng);
          }
        }, err => {
          updateDistance(crewLat, crewLng);
        });
        return;
      }
      
      updateDistance(crewLat, crewLng);
      
      function updateDistance(clat, clng) {
        const dist = getHaversineDistance(clat, clng, m.lat, m.lng);
        const nearScene = dist <= 0.15; // 150m
        
        if (distValEl) {
          if (nearScene) {
            distValEl.innerHTML = `<span style="color:var(--color-success); font-weight:700;">📍 Arrived (${(dist*1000).toFixed(0)}m away)</span>`;
            if (distBox) distBox.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          } else {
            distValEl.textContent = `${dist.toFixed(2)} km away`;
            if (distBox) distBox.style.borderColor = 'rgba(59, 130, 246, 0.15)';
          }
        }
        
        if (actArrivedBtn) {
          if (m.status === 'Start Journey' || m.status === 'Team Dispatched') {
            if (nearScene) {
              actArrivedBtn.className = 'team-btn btn-active';
              actArrivedBtn.removeAttribute('disabled');
            } else {
              actArrivedBtn.className = 'team-btn btn-disabled';
              actArrivedBtn.setAttribute('disabled', 'true');
            }
          }
        }
      }
    }

    document.querySelectorAll('.team-btn[data-status]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.classList.contains('btn-disabled')) return;
        const targetStatus = btn.dataset.status;
        
        btn.disabled = true;
        try {
          const res = await apiPatch(`/api/rescue/emergencies/${selectedEid}`, {
            status: targetStatus,
            note: `Field Team updated status to: ${targetStatus}`,
            actor: 'Rescue Field Crew'
          });
          showToast(`Mission status updated: ${targetStatus}`, 'success');
          await loadMissions();
        } catch (err) {
          showToast(`Update failed: ${err.message}`, 'error');
          btn.disabled = false;
        }
      });
    });

    document.getElementById('act-backup')?.addEventListener('click', () => {
      showToast('Backup request dispatched to Control Room!', 'warning');
    });

    document.getElementById('act-contact')?.addEventListener('click', () => {
      alert('📞 Control Room Emergency Hotline: +91 40-23456789 (GovConnect HQ)');
    });

    checkDistanceAndRender();

    document.getElementById('btn-simulate-gps')?.addEventListener('click', () => {
      simulatedLocation = { lat: m.lat, lng: m.lng };
      showToast('GPS simulated at incident location!', 'success');
      checkDistanceAndRender();
    });
  }

  await loadMissions();
}
