// GovConnect Civic Module Main Frontend Logic

const API_BASE = "http://127.0.0.1:5000";

// Global Session State
let currentUser = null;
let submitMap = null;
let submitMarker = null;
let adminMap = null;
let adminMarkersGroup = null;

// Initialize Page
document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  setupAuthEvents();
});

// --- SESSION MANAGEMENT ---

function checkSession() {
  const session = localStorage.getItem("govconnect_user");
  if (session) {
    currentUser = JSON.parse(session);
    showDashboard();
  } else {
    showAuth();
  }
}

function showAuth() {
  document.getElementById("auth-section").style.display = "block";
  document.getElementById("dashboard-section").style.display = "none";
  document.getElementById("session-header-widget").innerHTML = "";
  
  // Reset forms
  document.getElementById("login-form").reset();
  document.getElementById("register-form").reset();
  
  // Reset password group display and requirements (default Citizen selected)
  document.getElementById("login-password-group").style.display = "none";
  document.getElementById("login-password").required = false;
  document.getElementById("reg-password-group").style.display = "none";
  document.getElementById("reg-password").required = false;
  
  toggleAuthView("login");
}

function toggleAuthView(view) {
  if (view === "login") {
    document.getElementById("login-form-wrapper").style.display = "block";
    document.getElementById("register-form-wrapper").style.display = "none";
  } else {
    document.getElementById("login-form-wrapper").style.display = "none";
    document.getElementById("register-form-wrapper").style.display = "block";
  }
}

function setupAuthEvents() {
  document.getElementById("go-to-register").addEventListener("click", (e) => {
    e.preventDefault();
    toggleAuthView("register");
  });
  
  document.getElementById("go-to-login").addEventListener("click", (e) => {
    e.preventDefault();
    toggleAuthView("login");
  });

  // Toggle password fields based on role selection
  document.getElementById("login-role").addEventListener("change", (e) => {
    const passwordGroup = document.getElementById("login-password-group");
    const passwordInput = document.getElementById("login-password");
    if (e.target.value === "Citizen") {
      passwordGroup.style.display = "none";
      passwordInput.required = false;
      passwordInput.value = "";
    } else {
      passwordGroup.style.display = "block";
      passwordInput.required = true;
    }
  });

  document.getElementById("reg-role").addEventListener("change", (e) => {
    const passwordGroup = document.getElementById("reg-password-group");
    const passwordInput = document.getElementById("reg-password");
    if (e.target.value === "Citizen") {
      passwordGroup.style.display = "none";
      passwordInput.required = false;
      passwordInput.value = "";
    } else {
      passwordGroup.style.display = "block";
      passwordInput.required = true;
    }
  });
  
  // Login Submit
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const role = document.getElementById("login-role").value;
    const username = document.getElementById("login-username").value.trim();
    const password = role === "Citizen" ? "" : document.getElementById("login-password").value;
    
    try {
      const response = await fetch(`${API_BASE}/api/civic/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      if (response.ok) {
        currentUser = data.user;
        localStorage.setItem("govconnect_user", JSON.stringify(currentUser));
        showDashboard();
      } else {
        alert(data.error || "Authentication failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to server.");
    }
  });
  
  // Register Submit
  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const role = document.getElementById("reg-role").value;
    const full_name = document.getElementById("reg-name").value.trim();
    const username = document.getElementById("reg-username").value.trim();
    const password = role === "Citizen" ? "" : document.getElementById("reg-password").value;
    
    try {
      const response = await fetch(`${API_BASE}/api/civic/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, full_name })
      });
      
      const data = await response.json();
      if (response.ok) {
        alert("Registration successful! Please sign in.");
        toggleAuthView("login");
      } else {
        alert(data.error || "Registration failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to server.");
    }
  });

  // Logout button
  document.getElementById("btn-logout").addEventListener("click", () => {
    localStorage.removeItem("govconnect_user");
    currentUser = null;
    showAuth();
  });
}

// --- DASHBOARD ROUTING & LOADING ---

function showDashboard() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("dashboard-section").style.display = "grid";
  
  renderSessionHeader();
  renderSidebar();
  
  // Load default view based on role
  if (currentUser.role === "Citizen") {
    switchView("citizen-submit");
  } else if (currentUser.role === "Employee") {
    switchView("employee-dashboard");
  } else if (currentUser.role === "Admin") {
    switchView("admin-dashboard");
  }
}

