# AI Catalyst – Smart Governance Repositories

This repository contains the hackathon development code for Team **AI CATALYST**. It includes two primary sub-projects:

1. **GovConnect** (located in [`/GovConnect`](file:///c:/HACAKTHONS/SNIST/code%20files/ai-catalyst/GovConnect)): The Phase 1 full-stack portal foundation. It hosts the shared stylesheet, reusable components, modular frontend page layouts, and the Flask backend blueprint APIs.
2. **AssignIQ Engine** (located in the root `/core` and `/modules` folders): The core Decision Support Engine, featuring the multi-criteria officer scoring model, Explainable AI confidence generation, and the real-time simulation dashboard.

---

## Directory Navigation

- [GovConnect Portal Directory](file:///c:/HACAKTHONS/SNIST/code%20files/ai-catalyst/GovConnect)
  - [Frontend Landing Page](file:///c:/HACAKTHONS/SNIST/code%20files/ai-catalyst/GovConnect/frontend/pages/index.html)
  - [Flask app.py Entrypoint](file:///c:/HACAKTHONS/SNIST/code%20files/ai-catalyst/GovConnect/backend/app.py)
  - [Supabase Schema Draft](file:///c:/HACAKTHONS/SNIST/code%20files/ai-catalyst/GovConnect/database/schema.sql)
- [AssignIQ Decision Intelligence Simulator](file:///c:/HACAKTHONS/SNIST/code%20files/ai-catalyst/index.html)
  - [AI Matching Rules](file:///c:/HACAKTHONS/SNIST/code%20files/ai-catalyst/core/engine/recommender.js)
  - [Explainability Logic](file:///c:/HACAKTHONS/SNIST/code%20files/ai-catalyst/core/engine/explanations.js)
  - [Orchestration Flow](file:///c:/HACAKTHONS/SNIST/code%20files/ai-catalyst/core/engine/orchestrator.js)

---

## Running Project Stacks

### 1. GovConnect Portal (Flask API + HTML Pages)
```bash
python -m pip install -r GovConnect/requirements.txt
python GovConnect/backend/app.py
```
*Open `GovConnect/frontend/pages/index.html` in browser to view.*

### 2. AssignIQ Simulator (Vite Server)
```bash
npm install
npm run dev
```
*Open the Vite URL (typically `http://localhost:5173/`) in browser to view.*
