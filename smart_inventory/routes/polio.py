from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, flash
from utils.db import get_db_connection
from datetime import datetime, timedelta
import urllib.request
import json
import os
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

polio_bp = Blueprint('polio', __name__, url_prefix='/polio')

@polio_bp.route('/dashboard', methods=['GET'])
def dashboard():
    if 'role' not in session or session.get('role') != 'asha':
        return redirect(url_for('auth.asha_login'))

    village = session.get('village')
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Total Registered
    cursor.execute("SELECT COUNT(*) FROM polio_children WHERE village = ?", (village,))
    total_registered = cursor.fetchone()[0]

    # 2. Vaccinated Today & Due Today
    today = datetime.now().strftime("%Y-%m-%d")
    
    cursor.execute("""
        SELECT COUNT(*) FROM polio_vaccinations v
        JOIN polio_children c ON v.child_id = c.id
        WHERE c.village = ? AND v.administered_date = ? AND v.status = 'Completed'
    """, (village, today))
    vaccinated_today = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*) FROM polio_vaccinations v
        JOIN polio_children c ON v.child_id = c.id
        WHERE c.village = ? AND v.scheduled_date = ? AND v.status = 'Pending'
    """, (village, today))
    due_today = cursor.fetchone()[0]

    # 3. Overdue Children (Scheduled before today, status Pending)
    cursor.execute("""
        SELECT COUNT(*) FROM polio_vaccinations v
        JOIN polio_children c ON v.child_id = c.id
        WHERE c.village = ? AND v.scheduled_date < ? AND v.status = 'Pending'
    """, (village, today))
    overdue_count = cursor.fetchone()[0]

    # 4. Coverage % (Children with all 3 doses completed)
    cursor.execute("""
        SELECT c.id, COUNT(v.id) as completed_doses
        FROM polio_children c
        LEFT JOIN polio_vaccinations v ON c.id = v.child_id AND v.status = 'Completed'
        WHERE c.village = ?
        GROUP BY c.id
    """, (village,))
    children_doses = cursor.fetchall()
    fully_vaccinated = sum(1 for c in children_doses if c['completed_doses'] >= 3)
    coverage_pct = round((fully_vaccinated / total_registered * 100) if total_registered > 0 else 0, 1)

    # 5. Overdue Alerts List
    cursor.execute("""
        SELECT c.name, v.scheduled_date
        FROM polio_vaccinations v
        JOIN polio_children c ON v.child_id = c.id
        WHERE c.village = ? AND v.scheduled_date < ? AND v.status = 'Pending'
    """, (village, today))
    overdue_list = cursor.fetchall()

    # 6. OPV Stock Alert
    cursor.execute("SELECT quantity FROM medicines WHERE medicine_name = 'OPV' AND village = ?", (village,))
    opv_row = cursor.fetchone()
    opv_stock = opv_row['quantity'] if opv_row else 0

    # 7. Today's Vaccination List (Pending for today or Overdue)
    cursor.execute("""
        SELECT c.id, c.name, c.village, c.dob, v.dose_number, v.status, v.scheduled_date
        FROM polio_vaccinations v
        JOIN polio_children c ON v.child_id = c.id
        WHERE c.village = ? AND v.status = 'Pending' AND v.scheduled_date <= ?
        ORDER BY v.scheduled_date ASC
    """, (village, today))
    todays_list = cursor.fetchall()

    # 8. Full History
    cursor.execute("""
        SELECT c.name, v.dose_number, v.administered_date, v.scheduled_date, v.status
        FROM polio_vaccinations v
        JOIN polio_children c ON v.child_id = c.id
        WHERE c.village = ?
        ORDER BY v.scheduled_date DESC
    """, (village,))
    history_list = cursor.fetchall()

    conn.close()

    return render_template('polio_dashboard.html', 
                           total_registered=total_registered,
                           vaccinated_today=vaccinated_today,
                           due_today=due_today,
                           overdue_count=overdue_count,
                           fully_vaccinated=fully_vaccinated,
                           coverage_pct=coverage_pct,
                           overdue_list=overdue_list,
                           opv_stock=opv_stock,
                           todays_list=todays_list,
                           history_list=history_list)

@polio_bp.route('/register', methods=['POST'])
def register_child():
    if 'role' not in session or session.get('role') != 'asha':
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.form
    name = data.get('name')
    dob = data.get('dob')
    gender = data.get('gender')
    parent_name = data.get('parent_name')
    phone = data.get('phone')
    address = data.get('address')
    aadhaar = data.get('aadhaar', '')
    village = session.get('village')

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO polio_children (name, dob, gender, parent_name, phone, village, address, aadhaar)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (name, dob, gender, parent_name, phone, village, address, aadhaar))
    
    child_id = cursor.lastrowid

    # Create Vaccination Schedule based on National Immunization Schedule (OPV 0, 1, 2, 3)
    dob_date = datetime.strptime(dob, "%Y-%m-%d")
    
    # Dose 0: At birth
    cursor.execute("INSERT INTO polio_vaccinations (child_id, dose_number, scheduled_date, status) VALUES (?, 0, ?, 'Pending')", 
                   (child_id, dob_date.strftime("%Y-%m-%d")))
    # Dose 1: 6 weeks
    cursor.execute("INSERT INTO polio_vaccinations (child_id, dose_number, scheduled_date, status) VALUES (?, 1, ?, 'Pending')", 
                   (child_id, (dob_date + timedelta(days=42)).strftime("%Y-%m-%d")))
    # Dose 2: 10 weeks
    cursor.execute("INSERT INTO polio_vaccinations (child_id, dose_number, scheduled_date, status) VALUES (?, 2, ?, 'Pending')", 
                   (child_id, (dob_date + timedelta(days=70)).strftime("%Y-%m-%d")))
    # Dose 3: 14 weeks
    cursor.execute("INSERT INTO polio_vaccinations (child_id, dose_number, scheduled_date, status) VALUES (?, 3, ?, 'Pending')", 
                   (child_id, (dob_date + timedelta(days=98)).strftime("%Y-%m-%d")))

    conn.commit()
    conn.close()

    flash("Child registered and vaccination schedule created successfully!", "success")
    return redirect(url_for('polio.dashboard'))

@polio_bp.route('/vaccinate/<int:child_id>/<int:dose_number>', methods=['POST'])
def vaccinate(child_id, dose_number):
    if 'role' not in session or session.get('role') != 'asha':
        return jsonify({'error': 'Unauthorized'}), 403

    village = session.get('village')
    today = datetime.now().strftime("%Y-%m-%d")
    
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Update Vaccination Record
    cursor.execute("""
        UPDATE polio_vaccinations 
        SET status = 'Completed', administered_date = ? 
        WHERE child_id = ? AND dose_number = ?
    """, (today, child_id, dose_number))

    # 2. Inventory Integration: Deduct 1 OPV dose
    cursor.execute("SELECT id, quantity FROM medicines WHERE medicine_name = 'OPV' AND village = ?", (village,))
    opv = cursor.fetchone()
    if opv and opv['quantity'] > 0:
        new_qty = opv['quantity'] - 1
        cursor.execute("UPDATE medicines SET quantity = ? WHERE id = ?", (new_qty, opv['id']))
        # Log transaction
        cursor.execute("""
            INSERT INTO transactions (medicine_id, action, quantity, remarks, created_at)
            VALUES (?, 'Distributed', 1, 'OPV administered (Polio Module)', ?)
        """, (opv['id'], today))
        
        # Log distribution
        cursor.execute("SELECT name FROM polio_children WHERE id = ?", (child_id,))
        child_name = cursor.fetchone()['name']
        cursor.execute("""
            INSERT INTO distributions (beneficiary_name, medicine_id, quantity, village, distributed_date, remarks)
            VALUES (?, ?, 1, ?, ?, 'Polio Dose')
        """, (child_name, opv['id'], village, today))

    conn.commit()
    conn.close()

    flash(f"Vaccination marked as completed for Dose {dose_number}!", "success")
    return redirect(url_for('polio.dashboard'))

@polio_bp.route('/ai_insights', methods=['GET'])
def ai_insights():
    if 'role' not in session or session.get('role') != 'asha':
        return jsonify({'error': 'Unauthorized'}), 403
        
    village = session.get('village')
    today = datetime.now().strftime("%Y-%m-%d")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM polio_children WHERE village = ?", (village,))
    total_registered = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*) FROM polio_vaccinations v
        JOIN polio_children c ON v.child_id = c.id
        WHERE c.village = ? AND v.scheduled_date <= ? AND v.status = 'Pending'
    """, (village, today))
    total_due = cursor.fetchone()[0]

    cursor.execute("SELECT quantity FROM medicines WHERE medicine_name = 'OPV' AND village = ?", (village,))
    opv_row = cursor.fetchone()
    opv_stock = opv_row['quantity'] if opv_row else 0
    
    conn.close()

    system_prompt = f"""You are the ASHA AI Assistant generating a Polio Vaccination Daily Plan.
You are given the following real-time data for village: {village}.
- Total Registered Children: {total_registered}
- Children Due/Overdue for OPV: {total_due}
- Current OPV Stock: {opv_stock}

Return your output EXACTLY as a JSON object with two keys: "daily_plan" and "insights".
The "daily_plan" should be a list of 4-5 short, actionable bullet points for the worker's schedule today.
The "insights" should be a list of 2-3 short, analytical sentences about their coverage or stock levels (e.g. "Current OPV stock is enough for X days").
DO NOT return markdown. Return ONLY valid JSON.
Example format:
{{
  "daily_plan": ["Visit 5 children", "Carry 5 OPV doses", "Prioritize overdue children"],
  "insights": ["OPV stock is dangerously low", "Coverage is improving"]
}}
"""

    data = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Generate my AI daily plan and insights."}
        ],
        "temperature": 0.3,
        "max_tokens": 300,
        "response_format": {"type": "json_object"}
    }
    
    req = urllib.request.Request(
        GROQ_API_URL,
        data=json.dumps(data).encode('utf-8'),
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            ai_reply = json.loads(result['choices'][0]['message']['content'])
            return jsonify(ai_reply)
    except Exception as e:
        print(f"AI Insight Error: {e}")
        return jsonify({
            "daily_plan": ["Review your pending list manually", "Check OPV stock"],
            "insights": ["AI Insights currently unavailable"]
        })
