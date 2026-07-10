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
    
    # Expiry dates setup
    expired_date_1 = (today - timedelta(days=56)).strftime("%Y-%m-%d")    # 2026-05-15 (Expired)
    expired_date_2 = (today - timedelta(days=39)).strftime("%Y-%m-%d")    # 2026-06-01 (Expired)
    expiring_soon_1 = (today + timedelta(days=10)).strftime("%Y-%m-%d")   # 2026-07-20 (Expiring in 10 days)
    expiring_soon_2 = (today + timedelta(days=25)).strftime("%Y-%m-%d")   # 2026-08-04 (Expiring in 25 days)
    available_1 = (today + timedelta(days=174)).strftime("%Y-%m-%d")      # Dec 2026
    available_2 = (today + timedelta(days=189)).strftime("%Y-%m-%d")      # Jan 2027
    
    # Seed Medicines
    medicines = [
        # Rampur (Lakshmi Devi)
        ("Paracetamol 500mg", "Analgesics", 120, "Tablets", "PARA123", "Cipla Ltd", available_1, 50, "Rampur"),
        ("Amoxicillin 250mg", "Antibiotics", 15, "Tablets", "AMOX456", "Abbott India", available_1, 30, "Rampur"), # Low Stock
        ("Iron & Folic Acid", "Supplements", 80, "Tablets", "IFA789", "Sun Pharma", expiring_soon_1, 40, "Rampur"), # Expiring soon
        ("ORS Sachet", "Rehydration", 200, "Sachets", "ORS012", "Reddy's Lab", expired_date_1, 25, "Rampur"), # Expired
        ("Cough Syrup", "Antitussive", 8, "Bottles", "COUGH99", "Dabur", expiring_soon_2, 10, "Rampur"), # Low Stock + Expiring soon
        
        # Sompur (Anitha Kurma)
        ("Paracetamol 500mg", "Analgesics", 60, "Tablets", "PARA124", "Cipla Ltd", available_2, 50, "Sompur"),
        ("Iron & Folic Acid", "Supplements", 30, "Tablets", "IFA790", "Sun Pharma", available_1, 40, "Sompur"), # Low Stock
        
        # Chandanpur (Kavitha Reddy)
        ("ORS Sachet", "Rehydration", 10, "Sachets", "ORS013", "Reddy's Lab", expired_date_2, 30, "Chandanpur") # Low Stock + Expired
    ]
    
    for med in medicines:
        cursor.execute("""
        INSERT INTO medicines (
            medicine_name, category, quantity, unit, batch_number, manufacturer, expiry_date, minimum_stock, village
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, med)
        med_id = cursor.lastrowid
        
        # Log inventory addition transaction
        cursor.execute("""
        INSERT INTO transactions (medicine_id, action, quantity, remarks, created_at)
        VALUES (?, 'Added', ?, 'Initial stock seeding during DB initialization.', ?);
        """, (med_id, med[2], today.strftime("%Y-%m-%d %H:%M:%S")))

    # Seed some sample distributions to make dashboard metrics display "Distributed Today"
    # Lakshmi Devi distributed 10 Paracetamol tablets to a beneficiary in Rampur today
    cursor.execute("SELECT id FROM medicines WHERE medicine_name='Paracetamol 500mg' AND village='Rampur';")
    para_id = cursor.fetchone()[0]
    
    # Perform distribution
    cursor.execute("""
    INSERT INTO distributions (beneficiary_name, medicine_id, quantity, village, distributed_date, remarks)
    VALUES ('Saraswathi Amma', ?, 10, 'Rampur', ?, 'Distributed for headache/fever.');
    """, (para_id, today.strftime("%Y-%m-%d")))
    
    # Update quantity of paracetamol in Rampur
    cursor.execute("UPDATE medicines SET quantity = quantity - 10 WHERE id = ?;", (para_id,))
    
    # Log transaction
    cursor.execute("""
    INSERT INTO transactions (medicine_id, action, quantity, remarks, created_at)
    VALUES (?, 'Distributed', 10, 'Distributed 10 tablets to Saraswathi Amma in Rampur.', ?);
    """, (para_id, today.strftime("%Y-%m-%d %H:%M:%S")))

    conn.commit()
    print("Database seeding completed.")
