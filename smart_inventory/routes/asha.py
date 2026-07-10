from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from utils.db import get_db_connection
from datetime import datetime, timedelta
import functools

asha_bp = Blueprint('asha', __name__)

def asha_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if 'role' not in session or session['role'] != 'asha':
            flash("Please login as an ASHA worker to access this page.", "error")
            return redirect(url_for('auth.index'))
        return view(**kwargs)
    return wrapped_view

@asha_bp.route('/asha/dashboard')
@asha_required
def asha_dashboard():
    village = session['village']
    today = datetime.now().strftime("%Y-%m-%d")
    expiring_soon_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Total Medicines
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = ?;", (village,))
    total_medicines = cursor.fetchone()[0]
    
    # 2. Available Stock
    cursor.execute("SELECT SUM(quantity) FROM medicines WHERE village = ?;", (village,))
    available_stock = cursor.fetchone()[0] or 0
    
    # 3. Low Stock Medicines
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = ? AND quantity < minimum_stock AND expiry_date > ?;", (village, today))
    low_stock_count = cursor.fetchone()[0]
    
    # 4. Expired Medicines
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = ? AND expiry_date <= ?;", (village, today))
    expired_count = cursor.fetchone()[0]
    
    # 5. Medicines Expiring Soon
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = ? AND expiry_date > ? AND expiry_date <= ?;", (village, today, expiring_soon_date))
    expiring_soon_count = cursor.fetchone()[0]
    
    # 6. Medicines Distributed Today
    cursor.execute("SELECT SUM(quantity) FROM distributions WHERE village = ? AND distributed_date = ?;", (village, today))
    distributed_today = cursor.fetchone()[0] or 0

    # Phase 2 metrics
    # 7. Pending Requests
    cursor.execute("SELECT COUNT(*) FROM medicine_requests WHERE village = ? AND status = 'Pending';", (village,))
    pending_requests_count = cursor.fetchone()[0]
    
    # 8. Approved Requests
    cursor.execute("SELECT COUNT(*) FROM medicine_requests WHERE village = ? AND status = 'Approved';", (village,))
    approved_requests_count = cursor.fetchone()[0]
    
    # 9. Delivered Requests
    cursor.execute("SELECT COUNT(*) FROM medicine_requests WHERE village = ? AND status = 'Delivered';", (village,))
    delivered_requests_count = cursor.fetchone()[0]
    
    # Chart Data 1: Requests by Priority
    cursor.execute("SELECT priority, COUNT(*) as count FROM medicine_requests WHERE village = ? GROUP BY priority;", (village,))
    priority_rows = cursor.fetchall()
    priority_data = {row['priority']: row['count'] for row in priority_rows}
    
    # Chart Data 2: Requests by Status
    cursor.execute("SELECT status, COUNT(*) as count FROM medicine_requests WHERE village = ? GROUP BY status;", (village,))
    status_rows = cursor.fetchall()
    status_data = {row['status']: row['count'] for row in status_rows}
    
    # Fetch alerts
    cursor.execute("""
        SELECT id, medicine_name, quantity, minimum_stock, expiry_date 
        FROM medicines 
        WHERE village = ? AND (quantity < minimum_stock OR expiry_date <= ? OR (expiry_date > ? AND expiry_date <= ?));
    """, (village, today, today, expiring_soon_date))
    alerts_raw = cursor.fetchall()
    
    alerts = []
    for item in alerts_raw:
        med_id = item['id']
        name = item['medicine_name']
        qty = item['quantity']
        min_stock = item['minimum_stock']
        exp_date = item['expiry_date']
        
        if exp_date <= today:
            alerts.append({
                'type': 'danger',
                'message': f"CRITICAL: '{name}' (Batch: {med_id}) has EXPIRED on {exp_date}!"
            })
        elif exp_date <= expiring_soon_date:
            alerts.append({
                'type': 'warning',
                'message': f"WARNING: '{name}' is expiring soon on {exp_date}."
            })
        if qty < min_stock:
            alerts.append({
                'type': 'warning',
                'message': f"LOW STOCK: '{name}' quantity ({qty}) is below minimum level ({min_stock})."
            })
    priority_labels = list(priority_data.keys())
    priority_values = list(priority_data.values())
    status_labels = list(status_data.keys())
    status_values = list(status_data.values())

    conn.close()
    
    return render_template('asha_dashboard.html',
                           total_medicines=total_medicines,
                           available_stock=available_stock,
                           low_stock_count=low_stock_count,
                           expired_count=expired_count,
                           expiring_soon_count=expiring_soon_count,
                           distributed_today=distributed_today,
                           pending_requests_count=pending_requests_count,
                           approved_requests_count=approved_requests_count,
                           delivered_requests_count=delivered_requests_count,
                           priority_labels=priority_labels,
                           priority_values=priority_values,
                           status_labels=status_labels,
                           status_values=status_values,
                           alerts=alerts)

