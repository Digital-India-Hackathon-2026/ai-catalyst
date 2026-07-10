from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from utils.db import get_db_connection
from datetime import datetime, timedelta
import functools

mandal_bp = Blueprint('mandal', __name__)

def mandal_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if 'role' not in session or session['role'] != 'mandal':
            flash("Please login as a Mandal Hospital to access this page.", "error")
            return redirect(url_for('auth.index'))
        return view(**kwargs)
    return wrapped_view

@mandal_bp.route('/mandal/dashboard')
@mandal_required
def mandal_dashboard():
    today = datetime.now().strftime("%Y-%m-%d")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Total Villages (Count from ASHA workers)
    cursor.execute("SELECT COUNT(DISTINCT village) FROM asha_workers;")
    total_villages = cursor.fetchone()[0]
    
    # 2. Total Medicines (Sum of all quantities across the system)
    cursor.execute("SELECT SUM(quantity) FROM medicines;")
    total_medicines = cursor.fetchone()[0] or 0
    
    # 3. Low Stock Cases (Total items across system < minimum_stock)
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE quantity < minimum_stock AND expiry_date > ?;", (today,))
    low_stock_cases = cursor.fetchone()[0]
    
    # 4. Expired Medicines (Total expired across system)
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE expiry_date <= ?;", (today,))
    expired_medicines = cursor.fetchone()[0]
    
    # Build village-wise inventory list
    cursor.execute("SELECT name, village FROM asha_workers ORDER BY village ASC;")
    workers = cursor.fetchall()
    
    village_reports = []
    for worker in workers:
        v_name = worker['village']
        w_name = worker['name']
        
        # Total medicines count for this village
        cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = ?;", (v_name,))
        v_meds = cursor.fetchone()[0]
        
        # Low stock count for this village
        cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = ? AND quantity < minimum_stock AND expiry_date > ?;", (v_name, today))
        v_low = cursor.fetchone()[0]
        
        # Expired count for this village
        cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = ? AND expiry_date <= ?;", (v_name, today))
        v_expired = cursor.fetchone()[0]
        
        village_reports.append({
            'village': v_name,
            'asha_worker': w_name,
            'total_medicines': v_meds,
            'low_stock_items': v_low,
            'expired_items': v_expired
        })
        
    conn.close()
    
    return render_template('mandal_dashboard.html',
                           total_villages=total_villages,
                           total_medicines=total_medicines,
                           low_stock_cases=low_stock_cases,
                           expired_medicines=expired_medicines,
                           village_reports=village_reports)

@mandal_bp.route('/village/<village_name>')
@mandal_required
def village_inventory(village_name):
    search_query = request.args.get('search', '').strip()
    category_filter = request.args.get('category', '').strip()
    
    today = datetime.now().strftime("%Y-%m-%d")
    expiring_soon_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if village is valid (exists in asha_workers)
    cursor.execute("SELECT name FROM asha_workers WHERE village = ?;", (village_name,))
    worker = cursor.fetchone()
    
    if not worker:
        conn.close()
        flash(f"Village '{village_name}' not found.", "error")
        return redirect(url_for('mandal.mandal_dashboard'))
        
    asha_name = worker['name']
    
    # Get distinct categories for filtering
    cursor.execute("SELECT DISTINCT category FROM medicines WHERE village = ?;", (village_name,))
    categories = [row['category'] for row in cursor.fetchall()]
    
    # Build query
    query = "SELECT * FROM medicines WHERE village = ?"
    params = [village_name]
    
    if search_query:
        query += " AND medicine_name LIKE ?"
        params.append(f"%{search_query}%")
        
    if category_filter:
        query += " AND category = ?"
        params.append(category_filter)
        
    cursor.execute(query + " ORDER BY medicine_name ASC;", params)
    medicines_raw = cursor.fetchall()
    
    medicines = []
    for row in medicines_raw:
        qty = row['quantity']
        min_stock = row['minimum_stock']
        exp_date = row['expiry_date']
        
        # Status calculation logic
        if exp_date <= today:
            status = 'Expired'
        elif exp_date <= expiring_soon_date:
            status = 'Expiring Soon'
        elif qty < min_stock:
            status = 'Low Stock'
        else:
            status = 'Available'
            
        medicines.append({
            'name': row['medicine_name'],
            'category': row['category'],
            'quantity': qty,
            'unit': row['unit'],
            'batch_number': row['batch_number'],
            'manufacturer': row['manufacturer'],
            'expiry_date': exp_date,
            'minimum_stock': min_stock,
            'status': status
        })
        
    conn.close()
    
    return render_template('village_inventory.html',
                           village_name=village_name,
                           asha_worker=asha_name,
                           medicines=medicines,
                           categories=categories,
                           search=search_query,
                           selected_category=category_filter)
