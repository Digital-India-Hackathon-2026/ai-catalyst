from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from utils.db import get_db_connection

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/', methods=['GET'])
def index():
    if 'role' in session:
        if session['role'] == 'asha':
            return redirect(url_for('asha.asha_dashboard'))
        elif session['role'] == 'mandal':
            return redirect(url_for('mandal.mandal_dashboard'))
    return render_template('landing.html')

@auth_bp.route('/asha/login', methods=['GET', 'POST'])
def asha_login():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        village = request.form.get('village', '').strip()
        
        if not name or not village:
            flash("Both Name and Village are required.", "error")
            return render_template('login.html', role='ASHA Worker', fields={'name': 'ASHA Worker Name', 'context': 'Village Name'})

        # Insert into database if not exists, or get existing
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM asha_workers WHERE village = ?;", (village,))
        worker = cursor.fetchone()
        
        if not worker:
            cursor.execute("INSERT INTO asha_workers (name, village) VALUES (?, ?);", (name, village))
            conn.commit()
        
        conn.close()

        # Store in session
        session['role'] = 'asha'
        session['name'] = name
        session['village'] = village
        
        flash(f"Welcome, {name}! Logged in successfully.", "success")
        return redirect(url_for('asha.asha_dashboard'))
        
    return render_template('login.html', role='ASHA Worker', fields={'name': 'ASHA Worker Name', 'context': 'Village Name'})

@auth_bp.route('/mandal/login', methods=['GET', 'POST'])
def mandal_login():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        mandal = request.form.get('mandal', '').strip()
        
        if not name or not mandal:
            flash("Both Name and Mandal Name are required.", "error")
            return render_template('login.html', role='Mandal Hospital', fields={'name': 'Hospital Name', 'context': 'Mandal Name'})
            
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM mandal_hospitals WHERE mandal = ?;", (mandal,))
        hospital = cursor.fetchone()
        
        if not hospital:
            cursor.execute("INSERT INTO mandal_hospitals (name, mandal) VALUES (?, ?);", (name, mandal))
            conn.commit()
            
        conn.close()

        session['role'] = 'mandal'
        session['name'] = name
        session['mandal'] = mandal
        
        flash(f"Welcome, {name}! Logged in successfully.", "success")
        return redirect(url_for('mandal.mandal_dashboard'))

    return render_template('login.html', role='Mandal Hospital', fields={'name': 'Hospital Name', 'context': 'Mandal Name'})

@auth_bp.route('/logout')
def logout():
    session.clear()
    flash("You have been logged out.", "success")
    return redirect(url_for('auth.index'))
