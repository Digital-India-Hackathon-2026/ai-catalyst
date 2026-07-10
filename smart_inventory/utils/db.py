import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. ASHA Workers Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS asha_workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        village TEXT UNIQUE NOT NULL
    );
    """)
    
    # 2. Mandal Hospitals Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mandal_hospitals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mandal TEXT UNIQUE NOT NULL
    );
    """)
    
    # 3. Medicines Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_name TEXT NOT NULL,
        category TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT NOT NULL,
        batch_number TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        mfg_date TEXT NOT NULL, -- Format: YYYY-MM-DD
        expiry_date TEXT NOT NULL, -- Format: YYYY-MM-DD
        minimum_stock INTEGER NOT NULL,
        village TEXT NOT NULL,
        FOREIGN KEY(village) REFERENCES asha_workers(village) ON DELETE CASCADE
    );
    """)
    
    # 4. Distributions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS distributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        beneficiary_name TEXT NOT NULL,
        medicine_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        village TEXT NOT NULL,
        distributed_date TEXT NOT NULL,
        remarks TEXT,
        FOREIGN KEY(medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    );
    """)
    
    # 5. Transactions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER NOT NULL,
        action TEXT NOT NULL, -- Added, Distributed, Updated, Deleted
        quantity INTEGER NOT NULL,
        remarks TEXT,
        created_at TEXT NOT NULL
    );
    """)
    
    # 6. Medicine Requests Table (Phase 2)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medicine_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asha_worker TEXT NOT NULL,
        village TEXT NOT NULL,
        medicine_id INTEGER NOT NULL,
        current_stock INTEGER NOT NULL,
        requested_quantity INTEGER NOT NULL,
        reason TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL, -- Pending, Approved, Rejected, Dispatched, Delivered
        rejection_reason TEXT,
        request_date TEXT NOT NULL,
        FOREIGN KEY(medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    );
    """)

    # 7. Dispatches Table (Phase 2)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dispatches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        quantity_sent INTEGER NOT NULL,
        dispatch_date TEXT NOT NULL,
        delivery_notes TEXT,
        FOREIGN KEY(request_id) REFERENCES medicine_requests(id) ON DELETE CASCADE
    );
    """)

    # Polio Module Tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS polio_children (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        dob TEXT NOT NULL,
        gender TEXT NOT NULL,
        parent_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        village TEXT NOT NULL,
        address TEXT,
        aadhaar TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS polio_vaccinations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        child_id INTEGER NOT NULL,
        dose_number INTEGER NOT NULL,
        scheduled_date TEXT NOT NULL,
        status TEXT NOT NULL, -- Pending, Completed, Overdue
        administered_date TEXT,
        FOREIGN KEY(child_id) REFERENCES polio_children(id) ON DELETE CASCADE
    );
    """)

    # 8. Notifications Table (Phase 2)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_role TEXT NOT NULL, -- asha, mandal
        village TEXT,            -- NULL for mandal
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    );
    """)
    
    conn.commit()
    
    # Seed data if tables are empty
    seed_mock_data(conn)
    conn.close()

def seed_mock_data(conn):
    cursor = conn.cursor()
    
    # Check if we already seeded
    cursor.execute("SELECT COUNT(*) FROM asha_workers;")
    if cursor.fetchone()[0] > 0:
        return
        
    print("Seeding ASHA Workers Smart Inventory database with mock data...")
    
    # Seed ASHA Workers
    workers = [
        ("Lakshmi Devi", "Rampur"),
        ("Anitha Kurma", "Sompur"),
        ("Kavitha Reddy", "Chandanpur")
    ]
    cursor.executemany("INSERT INTO asha_workers (name, village) VALUES (?, ?);", workers)
    
    # Seed Mandal Hospitals
    hospitals = [
        ("Shamshabad Mandal Hospital", "Shamshabad")
    ]
    cursor.executemany("INSERT INTO mandal_hospitals (name, mandal) VALUES (?, ?);", hospitals)
    
    # Today's reference date: July 10, 2026
    today = datetime(2026, 7, 10)
    
    # Expiry and Mfg dates setup
    mfg_date_recent = (today - timedelta(days=90)).strftime("%Y-%m-%d")
    mfg_date_old = (today - timedelta(days=365)).strftime("%Y-%m-%d")
    
    expired_date_1 = (today - timedelta(days=56)).strftime("%Y-%m-%d")    # 2026-05-15 (Expired)
    expired_date_2 = (today - timedelta(days=39)).strftime("%Y-%m-%d")    # 2026-06-01 (Expired)
    expiring_soon_1 = (today + timedelta(days=10)).strftime("%Y-%m-%d")   # 2026-07-20 (Expiring in 10 days)
    expiring_soon_2 = (today + timedelta(days=25)).strftime("%Y-%m-%d")   # 2026-08-04 (Expiring in 25 days)
    available_1 = (today + timedelta(days=174)).strftime("%Y-%m-%d")      # Dec 2026
    available_2 = (today + timedelta(days=189)).strftime("%Y-%m-%d")      # Jan 2027
    
    # Seed Medicines (Categories: Tablets, Syrups, Vaccines, Nutrition, Pregnancy, Child Care, Emergency, First Aid)
    medicines = [
        # Rampur (Lakshmi Devi)
        ("Paracetamol 500mg", "First Aid", 120, "Tablets", "PARA123", "Cipla Ltd", mfg_date_recent, available_1, 50, "Rampur"),
        ("Amoxicillin 250mg", "Tablets", 15, "Tablets", "AMOX456", "Abbott India", mfg_date_old, available_1, 30, "Rampur"), # Low Stock
        ("Iron & Folic Acid", "Pregnancy", 80, "Tablets", "IFA789", "Sun Pharma", mfg_date_old, expiring_soon_1, 40, "Rampur"), # Expiring soon
        ("ORS Sachet", "Child Care", 200, "Sachets", "ORS012", "Reddy's Lab", mfg_date_old, expired_date_1, 25, "Rampur"), # Expired
        ("Cough Syrup", "Syrups", 8, "Bottles", "COUGH99", "Dabur", mfg_date_old, expiring_soon_2, 10, "Rampur"), # Low Stock + Expiring soon
        ("Vitamin A", "Nutrition", 0, "Bottles", "VITA01", "Sun Pharma", mfg_date_recent, available_2, 15, "Rampur"), # Out of stock
        
        # Sompur (Anitha Kurma)
        ("Paracetamol 500mg", "First Aid", 60, "Tablets", "PARA124", "Cipla Ltd", mfg_date_recent, available_2, 50, "Sompur"),
        ("Iron & Folic Acid", "Pregnancy", 30, "Tablets", "IFA790", "Sun Pharma", mfg_date_old, available_1, 40, "Sompur"), # Low Stock
        
        # Chandanpur (Kavitha Reddy)
        ("ORS Sachet", "Child Care", 10, "Sachets", "ORS013", "Reddy's Lab", mfg_date_old, expired_date_2, 30, "Chandanpur") # Low Stock + Expired
    ]
    
    for med in medicines:
        cursor.execute("""
        INSERT INTO medicines (
            medicine_name, category, quantity, unit, batch_number, manufacturer, mfg_date, expiry_date, minimum_stock, village
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, med)
        med_id = cursor.lastrowid
        
        # Log inventory addition transaction
        cursor.execute("""
        INSERT INTO transactions (medicine_id, action, quantity, remarks, created_at)
        VALUES (?, 'Added', ?, 'Initial stock seeding during DB initialization.', ?);
        """, (med_id, med[2], today.strftime("%Y-%m-%d %H:%M:%S")))

    # Seed historical distributions to calculate "Average Daily Usage"
    cursor.execute("SELECT id FROM medicines WHERE medicine_name='Paracetamol 500mg' AND village='Rampur';")
    para_id = cursor.fetchone()[0]
    cursor.execute("SELECT id FROM medicines WHERE medicine_name='Amoxicillin 250mg' AND village='Rampur';")
    amox_id_ramp = cursor.fetchone()[0]
    cursor.execute("SELECT id FROM medicines WHERE medicine_name='Iron & Folic Acid' AND village='Rampur';")
    ifa_id = cursor.fetchone()[0]
    
    distributions = [
        # (medicine_id, quantity, days_ago)
        (para_id, 10, 0), (para_id, 15, 2), (para_id, 5, 5), (para_id, 20, 10), (para_id, 10, 15),
        (amox_id_ramp, 20, 3), (amox_id_ramp, 30, 8), (amox_id_ramp, 15, 12),
        (ifa_id, 30, 1), (ifa_id, 40, 15), (ifa_id, 20, 25)
    ]
    
    for med_id, qty, days_ago in distributions:
        dist_date = (today - timedelta(days=days_ago))
        cursor.execute("""
        INSERT INTO distributions (beneficiary_name, medicine_id, quantity, village, distributed_date, remarks)
        VALUES ('Beneficiary', ?, ?, 'Rampur', ?, 'Mock historical distribution.');
        """, (med_id, qty, dist_date.strftime("%Y-%m-%d")))
        
        # We don't deduct quantity here because the seed quantity is intended to be the *current* quantity.
        cursor.execute("""
        INSERT INTO transactions (medicine_id, action, quantity, remarks, created_at)
        VALUES (?, 'Distributed', ?, 'Historical distribution log.', ?);
        """, (med_id, qty, dist_date.strftime("%Y-%m-%d %H:%M:%S")))

    # Seed Phase 2 Mock Data (Requests, Dispatches, Notifications)
    # Get medicine IDs for seeding requests
    cursor.execute("SELECT id, quantity FROM medicines WHERE medicine_name='Amoxicillin 250mg' AND village='Rampur';")
    amox_row = cursor.fetchone()
    amox_id, amox_qty = amox_row['id'], amox_row['quantity']
    
    cursor.execute("SELECT id, quantity FROM medicines WHERE medicine_name='Cough Syrup' AND village='Rampur';")
    cough_row = cursor.fetchone()
    cough_id, cough_qty = cough_row['id'], cough_row['quantity']
    
    cursor.execute("SELECT id, quantity FROM medicines WHERE medicine_name='ORS Sachet' AND village='Chandanpur';")
    ors_row = cursor.fetchone()
    ors_id, ors_qty = ors_row['id'], ors_row['quantity']
    
    cursor.execute("SELECT id, quantity FROM medicines WHERE medicine_name='Iron & Folic Acid' AND village='Sompur';")
    iron_row = cursor.fetchone()
    iron_id, iron_qty = iron_row['id'], iron_row['quantity']

    # 1. Pending Request (Lakshmi Devi, Rampur, Amoxicillin 250mg)
    cursor.execute("""
        INSERT INTO medicine_requests (asha_worker, village, medicine_id, current_stock, requested_quantity, reason, priority, status, request_date)
        VALUES ('Lakshmi Devi', 'Rampur', ?, ?, 100, 'Low stock, high demand due to local viral flu cases.', 'High', 'Pending', ?);
    """, (amox_id, amox_qty, today.strftime("%Y-%m-%d")))
    req_pending_id = cursor.lastrowid
    
    # 2. Approved Request (Lakshmi Devi, Rampur, Cough Syrup)
    cursor.execute("""
        INSERT INTO medicine_requests (asha_worker, village, medicine_id, current_stock, requested_quantity, reason, priority, status, request_date)
        VALUES ('Lakshmi Devi', 'Rampur', ?, ?, 30, 'Cough syrup inventory running below threshold safety limit.', 'Medium', 'Approved', ?);
    """, (cough_id, cough_qty, (today - timedelta(days=2)).strftime("%Y-%m-%d")))
    
    # 3. Dispatched Request (Kavitha Reddy, Chandanpur, ORS Sachet)
    cursor.execute("""
        INSERT INTO medicine_requests (asha_worker, village, medicine_id, current_stock, requested_quantity, reason, priority, status, request_date)
        VALUES ('Kavitha Reddy', 'Chandanpur', ?, ?, 150, 'Replenish expired stock for summer dehydration prep.', 'Emergency', 'Dispatched', ?);
    """, (ors_id, ors_qty, (today - timedelta(days=3)).strftime("%Y-%m-%d")))
    req_dispatch_id = cursor.lastrowid
    
    cursor.execute("""
        INSERT INTO dispatches (request_id, quantity_sent, dispatch_date, delivery_notes)
        VALUES (?, 150, ?, 'Dispatched in emergency vehicle AP-09-V-1234. Expected delivery by evening.');
    """, (req_dispatch_id, (today - timedelta(days=1)).strftime("%Y-%m-%d")))

    # 4. Delivered Request (Anitha Kurma, Sompur, Iron & Folic Acid)
    cursor.execute("""
        INSERT INTO medicine_requests (asha_worker, village, medicine_id, current_stock, requested_quantity, reason, priority, status, request_date)
        VALUES ('Anitha Kurma', 'Sompur', ?, ?, 50, 'Monthly supply for pregnant mothers nutrition program.', 'Medium', 'Delivered', ?);
    """, (iron_id, iron_qty, (today - timedelta(days=5)).strftime("%Y-%m-%d")))
    req_delivered_id = cursor.lastrowid
    
    cursor.execute("""
        INSERT INTO dispatches (request_id, quantity_sent, dispatch_date, delivery_notes)
        VALUES (?, 50, ?, 'Delivered successfully via routine distribution van.');
    """, (req_delivered_id, (today - timedelta(days=4)).strftime("%Y-%m-%d")))

    # Seed Notifications
    notifs = [
        # ASHA notifications (Rampur/Chandanpur/Sompur)
        ('asha', 'Rampur', "Your request for Cough Syrup has been APPROVED by Mandal Hospital.", 0, (today - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")),
        ('asha', 'Chandanpur', "Medicines for request 'ORS Sachet' have been DISPATCHED (Vehicle: AP-09-V-1234).", 0, today.strftime("%Y-%m-%d %H:%M:%S")),
        ('asha', 'Sompur', "Your request for Iron & Folic Acid has been DELIVERED.", 1, (today - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")),
        
        # Mandal notifications
        ('mandal', None, "New medicine request submitted by Kavitha Reddy (Chandanpur) for ORS Sachet.", 1, (today - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")),
        ('mandal', None, "New medicine request submitted by Lakshmi Devi (Rampur) for Amoxicillin 250mg.", 0, today.strftime("%Y-%m-%d %H:%M:%S")),
        ('mandal', None, "Delivery confirmed by Anitha Kurma (Sompur) for Iron & Folic Acid.", 1, (today - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"))
    ]
    cursor.executemany("INSERT INTO notifications (user_role, village, message, is_read, created_at) VALUES (?, ?, ?, ?, ?);", notifs)

    conn.commit()
    print("Database seeding completed.")
