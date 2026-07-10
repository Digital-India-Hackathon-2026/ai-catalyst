// =========================================================
// GovConnect – Rescue Module JS  (rescue.js)
// Phase 1 MVP – isolated, no civic.js dependency
// =========================================================

const API_BASE = 'http://127.0.0.1:5000';

// ─── Module Scope Geolocation & Team Constants ────────────
export const TEAM_BASES = {
  // Category fallbacks
  'Fire Response Unit':             { lat: 17.4374, lng: 78.4482, name: 'Ameerpet Fire Station Unit', icon: '🚒' },
  'Flood Rescue (NDRF)':            { lat: 17.4399, lng: 78.5020, name: 'Secunderabad NDRF Battalion', icon: '🚤' },
  'SDRF Structural Response Team':  { lat: 17.4265, lng: 78.4124, name: 'Jubilee Hills SDRF Team', icon: '🚜' },
  'Hazmat Response Unit':           { lat: 17.4483, lng: 78.3741, name: 'Gachibowli Hazmat Station', icon: '🚐' },
  'Emergency Response Team':        { lat: 17.4486, lng: 78.3908, name: 'Madhapur Patrol Unit', icon: '🚑' },
  'Electrical Emergency Unit':      { lat: 17.4447, lng: 78.4664, name: 'Begumpet Power Grid Response', icon: '🚐' },
  'Civic Emergency Team':           { lat: 17.4699, lng: 78.3678, name: 'Kondapur Municipal Crew', icon: '🚛' },

  // Sub-units
  'Fire Unit 1':                    { lat: 17.4374, lng: 78.4482, name: 'Ameerpet Fire Station Base', icon: '🚒' },
  'Fire Unit 2':                    { lat: 17.4420, lng: 78.5012, name: 'Secunderabad Fire Station Base', icon: '🚒' },
  'Fire Unit 3':                    { lat: 17.4486, lng: 78.3908, name: 'Madhapur Fire Station Base', icon: '🚒' },
  'NDRF Unit A':                    { lat: 17.4399, lng: 78.5020, name: 'Secunderabad NDRF Battalion Base', icon: '🚤' },
  'NDRF Unit B':                    { lat: 17.4483, lng: 78.3741, name: 'Gachibowli NDRF Battalion Base', icon: '🚤' },
  'SDRF Unit 1':                    { lat: 17.4265, lng: 78.4124, name: 'Jubilee Hills SDRF Base', icon: '🚜' },
  'SDRF Unit 2':                    { lat: 17.4447, lng: 78.4664, name: 'Begumpet SDRF Base', icon: '🚜' },
  'Hazmat Unit Alpha':              { lat: 17.4483, lng: 78.3741, name: 'Gachibowli Hazmat Station Base', icon: '🚐' },
  'Hazmat Unit Beta':               { lat: 17.4486, lng: 78.3908, name: 'Madhapur Hazmat Station Base', icon: '🚐' },
  'ERT Unit 1':                     { lat: 17.4486, lng: 78.3908, name: 'Madhapur ERT Base', icon: '🚑' },
  'ERT Unit 2':                     { lat: 17.4447, lng: 78.4664, name: 'Begumpet ERT Base', icon: '🚑' },
  'EE Unit A':                      { lat: 17.4447, lng: 78.4664, name: 'Begumpet Power Grid Base', icon: '🚐' },
  'EE Unit B':                      { lat: 17.4699, lng: 78.3678, name: 'Kondapur Power Grid Base', icon: '🚐' },
  'Civic Crew 1':                   { lat: 17.4699, lng: 78.3678, name: 'Kondapur Municipal Base', icon: '🚛' },
  'Civic Crew 2':                   { lat: 17.4265, lng: 78.4124, name: 'Jubilee Hills Municipal Base', icon: '🚛' }
};