@asha_bp.route('/inventory')
@asha_required
def inventory():
    village = session['village']
    search_query = request.args.get('search', '').strip()
    category_filter = request.args.get('category', '').strip()
    
    today = datetime.now().strftime("%Y-%m-%d")
    expiring_soon_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get distinct categories for filtering
    cursor.execute("SELECT DISTINCT category FROM medicines WHERE village = ?;", (village,))
    categories = [row['category'] for row in cursor.fetchall()]
    
    # Build query
    query = "SELECT * FROM medicines WHERE village = ?"
    params = [village]
    
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
            'id': row['id'],
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
    
    return render_template('inventory.html', 
                           medicines=medicines, 
                           categories=categories, 
                           search=search_query, 
                           selected_category=category_filter)

@asha_bp.route('/medicine/add', methods=['GET', 'POST'])
@asha_required
def add_medicine():
    if request.method == 'POST':
        name = request.form.get('medicine_name', '').strip()
        category = request.form.get('category', '').strip()
        quantity_str = request.form.get('quantity', '').strip()
        unit = request.form.get('unit', '').strip()
        batch_number = request.form.get('batch_number', '').strip()
        manufacturer = request.form.get('manufacturer', '').strip()
        expiry_date = request.form.get('expiry_date', '').strip()
        minimum_stock_str = request.form.get('minimum_stock', '').strip()
        village = session['village']
        
        # Validations
        if not (name and category and quantity_str and unit and batch_number and manufacturer and expiry_date and minimum_stock_str):
            flash("All fields are required.", "error")
            return render_template('medicine_form.html', action='Add', form_data=request.form)
            
        try:
            quantity = int(quantity_str)
            minimum_stock = int(minimum_stock_str)
            if quantity < 0 or minimum_stock < 0:
                raise ValueError()
        except ValueError:
            flash("Quantity and Minimum Stock must be positive integers.", "error")
            return render_template('medicine_form.html', action='Add', form_data=request.form)
            
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Save to database
        cursor.execute("""
            INSERT INTO medicines (
                medicine_name, category, quantity, unit, batch_number, manufacturer, expiry_date, minimum_stock, village
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (name, category, quantity, unit, batch_number, manufacturer, expiry_date, minimum_stock, village))
        
        med_id = cursor.lastrowid
        
        # Save transaction log
        cursor.execute("""
            INSERT INTO transactions (medicine_id, action, quantity, remarks, created_at)
            VALUES (?, 'Added', ?, ?, ?);
        """, (med_id, quantity, "New medicine stocked in inventory.", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        
        conn.commit()
        conn.close()
        
        flash(f"Medicine '{name}' successfully added to inventory.", "success")
        return redirect(url_for('asha.inventory'))
        
    return render_template('medicine_form.html', action='Add')

@asha_bp.route('/medicine/edit/<int:id>', methods=['GET', 'POST'])
@asha_required
def edit_medicine(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check ownership
    cursor.execute("SELECT * FROM medicines WHERE id = ? AND village = ?;", (id, session['village']))
    medicine = cursor.fetchone()
    
    if not medicine:
        conn.close()
        flash("Medicine not found or access denied.", "error")
        return redirect(url_for('asha.inventory'))
        
    if request.method == 'POST':
        name = request.form.get('medicine_name', '').strip()
        category = request.form.get('category', '').strip()
        quantity_str = request.form.get('quantity', '').strip()
        unit = request.form.get('unit', '').strip()
        batch_number = request.form.get('batch_number', '').strip()
        manufacturer = request.form.get('manufacturer', '').strip()
        expiry_date = request.form.get('expiry_date', '').strip()
        minimum_stock_str = request.form.get('minimum_stock', '').strip()
        
        if not (name and category and quantity_str and unit and batch_number and manufacturer and expiry_date and minimum_stock_str):
            conn.close()
            flash("All fields are required.", "error")
            return render_template('medicine_form.html', action='Edit', form_data=request.form, medicine_id=id)
            
        try:
            quantity = int(quantity_str)
            minimum_stock = int(minimum_stock_str)
            if quantity < 0 or minimum_stock < 0:
                raise ValueError()
        except ValueError:
            conn.close()
            flash("Quantity and Minimum Stock must be positive integers.", "error")
            return render_template('medicine_form.html', action='Edit', form_data=request.form, medicine_id=id)
            
        # Update SQLite table
        cursor.execute("""
            UPDATE medicines 
            SET medicine_name = ?, category = ?, quantity = ?, unit = ?, batch_number = ?, 
                manufacturer = ?, expiry_date = ?, minimum_stock = ?
            WHERE id = ?;
        """, (name, category, quantity, unit, batch_number, manufacturer, expiry_date, minimum_stock, id))
        
        # Log Transaction
        cursor.execute("""
            INSERT INTO transactions (medicine_id, action, quantity, remarks, created_at)
            VALUES (?, 'Updated', ?, ?, ?);
        """, (id, quantity, "Medicine parameters modified by worker.", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        
        conn.commit()
        conn.close()
        
        flash(f"Medicine details updated successfully.", "success")
        return redirect(url_for('asha.inventory'))
        
    conn.close()
    return render_template('medicine_form.html', action='Edit', form_data=medicine, medicine_id=id)

@asha_bp.route('/medicine/delete/<int:id>', methods=['POST'])
@asha_required
def delete_medicine(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check ownership
    cursor.execute("SELECT * FROM medicines WHERE id = ? AND village = ?;", (id, session['village']))
    medicine = cursor.fetchone()
    
    if not medicine:
        conn.close()
        flash("Medicine not found or access denied.", "error")
        return redirect(url_for('asha.inventory'))
        
    # Delete from DB
    cursor.execute("DELETE FROM medicines WHERE id = ?;", (id,))
    
    # Log Transaction
    cursor.execute("""
        INSERT INTO transactions (medicine_id, action, quantity, remarks, created_at)
        VALUES (?, 'Deleted', ?, ?, ?);
    """, (id, medicine['quantity'], f"Medicine '{medicine['medicine_name']}' removed from database.", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    
    conn.commit()
    conn.close()
    
    flash(f"Medicine '{medicine['medicine_name']}' deleted from database.", "success")
    return redirect(url_for('asha.inventory'))

@asha_bp.route('/distribution', methods=['GET', 'POST'])
@asha_required
def distribution():
    village = session['village']
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch medicines in this village to populate dropdown
    cursor.execute("SELECT id, medicine_name, quantity, unit FROM medicines WHERE village = ? AND quantity > 0 AND expiry_date > ?;", (village, datetime.now().strftime("%Y-%m-%d")))
    medicines = cursor.fetchall()
    
    if request.method == 'POST':
        beneficiary_name = request.form.get('beneficiary_name', '').strip()
        med_id_str = request.form.get('medicine_id', '').strip()
        qty_str = request.form.get('quantity', '').strip()
        dist_date = request.form.get('distribution_date', '').strip()
        remarks = request.form.get('remarks', '').strip()
        
        if not (beneficiary_name and med_id_str and qty_str and dist_date):
            flash("All required fields must be completed.", "error")
            return render_template('distribution.html', medicines=medicines, form_data=request.form)
            
        try:
            med_id = int(med_id_str)
            qty = int(qty_str)
            if qty <= 0:
                raise ValueError()
        except ValueError:
            flash("Quantity must be a positive integer greater than zero.", "error")
            return render_template('distribution.html', medicines=medicines, form_data=request.form)
            
        # Verify medicine details and ownership
        cursor.execute("SELECT * FROM medicines WHERE id = ? AND village = ?;", (med_id, village))
        medicine = cursor.fetchone()
        
        if not medicine:
            flash("Selected medicine is not valid for your village.", "error")
            return render_template('distribution.html', medicines=medicines, form_data=request.form)
            
        if medicine['quantity'] < qty:
            flash(f"Insufficient stock. Available stock for '{medicine['medicine_name']}' is only {medicine['quantity']} {medicine['unit']}.", "error")
            return render_template('distribution.html', medicines=medicines, form_data=request.form)
            
        # 1. Save distribution record
        cursor.execute("""
            INSERT INTO distributions (beneficiary_name, medicine_id, quantity, village, distributed_date, remarks)
            VALUES (?, ?, ?, ?, ?, ?);
        """, (beneficiary_name, med_id, qty, village, dist_date, remarks))
        
        # 2. Reduce medicine stock
        cursor.execute("UPDATE medicines SET quantity = quantity - ? WHERE id = ?;", (qty, med_id))
        
        # 3. Log transaction
        cursor.execute("""
            INSERT INTO transactions (medicine_id, action, quantity, remarks, created_at)
            VALUES (?, 'Distributed', ?, ?, ?);
        """, (med_id, qty, f"Distributed to beneficiary: {beneficiary_name} in {village}.", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        
        conn.commit()
        conn.close()
        
        flash(f"Successfully distributed {qty} {medicine['unit']} of '{medicine['medicine_name']}' to {beneficiary_name}.", "success")
        return redirect(url_for('asha.asha_dashboard'))
        
    conn.close()
    # Provide default today's date for ease of entry
    default_date = datetime.now().strftime("%Y-%m-%d")
    return render_template('distribution.html', medicines=medicines, default_date=default_date)

@asha_bp.route('/transactions')
@asha_required
def transactions():
    village = session['village']
    search_query = request.args.get('search', '').strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Query logs associated with medicines of this village
    query = """
        SELECT t.*, m.medicine_name, m.unit, m.batch_number 
        FROM transactions t
        LEFT JOIN medicines m ON t.medicine_id = m.id
        WHERE m.village = ?
    """
    params = [village]
    
    if search_query:
        query += " AND (m.medicine_name LIKE ? OR t.action LIKE ? OR t.remarks LIKE ?)"
        params.extend([f"%{search_query}%", f"%{search_query}%", f"%{search_query}%"])
        
    cursor.execute(query + " ORDER BY t.created_at DESC;", params)
    tx_list = cursor.fetchall()
    conn.close()
    
    return render_template('transactions.html', transactions=tx_list, search=search_query)

@asha_bp.route('/request/new', methods=['GET', 'POST'])
@asha_required
def request_new():
    village = session['village']
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        medicine_id = request.form.get('medicine_id', '').strip()
        requested_qty = request.form.get('requested_quantity', '').strip()
        reason = request.form.get('reason', '').strip()
        priority = request.form.get('priority', '').strip()
        
        if not medicine_id or not requested_qty or not reason or not priority:
            flash("All fields are required.", "error")
            cursor.execute("SELECT id, medicine_name, quantity, unit FROM medicines WHERE village = ?;", (village,))
            medicines = cursor.fetchall()
            conn.close()
            return render_template('request_form.html', medicines=medicines, form_data=request.form)
            
        try:
            qty = int(requested_qty)
            if qty <= 0:
                raise ValueError()
        except ValueError:
            flash("Requested quantity must be a positive integer.", "error")
            cursor.execute("SELECT id, medicine_name, quantity, unit FROM medicines WHERE village = ?;", (village,))
            medicines = cursor.fetchall()
            conn.close()
            return render_template('request_form.html', medicines=medicines, form_data=request.form)
            
        # Get current stock
        cursor.execute("SELECT quantity, medicine_name FROM medicines WHERE id = ? AND village = ?;", (medicine_id, village))
        med = cursor.fetchone()
        if not med:
            flash("Selected medicine not found in your inventory.", "error")
            cursor.execute("SELECT id, medicine_name, quantity, unit FROM medicines WHERE village = ?;", (village,))
            medicines = cursor.fetchall()
            conn.close()
            return render_template('request_form.html', medicines=medicines, form_data=request.form)
            
        current_stock = med['quantity']
        med_name = med['medicine_name']
        
        # Save request
        today_date = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("""
            INSERT INTO medicine_requests (asha_worker, village, medicine_id, current_stock, requested_quantity, reason, priority, status, request_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?);
        """, (session['name'], village, medicine_id, current_stock, qty, reason, priority, today_date))
        
        # Add notification for Mandal Hospital
        cursor.execute("""
            INSERT INTO notifications (user_role, village, message, is_read, created_at)
            VALUES ('mandal', NULL, ?, 0, ?);
        """, (f"New medicine request submitted by {session['name']} ({village}) for {med_name}.", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        
        conn.commit()
        conn.close()
        
        flash("Replenishment request submitted successfully.", "success")
        return redirect(url_for('asha.request_history'))
        
    # GET: Pre-populate medicine list
    pre_selected_id = request.args.get('medicine_id', '')
    cursor.execute("SELECT id, medicine_name, quantity, unit FROM medicines WHERE village = ?;", (village,))
    medicines = cursor.fetchall()
    conn.close()
    
    return render_template('request_form.html', medicines=medicines, pre_selected_id=pre_selected_id)

@asha_bp.route('/request/history')
@asha_required
def request_history():
    village = session['village']
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT r.*, m.medicine_name, m.unit, m.batch_number
        FROM medicine_requests r
        JOIN medicines m ON r.medicine_id = m.id
        WHERE r.village = ?
        ORDER BY r.request_date DESC, r.id DESC;
    """, (village,))
    requests_list = cursor.fetchall()
    conn.close()
    
    return render_template('request_history.html', requests=requests_list)

