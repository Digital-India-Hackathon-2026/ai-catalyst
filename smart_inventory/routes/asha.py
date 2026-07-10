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
    
    # 1. Total Medicines (count of unique products in village)
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = ?;", (village,))
    total_medicines = cursor.fetchone()[0]
    
    # 2. Available Stock (sum of quantities across all medicines in village)
    cursor.execute("SELECT SUM(quantity) FROM medicines WHERE village = ?;", (village,))
    available_stock = cursor.fetchone()[0] or 0
    
    # 3. Low Stock Medicines (quantity < minimum_stock)
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = ? AND quantity < minimum_stock AND expiry_date > ?;", (village, today))
    low_stock_count = cursor.fetchone()[0]
    
    # 4. Expired Medicines (expiry_date <= today)
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = ? AND expiry_date <= ?;", (village, today))
    expired_count = cursor.fetchone()[0]
    
    # 5. Medicines Expiring Soon (expiry_date > today and <= today + 30 days)
    cursor.execute("SELECT COUNT(*) FROM medicines WHERE village = ? AND expiry_date > ? AND expiry_date <= ?;", (village, today, expiring_soon_date))
    expiring_soon_count = cursor.fetchone()[0]
    
    # 6. Medicines Distributed Today (sum of distributed quantity today)
    cursor.execute("SELECT SUM(quantity) FROM distributions WHERE village = ? AND distributed_date = ?;", (village, today))
    distributed_today = cursor.fetchone()[0] or 0
    
    # Fetch alerts to display on dashboard
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
            
    conn.close()
    
    return render_template('asha_dashboard.html',
                           total_medicines=total_medicines,
                           available_stock=available_stock,
                           low_stock_count=low_stock_count,
                           expired_count=expired_count,
                           expiring_soon_count=expiring_soon_count,
                           distributed_today=distributed_today,
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
