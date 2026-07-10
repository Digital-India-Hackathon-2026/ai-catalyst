-- Supabase Schema Draft - GovConnect (Phase 2 Prep)

-- 1. Profiles (Officers, Dispatchers)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT CHECK (department IN ('Civic', 'Rescue', 'Medical')) NOT NULL,
    role TEXT NOT NULL,
    rating NUMERIC(3, 2) DEFAULT 5.0,
    active_tasks INT DEFAULT 0,
    location_lat NUMERIC(9, 6),
    location_lng NUMERIC(9, 6),
    status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Busy', 'Offline'))
);

-- 2. Incidents & Requests
CREATE TABLE public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')) NOT NULL,
    status TEXT DEFAULT 'Pending Assignment' CHECK (status IN ('Pending Assignment', 'In Progress', 'Completed')) NOT NULL,
    department TEXT NOT NULL,
    sla_minutes INT NOT NULL,
    assigned_officer UUID REFERENCES public.profiles(id),
    location_lat NUMERIC(9, 6) NOT NULL,
    location_lng NUMERIC(9, 6) NOT NULL
);

-- 3. Operations Audit Trail
CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    event_type TEXT CHECK (event_type IN ('RECOMMENDATION_GENERATED', 'AUTO_ASSIGN', 'MANUAL_CONFIRM', 'SUPERVISOR_OVERRIDE', 'TASK_RESOLVED')) NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    actor TEXT NOT NULL
);
