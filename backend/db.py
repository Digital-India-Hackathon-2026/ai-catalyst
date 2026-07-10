import sqlite3
import os
from datetime import datetime, timedelta

# Define database file path in the database/ folder of GovConnect
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database')
DB_PATH = os.path.join(DB_DIR, 'govconnect.db')

def get_db_connection():
    """Establishes connection to the SQLite database with row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema and seeds initial data."""
    if not os.path.exists(DB_DIR):
        os.makedirs(DB_DIR)

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # 1. Users Table (Citizen, Employee, Admin credentials)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('Citizen', 'Employee', 'Admin')) NOT NULL,
        full_name TEXT NOT NULL
    );
    """)
    
    # 2. Employees Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        employee_id TEXT UNIQUE NOT NULL,
        department TEXT NOT NULL,
        designation TEXT NOT NULL,
        experience_years INTEGER NOT NULL,
        specialization TEXT NOT NULL,
        attendance_percentage REAL DEFAULT 100.0,
        efficiency_percentage REAL DEFAULT 90.0,
        avg_resolution_time REAL DEFAULT 4.0, -- in hours
        rating REAL DEFAULT 5.0,
        status TEXT DEFAULT 'Available' CHECK(status IN ('Available', 'Busy', 'On Leave')),
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        profile_photo TEXT,
        leave_status TEXT DEFAULT 'Active'
    );
    """)
    
    # 3. Complaints Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT CHECK(category IN ('Road Damage', 'Garbage', 'Water Leakage', 'Drainage', 'Street Light', 'Traffic Signal', 'Illegal Dumping', 'Fallen Tree', 'Stray Animals', 'Others')) NOT NULL,
        description TEXT NOT NULL,
        image_path TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        priority TEXT CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')) NOT NULL,
        status TEXT DEFAULT 'Submitted' CHECK(status IN ('Submitted', 'AI Categorized', 'Pending Admin Review', 'Assigned Employee', 'Employee Accepted', 'Travelling', 'Reached Location', 'Working', 'Resolved', 'Verified', 'Closed')) NOT NULL,
        citizen_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        deadline TEXT NOT NULL,
        expected_completion TEXT,
        before_image TEXT,
        progress_image TEXT,
        completion_image TEXT,
        rejection_reason TEXT,
        citizen_rating INTEGER,
        citizen_feedback TEXT
    );
    """)
    
    # 4. Notifications Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        type TEXT NOT NULL, -- 'info', 'warning', 'emergency', 'sla_violation'
        read_status INTEGER DEFAULT 0, -- 0: unread, 1: read
        created_at TEXT NOT NULL
    );
    """)
    
    # 5. Audit Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER REFERENCES complaints(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT,
        actor TEXT NOT NULL,
        timestamp TEXT NOT NULL
    );
    """)
    
    # Seed default data if users table is empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        # Create Admin
        cursor.execute("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)",
                       ('admin', 'admin123', 'Admin', 'Shiva Nallela Patel (Commissioner)'))
        
        # Create Employee accounts
        employees_data = [
            {
                'username': 'emp_ravi', 'password': 'password123', 'role': 'Employee', 'full_name': 'Ravi Kumar',
                'employee_id': 'EMP001', 'department': 'Civic', 'designation': 'Assistant Engineer (Roads)',
                'experience_years': 6, 'specialization': 'Road Damage & Potholes',
                'attendance_percentage': 96.5, 'efficiency_percentage': 95.0, 'avg_resolution_time': 2.5,
                'rating': 4.8, 'status': 'Available', 'lat': 17.3850, 'lng': 78.4867,
                'profile_photo': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&fit=crop&q=80'
            },
            {
                'username': 'emp_ananya', 'password': 'password123', 'role': 'Employee', 'full_name': 'Ananya Sharma',
                'employee_id': 'EMP002', 'department': 'Civic', 'designation': 'Sanitation Inspector',
                'experience_years': 4, 'specialization': 'Garbage & Dumping Management',
                'attendance_percentage': 98.0, 'efficiency_percentage': 92.0, 'avg_resolution_time': 3.8,
                'rating': 4.6, 'status': 'Available', 'lat': 17.3980, 'lng': 78.4720,
                'profile_photo': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&fit=crop&q=80'
            },
            {
                'username': 'emp_ali', 'password': 'password123', 'role': 'Employee', 'full_name': 'Mohammed Ali',
                'employee_id': 'EMP003', 'department': 'Civic', 'designation': 'Water Works Engineer',
                'experience_years': 8, 'specialization': 'Water Leakage & Drainage',
                'attendance_percentage': 94.0, 'efficiency_percentage': 88.0, 'avg_resolution_time': 5.0,
                'rating': 4.2, 'status': 'Available', 'lat': 17.3610, 'lng': 78.4530,
                'profile_photo': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&fit=crop&q=80'
            },
            {
                'username': 'emp_srinivas', 'password': 'password123', 'role': 'Employee', 'full_name': 'B. Srinivas',
                'employee_id': 'EMP004', 'department': 'Civic', 'designation': 'Electrical Inspector',
                'experience_years': 5, 'specialization': 'Street Light & Traffic Signals',
                'attendance_percentage': 95.0, 'efficiency_percentage': 91.0, 'avg_resolution_time': 3.0,
                'rating': 4.5, 'status': 'Available', 'lat': 17.4120, 'lng': 78.5020,
                'profile_photo': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&fit=crop&q=80'
            }
        ]
        
        for emp in employees_data:
            cursor.execute("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)",
                           (emp['username'], emp['password'], emp['role'], emp['full_name']))
            user_id = cursor.lastrowid
            cursor.execute("""
            INSERT INTO employees (user_id, employee_id, department, designation, experience_years, specialization,
                                   attendance_percentage, efficiency_percentage, avg_resolution_time, rating, status, lat, lng, profile_photo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, emp['employee_id'], emp['department'], emp['designation'], emp['experience_years'], emp['specialization'],
                  emp['attendance_percentage'], emp['efficiency_percentage'], emp['avg_resolution_time'], emp['rating'], emp['status'],
                  emp['lat'], emp['lng'], emp['profile_photo']))
            
        # Create default Citizen account
        cursor.execute("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)",
                       ('citizen', 'citizen123', 'Citizen', 'Shiva Patel (Citizen)'))
        citizen_id = cursor.lastrowid
        
        # Seed some default complaints (Resolved, In Progress, Submitted)
        now = datetime.now()
        yesterday = now - timedelta(days=1)
        two_days_ago = now - timedelta(days=2)
        
        # 1. Resolved Complaint
        cursor.execute("""
        INSERT INTO complaints (title, category, description, lat, lng, priority, status, citizen_id, assigned_employee_id, created_at, deadline, expected_completion, citizen_rating, citizen_feedback)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            'Pothole on Dilshuknagar Main Road', 'Road Damage', 'A large pothole is causing accidents and slow traffic at the market entrance.',
            17.3685, 78.5248, 'High', 'Resolved', citizen_id, 1, two_days_ago.isoformat(), (two_days_ago + timedelta(hours=24)).isoformat(),
            (two_days_ago + timedelta(hours=3)).isoformat(), 5, 'Quick resolution, thank you!'
        ))
        complaint_1_id = cursor.lastrowid
        
        # 2. In Progress Complaint
        cursor.execute("""
        INSERT INTO complaints (title, category, description, lat, lng, priority, status, citizen_id, assigned_employee_id, created_at, deadline, expected_completion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            'Sewer overflow near Osmania Hospital', 'Drainage', 'Foul smell and open drain overflow onto pedestrians near hospital.',
            17.3660, 78.4740, 'Critical', 'Working', citizen_id, 3, yesterday.isoformat(), (yesterday + timedelta(hours=12)).isoformat(),
            (yesterday + timedelta(hours=6)).isoformat()
        ))
        complaint_2_id = cursor.lastrowid
        
        # 3. Newly Submitted Complaint
        cursor.execute("""
        INSERT INTO complaints (title, category, description, lat, lng, priority, status, citizen_id, created_at, deadline)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            'Streetlight not working in Bowenpally', 'Street Light', 'Three consecutive streetlights are broken, causing unsafe dark areas at night.',
            17.4720, 78.4780, 'Medium', 'Submitted', citizen_id, now.isoformat(), (now + timedelta(hours=48)).isoformat()
        ))
        complaint_3_id = cursor.lastrowid
        
        # Seed default audit logs
        cursor.execute("""
        INSERT INTO audit_logs (complaint_id, event_type, action, reason, actor, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            complaint_1_id, 'MANUAL_CONFIRM', 'Admin assigned task to Ravi Kumar', 'Closest engineer with high efficiency on Road Damage.', 'Shiva Nallela Patel', two_days_ago.isoformat()
        ))
        
        cursor.execute("""
        INSERT INTO audit_logs (complaint_id, event_type, action, reason, actor, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            complaint_2_id, 'AUTO_ASSIGN', 'System auto-assigned task to Mohammed Ali', 'Highest specialized match for Drainage.', 'System (Auto)', yesterday.isoformat()
        ))

        # Seed default notifications for the users
        cursor.execute("INSERT INTO notifications (user_id, message, type, created_at) VALUES (?, ?, ?, ?)",
                       (citizen_id, 'Your complaint for "Pothole on Dilshuknagar Main Road" has been Resolved!', 'info', yesterday.isoformat()))
        cursor.execute("INSERT INTO notifications (user_id, message, type, created_at) VALUES (?, ?, ?, ?)",
                       (citizen_id, 'New task "Sewer overflow near Osmania Hospital" has been auto-assigned to Mohammed Ali.', 'info', yesterday.isoformat()))
        cursor.execute("INSERT INTO notifications (user_id, message, type, created_at) VALUES (?, ?, ?, ?)",
                       (3, 'New emergency assignment received: Sewer overflow near Osmania Hospital.', 'emergency', yesterday.isoformat()))

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully.")
