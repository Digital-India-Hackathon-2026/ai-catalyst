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
    total_villages = list(cursor.fetchone().values())[0]
    
    # 2. Total Medicines (Sum of all quantities across the system)
    cursor.execute("SELECT SUM(quantity) FROM medicines;")
    total_medicines = list(cursor.fetchone().values())[0] or 0
    
    # 3. Low Stock Cases (Total items across system < minimum_stock)
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE quantity < minimum_stock AND expiry_date > %s;", (today,))
    low_stock_cases = list(cursor.fetchone().values())[0]
    
    # 4. Expired Medicines (Total expired across system)
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE expiry_date <= %s;", (today,))
    expired_medicines = list(cursor.fetchone().values())[0]

    # Phase 2 metrics
    # 5. Total Requests
    cursor.execute("SELECT COUNT(*) FROM medicine_requests;")
    total_requests = list(cursor.fetchone().values())[0]

    # 6. Pending Requests
    cursor.execute("SELECT COUNT(*) FROM medicine_requests WHERE status = 'Pending';")
    pending_requests = list(cursor.fetchone().values())[0]

    # 7. Approved Requests
    cursor.execute("SELECT COUNT(*) FROM medicine_requests WHERE status = 'Approved';")
    approved_requests = list(cursor.fetchone().values())[0]

    # 8. Delivered Requests
    cursor.execute("SELECT COUNT(*) FROM medicine_requests WHERE status = 'Delivered';")
    delivered_requests = list(cursor.fetchone().values())[0]
    
    # 9. Recent Requests
    cursor.execute("""
        SELECT r.*, m.medicine_name, m.unit, m.batch_number 
        FROM medicine_requests r
        JOIN medicines m ON r.medicine_id = m.id
        ORDER BY r.id DESC LIMIT 5;
    """)
    recent_requests = cursor.fetchall()

    # 10. Emergency Requests (Pending or Approved or Dispatched, Priority = Emergency or High)
    cursor.execute("""
        SELECT r.*, m.medicine_name, m.unit, m.batch_number
        FROM medicine_requests r
        JOIN medicines m ON r.medicine_id = m.id
        WHERE r.priority IN ('Emergency', 'High') AND r.status != 'Delivered'
        ORDER BY r.id DESC;
    """)
    emergency_requests = cursor.fetchall()

    # 11. Chart Data 1: Requests by Village
    cursor.execute("SELECT village, COUNT(*) as count FROM medicine_requests GROUP BY village;")
    village_rows = cursor.fetchall()
    requests_by_village = {row['village']: row['count'] for row in village_rows}

    # 12. Chart Data 2: Monthly Request Trends
    cursor.execute("SELECT to_char(request_date, 'YYYY-MM') as month, COUNT(*) as count FROM medicine_requests GROUP BY month ORDER BY month ASC;")
    month_rows = cursor.fetchall()
    monthly_trends = {row['month']: row['count'] for row in month_rows}

    village_labels = list(requests_by_village.keys())
    village_values = list(requests_by_village.values())
    trend_labels = list(monthly_trends.keys())
    trend_values = list(monthly_trends.values())
    
    # Build village-wise inventory list
    cursor.execute("SELECT name, village FROM asha_workers ORDER BY village ASC;")
    workers = cursor.fetchall()
    
    village_reports = []
    for worker in workers:
        v_name = worker['village']
        w_name = worker['name']
        
        cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = %s;", (v_name,))
        v_meds = list(cursor.fetchone().values())[0]
        
        cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = %s AND quantity < minimum_stock AND expiry_date > %s;", (v_name, today))
        v_low = list(cursor.fetchone().values())[0]
        
        cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = %s AND expiry_date <= %s;", (v_name, today))
        v_expired = list(cursor.fetchone().values())[0]
        
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
                           total_requests=total_requests,
                           pending_requests=pending_requests,
                           approved_requests=approved_requests,
                           delivered_requests=delivered_requests,
                           recent_requests=recent_requests,
                           emergency_requests=emergency_requests,
                           village_labels=village_labels,
                           village_values=village_values,
                           trend_labels=trend_labels,
                           trend_values=trend_values,
                           village_reports=village_reports)