export const STATUS_MAPPING = {
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

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

export function lerpPos(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

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

let googleMapsLoadedPromise = null;

export function ensureGoogleMapsLoaded() {
  if (window.google && window.google.maps) {
    return Promise.resolve();
  }
  if (googleMapsLoadedPromise) {
    return googleMapsLoadedPromise;
  }

  googleMapsLoadedPromise = new Promise(async (resolve, reject) => {
    try {
      const config = await apiGet('/api/rescue/config/maps-key');
      const key = config.key || '';
      if (!key) {
        reject(new Error("Maps API Key missing"));
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=initGoogleMap`;
      script.async = true;
      script.defer = true;
      
      window.initGoogleMap = () => {
        resolve();
      };
      
      script.onerror = (err) => {
        reject(err);
      };
      
      document.head.appendChild(script);
    } catch (err) {
      reject(err);
    }
  });
  
  return googleMapsLoadedPromise;
}

let leafletLoadedPromise = null;

export function ensureLeafletLoaded() {
  if (window.L) {
    return Promise.resolve();
  }
  if (leafletLoadedPromise) {
    return leafletLoadedPromise;
  }
  leafletLoadedPromise = new Promise((resolve) => {
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    
    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      resolve();
    };
    document.head.appendChild(script);
  });
  return leafletLoadedPromise;
}

// ── Persistent map instance cache (by container ID) ──────────
const _mapInstances = {};

export async function renderUnifiedMap(containerId, center, zoom, markers = []) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  // 1. Fetch maps key config (cached via module-level promise)
  let key = '';
  try {
    const config = await apiGet('/api/rescue/config/maps-key');
    key = config.key || '';
  } catch (err) {
    console.warn("Could not fetch maps API key:", err);
  }

  const isDummy = !key || key.toLowerCase().includes('dummy') || key === 'undefined';

  // ── EXISTING MAP: just update markers ─────────────────────
  const existing = _mapInstances[containerId];
  if (existing) {
    // Remove old markers
    existing.markerRefs.forEach(ref => {
      if (existing.type === 'leaflet') ref.remove();
      else if (existing.type === 'google') ref.setMap(null);
    });
    // Remove old polylines
    existing.polylineRefs.forEach(ref => {
      if (existing.type === 'leaflet') ref.remove();
      else if (existing.type === 'google') ref.setMap(null);
    });
    existing.markerRefs = [];
    existing.polylineRefs = [];

    // Re-add markers on existing map
    const rawMap = existing.map;
    const group = [];

    markers.forEach(m => {
      let newMarker;
      if (existing.type === 'leaflet') {
        if (m.icon && typeof m.icon === 'string') {
          const icon = L.divIcon({
            html: `<div style="font-size:28px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8)); line-height:1;">${m.icon}</div>`,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });
          newMarker = L.marker([m.pos.lat, m.pos.lng], { icon }).addTo(rawMap);
        } else {
          newMarker = L.circleMarker([m.pos.lat, m.pos.lng], {
            radius: 9,
            fillColor: m.color || '#3b82f6',
            fillOpacity: 0.92,
            color: '#ffffff',
            weight: 2.5
          }).addTo(rawMap);
        }
        if (m.info) newMarker.bindPopup(m.info);
        group.push([m.pos.lat, m.pos.lng]);
      } else if (existing.type === 'google') {
        const markerOpts = { position: m.pos, map: rawMap, title: m.title };
        if (m.icon && typeof m.icon === 'string') {
          markerOpts.label = { text: m.icon, fontSize: '22px' };
          markerOpts.icon = { path: google.maps.SymbolPath.CIRCLE, scale: 0 };
        } else {
          markerOpts.icon = {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            fillColor: m.color || '#3b82f6', fillOpacity: 0.9,
            strokeWeight: 2, strokeColor: '#ffffff', scale: 6
          };
        }
        newMarker = new google.maps.Marker(markerOpts);
        if (m.info) {
          const iw = new google.maps.InfoWindow({ content: m.info });
          newMarker.addListener('click', () => iw.open(rawMap, newMarker));
        }
      }
      if (newMarker) existing.markerRefs.push(newMarker);
    });

    // Refit bounds for Leaflet
    if (existing.type === 'leaflet' && group.length > 1) {
      rawMap.fitBounds(group, { padding: [40, 40] });
    }

    return { type: existing.type, map: rawMap, rawMap, addPolyline: existing.addPolyline };
  }

  // ── NEW MAP ────────────────────────────────────────────────
  container.innerHTML = '';

  const instance = {
    type: null,
    map: null,
    markerRefs: [],
    polylineRefs: [],
    addPolyline: null
  };

  if (!isDummy) {
    try {
      await ensureGoogleMapsLoaded();
      const gmap = new google.maps.Map(container, {
        center, zoom, styles: MAP_DARK_STYLES,
        disableDefaultUI: true, zoomControl: true
      });
      instance.type = 'google';
      instance.map = gmap;
      instance.addPolyline = (pts, opts) => {
        const pl = new google.maps.Polyline({ path: pts, map: gmap, ...opts });
        instance.polylineRefs.push(pl);
        return pl;
      };

      const bounds = new google.maps.LatLngBounds();
      markers.forEach(m => {
        const markerOpts = { position: m.pos, map: gmap, title: m.title };
        if (m.icon && typeof m.icon === 'string') {
          markerOpts.label = { text: m.icon, fontSize: '22px' };
          markerOpts.icon = { path: google.maps.SymbolPath.CIRCLE, scale: 0 };
        } else {
          markerOpts.icon = {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            fillColor: m.color || '#3b82f6', fillOpacity: 0.9,
            strokeWeight: 2, strokeColor: '#ffffff', scale: 6
          };
        }
        const gm = new google.maps.Marker(markerOpts);
        if (m.info) {
          const iw = new google.maps.InfoWindow({ content: m.info });
          gm.addListener('click', () => iw.open(gmap, gm));
        }
        instance.markerRefs.push(gm);
        bounds.extend(m.pos);
      });

      if (markers.length > 1) {
        gmap.fitBounds(bounds);
        const l = google.maps.event.addListener(gmap, 'idle', () => {
          if (gmap.getZoom() > 15) gmap.setZoom(15);
          google.maps.event.removeListener(l);
        });
      }

      _mapInstances[containerId] = instance;
      return { type: 'google', map: gmap, rawMap: gmap, addPolyline: instance.addPolyline };
    } catch (gErr) {
      console.warn("Google Maps failed, falling back to Leaflet:", gErr);
    }
  }

  // Leaflet fallback
  await ensureLeafletLoaded();

  const lmap = L.map(container, { zoomControl: true, attributionControl: false })
    .setView([center.lat, center.lng], zoom);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20
  }).addTo(lmap);

  instance.type = 'leaflet';
  instance.map = lmap;
  instance.addPolyline = (pts, opts) => {
    const pl = L.polyline(pts, opts).addTo(lmap);
    instance.polylineRefs.push(pl);
    return pl;
  };

  const group = [];
  markers.forEach(m => {
    let lm;
    if (m.icon && typeof m.icon === 'string') {
      const icon = L.divIcon({
        html: `<div style="font-size:28px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8)); line-height:1;">${m.icon}</div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      lm = L.marker([m.pos.lat, m.pos.lng], { icon }).addTo(lmap);
    } else {
      lm = L.circleMarker([m.pos.lat, m.pos.lng], {
        radius: 9,
        fillColor: m.color || '#3b82f6',
        fillOpacity: 0.92,
        color: '#ffffff',
        weight: 2.5
      }).addTo(lmap);
    }
    if (m.info) lm.bindPopup(m.info);
    instance.markerRefs.push(lm);
    group.push([m.pos.lat, m.pos.lng]);
  });

  if (group.length > 1) {
    lmap.fitBounds(group, { padding: [40, 40] });
  }

  _mapInstances[containerId] = instance;
  return { type: 'leaflet', map: lmap, rawMap: lmap, addPolyline: instance.addPolyline };
}



export const MAP_DARK_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#1a1a24" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a24" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7b7c85" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#fb923c" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f59e0b" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#12261e" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b7280" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2d2d3a" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#21212c" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca3af" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3e3e4f" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#2d2d3a" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#fb923c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#272733" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#fb923c" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#0f172a" }],
  },
];


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

  const CLOSED_STATUSES = ['Mission Completed', 'Rescue Completed', 'Case Closed'];
  let refreshInterval = null;

  async function fetchAndRender() {
    try {
      const data = await apiGet(`/api/rescue/emergencies/${eid}`);
      renderResultPage(data, root);

      if (CLOSED_STATUSES.includes(data.status)) {
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      }
    } catch (err) {
      root.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Could not load emergency ${eid}. ${err.message}</p></div>`;
      if (refreshInterval) clearInterval(refreshInterval);
    }
  }

  await fetchAndRender();
  // Auto-refresh every 10 seconds for live map & status updates
  refreshInterval = setInterval(fetchAndRender, 10000);
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

  // Parse complete Gemini JSON response
  let gemini = {};
  try {
    if (e.ai_analysis_json) {
      gemini = JSON.parse(e.ai_analysis_json);
    }
  } catch (err) {
    console.error("Error parsing ai_analysis_json:", err);
  }

  const aiSummary = gemini.ai_summary || e.ai_decision_summary || 'No summary available.';
  const requiredDepts = Array.isArray(gemini.required_departments) ? gemini.required_departments : (e.recommended_departments ? e.recommended_departments.split(', ') : []);
  const risks = Array.isArray(gemini.possible_risks) ? gemini.possible_risks : (e.possible_risks ? e.possible_risks.split(', ') : []);
  const actions = Array.isArray(gemini.suggested_rescue_actions) ? gemini.suggested_rescue_actions : (e.suggested_actions ? e.suggested_actions.split(', ') : []);
  const address = gemini.address || 'N/A';
  const landmark = gemini.landmark || e.landmark || 'N/A';

  const confidenceCircumference = 2 * Math.PI * 42; // r=42
  const dashOffset = confidenceCircumference * (1 - e.confidence_score / 100);

  const strokeColor = {
    critical: '#ec4899',
    high:     '#ef4444',
    medium:   '#f59e0b',
    low:      '#10b981'
  }[sevClass] || '#f59e0b';

  // Format list items into clean lists
  const deptsHTML = requiredDepts.map(d => `<span style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); color:var(--rescue-primary); padding:0.15rem 0.5rem; border-radius:20px; font-size:0.75rem; white-space:nowrap;">${d}</span>`).join(' ') || 'N/A';
  const risksHTML = risks.map(r => `<li style="margin-bottom:0.35rem; color:#fca5a5;">⚠️ ${r}</li>`).join('') || '<li style="color:var(--text-muted);">No immediate risks listed</li>';
  const actionsHTML_list = actions.map(a => `<li style="margin-bottom:0.35rem; color:#6ee7b7;">✔️ ${a}</li>`).join('') || '<li style="color:var(--text-muted);">No suggested actions listed</li>';

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
            <div class="label">🚒 Recommended Team</div>
            <div class="value" style="font-size:0.9rem;">${e.recommended_team}</div>
          </div>
          <div class="result-meta-item">
            <div class="label">⏱ Est. Response Time</div>
            <div class="value">${e.response_time_minutes} min</div>
          </div>
          <div class="result-meta-item">
            <div class="label">🏢 Depts Involved</div>
            <div class="value" style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-top:0.25rem;">${deptsHTML}</div>
          </div>
          <div class="result-meta-item">
            <div class="label">📍 Assigned Patrol Unit</div>
            <div class="value" style="font-size:0.82rem;">${e.nearest_rescue_team || 'N/A'}</div>
          </div>
          <div class="result-meta-item">
            <div class="label">📍 Context Landmark</div>
            <div class="value" style="font-size:0.82rem;">${landmark}</div>
          </div>
          <div class="result-meta-item">
            <div class="label">🏠 Context Address</div>
            <div class="value" style="font-size:0.82rem;">${address}</div>
          </div>
        </div>

        <!-- Gemini AI Detailed Diagnosis -->
        <div style="margin-top:1.5rem; border-top:1px solid rgba(255,255,255,0.08); padding-top:1rem;">
          <h4 style="font-size:0.9rem; font-weight:700; color:var(--rescue-primary); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
            🧠 Gemini AI Analysis & Diagnostic Insights
          </h4>
          <div style="display:flex; flex-direction:column; gap:1rem; font-size:0.85rem; line-height:1.5; color:var(--text-secondary);">
            <div>
              <strong style="color:var(--text-primary); display:block; margin-bottom:0.25rem;">📝 AI Summary:</strong>
              <span style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.6rem 0.8rem; border-radius:6px; display:block;">
                ${aiSummary}
              </span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:0.25rem;">
              <div>
                <strong style="color:var(--text-primary); display:block; margin-bottom:0.25rem;">⚠️ Possible Risks:</strong>
                <ul style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.12); padding:0.75rem 1rem; border-radius:6px; min-height:80px; margin:0; list-style:none;">
                  ${risksHTML}
                </ul>
              </div>
              <div>
                <strong style="color:var(--text-primary); display:block; margin-bottom:0.25rem;">🚒 Suggested Rescue Actions:</strong>
                <ul style="background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.12); padding:0.75rem 1rem; border-radius:6px; min-height:80px; margin:0; list-style:none;">
                  ${actionsHTML_list}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div class="result-status-banner ${statusBannerClass}" style="margin-top:1.5rem;">
          <span>${statusIcon}</span>
          <span>${e.status}</span>
        </div>

        <!-- Embedded Live Map -->
        <div style="margin-top:1.5rem; border-top:1px solid rgba(255,255,255,0.08); padding-top:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <h4 style="font-size:0.9rem; font-weight:700; color:var(--rescue-primary); margin:0;">
              🗺️ Live Incident & Team Map
            </h4>
            <span style="font-size:0.75rem; color:var(--text-muted);" id="result-status-text">Locating rescue unit...</span>
          </div>
          <div id="result-map" style="width:100%; height:260px; border-radius:8px; background:rgba(0,0,0,0.1); border:1px solid rgba(255,255,255,0.05); margin-bottom:0.5rem;"></div>
          <button class="team-btn" id="btn-navigate-gmaps" style="width:100%; margin-top:0.25rem; background:linear-gradient(135deg,#3b82f6,#1d4ed8); border:none; font-weight:700; color:#ffffff; font-size:0.8rem; display:flex; align-items:center; justify-content:center; gap:0.4rem; padding:0.6rem 1rem; cursor:pointer; border-radius:8px;">
            🚗 Navigate to Scene
          </button>
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
          <p style="font-size:0.78rem;color:var(--text-secondary);">Gemini AI classification confidence</p>
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

  // Render Map with Live Vehicle Tracking
  if (e.lat && e.lng) {
    const assignedUnit = e.nearest_rescue_team || e.recommended_team;
    const teamBase = TEAM_BASES[assignedUnit] || TEAM_BASES[e.recommended_team] || { lat: 17.3850, lng: 78.4867, name: 'Central Command Base', icon: '🚒' };
    const incidentPos = { lat: parseFloat(e.lat), lng: parseFloat(e.lng) };
    const statusIndex = STATUS_MAPPING[e.status] ?? 0;

    let teamPos = { ...teamBase };
    let trackerStatus = '';
    let progressFraction = 0;
    let isRealGPS = false;

    if (e.team_lat && e.team_lng && statusIndex >= 2 && statusIndex < 7) {
      teamPos = { lat: parseFloat(e.team_lat), lng: parseFloat(e.team_lng) };
      isRealGPS = true;
      const totalD = haversineKm(teamBase, incidentPos);
      const coveredD = haversineKm(teamBase, teamPos);
      progressFraction = totalD > 0 ? Math.min(coveredD / totalD, 0.95) : 0.5;
    }

    if (statusIndex <= 1) {
      teamPos = { ...teamBase };
      trackerStatus = `⏳ Awaiting dispatch — ${e.status}`;
    } else if (statusIndex === 2 || statusIndex === 3) {
      teamPos = { ...teamBase };
      trackerStatus = `🏢 ${assignedUnit} — ${e.status} at ${teamBase.name}`;
    } else if (statusIndex === 4) {
      if (!isRealGPS) {
        const updatedAt = e.updated_at ? new Date(e.updated_at) : new Date();
        const etaMs = (e.response_time_minutes || 15) * 60 * 1000;
        const elapsedMs = Date.now() - updatedAt.getTime();
        progressFraction = Math.min(elapsedMs / etaMs, 0.92);
        teamPos = lerpPos(teamBase, incidentPos, progressFraction);
      }
      const distLeft = haversineKm(teamPos, incidentPos);
      const pct = Math.round(progressFraction * 100);
      trackerStatus = `🚨 ${teamBase.icon} En Route — ${distLeft.toFixed(1)} km away (${pct}% of journey)${isRealGPS ? ' (Live GPS)' : ''}`;
    } else if (statusIndex === 5) {
      teamPos = { ...incidentPos };
      trackerStatus = `📍 ${teamBase.icon} Arrived at scene — ${e.status}`;
    } else {
      teamPos = { ...incidentPos };
      trackerStatus = `🔨 ${teamBase.icon} ${e.status}`;
    }

    setTimeout(async () => {
      const totalDist = haversineKm(teamBase, incidentPos).toFixed(1);
      const markers = [
        {
          pos: incidentPos,
          title: `📍 Emergency Location`,
          color: '#ef4444',
          info: `<div style="color:#000; font-size:0.82rem; padding:0.25rem;">
            📍 <strong>Incident Location</strong><br>
            ${e.incident_type}<br>
            <span style="color:#ef4444; font-weight:700;">${e.severity} Priority</span>
          </div>`
        }
      ];

      if (statusIndex >= 2) {
        markers.push({
          pos: teamBase,
          title: `🏢 ${assignedUnit} Base`,
          color: '#3b82f6',
          info: `<div style="color:#000; font-size:0.82rem; padding:0.25rem;">
            🏢 <strong>Team Base</strong><br>
            ${teamBase.name}<br>
            Total distance: ${totalDist} km
          </div>`
        });

        const distTravelled = (haversineKm(teamBase, teamPos)).toFixed(1);
        markers.push({
          pos: teamPos,
          title: `${teamBase.icon} ${assignedUnit}`,
          icon: teamBase.icon,
          info: `<div style="color:#000; font-size:0.82rem; padding:0.25rem;">
            ${teamBase.icon} <strong>${assignedUnit}</strong><br>
            Status: <strong>${e.status}</strong><br>
            ${statusIndex === 4 ? `Travelled: ${distTravelled} km of ${totalDist} km` : ''}
          </div>`
        });
      }


      const mapResult = await renderUnifiedMap('result-map', incidentPos, 13, markers);

      // Update status text in UI
      const statusTextEl = document.getElementById('result-status-text');
      if (statusTextEl) {
        statusTextEl.textContent = trackerStatus;
        statusTextEl.style.color = statusIndex === 4 ? '#fb923c' : 'var(--text-muted)';
        statusTextEl.style.fontWeight = statusIndex === 4 ? '700' : '400';
      }

      // Draw route lines on result map
      if (mapResult && mapResult.addPolyline && statusIndex >= 2) {
        mapResult.addPolyline(
          [[teamBase.lat, teamBase.lng], [incidentPos.lat, incidentPos.lng]],
          mapResult.type === 'leaflet'
            ? { color: '#fb923c', weight: 3, dashArray: '6, 8', opacity: 0.75 }
            : { strokeColor: '#fb923c', strokeOpacity: 0.6, strokeWeight: 3, geodesic: true }
        );
        if (statusIndex === 4 && progressFraction > 0) {
          mapResult.addPolyline(
            [[teamBase.lat, teamBase.lng], [teamPos.lat, teamPos.lng]],
            mapResult.type === 'leaflet'
              ? { color: '#22c55e', weight: 4, opacity: 0.9 }
              : { strokeColor: '#22c55e', strokeOpacity: 0.9, strokeWeight: 4, geodesic: true }
          );
        }
      }

      // Bind Navigate button click
      document.getElementById('btn-navigate-gmaps')?.addEventListener('click', () => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}`, '_blank');
      });
    }, 100);
  }
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

  const CLOSED_STATUSES = ['Mission Completed', 'Rescue Completed', 'Case Closed'];
  let refreshInterval = null;

  async function fetchAndRender() {
    try {
      const data = await apiGet(`/api/rescue/track/${eid}`);
      renderTrackingPage(data, root);

      // Stop polling if mission is closed
      if (CLOSED_STATUSES.includes(data.emergency?.status)) {
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      }
    } catch (err) {
      root.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Could not load tracking for ${eid}.</p></div>`;
      if (refreshInterval) clearInterval(refreshInterval);
    }
  }

  await fetchAndRender();

  // Auto-refresh every 10 seconds for live updates
  refreshInterval = setInterval(fetchAndRender, 10000);
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

      <!-- Live Team Tracking Map -->
      <div class="glass-card" style="margin-bottom:1.5rem; padding:0; overflow:hidden;">
        <div style="padding:1rem; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:0.95rem; font-family:var(--font-display); color:var(--rescue-primary);">🗺️ Live Team Tracker Map</h3>
          <span style="font-size:0.75rem; color:var(--text-muted);" id="tracker-status-text">Locating rescue unit...</span>
        </div>
        <div id="tracker-map" style="width:100%; height:320px; background:rgba(0,0,0,0.1);"></div>
        <div style="padding:0.75rem 1rem; border-top:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.01);">
          <button class="team-btn" id="btn-navigate-gmaps" style="width:100%; background:linear-gradient(135deg,#3b82f6,#1d4ed8); border:none; font-weight:700; color:#ffffff; font-size:0.8rem; display:flex; align-items:center; justify-content:center; gap:0.4rem; padding:0.6rem 1rem; cursor:pointer; border-radius:8px;">
            🚗 Navigate to Scene
          </button>
        </div>
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

  // Team Tracking Simulation on Map — always show map, use team base as fallback if GPS missing
  {
    const assignedUnit = e.nearest_rescue_team || e.recommended_team;
    const teamBase = TEAM_BASES[assignedUnit] || TEAM_BASES[e.recommended_team] || { lat: 17.3850, lng: 78.4867, name: 'Central Command Base', icon: '🚒' };
    const incidentPos = (e.lat && e.lng)
      ? { lat: parseFloat(e.lat), lng: parseFloat(e.lng) }
      : { lat: teamBase.lat + 0.005, lng: teamBase.lng + 0.005 };

    const statusIndex = current_step_index;

    // ── Compute vehicle position based on time elapsed or live GPS ──
    let teamPos = { ...teamBase };
    let trackerStatus = '';
    let progressFraction = 0;
    let isRealGPS = false;

    if (e.team_lat && e.team_lng && statusIndex >= 2 && statusIndex < 7) {
      teamPos = { lat: parseFloat(e.team_lat), lng: parseFloat(e.team_lng) };
      isRealGPS = true;
      const totalD = haversineKm(teamBase, incidentPos);
      const coveredD = haversineKm(teamBase, teamPos);
      progressFraction = totalD > 0 ? Math.min(coveredD / totalD, 0.95) : 0.5;
    }

    if (statusIndex <= 1) {
      teamPos = { ...teamBase };
      trackerStatus = `⏳ Awaiting dispatch — ${e.status}`;
    } else if (statusIndex === 2 || statusIndex === 3) {
      teamPos = { ...teamBase };
      trackerStatus = `🏢 ${assignedUnit} — ${e.status} at ${teamBase.name}`;
    } else if (statusIndex === 4) {
      if (!isRealGPS) {
        const updatedAt = e.updated_at ? new Date(e.updated_at) : new Date();
        const etaMs = (e.response_time_minutes || 15) * 60 * 1000;
        const elapsedMs = Date.now() - updatedAt.getTime();
        progressFraction = Math.min(elapsedMs / etaMs, 0.92);
        teamPos = lerpPos(teamBase, incidentPos, progressFraction);
      }
      const distLeft = haversineKm(teamPos, incidentPos);
      const pct = Math.round(progressFraction * 100);
      trackerStatus = `🚨 ${teamBase.icon} En Route — ${distLeft.toFixed(1)} km away (${pct}% of journey)${isRealGPS ? ' (Live GPS)' : ''}`;
    } else if (statusIndex === 5) {
      teamPos = { ...incidentPos };
      trackerStatus = `📍 ${teamBase.icon} Arrived at scene — ${e.status}`;
    } else {
      teamPos = { ...incidentPos };
      trackerStatus = `🔨 ${teamBase.icon} ${e.status}`;
    }

    setTimeout(async () => {
      const totalDist = haversineKm(teamBase, incidentPos).toFixed(1);
      const markers = [
        {
          pos: incidentPos,
          title: `📍 Emergency Location`,
          color: '#ef4444',
          info: `<div style="color:#000; font-size:0.82rem; padding:0.25rem;">
            📍 <strong>Incident Location</strong><br>
            ${e.incident_type}<br>
            <span style="color:#ef4444; font-weight:700;">${e.severity} Priority</span>
          </div>`
        }
      ];

      if (statusIndex >= 2) {
        markers.push({
          pos: teamBase,
          title: `🏢 ${assignedUnit} Base`,
          color: '#3b82f6',
          info: `<div style="color:#000; font-size:0.82rem; padding:0.25rem;">
            🏢 <strong>Team Base</strong><br>
            ${teamBase.name}<br>
            Total distance: ${totalDist} km
          </div>`
        });

        const distTravelled = (haversineKm(teamBase, teamPos)).toFixed(1);
        markers.push({
          pos: teamPos,
          title: `${teamBase.icon} ${assignedUnit}`,
          icon: teamBase.icon,
          info: `<div style="color:#000; font-size:0.82rem; padding:0.25rem;">
            ${teamBase.icon} <strong>${assignedUnit}</strong><br>
            Status: <strong>${e.status}</strong><br>
            ${statusIndex === 4 ? `Travelled: ${distTravelled} km of ${totalDist} km` : ''}
          </div>`
        });
      }


      const mapResult = await renderUnifiedMap('tracker-map', incidentPos, 13, markers);

      // Update status text
      const statusTextEl = document.getElementById('tracker-status-text');
      if (statusTextEl) {
        statusTextEl.textContent = trackerStatus;
        // Pulse orange when en route
        statusTextEl.style.color = statusIndex === 4 ? '#fb923c' : 'var(--text-muted)';
        statusTextEl.style.fontWeight = statusIndex === 4 ? '700' : '400';
      }

      // Draw dashed route line base→incident + solid progress line
      if (mapResult && mapResult.addPolyline && statusIndex >= 2) {
        // Full route (dashed orange)
        mapResult.addPolyline(
          [[teamBase.lat, teamBase.lng], [incidentPos.lat, incidentPos.lng]],
          mapResult.type === 'leaflet'
            ? { color: '#fb923c', weight: 3, dashArray: '6, 8', opacity: 0.75 }
            : { strokeColor: '#fb923c', strokeOpacity: 0.6, strokeWeight: 3, geodesic: true }
        );
        // Progress line (solid green) — distance already covered
        if (statusIndex === 4 && progressFraction > 0) {
          mapResult.addPolyline(
            [[teamBase.lat, teamBase.lng], [teamPos.lat, teamPos.lng]],
            mapResult.type === 'leaflet'
              ? { color: '#22c55e', weight: 4, opacity: 0.9 }
              : { strokeColor: '#22c55e', strokeOpacity: 0.9, strokeWeight: 4, geodesic: true }
          );
        }
      }

      // Bind Navigate button click on tracker page
      document.getElementById('btn-navigate-gmaps')?.addEventListener('click', () => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}`, '_blank');
      });
    }, 100);
  }
}



// ─── CONTROL ROOM ──────────────────────────────────────────

let controlData = [];
let activeFilter = 'all';
let pendingActionEid = null;
let pendingAction    = null;

let controlRoomMap = null;
let controlRoomMarkers = [];

function updateControlRoomMap() {
  const closedStatuses = ['Case Closed', 'Mission Completed', 'Rescue Completed'];
  const activeEmergencies = controlData.filter(e => e.lat && e.lng && !closedStatuses.includes(e.status));
  
  const center = { lat: 17.385044, lng: 78.486671 }; // Hyderabad Center
  const markers = [];

  activeEmergencies.forEach(e => {
    const markerColor = {
      'Critical': '#ef4444',
      'High':     '#f97316',
      'Medium':   '#eab308',
      'Low':      '#22c55e'
    }[e.severity] || '#3b82f6';

    const assignedUnit = e.nearest_rescue_team || e.recommended_team;
    
    // 1. Incident Location Marker
    const infoContent = `
      <div style="color:#000000; font-family:sans-serif; padding:0.5rem; max-width:250px; line-height:1.4;">
        <h4 style="margin:0 0 0.25rem 0; font-size:0.95rem; font-weight:700;">${e.emergency_id}</h4>
        <div style="font-size:0.85rem; font-weight:700; color:${markerColor}; margin-bottom:0.4rem;">${e.incident_type} (${e.severity})</div>
        <div style="font-size:0.8rem; margin-bottom:0.4rem;"><strong>Status:</strong> ${e.status}</div>
        <div style="font-size:0.8rem; margin-bottom:0.4rem;"><strong>Assigned Team:</strong> ${assignedUnit || 'Unassigned'}</div>
        <div style="font-size:0.78rem; background:#f4f4f5; padding:0.35rem; border-radius:4px; color:#4b5563; margin-bottom:0.5rem;"><strong>AI Summary:</strong> ${e.ai_decision_summary || 'No summary available.'}</div>
        <div style="margin-top: 0.5rem;">
          <a href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}" target="_blank" class="team-btn" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8); border:none; text-decoration:none; color:#ffffff; font-size:0.75rem; font-weight:700; display:flex; align-items:center; justify-content:center; gap:0.3rem; padding:0.4rem 0.8rem; cursor:pointer; border-radius:4px; text-align:center;">
            🚗 Navigate to Scene
          </a>
        </div>
      </div>
    `;

    markers.push({
      pos: { lat: parseFloat(e.lat), lng: parseFloat(e.lng) },
      title: `${e.emergency_id} - ${e.incident_type}`,
      color: markerColor,
      info: infoContent
    });

    // 2. Dispatched Team & Base station tracking on control map
    const statusIndex = STATUS_MAPPING[e.status] ?? 0;
    if (statusIndex >= 2 && assignedUnit) {
      const teamBase = TEAM_BASES[assignedUnit] || TEAM_BASES[e.recommended_team] || { lat: 17.3850, lng: 78.4867, name: 'Central Command Base', icon: '🚒' };
      const incidentPos = { lat: parseFloat(e.lat), lng: parseFloat(e.lng) };

      let teamPos = { ...teamBase };
      let progressFraction = 0;
      let isRealGPS = false;

      if (e.team_lat && e.team_lng && statusIndex >= 2 && statusIndex < 7) {
        teamPos = { lat: parseFloat(e.team_lat), lng: parseFloat(e.team_lng) };
        isRealGPS = true;
        const totalD = haversineKm(teamBase, incidentPos);
        const coveredD = haversineKm(teamBase, teamPos);
        progressFraction = totalD > 0 ? Math.min(coveredD / totalD, 0.95) : 0.5;
      }

      if (statusIndex === 4 && !isRealGPS) {
        const updatedAt = e.updated_at ? new Date(e.updated_at) : new Date();
        const etaMs = (e.response_time_minutes || 15) * 60 * 1000;
        const elapsedMs = Date.now() - updatedAt.getTime();
        progressFraction = Math.min(elapsedMs / etaMs, 0.92);
        teamPos = lerpPos(teamBase, incidentPos, progressFraction);
      } else if (statusIndex >= 5 && !isRealGPS) {
        teamPos = { ...incidentPos };
      }

      // Add Base Station Marker
      markers.push({
        pos: teamBase,
        title: `🏢 Base: ${teamBase.name}`,
        color: '#3b82f6',
        info: `
          <div style="color:#000000; font-family:sans-serif; padding:0.5rem; max-width:220px; line-height:1.4;">
            <h4 style="margin:0 0 0.25rem 0; font-size:0.9rem; font-weight:700; color:#3b82f6;">🏢 Base Station</h4>
            <div style="font-size:0.8rem; margin-bottom:0.25rem;"><strong>Name:</strong> ${teamBase.name}</div>
            <div style="font-size:0.8rem;"><strong>Dispatched to:</strong> ${e.emergency_id}</div>
          </div>
        `
      });

      // Add Vehicle Marker
      markers.push({
        pos: teamPos,
        title: `${teamBase.icon} ${assignedUnit}`,
        icon: teamBase.icon,
        info: `
          <div style="color:#000000; font-family:sans-serif; padding:0.5rem; max-width:220px; line-height:1.4;">
            <h4 style="margin:0 0 0.25rem 0; font-size:0.9rem; font-weight:700; color:#22c55e;">🚒 En Route to ${e.emergency_id}${isRealGPS ? ' (Live GPS)' : ''}</h4>
            <div style="font-size:0.8rem; margin-bottom:0.25rem;"><strong>Unit:</strong> ${assignedUnit}</div>
            <div style="font-size:0.8rem; margin-bottom:0.25rem;"><strong>Driver:</strong> ${e.team_driver || '—'}</div>
            <div style="font-size:0.8rem;"><strong>Leader:</strong> ${e.team_leader || '—'}</div>
          </div>
        `
      });
    }
  });

  setTimeout(async () => {
    const mapResult = await renderUnifiedMap('map', center, 12, markers);

    if (mapResult && mapResult.addPolyline) {
      activeEmergencies.forEach(e => {
        const statusIndex = STATUS_MAPPING[e.status] ?? 0;
        const assignedUnit = e.nearest_rescue_team || e.recommended_team;
        if (statusIndex >= 2 && assignedUnit) {
          const teamBase = TEAM_BASES[assignedUnit] || TEAM_BASES[e.recommended_team] || { lat: 17.3850, lng: 78.4867, name: 'Central Command Base', icon: '🚒' };
          const incidentPos = { lat: parseFloat(e.lat), lng: parseFloat(e.lng) };

          let teamPos = { ...teamBase };
          let progressFraction = 0;
          let isRealGPS = false;

          if (e.team_lat && e.team_lng && statusIndex >= 2 && statusIndex < 7) {
            teamPos = { lat: parseFloat(e.team_lat), lng: parseFloat(e.team_lng) };
            isRealGPS = true;
            const totalD = haversineKm(teamBase, incidentPos);
            const coveredD = haversineKm(teamBase, teamPos);
            progressFraction = totalD > 0 ? Math.min(coveredD / totalD, 0.95) : 0.5;
          }

          if (statusIndex === 4 && !isRealGPS) {
            const updatedAt = e.updated_at ? new Date(e.updated_at) : new Date();
            const etaMs = (e.response_time_minutes || 15) * 60 * 1000;
            const elapsedMs = Date.now() - updatedAt.getTime();
            progressFraction = Math.min(elapsedMs / etaMs, 0.92);
            teamPos = lerpPos(teamBase, incidentPos, progressFraction);
          } else if (statusIndex >= 5 && !isRealGPS) {
            teamPos = { ...incidentPos };
          }

          // Draw dashed route line
          mapResult.addPolyline(
            [[teamBase.lat, teamBase.lng], [incidentPos.lat, incidentPos.lng]],
            mapResult.type === 'leaflet'
              ? { color: '#fb923c', weight: 3, dashArray: '6, 8', opacity: 0.75 }
              : { strokeColor: '#fb923c', strokeOpacity: 0.6, strokeWeight: 3, geodesic: true }
          );

          // Draw solid progress line
          if (statusIndex === 4 && progressFraction > 0) {
            mapResult.addPolyline(
              [[teamBase.lat, teamBase.lng], [teamPos.lat, teamPos.lng]],
              mapResult.type === 'leaflet'
                ? { color: '#22c55e', weight: 4, opacity: 0.9 }
                : { strokeColor: '#22c55e', strokeOpacity: 0.9, strokeWeight: 4, geodesic: true }
            );
          }
        }
      });
    }
  }, 100);
}



export async function initControlRoom() {
  const root    = document.getElementById('control-root');
  const statsEl = document.getElementById('control-stats');
  if (!root) return;

  root.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading emergencies…</p></div>`;

  async function refresh() {
    try {
      controlData = await apiGet('/api/rescue/emergencies');
      renderStats(statsEl);
      const filtered = activeFilter === 'all'
        ? controlData
        : controlData.filter(e =>
            e.severity.toLowerCase() === activeFilter ||
            e.status.toLowerCase().includes(activeFilter)
          );
      renderEmergencies(root, filtered);
      updateControlRoomMap();
    } catch (err) {
      root.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Failed to load: ${err.message}. Is the Flask backend running?</p></div>`;
    }
  }

  await refresh();
  initFilters(root, statsEl);

  // Auto-refresh every 30 seconds so completed missions appear immediately
  setInterval(refresh, 30000);
}


function renderStats(el) {
  if (!el) return;

  const closedStatuses = ['Case Closed', 'Mission Completed', 'Rescue Completed'];

  // Active cases (not closed)
  const activeCases = controlData.filter(e => !closedStatuses.includes(e.status));
  const activeCount = activeCases.length;

  const criticalCount = activeCases.filter(e => e.severity === 'Critical').length;
  const highCount     = activeCases.filter(e => e.severity === 'High').length;
  const mediumCount   = activeCases.filter(e => e.severity === 'Medium').length;
  const lowCount      = activeCases.filter(e => e.severity === 'Low').length;

  // Active teams busy (unique teams assigned to active emergencies)
  const allTeamUnits = [
    'Fire Unit 1', 'Fire Unit 2', 'Fire Unit 3',
    'NDRF Unit A', 'NDRF Unit B',
    'SDRF Unit 1', 'SDRF Unit 2',
    'Hazmat Unit Alpha', 'Hazmat Unit Beta',
    'ERT Unit 1', 'ERT Unit 2',
    'EE Unit A', 'EE Unit B',
    'Civic Crew 1', 'Civic Crew 2'
  ];
  
  const busyTeamsSet = new Set();
  activeCases.forEach(e => {
    const assigned = e.nearest_rescue_team || e.recommended_team;
    if (assigned && allTeamUnits.includes(assigned)) {
      busyTeamsSet.add(assigned);
    }
  });

  const busyTeamsCount = busyTeamsSet.size;
  const availableTeamsCount = Math.max(0, 15 - busyTeamsCount);

  // Completed missions today (any closed status updated/submitted today)
  const todayStr = new Date().toISOString().split('T')[0];
  const completedTodayCount = controlData.filter(e => {
    const isClosed = closedStatuses.includes(e.status);
    const wasUpdatedToday = (e.updated_at && e.updated_at.startsWith(todayStr)) || (e.submitted_at && e.submitted_at.startsWith(todayStr));
    return isClosed && wasUpdatedToday;
  }).length;

  el.innerHTML = `
    <div class="control-stat-card total-stat">
      <div class="stat-label">Total Active Cases</div>
      <div class="stat-num" style="color:var(--rescue-primary);">${activeCount}</div>
    </div>
    <div class="control-stat-card critical-stat">
      <div class="stat-label">🔴 Critical Priority</div>
      <div class="stat-num">${criticalCount}</div>
    </div>
    <div class="control-stat-card high-stat">
      <div class="stat-label">🟠 High Priority</div>
      <div class="stat-num">${highCount}</div>
    </div>
    <div class="control-stat-card medium-stat">
      <div class="stat-label">🟡 Medium Priority</div>
      <div class="stat-num">${mediumCount}</div>
    </div>
    <div class="control-stat-card low-stat">
      <div class="stat-label">🟢 Low Priority</div>
      <div class="stat-num" style="color:#10b981;">${lowCount}</div>
    </div>
    <div class="control-stat-card available-stat">
      <div class="stat-label">🟢 Teams Available</div>
      <div class="stat-num" style="color:#34d399;">${availableTeamsCount}</div>
    </div>
    <div class="control-stat-card busy-stat">
      <div class="stat-label">🔴 Teams Busy</div>
      <div class="stat-num" style="color:#f87171;">${busyTeamsCount}</div>
    </div>
    <div class="control-stat-card completed-stat">
      <div class="stat-label">🏆 Completed Today</div>
      <div class="stat-num" style="color:#60a5fa;">${completedTodayCount}</div>
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
    actionsHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
        <div>${statusBadge(e.status)}</div>
        ${e.lat && e.lng ? `
          <a href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}" target="_blank" class="team-btn btn-secondary" style="font-size:0.72rem; padding:0.25rem 0.60rem; display:inline-flex; align-items:center; gap:0.2rem; text-decoration:none; border-radius:4px; font-weight:600; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-secondary);">
            🚗 Navigate to Scene
          </a>
        ` : ''}
      </div>
    `;
  } else {
    // Only show action buttons for cases that need supervisor decision
    let buttonsHTML = '';
    if (e.status === 'Pending Supervisor Approval' || e.status === 'Pending Review') {
      buttonsHTML = `
        <button class="btn-ec-approve" data-eid="${e.emergency_id}" data-action="approve">✅ Approve</button>
        <button class="btn-ec-close"   data-eid="${e.emergency_id}" data-action="close">✖ Close</button>
      `;
    }

    const statuses = [
      'Complaint Submitted',
      'AI Analysis Complete',
      'Pending Supervisor Approval',
      'Pending Review',
      'Auto Dispatched',
      'Team Assigned',
      'Mission Accepted',
      'Start Journey',
      'Reached Location',
      'Rescue in Progress',
      'Mission Completed',
      'Case Closed'
    ];

    const options = statuses.map(st =>
      `<option value="${st}" ${e.status === st ? 'selected' : ''}>${st}</option>`
    ).join('');

    actionsHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;width:100%;">
        <div style="display:flex;gap:0.5rem;align-items:center;">
          ${buttonsHTML}
          ${e.lat && e.lng ? `
            <a href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}" target="_blank" class="team-btn" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8); border:none; text-decoration:none; color:#ffffff; font-size:0.72rem; padding:0.35rem 0.65rem; border-radius:4px; font-weight:600; display:inline-flex; align-items:center; gap:0.2rem;">
              🚗 Navigate to Scene
            </a>
          ` : ''}
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


  // ── Team Roster Panel ──
  const assignedUnit = e.nearest_rescue_team || e.recommended_team;
  let rosterHTML = '';
  if (assignedUnit) {
    const assignReason = e.severity === 'Critical'
      ? `<span style="color:#fca5a5;">🤖 Auto-dispatched by AI</span> — Critical priority case routed to least-loaded unit based on time burden scoring.`
      : `<span style="color:#fcd34d;">👤 Supervisor Approved</span> — Assigned based on specialization match and current workload.`;

    const memberBadges = e.team_members
      ? e.team_members.split(',').map(m => `<span style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:0.15rem 0.55rem;font-size:0.72rem;white-space:nowrap;">${m.trim()}</span>`).join('')
      : '<span style="color:var(--text-muted); font-size:0.78rem;">No roster data</span>';

    rosterHTML = `
      <div style="margin-top:0.75rem; border-top:1px solid rgba(255,255,255,0.06); padding-top:0.75rem;">
        <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">🚒 Assigned Team: ${assignedUnit}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem 1rem; font-size:0.78rem; margin-bottom:0.5rem;">
          <div><span style="color:var(--text-muted);">👮 Leader:</span> <strong>${e.team_leader || '—'}</strong></div>
          <div><span style="color:var(--text-muted);">🚐 Driver:</span> <strong>${e.team_driver || '—'}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--text-muted);">🎯 Specialization:</span> ${e.team_specialization || '—'}</div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-bottom:0.5rem;">${memberBadges}</div>
        <div style="font-size:0.75rem; color:var(--text-secondary); background:rgba(255,255,255,0.03); border-radius:6px; padding:0.4rem 0.6rem;">
          <span style="font-weight:700;">📋 Assignment Reason:</span> ${assignReason}
        </div>
      </div>`;
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
        <span class="ec-meta-item">🚒 Team: ${assignedUnit || 'Unassigned'}</span>
        <span class="ec-meta-item">🏢 Depts: ${e.recommended_departments || 'N/A'}</span>
        <span class="ec-meta-item">⏱ ${e.response_time_minutes} min ETA</span>
        <span class="ec-meta-item">🎯 ${e.confidence_score}% confidence</span>
        ${e.landmark ? `<span class="ec-meta-item">📍 ${e.landmark}</span>` : ''}
      </div>

      <!-- Gemini AI Diagnostics -->
      <div style="margin-top:0.75rem; border-top:1px dashed rgba(255,255,255,0.06); padding-top:0.75rem; font-size:0.78rem; color:var(--text-secondary);">
        <div style="margin-bottom:0.4rem;">
          <span style="color:var(--rescue-primary); font-weight:700;">🧠 AI Decision Summary:</span> 
          <span>${e.ai_decision_summary || 'No summary available.'}</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.4rem;">
          <div style="background:rgba(239,68,68,0.03); border:1px solid rgba(239,68,68,0.08); padding:0.4rem; border-radius:4px;">
            <span style="color:#fca5a5; font-weight:700; display:block; margin-bottom:0.15rem;">⚠️ Potential Risks:</span>
            <span>${e.possible_risks || 'No immediate risks identified.'}</span>
          </div>
          <div style="background:rgba(16,185,129,0.03); border:1px solid rgba(16,185,129,0.08); padding:0.4rem; border-radius:4px;">
            <span style="color:#6ee7b7; font-weight:700; display:block; margin-bottom:0.15rem;">🚒 Suggested Actions:</span>
            <span>${e.suggested_actions || 'No suggested actions.'}</span>
          </div>
        </div>
      </div>

      ${rosterHTML}
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
let teamData       = [];
let selectedEid    = null;
let simulatedLocation = null;
let currentTeamUnit   = null;   // Logged-in unit label
let currentUnitId     = null;   // e.g. 'FIRE1'
let currentPrimaryTeam = null;

const UNIT_ICONS = {
  'Fire Response Unit':           '🔥',
  'Flood Rescue (NDRF)':          '🌊',
  'SDRF Structural Response Team':'🏗️',
  'Hazmat Response Unit':         '☢️',
  'Emergency Response Team':      '🚑',
  'Electrical Emergency Unit':    '⚡',
  'Civic Emergency Team':         '🌳',
};

function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function initTeamDashboard() {
  const listEl        = document.getElementById('missions-list');
  const detailsEl     = document.getElementById('details-panel');
  const loginScreen   = document.getElementById('login-screen');
  const dashboardMain = document.getElementById('dashboard-main');
  const loginForm     = document.getElementById('login-form');
  const loginError    = document.getElementById('login-error');
  const btnLogin      = document.getElementById('btn-login');
  const btnLogout     = document.getElementById('btn-logout');

  if (!listEl) return;

  // ── Restore session ──
  const savedUnit  = sessionStorage.getItem('rescueTeamUnit');
  const savedId    = sessionStorage.getItem('rescueUnitId');
  const savedPrimary = sessionStorage.getItem('rescuePrimaryTeam');
  if (savedUnit && savedId) {
    currentTeamUnit    = savedUnit;
    currentUnitId      = savedId;
    currentPrimaryTeam = savedPrimary || '';
    showDashboard();
  }

  // ── Login form submit ──
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const unitId = document.getElementById('unit-id-input')?.value.trim().toUpperCase();
    const pin    = document.getElementById('unit-pin-input')?.value.trim();
    if (!unitId || !pin) return;

    btnLogin.disabled = true;
    btnLogin.textContent = '🔄 Verifying...';
    loginError.style.display = 'none';

    try {
      const resp = await apiPost('/api/rescue/team/login', { unit_id: unitId, pin });
      currentTeamUnit    = resp.unit_label;
      currentUnitId      = resp.unit_id;
      currentPrimaryTeam = resp.primary_team;
      sessionStorage.setItem('rescueTeamUnit',    currentTeamUnit);
      sessionStorage.setItem('rescueUnitId',      currentUnitId);
      sessionStorage.setItem('rescuePrimaryTeam', currentPrimaryTeam);
      showDashboard();
    } catch (err) {
      loginError.textContent = err.message || 'Login failed. Check your credentials.';
      loginError.style.display = 'block';
      btnLogin.disabled = false;
      btnLogin.textContent = '🔓 Access Dashboard';
    }
  });

  // ── Logout ──
  btnLogout?.addEventListener('click', () => {
    sessionStorage.removeItem('rescueTeamUnit');
    sessionStorage.removeItem('rescueUnitId');
    sessionStorage.removeItem('rescuePrimaryTeam');
    currentTeamUnit = currentUnitId = currentPrimaryTeam = null;
    selectedEid = null;
    loginScreen.style.display  = 'flex';
    dashboardMain.style.display = 'none';
    if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = '🔓 Access Dashboard'; }
    if (loginError) loginError.style.display = 'none';
    document.getElementById('unit-id-input').value = '';
    document.getElementById('unit-pin-input').value = '';
  });

  function showDashboard() {
    loginScreen.style.display   = 'none';
    dashboardMain.style.display = 'block';
    // Set banner
    const bannerLabel   = document.getElementById('banner-unit-label');
    const bannerPrimary = document.getElementById('banner-primary-team');
    const bannerIcon    = document.getElementById('banner-icon');
    if (bannerLabel)   bannerLabel.textContent   = currentTeamUnit;
    if (bannerPrimary) bannerPrimary.textContent  = currentPrimaryTeam;
    if (bannerIcon)    bannerIcon.textContent     = UNIT_ICONS[currentPrimaryTeam] || '🚒';
    loadMissions();
    // Auto-refresh every 30s
    setInterval(loadMissions, 30000);
  }

  async function loadMissions() {
    try {
      const resp = await apiGet(`/api/rescue/team/${encodeURIComponent(currentTeamUnit)}/missions`);
      teamData = resp.missions || [];

      // Update workload banner
      const chip = document.getElementById('workload-chip');
      if (chip) {
        const burden = resp.total_time_burden_minutes || 0;
        const active = resp.active_count || 0;
        chip.textContent = `${active} active · ${burden} min workload`;
        chip.className   = 'workload-chip' + (burden > 30 ? ' busy' : '');
      }
      const cntEl = document.getElementById('mission-count');
      if (cntEl) cntEl.textContent = `${teamData.length} missions`;

      if (!teamData.length) {
        listEl.innerHTML = `
          <div class="empty-state" style="padding:2rem 1rem;">
            <div class="empty-icon">✅</div>
            <p>No missions assigned to your unit.</p>
          </div>`;
        detailsEl.innerHTML = `
          <div class="empty-state" style="padding:5rem 1rem;">
            <div class="empty-icon">🚒</div>
            <h3>All Clear!</h3>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.5rem;">No active missions. The AI will dispatch cases here automatically.</p>
          </div>`;
        return;
      }

      // Render mission queue (read-only — AI-assigned, no manual picking)
      listEl.innerHTML = teamData.map((m, idx) => {
        const sev = m.severity.toLowerCase();
        const isActive = idx === 0 || m.emergency_id === selectedEid;
        const activeClass = m.emergency_id === selectedEid ? 'active' : '';
        const autoTag = m.severity === 'Critical'
          ? `<span style="font-size:0.65rem; background:rgba(239,68,68,0.15); color:#fca5a5; border:1px solid rgba(239,68,68,0.3); border-radius:20px; padding:0.1rem 0.5rem; margin-left:0.35rem;">AUTO</span>`
          : '';
        return `
          <div class="mission-item ${activeClass} border-severity-${sev}" data-eid="${m.emergency_id}"
            style="padding:1rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05);
                   border-left:4px solid var(--border-color,#fff); border-radius:8px;
                   cursor:pointer; transition:all 0.2s ease;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
              <span style="font-weight:700; font-family:monospace; color:var(--rescue-primary);">${m.emergency_id}${autoTag}</span>
              ${severityBadge(m.severity)}
            </div>
            <div style="font-size:0.88rem; font-weight:700; color:var(--text-primary); margin-bottom:0.2rem;">${m.incident_type}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between;">
              <span>📍 ${m.landmark || 'No landmark'}</span>
              ${statusBadge(m.status)}
            </div>
            ${m.response_time_minutes ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.25rem;">⏱ Est. ${m.response_time_minutes} min response</div>` : ''}
          </div>`;
      }).join('');

      // Click to view details
      document.querySelectorAll('.mission-item').forEach(item => {
        item.addEventListener('click', () => {
          selectedEid = item.dataset.eid;
          document.querySelectorAll('.mission-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          renderDetails();
        });
      });

      // Auto-display the top-priority mission (first in sorted list)
      if (!selectedEid || !teamData.find(m => m.emergency_id === selectedEid)) {
        selectedEid = teamData[0].emergency_id;
      }
      document.querySelector(`.mission-item[data-eid="${selectedEid}"]`)?.classList.add('active');
      renderDetails();

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

    // Parse complete Gemini JSON response
    let gemini = {};
    try {
      if (m.ai_analysis_json) {
        gemini = JSON.parse(m.ai_analysis_json);
      }
    } catch (err) {
      console.error("Error parsing ai_analysis_json in team dashboard:", err);
    }

    const aiSummary = gemini.ai_summary || m.ai_decision_summary || 'No summary available.';
    const risks = Array.isArray(gemini.possible_risks) ? gemini.possible_risks.join(', ') : (m.possible_risks || 'No risks reported.');
    const actions = Array.isArray(gemini.suggested_rescue_actions) ? gemini.suggested_rescue_actions.join(', ') : (m.suggested_actions || 'No suggested rescue actions.');

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
            <span>🧠 Gemini AI Dispatch Diagnostics</span>
            <span style="color:var(--rescue-primary); font-weight:700;">Confidence: ${m.confidence_score}%</span>
          </h4>
          <div style="display:flex; flex-direction:column; gap:0.5rem; color: var(--text-secondary);">
            <span><strong>Incident Type:</strong> <span>${m.incident_type}</span></span>
            <span><strong>Severity:</strong> <span style="color:#ef4444; font-weight:700;">${m.severity}</span></span>
            <span><strong>AI Summary:</strong> ${aiSummary}</span>
            <span><strong>Possible Risks:</strong> <span style="color:#fca5a5;">${risks}</span></span>
            <span><strong>Suggested Rescue Actions:</strong> <span style="color:#6ee7b7;">${actions}</span></span>
            <span><strong>Estimated Response Time:</strong> <span>${m.response_time_minutes} minutes</span></span>
            <span><strong>Dispatch Type:</strong> ${dispatchType}</span>
          </div>
        </div>

        <!-- Embedded Google Map -->
        <div>
          <div style="color:var(--text-muted); font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.35rem;">📍 Mission Location Map</div>
          <div id="team-map" style="width:100%; height:220px; border-radius:8px; background:rgba(0,0,0,0.1); border:1px solid rgba(255,255,255,0.05); margin-bottom:0.5rem;"></div>
          <button class="team-btn" id="btn-navigate-gmaps" style="width:100%; margin-top:0.25rem; background:linear-gradient(135deg,#3b82f6,#1d4ed8); border:none; font-weight:700; color:#ffffff; font-size:0.8rem; display:flex; align-items:center; justify-content:center; gap:0.4rem; padding:0.6rem 1rem; cursor:pointer; border-radius:8px;">
            🚗 Navigate to Scene
          </button>
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

    // Render Map at scene
    if (m.lat && m.lng) {
      setTimeout(() => {
        const pos = { lat: parseFloat(m.lat), lng: parseFloat(m.lng) };
        renderUnifiedMap('team-map', pos, 15, [
          {
            pos: pos,
            title: m.incident_type,
            color: m.severity === 'Critical' ? '#ef4444' : '#fb923c',
            info: `<div style="color:#000; font-size:0.82rem; line-height:1.4;"><strong>${m.incident_type}</strong><br>Severity: ${m.severity}</div>`
          }
        ]);
        
        // Bind Navigate button click
        document.getElementById('btn-navigate-gmaps')?.addEventListener('click', () => {
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`, '_blank');
        });
      }, 50);
    }



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
        // Use watchPosition for continuous live GPS monitoring during journey
        navigator.geolocation.watchPosition(pos => {
          if (!simulatedLocation) {
            updateDistance(pos.coords.latitude, pos.coords.longitude);
          }
        }, err => {
          // Fallback: use Hyderabad center if GPS unavailable
          updateDistance(crewLat, crewLng);
        }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
        return;
      }
      
      updateDistance(crewLat, crewLng);
      
      function updateDistance(clat, clng) {
        const dist = getHaversineDistance(clat, clng, m.lat, m.lng);
        const nearScene = dist <= 0.15; // 150m
        
        // Report team live coordinates back to server (throttle to every 5s)
        const nowTime = Date.now();
        if (!updateDistance.lastSent || (nowTime - updateDistance.lastSent > 5000)) {
          updateDistance.lastSent = nowTime;
          apiPatch(`/api/rescue/emergencies/${selectedEid}`, {
            team_lat: clat,
            team_lng: clng,
            actor: currentTeamUnit || 'Field Team'
          }).catch(err => console.warn("Failed to report live team coordinates:", err));
        }

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
              
              // AUTO-CLICK: Automatically trigger Reached Location update
              if (!actArrivedBtn.dataset.autoTriggered) {
                actArrivedBtn.dataset.autoTriggered = 'true';
                showToast('📍 Arrived at scene! Status auto-updating to Reached Location...', 'success');
                setTimeout(async () => {
                  try {
                    await apiPatch(`/api/rescue/emergencies/${selectedEid}`, {
                      status: 'Reached Location',
                      note: 'Auto-triggered: Crew GPS within 150m of incident scene.',
                      actor: 'GPS Auto-Detection'
                    });
                    showToast('✅ Status updated: Reached Location', 'success');
                    await loadMissions();
                  } catch (err) {
                    showToast(`Auto-update failed: ${err.message}`, 'error');
                  }
                }, 1500); // slight delay so crew sees the toast first
              }
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
