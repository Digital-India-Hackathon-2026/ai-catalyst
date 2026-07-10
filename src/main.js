// AssignIQ Application main script

import { dbStore } from "../core/db/store.js";
import { orchestrator } from "../core/engine/orchestrator.js";
import { CivicModule } from "../modules/civic/civic-module.js";
import { RescueModule } from "../modules/rescue/rescue-module.js";
import { MedicalModule } from "../modules/medical/medical-module.js";

// Initialize and Register Modules
const civicModule = new CivicModule();
const rescueModule = new RescueModule();
const medicalModule = new MedicalModule();

// State variable for selected task ID
let selectedTaskId = null;
let selectedOfficerIdForOverride = null;

// Mock list of incident generators
const INCIDENT_TEMPLATES = [
  {
    title: "Sewer overflow at Dilshuknagar Market",
    type: "sanitation",
    department: "Civic",
    priority: "Medium",
    description: "Sewer blockage causing foul smell and overflow into public market stalls.",
    location: { lat: 17.3685, lng: 78.5248 }
  },
  {
    title: "Voter ID correction grievance delay",
    type: "grievances",
    department: "Civic",
    priority: "Low",
    description: "Citizen complaining about 45 days delay in simple spelling correction.",
    location: { lat: 17.3890, lng: 78.4810 }
  },
  {
    title: "Structural cracks in flyover pillar",
    type: "structural-collapse",
    department: "Rescue",
    priority: "Critical",
    description: "Deep cracks detected on pillar #42. Immediate structural audit and cordoning off required.",
    location: { lat: 17.4150, lng: 78.4500 }
  },
  {
    title: "Basement flood in apartments near lake",
    type: "flood-rescue",
    department: "Rescue",
    priority: "High",
    description: "Heavy rain has submerged cellar parking, disabling electricity panels.",
    location: { lat: 17.4520, lng: 78.3800 }
  },
  {
    title: "Major road accident on ORR Express Highway",
    type: "accident-response",
    department: "Medical",
    priority: "Critical",
    description: "Collision between two trucks. Multi-injury trauma response and emergency extraction needed.",
    location: { lat: 17.5100, lng: 78.3200 }
  },
  {
    title: "Severe chest pain reported at Bowenpally",
    type: "cardiac-emergency",
    department: "Medical",
    priority: "High",
    description: "64-year-old male experiencing intense crushing chest pain and breathing issues.",
    location: { lat: 17.4720, lng: 78.4780 }
  },
  {
    title: "Pothole-induced traffic block at Kukatpally",
    type: "pothole",
    department: "Civic",
    priority: "Medium",
    description: "Multiple small potholes have turned into a giant crater causing traffic gridlock.",
    location: { lat: 17.4840, lng: 78.3889 }
  }
];

// --- Main UI Rendering Functions ---

function initApp() {
  // Bind Header Controls
  const toggleBtn = document.getElementById("btn-toggle-sim");
  const speedSlider = document.getElementById("slider-speed");
  const speedDisplay = document.getElementById("speed-display");

  toggleBtn.addEventListener("click", () => {
    dbStore.toggleSimulation();
  });

  speedSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    dbStore.setSimulationSpeed(val);
    speedDisplay.textContent = `${(val / 1000).toFixed(0)}s`;
  });

  // Subscribe to DB updates
  dbStore.subscribe((state) => {
    renderDashboard(state);
  });

  // Initial draw
  renderDashboard(dbStore.getState());

  // Start Simulation Loop
  runSimulationLoop();

  // Seed initial simulator tasks
  setTimeout(() => {
    triggerSimulationEvent();
  }, 1000);
}

// Global simulation timer reference
let simTimer = null;

function runSimulationLoop() {
  const loop = () => {
    const state = dbStore.getState();
    if (state.simulationActive) {
      triggerSimulationEvent();
    }
    simTimer = setTimeout(loop, state.simulationSpeed);
  };
  loop();
}

function triggerSimulationEvent() {
  // Pick random template
  const randIndex = Math.floor(Math.random() * INCIDENT_TEMPLATES.length);
  const template = INCIDENT_TEMPLATES[randIndex];
  
  // Randomize coordinates slightly to make the map look active
  const offsetLat = (Math.random() - 0.5) * 0.05;
  const offsetLng = (Math.random() - 0.5) * 0.05;
  
  const incident = {
    ...template,
    title: `${template.title} #${Math.floor(100 + Math.random() * 900)}`,
    location: {
      lat: parseFloat((template.location.lat + offsetLat).toFixed(4)),
      lng: parseFloat((template.location.lng + offsetLng).toFixed(4))
    }
  };

  // Submit to appropriate module
  if (incident.department === "Civic") {
    civicModule.submitRequest(incident);
  } else if (incident.department === "Rescue") {
    rescueModule.submitRequest(incident);
  } else if (incident.department === "Medical") {
    medicalModule.submitRequest(incident);
  }
}