function renderSessionHeader() {
  const container = document.getElementById("session-header-widget");
  container.innerHTML = `
    <button id="btn-show-notifications" class="notification-bell-btn">
      <i class="fa-solid fa-bell"></i>
      <span class="notification-count" id="header-unread-count" style="display: none;">0</span>
    </button>
    
    <div class="glass-card user-panel-header" style="margin-bottom: 0; padding: 0.5rem 1rem;">
      <div class="user-info">
        <div class="user-avatar">${currentUser.full_name.charAt(0)}</div>
        <div class="user-meta">
          <h4>${currentUser.full_name}</h4>
          <span>Role: ${currentUser.role}</span>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById("btn-show-notifications").addEventListener("click", () => {
    switchView("notifications-center");
  });
  
  updateUnreadCount();
}

async function updateUnreadCount() {
  try {
    const res = await fetch(`${API_BASE}/api/civic/notifications?user_id=${currentUser.id}`);
    if (res.ok) {
      const notifications = await res.json();
      const unreadCount = notifications.filter(n => n.read_status === 0).length;
      const badge = document.getElementById("header-unread-count");
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function renderSidebar() {
  const container = document.getElementById("sidebar-menu-links");
  container.innerHTML = "";
  
  if (currentUser.role === "Citizen") {
    container.innerHTML = `
      <button class="sidebar-btn active" id="side-citizen-submit">
        <i class="fa-solid fa-circle-plus"></i> Submit Grievance
      </button>
      <button class="sidebar-btn" id="side-citizen-history">
        <i class="fa-solid fa-clock-rotate-left"></i> My Complaints
      </button>
    `;
    
    document.getElementById("side-citizen-submit").addEventListener("click", () => switchView("citizen-submit"));
    document.getElementById("side-citizen-history").addEventListener("click", () => {
      switchView("complaints-list");
      loadComplaintsList();
    });
    
  } else if (currentUser.role === "Employee") {
    container.innerHTML = `
      <button class="sidebar-btn active" id="side-employee-home">
        <i class="fa-solid fa-house-chimney-user"></i> Workspace
      </button>
      <button class="sidebar-btn" id="side-employee-history">
        <i class="fa-solid fa-folder-closed"></i> Job History
      </button>
    `;
    
    document.getElementById("side-employee-home").addEventListener("click", () => switchView("employee-dashboard"));
    document.getElementById("side-employee-history").addEventListener("click", () => {
      switchView("complaints-list");
      loadComplaintsList();
    });
    
  } else if (currentUser.role === "Admin") {
    container.innerHTML = `
      <button class="sidebar-btn active" id="side-admin-home">
        <i class="fa-solid fa-chart-line"></i> Analytics Control
      </button>
      <button class="sidebar-btn" id="side-admin-complaints">
        <i class="fa-solid fa-list-check"></i> Manage Grievances
      </button>
    `;
    
    document.getElementById("side-admin-home").addEventListener("click", () => switchView("admin-dashboard"));
    document.getElementById("side-admin-complaints").addEventListener("click", () => {
      switchView("complaints-list");
      loadComplaintsList();
    });
  }
}

function switchView(viewId) {
  // Hide all views
  document.querySelectorAll(".dynamic-view").forEach(v => v.style.display = "none");
  
  // Show target view
  document.getElementById(`view-${viewId}`).style.display = "block";
  
  // Highlight active sidebar button
  document.querySelectorAll(".sidebar-btn").forEach(btn => btn.classList.remove("active"));
  
  if (viewId === "citizen-submit") {
    document.getElementById("side-citizen-submit")?.classList.add("active");
    initSubmissionMap();
  } else if (viewId === "complaints-list") {
    if (currentUser.role === "Citizen") {
      document.getElementById("side-citizen-history")?.classList.add("active");
    } else if (currentUser.role === "Employee") {
      document.getElementById("side-employee-history")?.classList.add("active");
    } else if (currentUser.role === "Admin") {
      document.getElementById("side-admin-complaints")?.classList.add("active");
    }
  } else if (viewId === "employee-dashboard") {
    document.getElementById("side-employee-home")?.classList.add("active");
    loadEmployeeDashboard();
  } else if (viewId === "admin-dashboard") {
    document.getElementById("side-admin-home")?.classList.add("active");
    loadAdminDashboard();
  } else if (viewId === "notifications-center") {
    loadNotificationsCenter();
  }
}

// --- CITIZEN SUBMIT COMPLAINT PAGE ---

function initSubmissionMap() {
  if (submitMap) return; // already initialized
  
  // Default to Hyderabad center
  const defaultLat = 17.3850;
  const defaultLng = 78.4867;
  
  submitMap = L.map("submit-map").setView([defaultLat, defaultLng], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(submitMap);
  
  // Set default coordinates
  document.getElementById("comp-lat").value = defaultLat;
  document.getElementById("comp-lng").value = defaultLng;
  document.getElementById("coordinates-display").innerHTML = `Lat: ${defaultLat}, Lng: ${defaultLng}`;
  
  submitMarker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(submitMap);
  
  submitMarker.on("dragend", () => {
    const latlng = submitMarker.getLatLng();
    updateCoords(latlng.lat, latlng.lng);
  });
  
  submitMap.on("click", (e) => {
    submitMarker.setLatLng(e.latlng);
    updateCoords(e.latlng.lat, e.latlng.lng);
  });
  
  // Geolocation trigger
  document.getElementById("btn-geolocation").addEventListener("click", () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        submitMap.setView([lat, lng], 15);
        submitMarker.setLatLng([lat, lng]);
        updateCoords(lat, lng);
      }, () => {
        alert("Geolocation retrieval failed. Please click coordinates manually.");
      });
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  });

  // Heuristic priorities suggestions listener
  const titleInput = document.getElementById("comp-title");
  const descInput = document.getElementById("comp-desc");
  const categoryInput = document.getElementById("comp-category");
  
  const queryAIHeuristic = debounce(async () => {
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const category = categoryInput.value;
    
    if (title.length > 5 || description.length > 10) {
      const res = await fetch(`${API_BASE}/api/civic/suggest-priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, category })
      });
      if (res.ok) {
        const data = await res.json();
        const banner = document.getElementById("priority-heuristic-box");
        banner.style.display = "flex";
        document.getElementById("ai-suggested-prio-val").textContent = data.suggested_priority;
        document.getElementById("ai-prio-conf").textContent = `${data.confidence} Match`;
        
        // Auto set form value to suggested value
        document.getElementById("comp-priority").value = data.suggested_priority;
      }
    }
  }, 600);
  
  titleInput.addEventListener("input", queryAIHeuristic);
  descInput.addEventListener("input", queryAIHeuristic);
  categoryInput.addEventListener("change", queryAIHeuristic);

  // File image input Base64 parsing
  const fileInput = document.getElementById("comp-file-input");
  const uploadTrigger = document.getElementById("image-upload-trigger");
  const uploadPrompt = document.getElementById("upload-prompt");
  const uploadPreview = document.getElementById("upload-preview-img");
  
  uploadTrigger.addEventListener("click", () => fileInput.click());
  
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        uploadPreview.src = event.target.result;
        uploadPreview.style.display = "block";
        uploadPrompt.style.display = "none";
      };
      reader.readAsDataURL(file);
    }
  });

  // Form Submit Action
  document.getElementById("complaint-form").onsubmit = async (e) => {
    e.preventDefault();
    
    const title = document.getElementById("comp-title").value.trim();
    const category = document.getElementById("comp-category").value;
    const description = document.getElementById("comp-desc").value.trim();
    const priority = document.getElementById("comp-priority").value;
    const lat = parseFloat(document.getElementById("comp-lat").value);
    const lng = parseFloat(document.getElementById("comp-lng").value);
    const image_path = uploadPreview.src || null;
    
    try {
      const res = await fetch(`${API_BASE}/api/civic/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, category, description, priority, lat, lng, image_path,
          citizen_id: currentUser.id
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert("Grievance submitted successfully to Municipal Office!");
        // Reset form & view history
        document.getElementById("complaint-form").reset();
        uploadPreview.style.display = "none";
        uploadPrompt.style.display = "block";
        uploadPreview.removeAttribute('src');
        switchView("complaints-list");
        loadComplaintsList();
      } else {
        alert(data.error || "Submission failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error sending request to server.");
    }
  };
}

function updateCoords(lat, lng) {
  document.getElementById("comp-lat").value = lat;
  document.getElementById("comp-lng").value = lng;
  document.getElementById("coordinates-display").innerHTML = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
}

// Helper Debouncer
function debounce(func, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

// --- GENERAL COMPLAINTS LEDGER TABLE ---

async function loadComplaintsList() {
  const tableHead = document.querySelector("#complaints-table th");
  const tableHeader = document.querySelector("#complaints-table thead");
  const tbody = document.getElementById("complaints-table-body");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Fetching complaints records...</td></tr>`;
  
  // Set headers dynamically based on role
  if (currentUser.role === "Citizen") {
    tableHeader.innerHTML = `
      <tr>
        <th>Complaint ID</th>
        <th>Title</th>
        <th>Category</th>
        <th>Priority</th>
        <th>Created On</th>
        <th>Status</th>
        <th style="width: 20%;">Track / Feedback</th>
      </tr>
    `;
  } else if (currentUser.role === "Admin") {
    tableHeader.innerHTML = `
      <tr>
        <th>Complaint ID</th>
        <th>Citizen</th>
        <th>Category</th>
        <th>Priority</th>
        <th>Area Coordinates</th>
        <th>Status</th>
        <th style="width: 20%;">Assignment Management</th>
      </tr>
    `;
  } else if (currentUser.role === "Employee") {
    tableHeader.innerHTML = `
      <tr>
        <th>Complaint ID</th>
        <th>Citizen</th>
        <th>Category</th>
        <th>Priority</th>
        <th>Created On</th>
        <th>Status</th>
        <th>Timeline Track</th>
      </tr>
    `;
  }
  
  // Compile filters
  const searchVal = document.getElementById("filter-search").value.trim();
  const statusVal = document.getElementById("filter-status").value;
  const priorityVal = document.getElementById("filter-priority").value;
  const categoryVal = document.getElementById("filter-category").value;
  
  let url = `${API_BASE}/api/civic/complaints?`;
  if (currentUser.role === "Citizen") {
    url += `citizen_id=${currentUser.id}&`;
  } else if (currentUser.role === "Employee") {
    url += `assigned_employee_id=${currentUser.employee_details.id}&`;
  }
  
  if (searchVal) url += `search=${encodeURIComponent(searchVal)}&`;
  if (statusVal) url += `status=${statusVal}&`;
  if (priorityVal) url += `priority=${priorityVal}&`;
  if (categoryVal) url += `category=${categoryVal}&`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load");
    const data = await res.json();
    
    tbody.innerHTML = "";
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-clipboard-question"></i> No complaints records found matching criteria.</td></tr>`;
      return;
    }
    
    data.forEach(comp => {
      const tr = document.createElement("tr");
      const statusBadge = `<span class="badge-status ${comp.status.toLowerCase().replace(' ', '')}">${comp.status}</span>`;
      const dateString = new Date(comp.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      
      if (currentUser.role === "Citizen") {
        let actionBtn = `<button class="btn btn-outline" onclick="openTracker(${comp.id})" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;"><i class="fa-solid fa-route"></i> Track</button>`;
        if (comp.status === "Resolved" || comp.status === "Verified") {
          actionBtn += ` <button class="btn" onclick="openRatingModal(${comp.id})" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; background-color: var(--color-success);"><i class="fa-solid fa-star"></i> Rate & Close</button>`;
        }
        
        tr.innerHTML = `
          <td><strong>#${comp.id}</strong></td>
          <td>${comp.title}</td>
          <td>${comp.category}</td>
          <td><span class="badge-status ${comp.priority.toLowerCase()}">${comp.priority}</span></td>
          <td>${dateString}</td>
          <td>${statusBadge}</td>
          <td>${actionBtn}</td>
        `;
      } else if (currentUser.role === "Admin") {
        let assignBtn = "";
        if (comp.status === "Submitted" || comp.status === "AI Categorized" || comp.status === "Pending Admin Review") {
          assignBtn = `<button class="btn" onclick="openAssignmentModal(${comp.id})" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;"><i class="fa-solid fa-user-plus"></i> Allocate</button>`;
        } else if (comp.status === "Resolved") {
          assignBtn = `<button class="btn" onclick="verifyComplaint(${comp.id})" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; background-color: var(--color-success);"><i class="fa-solid fa-certificate"></i> Verify</button>`;
        } else {
          assignBtn = `<span style="font-size: 0.75rem; color: var(--text-muted);">Assigned: <a href="#" onclick="viewEmployeeProfile(${comp.assigned_employee_id})" style="color:var(--color-civic); text-decoration:none;">${comp.employee_name || 'Officer'}</a></span>`;
        }
        assignBtn += ` <button class="btn btn-outline" onclick="openTracker(${comp.id})" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;"><i class="fa-solid fa-route"></i></button>`;
        
        tr.innerHTML = `
          <td><strong>#${comp.id}</strong></td>
          <td>${comp.citizen_name || 'Anonymous'}</td>
          <td>${comp.category}</td>
          <td><span class="badge-status ${comp.priority.toLowerCase()}">${comp.priority}</span></td>
          <td style="font-family: monospace;">(${comp.lat.toFixed(4)}, ${comp.lng.toFixed(4)})</td>
          <td>${statusBadge}</td>
          <td>${assignBtn}</td>
        `;
      } else if (currentUser.role === "Employee") {
        tr.innerHTML = `
          <td><strong>#${comp.id}</strong></td>
          <td>${comp.citizen_name || 'Anonymous'}</td>
          <td>${comp.category}</td>
          <td><span class="badge-status ${comp.priority.toLowerCase()}">${comp.priority}</span></td>
          <td>${dateString}</td>
          <td>${statusBadge}</td>
          <td><button class="btn btn-outline" onclick="openTracker(${comp.id})" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;"><i class="fa-solid fa-route"></i> Track</button></td>
        `;
      }
      
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-danger);">Failed to query records.</td></tr>`;
  }
}

// Setup Filters Bindings
document.getElementById("filter-search").addEventListener("input", debounce(loadComplaintsList, 400));
document.getElementById("filter-status").addEventListener("change", loadComplaintsList);
document.getElementById("filter-priority").addEventListener("change", loadComplaintsList);
document.getElementById("filter-category").addEventListener("change", loadComplaintsList);
document.getElementById("btn-reset-filters").onclick = () => {
  document.getElementById("filter-search").value = "";
  document.getElementById("filter-status").value = "";
  document.getElementById("filter-priority").value = "";
  document.getElementById("filter-category").value = "";
  loadComplaintsList();
};


// --- EMPLOYEE WORKSPACE DASHBOARD ---

async function loadEmployeeDashboard() {
  const empId = currentUser.employee_details.id;
  
  try {
    const res = await fetch(`${API_BASE}/api/civic/employees/${empId}`);
    if (!res.ok) throw new Error("Failed to load employee details");
    const data = await res.json();
    
    // Set metrics
    document.getElementById("emp-meta-assigned").textContent = data.current_tasks.length + data.completed_tasks.length;
    document.getElementById("emp-meta-workload").textContent = data.current_tasks.length;
    document.getElementById("emp-meta-completed").textContent = data.completed_tasks.length;
    document.getElementById("emp-meta-rating").textContent = `${data.rating.toFixed(1)} / 5.0`;
    
    // Renders active jobs list table
    const tbody = document.getElementById("employee-task-table-body");
    tbody.innerHTML = "";
    
    if (data.current_tasks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-circle-check"></i> Perfect! No active tasks assigned for today.</td></tr>`;
      return;
    }
    
    data.current_tasks.forEach(task => {
      const tr = document.createElement("tr");
      const statusBadge = `<span class="badge-status ${task.status.toLowerCase().replace(' ', '')}">${task.status}</span>`;
      const deadlineStr = new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date(task.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
      
      let actionButtons = "";
      
      // Dynamic operational actions based on status flows
      if (task.status === "Assigned Employee") {
        actionButtons = `
          <button class="btn" onclick="updateTaskProgress(${task.id}, 'Employee Accepted')" style="padding: 0.35rem 0.5rem; font-size: 0.75rem; background-color: var(--color-success);"><i class="fa-solid fa-check"></i> Accept</button>
          <button class="btn" onclick="openRejectionModal(${task.id})" style="padding: 0.35rem 0.5rem; font-size: 0.75rem; background-color: var(--color-danger);"><i class="fa-solid fa-xmark"></i> Decline</button>
        `;
      } else if (task.status === "Employee Accepted") {
        actionButtons = `<button class="btn" onclick="updateTaskProgress(${task.id}, 'Travelling')" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; background-color: var(--color-warning);"><i class="fa-solid fa-truck-fast"></i> Start Travel</button>`;
      } else if (task.status === "Travelling") {
        actionButtons = `<button class="btn" onclick="updateTaskProgress(${task.id}, 'Reached Location')" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; background-color: var(--color-warning);"><i class="fa-solid fa-location-dot"></i> Reached Loc</button>`;
      } else if (task.status === "Reached Location") {
        actionButtons = `<button class="btn" onclick="openProgressModal(${task.id}, 'Work Started')" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; background-color: var(--color-warning);"><i class="fa-solid fa-play"></i> Start Work</button>`;
      } else if (task.status === "Work Started") {
        actionButtons = `<button class="btn" onclick="openProgressModal(${task.id}, 'Working')" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; background-color: var(--color-warning);"><i class="fa-solid fa-spinner fa-spin"></i> Set Progress</button>`;
      } else if (task.status === "Working") {
        actionButtons = `<button class="btn" onclick="openProgressModal(${task.id}, 'Resolved')" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; background-color: var(--color-success);"><i class="fa-solid fa-check-double"></i> Mark Solved</button>`;
      } else {
        actionButtons = `<span style="font-size: 0.75rem; color: var(--text-muted);">Awaiting Verification</span>`;
      }
      
      tr.innerHTML = `
        <td><strong>#${task.id}</strong></td>
        <td>Citizen (ID: ${task.citizen_id})</td>
        <td>${task.category}</td>
        <td><span class="badge-status ${task.priority.toLowerCase()}">${task.priority}</span></td>
        <td style="font-size: 0.8rem;">${deadlineStr}</td>
        <td>${statusBadge}</td>
        <td style="display:flex; gap:0.25rem;">${actionButtons}</td>
      `;
      tbody.appendChild(tr);
    });
    
  } catch (err) {
    console.error(err);
  }
}

// Direct progress updates for simple transitions
async function updateTaskProgress(cid, targetStatus, before_image = null, progress_image = null, completion_image = null, comments = "") {
  try {
    const res = await fetch(`${API_BASE}/api/civic/complaints/${cid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: targetStatus,
        before_image,
        progress_image,
        completion_image,
        rejection_reason: comments,
        actor: currentUser.full_name
      })
    });
    
    if (res.ok) {
      alert(`Task status successfully updated to: ${targetStatus}`);
      loadEmployeeDashboard();
    } else {
      const data = await res.json();
      alert(data.error || "Update status failed");
    }
  } catch (err) {
    console.error(err);
    alert("Connection error.");
  }
}


// --- ADMIN INTELLIGENT ROUTING & CONTROL ---

async function loadAdminDashboard() {
  try {
    const res = await fetch(`${API_BASE}/api/civic/analytics`);
    if (!res.ok) throw new Error("Analytics retrieval failed");
    const data = await res.json();
    
    // Top Metric Cards Render
    const grid = document.getElementById("admin-metrics-grid");
    grid.innerHTML = `
      <div class="glass-card analytics-card normal">
        <div class="info">
          <h5>Total Complaints</h5>
          <div class="value">${data.total_complaints}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-folder-open"></i></div>
      </div>
      <div class="glass-card analytics-card warning">
        <div class="info">
          <h5>Pending Review</h5>
          <div class="value">${data.pending_complaints}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      </div>
      <div class="glass-card analytics-card normal">
        <div class="info">
          <h5>Assigned Tasks</h5>
          <div class="value">${data.assigned_complaints}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-user-check"></i></div>
      </div>
      <div class="glass-card analytics-card normal">
        <div class="info">
          <h5>In Progress</h5>
          <div class="value">${data.in_progress}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
      </div>
      <div class="glass-card analytics-card success">
        <div class="info">
          <h5>Resolved</h5>
          <div class="value">${data.resolved}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-circle-check"></i></div>
      </div>
      <div class="glass-card analytics-card success">
        <div class="info">
          <h5>Closed</h5>
          <div class="value">${data.closed}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-box-archive"></i></div>
      </div>
      <div class="glass-card analytics-card normal">
        <div class="info">
          <h5>Today's Received</h5>
          <div class="value">${data.today_complaints}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-calendar-day"></i></div>
      </div>
      <div class="glass-card analytics-card warning">
        <div class="info">
          <h5>High Priority</h5>
          <div class="value">${data.high_priority_complaints}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-hourglass-half"></i></div>
      </div>
      <div class="glass-card analytics-card danger">
        <div class="info">
          <h5>Emergency Tasks</h5>
          <div class="value">${data.emergency_complaints}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-bell"></i></div>
      </div>
      <div class="glass-card analytics-card success">
        <div class="info">
          <h5>Available Officers</h5>
          <div class="value">${data.employee_availability}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-users-gear"></i></div>
      </div>
      <div class="glass-card analytics-card normal">
        <div class="info">
          <h5>Avg Resolution Time</h5>
          <div class="value">${data.average_resolution_time}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-stopwatch"></i></div>
      </div>
      <div class="glass-card analytics-card danger">
        <div class="info">
          <h5>SLA Violations</h5>
          <div class="value">${data.sla_violations}</div>
        </div>
        <div class="icon"><i class="fa-solid fa-skull-crossbones"></i></div>
      </div>
    `;
    
    // Audit Log rendering
    const logsBox = document.getElementById("admin-audit-log-box");
    logsBox.innerHTML = "";
    if (data.recent_activities.length === 0) {
      logsBox.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:2rem;">No operational changes logged today.</p>`;
    } else {
      data.recent_activities.forEach(log => {
        const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const typeClass = log.event_type === 'SUPERVISOR_OVERRIDE' ? 'override' : 'auto';
        logsBox.innerHTML += `
          <div style="font-size:0.75rem; border-bottom:1px solid var(--border-color); padding: 0.5rem 0; display:flex; flex-direction:column; gap:0.15rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:var(--text-primary); font-weight:600;">${log.action}</strong>
              <span class="badge-status submitted" style="font-size:0.65rem; padding:1px 4px;">${log.event_type}</span>
            </div>
            <span style="color:var(--text-secondary);">${log.reason || 'Normal operation'}</span>
            <span style="color:var(--text-muted); font-size:0.65rem;">🕒 ${timeStr} | Actor: ${log.actor}</span>
          </div>
        `;
      });
    }

    // Chart.js render analytics
    renderAdminCharts(data);
    
    // Admin interactive incidents map
    initAdminMap(data.area_distribution);
    
  } catch (err) {
    console.error(err);
  }
}

function initAdminMap(areaDist) {
  if (adminMap) {
    // Clear and redraw markers
    adminMarkersGroup.clearLayers();
  } else {
    adminMap = L.map("admin-map").setView([17.3850, 78.4867], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(adminMap);
    adminMarkersGroup = L.layerGroup().addTo(adminMap);
  }
  
  // Fetch active complaints for placing map markers
  fetch(`${API_BASE}/api/civic/complaints`)
    .then(res => res.json())
    .then(complaints => {
      complaints.forEach(comp => {
        if (comp.status !== "Closed") {
          // Color code markers by priority
          let color = "green";
          if (comp.priority === "Critical" || comp.priority === "High") {
            color = "red";
          } else if (comp.priority === "Medium") {
            color = "orange";
          }
          
          // Generate colored SVG marker
          const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="28px" height="28px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
          const customIcon = L.divIcon({
            html: iconSvg,
            className: 'custom-leaflet-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 28]
          });
          
          const popupHtml = `
            <div style="font-family:var(--font-sans); color:#fff; width:200px;">
              <h5 style="margin-bottom:0.25rem; font-weight:600; font-size:0.85rem;">${comp.title}</h5>
              <span class="badge-status ${comp.priority.toLowerCase()}" style="font-size:0.65rem; padding: 2px 4px; display:inline-block; margin-bottom:0.5rem;">${comp.priority}</span>
              <p style="font-size:0.75rem; color:#9ca3af; margin-bottom:0.5rem;">${comp.description.slice(0, 50)}...</p>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="badge-status ${comp.status.toLowerCase().replace(' ', '')}" style="font-size:0.75rem;">${comp.status}</span>
                <button class="btn" onclick="openTracker(${comp.id})" style="padding:2px 6px; font-size:0.7rem;">Track</button>
              </div>
            </div>
          `;
          
          L.marker([comp.lat, comp.lng], { icon: customIcon })
            .bindPopup(popupHtml)
            .addTo(adminMarkersGroup);
        }
      });
    });
}

// Render administrative dashboards charts
let chartsList = {};
function renderAdminCharts(data) {
  // 1. Categories Chart
  const ctxCat = document.getElementById("chart-categories").getContext("2d");
  if (chartsList.cat) chartsList.cat.destroy();
  
  const catLabels = Object.keys(data.category_distribution);
  const catValues = Object.values(data.category_distribution);
  
  chartsList.cat = new Chart(ctxCat, {
    type: 'doughnut',
    data: {
      labels: catLabels,
      datasets: [{
        data: catValues,
        backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#a78bfa', '#ec4899', '#14b8a6', '#6b7280']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9ca3af' } }
      }
    }
  });

  // 2. Trends Chart
  const ctxTrend = document.getElementById("chart-trends").getContext("2d");
  if (chartsList.trend) chartsList.trend.destroy();
  
  chartsList.trend = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels: ['May', 'Jun', 'Jul'],
      datasets: [{
        label: 'Grievances Received',
        data: [12, 19, data.total_complaints],
        borderColor: '#3b82f6',
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      },
      plugins: {
        legend: { labels: { color: '#9ca3af' } }
      }
    }
  });

  // 3. Employee Workloads Chart
  const ctxEmp = document.getElementById("chart-employees").getContext("2d");
  if (chartsList.emp) chartsList.emp.destroy();
  
  const empNames = data.employee_performance.map(e => e.full_name);
  const empCompleted = data.employee_performance.map(e => e.completed_count);
  const empEfficiency = data.employee_performance.map(e => e.efficiency_percentage);
  
  chartsList.emp = new Chart(ctxEmp, {
    type: 'bar',
    data: {
      labels: empNames,
      datasets: [
        {
          label: 'Completed Tasks',
          data: empCompleted,
          backgroundColor: 'rgba(59, 130, 246, 0.6)'
        },
        {
          label: 'Efficiency %',
          data: empEfficiency,
          backgroundColor: 'rgba(16, 185, 129, 0.6)'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      },
      plugins: {
        legend: { labels: { color: '#9ca3af' } }
      }
    }
  });

  // 4. SLA Compliance Chart
  const ctxSla = document.getElementById("chart-compliance").getContext("2d");
  if (chartsList.sla) chartsList.sla.destroy();
  
  chartsList.sla = new Chart(ctxSla, {
    type: 'pie',
    data: {
      labels: ['SLA Compliant', 'SLA Violations'],
      datasets: [{
        data: [data.total_complaints - data.sla_violations, data.sla_violations],
        backgroundColor: ['#10b981', '#ef4444']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9ca3af' } }
      }
    }
  });
}

// --- ADMIN CANDIDATE RECOMMENDATION MODAL ---

window.openAssignmentModal = async function(cid) {
  const modal = document.getElementById("assignment-modal");
  const compInfo = document.getElementById("assign-modal-complaint-info");
  const aiPanel = document.getElementById("ai-recommender-panel");
  const empList = document.getElementById("modal-employee-list");
  
  modal.style.display = "flex";
  compInfo.textContent = `Fetching candidates for Complaint ID: #${cid}...`;
  aiPanel.innerHTML = `<div style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Querying AI criteria matching engine...</div>`;
  empList.innerHTML = "";
  
  try {
    // Fetch recommendations for this complaint
    const res = await fetch(`${API_BASE}/api/civic/complaints/${cid}/recommendations`);
    if (!res.ok) throw new Error("Failed to fetch recommendation matching profiles");
    const recommendations = await res.json();
    
    // Get base complaint data for text print
    const compRes = await fetch(`${API_BASE}/api/civic/complaints/${cid}`);
    const compData = await compRes.json();
    compInfo.textContent = `Complaint Category: ${compData.category} | Title: "${compData.title}"`;
    
    if (recommendations.length === 0) {
      aiPanel.innerHTML = `<div style="color:var(--color-danger);"><i class="fa-solid fa-triangle-exclamation"></i> No active employees available in Mandal records.</div>`;
      return;
    }
    
    // Top Recommendation
    const topRec = recommendations[0];
    aiPanel.innerHTML = `
      <div class="ai-recommendation-header">
        <div>
          <span class="ai-recommendation-badge"><i class="fa-solid fa-robot"></i> Recommended AI Officer</span>
          <h4 style="margin-top: 0.5rem; font-size:1.2rem;">${topRec.employee.full_name} (${topRec.employee.designation})</h4>
        </div>
        <div class="ai-recommendation-score">
          ${topRec.confidence}% Match
        </div>
      </div>
      <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">Match Criteria Justifications:</p>
      <ul class="ai-reason-list">
        ${topRec.reasons.map(r => `<li><i class="fa-solid fa-circle-check"></i> ${r}</li>`).join('')}
        ${topRec.concerns.map(c => `<li style="color:#f472b6;"><i class="fa-solid fa-triangle-exclamation"></i> ${c}</li>`).join('')}
      </ul>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
        <button class="btn" onclick="executeAssignment(${cid}, ${topRec.employee.id}, false)" style="background-color: var(--color-success);">Approve AI Recommendation</button>
      </div>
    `;
    
    // Other Candidates
    empList.innerHTML = "";
    recommendations.forEach(rec => {
      const emp = rec.employee;
      const row = document.createElement("div");
      row.className = "employee-comparison-card glass-card";
      row.style = "display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem; margin-bottom: 1rem; width: 100%; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; background: rgba(255, 255, 255, 0.015);";
      
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; gap: 1rem; align-items: center;">
            <img src="${emp.profile_photo || 'https://via.placeholder.com/150'}" alt="${emp.full_name}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255, 255, 255, 0.1);">
            <div>
              <h5 style="font-size: 0.95rem; font-weight: 700; margin: 0; color: #fff;">${emp.full_name} <span style="font-size: 0.75rem; color: var(--text-muted);">(${emp.employee_id})</span></h5>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.15rem 0 0 0;">${emp.designation} | Dept: <strong>${emp.department}</strong></p>
            </div>
          </div>
          <div>
            <button class="btn btn-outline" onclick="executeAssignment(${cid}, ${emp.id}, true)" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; border-color: var(--color-warning); color: #fff;"><i class="fa-solid fa-user-pen"></i> Assign Override</button>
          </div>
        </div>

        <div class="emp-params-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 0.75rem; font-size: 0.75rem; width: 100%;">
          <div><span style="color: var(--text-muted);">Experience:</span> <strong style="color: #fff;">${emp.experience_years} Years</strong></div>
          <div style="grid-column: span 2;"><span style="color: var(--text-muted);">Specialization:</span> <strong style="color: #fff;">${emp.specialization}</strong></div>
          <div><span style="color: var(--text-muted);">Attendance:</span> <strong style="color: var(--color-success);">${emp.attendance_percentage}%</strong></div>
          
          <div><span style="color: var(--text-muted);">Efficiency:</span> <strong style="color: var(--color-primary);">${emp.efficiency_percentage}%</strong></div>
          <div><span style="color: var(--text-muted);">Rating:</span> <strong style="color: #fbbf24;"><i class="fa-solid fa-star"></i> ${emp.rating.toFixed(1)}/5</strong></div>
          <div><span style="color: var(--text-muted);">Avg Resol. Time:</span> <strong style="color: #fff;">${emp.avg_resolution_time.toFixed(1)} hrs</strong></div>
          <div><span style="color: var(--text-muted);">Current Workload:</span> <strong style="color: var(--color-warning);">${emp.current_workload} active</strong></div>
          
          <div><span style="color: var(--text-muted);">Completed:</span> <strong style="color: var(--color-success);">${emp.total_completed} jobs</strong></div>
          <div><span style="color: var(--text-muted);">Pending:</span> <strong style="color: var(--color-warning);">${emp.total_pending} jobs</strong></div>
          <div><span style="color: var(--text-muted);">Availability:</span> <strong style="color: ${emp.status==='Available'?'var(--color-success)':'var(--color-danger)'};">${emp.status}</strong></div>
          <div><span style="color: var(--text-muted);">Leave Status:</span> <strong style="color: ${emp.leave_status==='Active'?'var(--color-success)':'var(--color-danger)'};">${emp.leave_status}</strong></div>
          
          <div style="grid-column: span 2;"><span style="color: var(--text-muted);">Current Location:</span> <strong style="font-family: monospace; color: #fff;">(${emp.lat.toFixed(4)}, ${emp.lng.toFixed(4)})</strong></div>
          <div style="grid-column: span 2;"><span style="color: var(--text-muted);">Distance:</span> <strong style="color: var(--color-primary);">${rec.distance_km} km away</strong></div>
        </div>
      `;
      empList.appendChild(row);
    });
    
  } catch (err) {
    console.error(err);
    compInfo.textContent = "Error loading assignment recommendation dashboard.";
  }
};

window.executeAssignment = async function(cid, employeeId, isOverride) {
  let reason = "Approved AI Recommendation";
  if (isOverride) {
    reason = prompt("Specify justification for overriding AI suggestion (Required):");
    if (!reason || !reason.trim()) {
      alert("Override reason is required.");
      return;
    }
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/civic/complaints/${cid}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: employeeId,
        reason,
        is_override: isOverride,
        actor: currentUser.full_name
      })
    });
    
    if (res.ok) {
      alert("Employee allocated to grievance successfully!");
      document.getElementById("assignment-modal").style.display = "none";
      loadComplaintsList();
      // Reload admin dashboard if in admin home
      if (document.getElementById("view-admin-dashboard").style.display === "block") {
        loadAdminDashboard();
      }
    } else {
      const data = await res.json();
      alert(data.error || "Assignment allocation failed");
    }
  } catch (err) {
    console.error(err);
  }
};

// Modal closings Bindings
document.getElementById("btn-close-assign-modal").onclick = () => {
  document.getElementById("assignment-modal").style.display = "none";
};


// --- EMPLOYEE DASHBOARD ACTION MODALS ---

window.openRejectionModal = function(cid) {
  document.getElementById("rejection-modal").style.display = "flex";
  document.getElementById("reject-complaint-id").value = cid;
  document.getElementById("reject-reason").value = "";
};

document.getElementById("btn-close-reject-modal").onclick = () => {
  document.getElementById("rejection-modal").style.display = "none";
};

document.getElementById("btn-submit-rejection").onclick = async () => {
  const cid = document.getElementById("reject-complaint-id").value;
  const reason = document.getElementById("reject-reason").value.trim();
  
  if (!reason) {
    alert("Please provide a rejection reason.");
    return;
  }
  
  // Rejection reverts status to Pending Admin Review or Submitted and logs the reason
  await updateTaskProgress(cid, 'Pending Admin Review', null, null, null, reason);
  document.getElementById("rejection-modal").style.display = "none";
};

// Progress verification modal
window.openProgressModal = function(cid, targetStatus) {
  const modal = document.getElementById("progress-modal");
  modal.style.display = "flex";
  document.getElementById("progress-complaint-id").value = cid;
  document.getElementById("progress-target-status").value = targetStatus;
  
  document.getElementById("progress-modal-title").textContent = `Confirming transition to: ${targetStatus}`;
  
  // Reset fields
  document.getElementById("progress-file-input").value = "";
  document.getElementById("progress-preview-img").style.display = "none";
  document.getElementById("progress-preview-img").removeAttribute("src");
  document.getElementById("progress-upload-prompt").style.display = "block";
  document.getElementById("progress-reasons").value = "";
  
  if (targetStatus === "Working") {
    document.getElementById("progress-desc-form-group").style.display = "block";
  } else {
    document.getElementById("progress-desc-form-group").style.display = "none";
  }
};

document.getElementById("btn-close-progress-modal").onclick = () => {
  document.getElementById("progress-modal").style.display = "none";
};

// File image upload inside progress modal
const progressFileInput = document.getElementById("progress-file-input");
const progressTrigger = document.getElementById("progress-upload-trigger");
const progressPrompt = document.getElementById("progress-upload-prompt");
const progressPreview = document.getElementById("progress-preview-img");

progressTrigger.addEventListener("click", () => progressFileInput.click());

progressFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      progressPreview.src = event.target.result;
      progressPreview.style.display = "block";
      progressPrompt.style.display = "none";
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById("btn-submit-progress").onclick = async () => {
  const cid = document.getElementById("progress-complaint-id").value;
  const status = document.getElementById("progress-target-status").value;
  const image = progressPreview.src || null;
  const comments = document.getElementById("progress-reasons").value.trim();
  
  if (!image && (status === "Work Started" || status === "Resolved")) {
    alert("Image verification upload is mandatory for auditing before starting or closing work.");
    return;
  }
  
  let before_image = null, progress_image = null, completion_image = null;
  if (status === "Work Started") before_image = image;
  else if (status === "Working") progress_image = image;
  else if (status === "Resolved") completion_image = image;
  
  await updateTaskProgress(cid, status, before_image, progress_image, completion_image, comments);
  document.getElementById("progress-modal").style.display = "none";
};


// --- CITIZEN GRATING / FEEDBACK CLOSURE MODAL ---

window.openRatingModal = function(cid) {
  document.getElementById("rating-modal").style.display = "flex";
  document.getElementById("rating-complaint-id").value = cid;
  document.getElementById("rating-feedback").value = "";
  
  // reset stars
  document.querySelectorAll("#feedback-stars i").forEach(star => star.classList.remove("active"));
};

document.getElementById("btn-close-rating-modal").onclick = () => {
  document.getElementById("rating-modal").style.display = "none";
};

// stars clicks
document.querySelectorAll("#feedback-stars i").forEach(star => {
  star.onclick = () => {
    const r = parseInt(star.getAttribute("data-rating"));
    document.querySelectorAll("#feedback-stars i").forEach(s => {
      const sr = parseInt(s.getAttribute("data-rating"));
      if (sr <= r) s.classList.add("active");
      else s.classList.remove("active");
    });
    star.setAttribute("data-selected-rating", r);
  };
});

document.getElementById("btn-submit-rating").onclick = async () => {
  const cid = document.getElementById("rating-complaint-id").value;
  const starsContainer = document.querySelector("#feedback-stars i.active:last-of-type");
  const rating = starsContainer ? parseInt(starsContainer.getAttribute("data-rating")) : 5;
  const feedback = document.getElementById("rating-feedback").value.trim();
  
  try {
    const res = await fetch(`${API_BASE}/api/civic/complaints/${cid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Closed',
        citizen_rating: rating,
        citizen_feedback: feedback,
        actor: currentUser.full_name
      })
    });
    
    if (res.ok) {
      alert("Thank you for your rating! Complaint is officially CLOSED.");
      document.getElementById("rating-modal").style.display = "none";
      loadComplaintsList();
    } else {
      alert("Feedback submission failed");
    }
  } catch (err) {
    console.error(err);
  }
};


// --- TIMELINE TRACKER NAVIGATION ---

window.openTracker = function(cid) {
  window.open(`track.html?id=${cid}`, '_blank');
};

window.viewEmployeeProfile = function(empId) {
  window.open(`employee-profile.html?id=${empId}`, '_blank');
};

window.verifyComplaint = async function(cid) {
  if (!confirm("Are you sure you want to verify the resolved work for this complaint?")) return;
  try {
    const res = await fetch(`${API_BASE}/api/civic/complaints/${cid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Verified',
        actor: currentUser.full_name
      })
    });
    if (res.ok) {
      alert("Complaint marked as VERIFIED!");
      loadComplaintsList();
      if (document.getElementById("view-admin-dashboard").style.display === "block") {
        loadAdminDashboard();
      }
    } else {
      alert("Verification update failed.");
    }
  } catch (err) {
    console.error(err);
  }
};


// --- USER NOTIFICATIONS CENTER ---

async function loadNotificationsCenter() {
  const box = document.getElementById("notifications-box");
  box.innerHTML = `<div style="text-align:center; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Querying alerts...</div>`;
  
  try {
    const res = await fetch(`${API_BASE}/api/civic/notifications?user_id=${currentUser.id}`);
    if (!res.ok) throw new Error("Query alerts failed");
    const notifications = await res.json();
    
    box.innerHTML = "";
    if (notifications.length === 0) {
      box.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bell-slash"></i> Inbox is clean! No alerts received today.</div>`;
      return;
    }
    
    notifications.forEach(n => {
      const item = document.createElement("div");
      item.className = `notification-item ${n.read_status === 0 ? 'unread' : 'read'}`;
      
      let icon = "fa-info-circle";
      if (n.type === 'emergency') icon = "fa-radiation";
      else if (n.type === 'warning') icon = "fa-triangle-exclamation";
      
      const timeStr = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
      
      item.innerHTML = `
        <div class="notification-icon ${n.type}"><i class="fa-solid ${icon}"></i></div>
        <div style="flex-grow: 1;">
          <p style="font-size:0.85rem; color:#fff; font-weight:500;">${n.message}</p>
          <span style="font-size:0.7rem; color:var(--text-muted);">🕒 ${timeStr}</span>
        </div>
        ${n.read_status === 0 ? `<button class="btn btn-outline" onclick="markNotificationRead(${n.id})" style="padding:0.25rem 0.5rem; font-size:0.65rem;"><i class="fa-solid fa-check"></i> Read</button>` : ''}
      `;
      box.appendChild(item);
    });
  } catch (err) {
    console.error(err);
    box.innerHTML = `<div style="text-align:center; color:var(--color-danger);">Failed to query alerts.</div>`;
  }
}

window.markNotificationRead = async function(nid) {
  try {
    const res = await fetch(`${API_BASE}/api/civic/notifications/${nid}/read`, { method: 'POST' });
    if (res.ok) {
      loadNotificationsCenter();
      updateUnreadCount();
    }
  } catch (err) {
    console.error(err);
  }
};

document.getElementById("btn-mark-all-read").onclick = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/civic/notifications?user_id=${currentUser.id}`);
    if (res.ok) {
      const notifications = await res.json();
      const unreads = notifications.filter(n => n.read_status === 0);
      
      for (const n of unreads) {
        await fetch(`${API_BASE}/api/civic/notifications/${n.id}/read`, { method: 'POST' });
      }
      
      loadNotificationsCenter();
      updateUnreadCount();
    }
  } catch (err) {
    console.error(err);
  }
};
