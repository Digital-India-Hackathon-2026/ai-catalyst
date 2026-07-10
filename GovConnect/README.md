# GovConnect – Smart Government Services Portal (Phase 1)

**GovConnect** is a full-stack web application designed to unify civic management, disaster rescue, and emergency medical services under a single intelligent portal.

This directory represents **Phase 1** of our hackathon development lifecycle. It establishes a strong full-stack project skeleton, enabling parallel development for our 4-person team.

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript (Vanilla, premium glassmorphism dark-theme)
- **Backend**: Flask (Python 3) with blueprint routing and CORS enabled
- **Database**: Supabase config placeholders (prepared for Phase 2 integration)

## Core Structure
```
GovConnect/
├── frontend/             # Portal Landing Page & Sub-modules (HTML/CSS/JS)
│   ├── components/       # Shared Web components (Navbar, Footer, Spinner)
│   ├── css/              # UI theme stylesheet
│   └── pages/            # Page layouts for Civic, Rescue, and Medical
├── backend/              # Flask Backend API Blueprints
│   ├── app.py            # Main API entrypoint
│   └── routes/           # Blueprint controllers returning JSON placeholders
└── database/             # Database Schemas & seed configs
```

## Running the Application

### 1. Start the Flask Backend
```bash
python -m pip install -r requirements.txt
python backend/app.py
```
The API server will run at `http://127.0.0.1:5000/`.

### 2. View the Portal Page
Simply open `frontend/pages/index.html` in any web browser. 
The portal page allows navigation to each module. On page load, each module dynamically fetches its setup configurations and status from the local Flask backend blueprint APIs, demonstrating full integration.