// Render entire state
function renderDashboard(state) {
  // Update Sim Controls
  const toggleBtn = document.getElementById("btn-toggle-sim");
  const playIcon = document.getElementById("sim-play-icon");
  const btnText = document.getElementById("sim-btn-text");

  if (state.simulationActive) {
    playIcon.textContent = "⏸";
    btnText.textContent = "Pause Simulation";
    toggleBtn.classList.remove("btn-danger");
  } else {
    playIcon.textContent = "▶";
    btnText.textContent = "Resume Simulation";
    toggleBtn.classList.add("btn-danger");
  }

  // Update Metrics
  const activeTasks = state.tasks.filter(t => t.status === "In Progress" || t.status === "Pending Assignment").length;
  const completedTasks = state.tasks.filter(t => t.status === "Completed").length;
  const overrides = state.auditLogs.filter(log => log.type === "SUPERVISOR_OVERRIDE").length;
  
  // SLA Rate
  let slaCompliantCount = 0;
  const completedList = state.tasks.filter(t => t.status === "Completed");
  completedList.forEach(t => {
    const elapsedMs = new Date(t.completedAt) - new Date(t.assignedAt);
    const elapsedMins = elapsedMs / 60000;
    if (elapsedMins <= t.slaMinutes) {
      slaCompliantCount++;
    }
  });
  const slaRate = completedList.length > 0 ? Math.round((slaCompliantCount / completedList.length) * 100) : 100;

  document.getElementById("metric-active-tasks").textContent = activeTasks;
  document.getElementById("metric-completed-tasks").textContent = completedTasks;
  document.getElementById("metric-override-count").textContent = overrides;
  document.getElementById("metric-sla-rate").textContent = `${slaRate}%`;

  // Render Queue Count badge
  const pendingCount = state.tasks.filter(t => t.status === "Pending Assignment").length;
  document.getElementById("queue-count").textContent = `${pendingCount} pending`;

  // Render Queue list
  renderQueue(state.tasks);

  // Render Detail Panel
  renderDetailPanel(state);

  // Render Audit Log Table
  renderAuditLogs(state.auditLogs);
}