@mandal_bp.route('/village/<village_name>')
@mandal_required
def village_inventory(village_name):
    search_query = request.args.get('search', '').strip()
    category_filter = request.args.get('category', '').strip()
    
    today = datetime.now().date()
    expiring_soon_date = today + timedelta(days=30)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if village is valid (exists in asha_workers)
    cursor.execute("SELECT name FROM asha_workers WHERE village = %s;", (village_name,))
    worker = cursor.fetchone()
    
    if not worker:
        conn.close()
        flash(f"Village '{village_name}' not found.", "error")
        return redirect(url_for('mandal.mandal_dashboard'))
        
    asha_name = worker['name']
    
    # Get distinct categories for filtering
    cursor.execute("SELECT DISTINCT category FROM medicines WHERE village = %s;", (village_name,))
    categories = [row['category'] for row in cursor.fetchall()]
    
    # Build query
    query = "SELECT * FROM medicines WHERE village = %s"
    params = [village_name]
    
    if search_query:
        query += " AND medicine_name LIKE %s"
        params.append(f"%{search_query}%")
        
    if category_filter:
        query += " AND category = %s"
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

@mandal_bp.route('/mandal/request/view/<int:req_id>')
@mandal_required
def request_view(req_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT r.*, m.medicine_name, m.unit, m.batch_number, m.expiry_date
        FROM medicine_requests r
        JOIN medicines m ON r.medicine_id = m.id
        WHERE r.id = %s;
    """, (req_id,))
    req = cursor.fetchone()
    
    if not req:
        conn.close()
        flash("Request not found.", "error")
        return redirect(url_for('mandal.mandal_dashboard'))
        
    cursor.execute("SELECT * FROM dispatches WHERE request_id = %s;", (req_id,))
    dispatch = cursor.fetchone()
    conn.close()
    
    return render_template('request_view.html', request=req, dispatch=dispatch)

@mandal_bp.route('/request/approve/<int:req_id>', methods=['POST'])
@mandal_required
def request_approve(req_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT r.*, m.medicine_name FROM medicine_requests r JOIN medicines m ON r.medicine_id = m.id WHERE r.id = %s AND r.status = 'Pending';", (req_id,))
    req = cursor.fetchone()
    
    if not req:
        conn.close()
        flash("Request not found or not pending.", "error")
        return redirect(url_for('mandal.mandal_dashboard'))
        
    cursor.execute("UPDATE medicine_requests SET status = 'Approved' WHERE id = %s;", (req_id,))
    
    # Notify ASHA worker
    msg = f"Your request for '{req['medicine_name']}' has been APPROVED by Mandal Hospital."
    cursor.execute("""
        INSERT INTO notifications (user_role, village, message, read_status, created_at)
        VALUES ('asha', %s, %s, 0, %s);
    """, (req['village'], msg, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    
    conn.commit()
    conn.close()
    
    flash("Request approved successfully.", "success")
    return redirect(url_for('mandal.request_view', req_id=req_id))

@mandal_bp.route('/request/reject/<int:req_id>', methods=['POST'])
@mandal_required
def request_reject(req_id):
    reason = request.form.get('rejection_reason', '').strip()
    if not reason:
        flash("Rejection reason is required.", "error")
        return redirect(url_for('mandal.request_view', req_id=req_id))
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT r.*, m.medicine_name FROM medicine_requests r JOIN medicines m ON r.medicine_id = m.id WHERE r.id = %s AND r.status = 'Pending';", (req_id,))
    req = cursor.fetchone()
    
    if not req:
        conn.close()
        flash("Request not found or not pending.", "error")
        return redirect(url_for('mandal.mandal_dashboard'))
        
    cursor.execute("UPDATE medicine_requests SET status = 'Rejected', rejection_reason = %s WHERE id = %s;", (reason, req_id))
    
    # Notify ASHA worker
    msg = f"Your request for '{req['medicine_name']}' was REJECTED. Reason: {reason}."
    cursor.execute("""
        INSERT INTO notifications (user_role, village, message, read_status, created_at)
        VALUES ('asha', %s, %s, 0, %s);
    """, (req['village'], msg, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    
    conn.commit()
    conn.close()
    
    flash("Request rejected successfully.", "success")
    return redirect(url_for('mandal.request_view', req_id=req_id))

@mandal_bp.route('/dispatch/new/<int:req_id>', methods=['GET', 'POST'])
@mandal_required
def dispatch_new(req_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT r.*, m.medicine_name, m.unit, m.batch_number 
        FROM medicine_requests r 
        JOIN medicines m ON r.medicine_id = m.id 
        WHERE r.id = %s AND r.status = 'Approved';
    """, (req_id,))
    req = cursor.fetchone()
    
    if not req:
        conn.close()
        flash("Request not found or is not approved.", "error")
        return redirect(url_for('mandal.mandal_dashboard'))
        
    if request.method == 'POST':
        qty_sent = request.form.get('quantity_sent', '').strip()
        vehicle_num = request.form.get('vehicle_number', '').strip()
        notes = request.form.get('delivery_notes', '').strip()
        dispatch_date = request.form.get('dispatch_date', '').strip()
        
        if not qty_sent or not dispatch_date:
            flash("Quantity Sent and Dispatch Date are required.", "error")
            conn.close()
            return render_template('dispatch_form.html', request=req, form_data=request.form)
            
        try:
            sent_val = int(qty_sent)
            if sent_val <= 0:
                raise ValueError()
        except ValueError:
            flash("Quantity Sent must be a positive integer.", "error")
            conn.close()
            return render_template('dispatch_form.html', request=req, form_data=request.form)
            
        # 1. Update request status to 'Dispatched'
        cursor.execute("UPDATE medicine_requests SET status = 'Dispatched' WHERE id = %s;", (req_id,))
        
        # 2. Insert dispatch record
        cursor.execute("""
            INSERT INTO dispatches (request_id, quantity_sent, dispatch_date, delivery_notes)
            VALUES (%s, %s, %s, %s);
        """, (req_id, sent_val, dispatch_date, f"{notes} (Vehicle: {vehicle_num})" if vehicle_num else notes))
        
        # 3. Notify ASHA worker
        vehicle_msg = f" (Vehicle: {vehicle_num})" if vehicle_num else ""
        msg = f"Medicines for request '{req['medicine_name']}' have been DISPATCHED{vehicle_msg}."
        cursor.execute("""
            INSERT INTO notifications (user_role, village, message, read_status, created_at)
            VALUES ('asha', %s, %s, 0, %s);
        """, (req['village'], msg, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        
        conn.commit()
        conn.close()
        
        flash("Medicines dispatched successfully.", "success")
        return redirect(url_for('mandal.request_view', req_id=req_id))
        
    conn.close()
    default_date = datetime.now().strftime("%Y-%m-%d")
    return render_template('dispatch_form.html', request=req, default_date=default_date)

@mandal_bp.route('/mandal/notifications')
@mandal_required
def notifications():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch notifications
    cursor.execute("SELECT * FROM notifications WHERE user_role = 'mandal' ORDER BY created_at DESC;")
    notif_list = cursor.fetchall()
    
    # Mark as read
    cursor.execute("UPDATE notifications SET read_status = 1 WHERE user_role = 'mandal';")
    conn.commit()
    conn.close()
    
    return render_template('notifications.html', notifications=notif_list)

@mandal_bp.route('/reports')
@mandal_required
def reports():
    village_filter = request.args.get('village', '').strip()
    status_filter = request.args.get('status', '').strip()
    priority_filter = request.args.get('priority', '').strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch distinct villages for dropdown filter
    cursor.execute("SELECT DISTINCT village FROM asha_workers;")
    villages = [row['village'] for row in cursor.fetchall()]
    
    # Query requests
    query = """
        SELECT r.*, m.medicine_name, m.unit, m.batch_number
        FROM medicine_requests r
        JOIN medicines m ON r.medicine_id = m.id
        WHERE 1=1
    """
    params = []
    
    if village_filter:
        query += " AND r.village = %s"
        params.append(village_filter)
    if status_filter:
        query += " AND r.status = %s"
        params.append(status_filter)
    if priority_filter:
        query += " AND r.priority = %s"
        params.append(priority_filter)
        
    cursor.execute(query + " ORDER BY r.request_date DESC, r.id DESC;", params)
    reports_list = cursor.fetchall()
    conn.close()
    
    return render_template('reports.html', 
                           reports=reports_list, 
                           villages=villages, 
                           selected_village=village_filter, 
                           selected_status=status_filter, 
                           selected_priority=priority_filter)
