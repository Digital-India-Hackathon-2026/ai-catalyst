# GovConnect – Smart Government Services Portal (Phase 1)

**GovConnect** is a full-stack web application designed to unify civic management, disaster rescue, and emergency medical services under a single intelligent portal.

This project represents **Phase 1** of our hackathon development lifecycle. It establishes a strong full-stack project skeleton, enabling parallel development for our team.

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript (Vanilla, premium glassmorphism dark-theme)
- **Backend**: Flask (Python 3) with blueprint routing and CORS enabled
- **Database**: SQLite (local dev) & Supabase config placeholders (prepared for Phase 2 integration)

## Core Structure
```text
.
├── backend/              # Flask Backend API Blueprints
│   ├── app.py            # Main API entrypoint
│   └── routes/           # Blueprint controllers returning JSON placeholders
├── database/             # Database Schemas & SQLite local database
├── frontend/             # Portal Landing Page & Sub-modules (HTML/CSS/JS)
│   ├── components/       # Shared Web components (Navbar, Footer, Spinner)
│   ├── css/              # UI theme stylesheet
│   └── pages/            # Page layouts for Civic, Rescue, and Medical
├── ai/                   # GovConnect AI Decision Matching Engine
└── requirements.txt      # Python backend dependencies
```

## Running the Application

### 1. Start the Flask Backend
```bash
python -m pip install -r requirements.txt
python backend/app.py
```
The API server will run at `http://127.0.0.1:5000/`.

### 2. View the Portal Page
To serve the frontend assets locally:
```bash
npm run dev
```
And open the portal URL in your web browser:
`http://localhost:5173/frontend/pages/index.html`