function renderQueue(tasks) {
  const container = document.getElementById("task-queue");
  container.innerHTML = "";

  const activeQueueTasks = tasks.filter(t => t.status !== "Completed");

  if (activeQueueTasks.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 2rem; font-size: 0.85rem;">
        No active tasks in queue.
      </div>
    `;
    return;
  }

  activeQueueTasks.forEach(task => {
    const card = document.createElement("div");
    card.className = `task-card ${selectedTaskId === task.id ? 'active-selection' : ''}`;
    card.addEventListener("click", () => {
      selectedTaskId = task.id;
      selectedOfficerIdForOverride = null; // reset selection override
      renderDashboard(dbStore.getState());
    });

    const timeString = new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const deptBadgeClass = `badge-${task.department.toLowerCase()}`;
    const priorityClass = `priority-${task.priority.toLowerCase()}`;
    const statusClass = task.status === "Pending Assignment" ? "status-pending" : "status-inprogress";

    card.innerHTML = `
      <div class="task-header">
        <span class="task-title">${task.title}</span>
        <span class="badge ${priorityClass}">${task.priority}</span>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
        ${task.description}
      </p>
      <div class="task-meta">
        <span class="badge ${deptBadgeClass}">${task.department}</span>
        <span class="badge ${statusClass}">${task.status}</span>
        <span>⏱ SLA: ${task.slaMinutes} min</span>
        <span>🕒 ${timeString}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderDetailPanel(state) {
  const panel = document.getElementById("detail-panel");
  
  if (!selectedTaskId) {
    panel.innerHTML = `
      <div class="empty-detail-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
        <p>Select a task from the active queue to view AI assignment recommendations, custom SLA metrics, explainable justifications, and coordinates.</p>
      </div>
    `;
    return;
  }

  const task = state.tasks.find(t => t.id === selectedTaskId);
  if (!task || task.status === "Completed") {
    selectedTaskId = null;
    renderDetailPanel(state);
    return;
  }

  // Set default selected officer for override if none is set
  const departmentOfficers = state.officers.filter(o => o.department === task.department);
  
  // Detail Panel Layout
  panel.innerHTML = `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight:600;">${task.title}</h3>
        <span class="badge badge-${task.department.toLowerCase()}">${task.department}</span>
      </div>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">${task.description}</p>
      <div style="display:flex; gap:1rem; font-size:0.75rem; color:var(--text-muted); margin-bottom: 1rem;">
        <span>📍 Loc: (${task.location.lat}, ${task.location.lng})</span>
        <span>⏱ Required SLA: ${task.slaMinutes} minutes</span>
      </div>
    </div>

    <div class="recommendation-details-grid">
      <!-- Recommendations Candidate List -->
      <div>
        <h4 style="font-size:0.9rem; font-weight:600; margin-bottom:0.75rem; color:var(--text-primary);">AI Generated Ranks</h4>
        <div class="rec-list" id="detail-rec-list">
          <!-- Populated below -->
        </div>
      </div>

      <!-- XAI explanation column -->
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <h4 style="font-size:0.9rem; font-weight:600; color:var(--text-primary);">Recommendation Explanation</h4>
        <div id="xai-panel">
          <!-- Populated when click candidate -->
        </div>
      </div>
    </div>

    <!-- Live Geographic coordinates node connector -->
    <div class="map-visualizer">
      <div class="map-grid"></div>
      <div id="map-visuals-container"></div>
    </div>

    <!-- Supervisor human-in-the-loop action footer -->
    <div class="action-box">
      ${task.status === "Pending Assignment" ? `
        <div style="display:flex; gap:1rem; justify-content: flex-end;">
          <button id="btn-approve-rec" class="btn" style="background-color: var(--color-success)">
            ✓ Approve Recommended Officer
          </button>
          <button id="btn-toggle-override" class="btn btn-secondary">
            🛠 Supervisor Override
          </button>
        </div>
        
        <div id="override-container" class="override-form" style="display: none;">
          <div class="override-form-title">Manual Officer Reassignment</div>
          
          <div class="form-group">
            <label for="select-override-officer">Select Alternative Officer:</label>
            <select id="select-override-officer" class="form-control">
              ${departmentOfficers.map(o => `<option value="${o.id}">${o.name} (${o.role})</option>`).join("")}
            </select>
          </div>

          <div class="form-group">
            <label for="input-override-reason">Justification for Override (Required):</label>
            <input type="text" id="input-override-reason" class="form-control" placeholder="e.g. Nearer emergency response vehicle, specialized equipment required.">
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem;">
            <button id="btn-submit-override" class="btn btn-secondary" style="background-color: var(--color-warning); color: #000;">
              Execute Override
            </button>
          </div>
        </div>
      ` : `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:0.85rem; color:var(--text-secondary);">
            Assigned to: <strong>${state.officers.find(o => o.id === task.officerId)?.name || 'Unknown'}</strong> (In Progress)
          </div>
          <button id="btn-complete-task" class="btn" style="background-color: var(--color-success)">
            ✓ Mark as Resolved
          </button>
        </div>
      `}
    </div>
  `;

  // Render Ranks list & setup click events
  const recContainer = document.getElementById("detail-rec-list");
  let selectedRecIndex = 0; // default top score is index 0

  const drawRecOptions = () => {
    recContainer.innerHTML = "";
    task.recommendations.forEach((rec, idx) => {
      const card = document.createElement("div");
      card.className = `rec-option-card ${idx === selectedRecIndex ? 'selected' : ''}`;
      card.addEventListener("click", () => {
        selectedRecIndex = idx;
        drawRecOptions();
        drawXAI(task.recommendations[selectedRecIndex]);
        drawMap(task, task.recommendations[selectedRecIndex]);
      });

      card.innerHTML = `
        <div class="rec-card-header">
          <span class="rec-name">${rec.officerName}</span>
          <span class="rec-score-badge">${Math.round(rec.score * 100)}% Match</span>
        </div>
        <div class="rec-stats">
          <span>📍 ${rec.distance} km</span>
          <span>💼 Workload: ${state.officers.find(o => o.id === rec.officerId)?.activeTasks || 0} active</span>
        </div>
      `;
      recContainer.appendChild(card);
    });

    // Draw initial XAI and Map for the selected recommendation index
    if (task.recommendations.length > 0) {
      drawXAI(task.recommendations[selectedRecIndex]);
      drawMap(task, task.recommendations[selectedRecIndex]);
    }
  };

  const drawXAI = (rec) => {
    const xaiContainer = document.getElementById("xai-panel");
    const { explanation } = rec;
    
    xaiContainer.innerHTML = `
      <div class="xai-card">
        <div class="xai-title">
          <span>🧠 Confidence Matrix</span>
          <span style="margin-left:auto; color: var(--color-success)">${explanation.confidence}% Score</span>
        </div>
        <div class="xai-summary">${explanation.summary}</div>
        <ul class="xai-points-list">
          ${explanation.positives.map(pos => `<li class="xai-point">${pos}</li>`).join("")}
          ${explanation.concerns.map(con => `<li class="xai-point concern">${con}</li>`).join("")}
        </ul>
      </div>
    `;
  };

  // Map drawing utility using dynamic offsets
  const drawMap = (currTask, currRec) => {
    const mapContainer = document.getElementById("map-visuals-container");
    mapContainer.innerHTML = "";

    // Boundaries of Hyderabad coordinates for scaling
    // Min Lat: 17.3200, Max Lat: 17.5200
    // Min Lng: 78.3000, Max Lng: 78.5800
    const minLat = 17.3000;
    const maxLat = 17.5400;
    const minLng = 78.3000;
    const maxLng = 78.6000;

    const scaleX = (lng) => ((lng - minLng) / (maxLng - minLng)) * 100;
    const scaleY = (lat) => 100 - (((lat - minLat) / (maxLat - minLat)) * 100); // invert Y for screen coords

    // Position Task Node
    const taskX = scaleX(currTask.location.lng);
    const taskY = scaleY(currTask.location.lat);

    const taskNode = document.createElement("div");
    taskNode.className = "map-node task-node";
    taskNode.style.left = `${taskX}%`;
    taskNode.style.top = `${taskY}%`;
    taskNode.title = `Incident: ${currTask.title}`;
    mapContainer.appendChild(taskNode);

    // Position Recommended Officer Node
    const officer = state.officers.find(o => o.id === currRec.officerId);
    if (officer && officer.lat && officer.lng) {
      const offX = scaleX(officer.lng);
      const offY = scaleY(officer.lat);

      const officerNode = document.createElement("div");
      officerNode.className = "map-node officer-node selected-officer";
      officerNode.style.left = `${offX}%`;
      officerNode.style.top = `${offY}%`;
      officerNode.title = `Recommended: ${officer.name}`;
      mapContainer.appendChild(officerNode);

      // Draw connection line
      const deltaX = offX - taskX;
      const deltaY = offY - taskY;
      const distancePercent = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

      const line = document.createElement("div");
      line.className = "map-connection-line";
      line.style.left = `${taskX}%`;
      line.style.top = `${taskY}%`;
      line.style.width = `calc(${distancePercent}% - 5px)`;
      line.style.transform = `rotate(${angle}deg)`;
      mapContainer.appendChild(line);
    }
  };

  drawRecOptions();

  // Action Buttons Bindings
  if (task.status === "Pending Assignment") {
    const btnApprove = document.getElementById("btn-approve-rec");
    const btnToggleOverride = document.getElementById("btn-toggle-override");
    const overrideForm = document.getElementById("override-container");
    const btnSubmitOverride = document.getElementById("btn-submit-override");

    btnApprove.addEventListener("click", () => {
      if (task.recommendations.length > 0) {
        const topRec = task.recommendations[selectedRecIndex];
        orchestrator.confirmAssignment(task.id, topRec.officerId, false);
      }
    });

    btnToggleOverride.addEventListener("click", () => {
      if (overrideForm.style.display === "none") {
        overrideForm.style.display = "flex";
      } else {
        overrideForm.style.display = "none";
      }
    });

    btnSubmitOverride.addEventListener("click", () => {
      const selectOff = document.getElementById("select-override-officer");
      const reasonInput = document.getElementById("input-override-reason");
      const selectedOffId = selectOff.value;
      const reason = reasonInput.value.trim();

      if (!reason) {
        alert("Please provide a supervisor justification for overriding the AI recommendation.");
        return;
      }

      orchestrator.overrideAssignment(task.id, selectedOffId, reason);
    });
  } else {
    // In progress task action
    const btnComplete = document.getElementById("btn-complete-task");
    btnComplete.addEventListener("click", () => {
      orchestrator.completeTask(task.id);
    });
  }
}

function renderAuditLogs(logs) {
  const tbody = document.getElementById("audit-log-body");
  tbody.innerHTML = "";

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          No operational events logged yet.
        </td>
      </tr>
    `;
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement("tr");
    const timeString = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    let typeClass = "new";
    if (log.type === "AUTO_ASSIGN") typeClass = "auto";
    if (log.type === "SUPERVISOR_OVERRIDE") typeClass = "override";
    if (log.type === "MANUAL_CONFIRM") typeClass = "confirm";
    if (log.type === "TASK_RESOLVED") typeClass = "completed";

    tr.innerHTML = `
      <td style="color:var(--text-muted); font-size:0.75rem;">${timeString}</td>
      <td><span class="audit-type ${typeClass}">${log.type}</span></td>
      <td style="font-weight: 500;">${log.action}</td>
      <td style="font-size:0.75rem; color:var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.reason}">${log.reason}</td>
      <td style="font-size:0.75rem; font-weight: 600;">${log.user}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Window load trigger
window.addEventListener("DOMContentLoaded", () => {
  initApp();
});
