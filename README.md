# GovConnect – Smart Government Services Portal

**GovConnect** is a full-stack, intelligent web application designed to unify civic grievance management, disaster rescue operations, and emergency mandal-to-village medical inventory logistics under a single portal.

---

## 🚀 Core Systems & Features

1. **GovConnect Civic (Decision Intelligence)**
   - Allows citizens to report local public grievances (Road Damage, Water Leakage, Drainage, etc.).
   - Utilizes AI-assisted priority routing to dynamically assess severity.
   - Intelligent allocation system suggesting the best-suited field employee based on attendance, active workload, rating, and geographic proximity.
   - Comprehensive workflow tracker for employees: Accept/Decline tasks, Start Travel (with geolocation), Update Progress, and Upload Verification Photos.

2. **ASHA Workers Smart Inventory (Smart Health & Medical Logistics)**
   - Helps rural ASHA Workers manage local health post medicine stocks (e.g. OPV, Paracetamol).
   - Low-stock and expiration alerts with automated/manual replenishment requests sent to Mandal Hospitals.
   - Complete Mandal Hospital dispatch tracking, cargo verification, and digital receipt confirmations.
   - National Immunization Schedule Polio Vaccination Dashboard to register children, compute coverage rates, track upcoming doses, and alert on overdue vaccinations.
   - **ASHA AI Assistant:** Voice-enabled chatbot responding to queries about stock availability, basic medicine safety, and government health schemes, with strict language-matching capabilities (translates database records to match query scripts).

3. **Disaster Rescue Module**
   - Command-room coordination and team tracking during active alerts.

---

## 🛠️ Tech Stack
- **Frontend**: HTML, CSS, JavaScript (Vite compiler, CSS glassmorphism layout, Leaflet maps, ChartJS).
- **Backend**: Flask (Python 3) with modular blueprint routing and CORS enabled.
- **Database**: PostgreSQL (Supabase cloud connection) and SQLite.

---

## 📁 Repository Structure
```text
.
├── backend/              # Flask Backend API Blueprints (Port 5000)
│   ├── app.py            # Main API entrypoint
│   └── routes/           # Blueprints for Civic, Rescue, and Medical
├── database/             # Database Schemas & PostgreSQL scripts
├── frontend/             # Frontend assets & views (Vite Port 5173)
│   ├── components/       # Shared navbar and footer components
│   └── pages/            # View layouts for Civic, Rescue, and Medical
├── smart_inventory/      # ASHA Worker Inventory Flask App (Port 8000)
│   ├── app.py            # Main entrypoint for Inventory
│   ├── routes/           # Routing logic for ASHA, Mandal, Chatbot, and Polio
│   ├── templates/        # Jinja2 layouts and dashboards
│   └── static/           # UI scripts and chat styles
├── vite.config.js        # Multi-Page Application (MPA) entrypoint rollup configuration
└── requirements.txt      # Main Python backend dependencies
```

---

## 🏃 Run the Application locally

### 1. Main Portal Frontend
To compile and serve frontend static assets:
```bash
npm install
npm run dev
```
The client dashboard opens at: `http://localhost:5173/index.html` (automatically redirects to `http://localhost:5173/frontend/pages/index.html`).

### 2. Main Portal Backend API
Installs requirements and starts the Flask API backend:
```bash
python -m pip install -r requirements.txt
python backend/app.py
```
The central API server runs at: `http://127.0.0.1:5000/`.

### 3. ASHA Workers Smart Inventory App
Navigate to the `smart_inventory` directory, install specific packages, and start the dedicated inventory Flask app:
```bash
cd smart_inventory
python -m pip install -r requirements.txt
python app.py
```
The Inventory and Polio Dashboard runs at: `http://127.0.0.1:8000/`.

---

## 🔑 Test Credentials

For testing individual roles on the local ports:

### A. Civic Portal (`http://localhost:5173/frontend/pages/civic/index.html`)
* **Employee (Field Officer):**
  * Username: `employ`
  * Password: `employ`
* **Admin (Supervisor):**
  * Username: `admin`
  * Password: `admin`
* **Citizen:**
  * Username: `shiva` (No password required)

### B. Smart Inventory & Polio Portal (`http://127.0.0.1:8000/asha/login`)
* **ASHA Worker:**
  * Worker Name: `Lakshmi Devi`
  * Village: `Rampur`
* **Mandal Hospital Login:**
  * Hospital Name: `Shamshabad Mandal Hospital`
  * Mandal Name: `Shamshabad`

---

## 🔧 Fixes Implemented

1. **Civic Dashboard Scoping Fix:** Expose `updateTaskProgress` globally on `window` in `civic.js` to ensure dynamic HTML button event handlers (`onclick`) correctly resolve the function.
2. **Polio Dashboard Date Render:** Fixed a Jinja2 template crash where `today_date_str` was undefined, and implemented a type coercion filter (`scheduled_date|string`) to prevent comparison errors between database date objects and string values.
3. **Database Schema Mapping:** Changed legacy `is_read` column calls in notifications queries to `read_status` to match active PostgreSQL Supabase column names, and converted SQLite query parameters from `?` to `%s`.
4. **Mandal Queue Management:** Added direct **Review** and **Dispatch 🚚** actions in both the Mandal Hospital Dashboard and Reports page.
5. **ASHA AI Assistant Language Enforcement:** Configured the chatbot to check query script types (English/Latin vs Telugu), outputting responses strictly matching the user's input script, and dynamically translating Telugu database context when answering in English.