@asha_bp.route('/request/view/<int:req_id>')
@asha_required
def request_view(req_id):
    village = session['village']
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify request belongs to village
    cursor.execute("""
        SELECT r.*, m.medicine_name, m.unit, m.batch_number, m.expiry_date
        FROM medicine_requests r
        JOIN medicines m ON r.medicine_id = m.id
        WHERE r.id = ? AND r.village = ?;
    """, (req_id, village))
    req = cursor.fetchone()
    
    if not req:
        conn.close()
        flash("Request not found.", "error")
        return redirect(url_for('asha.request_history'))
        
    # Get dispatch details if applicable
    cursor.execute("SELECT * FROM dispatches WHERE request_id = ?;", (req_id,))
    dispatch = cursor.fetchone()
    conn.close()
    
    return render_template('request_view.html', request=req, dispatch=dispatch)

@asha_bp.route('/delivery/confirm/<int:req_id>', methods=['POST'])
@asha_required
def delivery_confirm(req_id):
    village = session['village']
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify request
    cursor.execute("""
        SELECT r.*, m.medicine_name, m.unit 
        FROM medicine_requests r
        JOIN medicines m ON r.medicine_id = m.id
        WHERE r.id = ? AND r.village = ? AND r.status = 'Dispatched';
    """, (req_id, village))
    req = cursor.fetchone()
    
    if not req:
        conn.close()
        flash("Invalid request or request is not in Dispatched state.", "error")
        return redirect(url_for('asha.request_history'))
        
    # Get dispatched quantity
    cursor.execute("SELECT quantity_sent FROM dispatches WHERE request_id = ?;", (req_id,))
    disp = cursor.fetchone()
    if not disp:
        conn.close()
        flash("Dispatch details not found for this request.", "error")
        return redirect(url_for('asha.request_history'))
        
    qty_sent = disp['quantity_sent']
    med_id = req['medicine_id']
    med_name = req['medicine_name']
    
    # 1. Update request status to 'Delivered'
    cursor.execute("UPDATE medicine_requests SET status = 'Delivered' WHERE id = ?;", (req_id,))
    
    # 2. Increase stock of the medicine
    cursor.execute("UPDATE medicines SET quantity = quantity + ? WHERE id = ?;", (qty_sent, med_id))
    
    # 3. Log transaction
    cursor.execute("""
        INSERT INTO transactions (medicine_id, action, quantity, remarks, created_at)
        VALUES (?, 'Added', ?, ?, ?);
    """, (med_id, qty_sent, f"Stock replenished via request ID {req_id}.", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    
    # 4. Insert notifications
    cursor.execute("""
        INSERT INTO notifications (user_role, village, message, is_read, created_at)
        VALUES ('asha', ?, ?, 0, ?);
    """, (village, f"Your request for '{med_name}' has been DELIVERED.", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    
    cursor.execute("""
        INSERT INTO notifications (user_role, village, message, is_read, created_at)
        VALUES ('mandal', NULL, ?, 0, ?);
    """, (f"Delivery confirmed by {session['name']} ({village}) for {med_name}.", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    
    conn.commit()
    conn.close()
    
    flash(f"Delivery confirmed. Stock for '{med_name}' increased by {qty_sent}.", "success")
    return redirect(url_for('asha.request_view', req_id=req_id))

@asha_bp.route('/notifications')
@asha_required
def notifications():
    village = session['village']
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch notifications
    cursor.execute("""
        SELECT * FROM notifications 
        WHERE user_role = 'asha' AND village = ?
        ORDER BY created_at DESC;
    """, (village,))
    notif_list = cursor.fetchall()
    
    # Mark as read
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE user_role = 'asha' AND village = ?;", (village,))
    conn.commit()
    conn.close()
    
    return render_template('notifications.html', notifications=notif_list)
