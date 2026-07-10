# GovConnect Contributor Guide

Welcome to the team! This repository is initialized with **Phase 1** of our full-stack Smart Government Services Portal (**GovConnect**).

## Branch Allocations
- **Core Orchestrator**: `feature/core-system` (You)
- **Civic/Mandal Services**: `feature/civic-module` (Teammate 1)
- **Rescue/Disaster Response**: `feature/rescue-module` (Teammate 2)
- **Medical/EMS Dispatch**: `feature/medical-module` (Teammate 3)

## Quick Start (Local Setup)

### 1. Clone & Branch Setup
Clone the repository and check out your dedicated branch:
```bash
git fetch --all
git checkout feature/<your-module-name>
```

### 2. Backend Setup (Flask)
Install python packages from the requirements list and start the server:
```bash
python -m pip install -r GovConnect/requirements.txt
python GovConnect/backend/app.py
```
Verify the backend is live at `http://127.0.0.1:5000/`.

### 3. Frontend Setup
Open `GovConnect/frontend/pages/index.html` in your browser. The frontend contains a live API widget that queries your backend Flask blueprint automatically.

## How to Extend for Phase 2

1. **Backend Integration**: 
   Add your database models under `backend/models/` and custom services under `backend/services/`. Update your routes blueprint under `backend/routes/` to replace the JSON mock response with real data from Supabase.
   
2. **Frontend UI**:
   Update your module's pages under `frontend/pages/<module-name>/index.html` to build the full dashboard. Ensure you inherit styles from `frontend/css/style.css` and use the common components under `frontend/components/` to preserve a unified visual design.
