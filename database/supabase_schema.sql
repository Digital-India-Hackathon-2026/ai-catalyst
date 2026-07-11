-- GovConnect Unified Supabase PostgreSQL Schema

-- Enable UUID extension just in case we need it later
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- CORE SYSTEM TABLES
-- ==========================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Citizen', 'Employee', 'Admin', 'asha', 'mandal')),
    full_name TEXT NOT NULL
);

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    employee_id TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    experience_years INTEGER NOT NULL,
    specialization TEXT NOT NULL,
    attendance_percentage NUMERIC DEFAULT 100.0,
    efficiency_percentage NUMERIC DEFAULT 90.0,
    avg_resolution_time NUMERIC DEFAULT 4.0, -- in hours
    rating NUMERIC DEFAULT 5.0,
    status TEXT DEFAULT 'Available' CHECK(status IN ('Available', 'Busy', 'On Leave')),
    lat NUMERIC NOT NULL,
    lng NUMERIC NOT NULL,
    profile_photo TEXT,
    leave_status TEXT DEFAULT 'Active'
);

-- ==========================================
-- CIVIC MODULE
-- ==========================================

CREATE TABLE complaints (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Road Damage', 'Garbage', 'Water Leakage', 'Drainage', 'Street Light', 'Traffic Signal', 'Illegal Dumping', 'Fallen Tree', 'Stray Animals', 'Others')),
    description TEXT NOT NULL,
    image_path TEXT,
    lat NUMERIC NOT NULL,
    lng NUMERIC NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
    status TEXT DEFAULT 'Submitted' NOT NULL CHECK(status IN ('Submitted', 'AI Categorized', 'Pending Admin Review', 'Assigned Employee', 'Employee Accepted', 'Travelling', 'Reached Location', 'Working', 'Resolved', 'Verified', 'Closed')),
    citizen_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_completion TIMESTAMP WITH TIME ZONE,
    before_image TEXT,
    progress_image TEXT,
    completion_image TEXT,
    rejection_reason TEXT,
    citizen_rating INTEGER,
    citizen_feedback TEXT
);

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER REFERENCES complaints(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    actor TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==========================================
-- RESCUE MODULE
-- ==========================================

CREATE TABLE rescue_emergencies (
    id SERIAL PRIMARY KEY,
    emergency_id TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    image_path TEXT,
    lat NUMERIC,
    lng NUMERIC,
    landmark TEXT,
    incident_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('Low', 'Medium', 'High', 'Critical')),
    recommended_team TEXT NOT NULL,
    response_time_minutes INTEGER NOT NULL,
    confidence_score INTEGER NOT NULL,
    status TEXT DEFAULT 'Complaint Received' NOT NULL CHECK(status IN (
        'Complaint Received', 'Complaint Submitted', 'AI Analysis Completed',
        'AI Analysis Complete', 'Team Assigned', 'Mission Accepted',
        'Start Journey', 'Team Dispatched', 'Reached Location', 'Team Arrived',
        'Rescue in Progress', 'Rescue Completed', 'Mission Completed', 'Case Closed',
        'Pending Supervisor Approval', 'Auto Dispatched', 'Pending Review'
    )),
    supervisor_note TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    recommended_departments TEXT,
    nearest_rescue_team TEXT,
    ai_decision_summary TEXT,
    possible_risks TEXT,
    suggested_actions TEXT,
    ai_analysis_json TEXT,
    team_lat NUMERIC,
    team_lng NUMERIC
);

CREATE TABLE rescue_audit_logs (
    id SERIAL PRIMARY KEY,
    emergency_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==========================================
-- NOTIFICATIONS (Unified)
-- ==========================================
-- Supporting both user_id based routing (Civic) and role/village based routing (Medical)

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Civic modules
    user_role TEXT, -- 'asha' or 'mandal'
    village TEXT,   -- Specific to Medical module
    message TEXT NOT NULL,
    type TEXT, -- 'info', 'warning', 'emergency', 'sla_violation'
    read_status INTEGER DEFAULT 0, -- 0: unread, 1: read
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==========================================
-- MEDICAL / SMART INVENTORY MODULE
-- ==========================================

CREATE TABLE asha_workers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    village TEXT UNIQUE NOT NULL
);

CREATE TABLE mandal_hospitals (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    mandal TEXT UNIQUE NOT NULL
);

CREATE TABLE medicines (
    id SERIAL PRIMARY KEY,
    medicine_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    mfg_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    minimum_stock INTEGER NOT NULL,
    village TEXT NOT NULL REFERENCES asha_workers(village) ON DELETE CASCADE
);

CREATE TABLE distributions (
    id SERIAL PRIMARY KEY,
    beneficiary_name TEXT NOT NULL,
    medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    village TEXT NOT NULL,
    distributed_date DATE NOT NULL,
    remarks TEXT
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- Added, Distributed, Updated, Deleted
    quantity INTEGER NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE medicine_requests (
    id SERIAL PRIMARY KEY,
    asha_worker TEXT NOT NULL,
    village TEXT NOT NULL,
    medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    current_stock INTEGER NOT NULL,
    requested_quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL, -- Pending, Approved, Rejected, Dispatched, Delivered
    rejection_reason TEXT,
    request_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE dispatches (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES medicine_requests(id) ON DELETE CASCADE,
    quantity_sent INTEGER NOT NULL,
    dispatch_date DATE NOT NULL,
    delivery_notes TEXT
);

CREATE TABLE polio_children (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    dob DATE NOT NULL,
    gender TEXT NOT NULL,
    parent_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    village TEXT NOT NULL,
    address TEXT,
    aadhaar TEXT
);

CREATE TABLE polio_vaccinations (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES polio_children(id) ON DELETE CASCADE,
    dose_number INTEGER NOT NULL,
    scheduled_date DATE NOT NULL,
    status TEXT NOT NULL, -- Pending, Completed, Overdue
    administered_date DATE
);
