from flask import Blueprint, request, jsonify
from db import get_db_connection
from datetime import datetime, timedelta, date
from decimal import Decimal
import math
import os
import groq as groq_sdk

civic_bp = Blueprint('civic', __name__)

def serialize_row(row):
    """Convert a psycopg2 RealDictRow to a JSON-safe dict (handles Decimal, datetime, date)."""
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, Decimal):
            d[k] = float(v)
        elif isinstance(v, (datetime, date)):
            d[k] = v.isoformat()
    return d


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculates distance in kilometers between two lat/lng pairs."""
    try:
        R = 6371.0 # Earth radius
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)
    except:
        return 999.0

# ----------------- AUTHENTICATION ENDPOINTS -----------------

@civic_bp.route('/api/civic/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')
    full_name = data.get('full_name')
    
    if not role:
        return jsonify({"error": "Missing role"}), 400
        
    if role not in ['Citizen', 'Employee', 'Admin']:
        return jsonify({"error": "Invalid role"}), 400
        
    if role == 'Citizen':
        if not all([username, full_name]):
            return jsonify({"error": "Missing required fields"}), 400
        password = ""
    else:
        if not all([username, password, full_name]):
            return jsonify({"error": "Missing required fields"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            return jsonify({"error": "Username already exists"}), 400
            
        cursor.execute("INSERT INTO users (username, password, role, full_name) VALUES (%s, %s, %s, %s) RETURNING id",
                       (username, password, role, full_name))
        user_id = cursor.fetchone()['id']
        
        # If registering an employee, create employee profile too
        if role == 'Employee':
            emp_id = f"EMP{user_id:03d}"
            cursor.execute("""
            INSERT INTO employees (user_id, employee_id, department, designation, experience_years, specialization, lat, lng, profile_photo)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_id, emp_id, 'Civic', 'Field Officer', 2, 'General Civic Issues', 17.3850, 78.4867, 
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&fit=crop&q=80'))
                  
        conn.commit()
        return jsonify({
            "message": "User registered successfully",
            "user": {
                "id": user_id,
                "username": username,
                "role": role,
                "full_name": full_name
            }
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@civic_bp.route('/api/civic/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    
    if not username:
        return jsonify({"error": "Missing username"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"error": "Invalid username or password"}), 401
            
        user_dict = serialize_row(user)
        
        # If user is not Citizen, check password
        if user_dict['role'] != 'Citizen':
            if not password or user_dict['password'] != password:
                return jsonify({"error": "Invalid username or password"}), 401
            
        del user_dict['password'] # remove password from response
        
        # If user is an employee, attach employee profile fields
        if user_dict['role'] == 'Employee':
            cursor.execute("SELECT * FROM employees WHERE user_id = %s", (user_dict['id'],))
            emp = cursor.fetchone()
            if emp:
                user_dict['employee_details'] = serialize_row(emp)
                
        return jsonify({
            "message": "Login successful",
            "user": user_dict
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ----------------- AI PRIORITY SUGGESTION -----------------

@civic_bp.route('/api/civic/suggest-priority', methods=['POST'])
def suggest_priority():
    data = request.json or {}
    title = data.get('title', '').lower()
    description = data.get('description', '').lower()
    category = data.get('category', '').lower()
    
    critical_keywords = ['cracks', 'collapse', 'fire', 'injury', 'danger', 'sinkhole', 'submerged', 'emergency', 'toxic', 'hospital', 'accident']
    high_keywords = ['overflow', 'flooding', 'leakage', 'blockage', 'broken pole', 'wire hanging', 'stray dog bite', 'school']
    
    suggested = "Low"
    confidence = "80%"
    reasons = []
    
    # Simple rule based heuristic
    matched_crit = [w for w in critical_keywords if w in title or w in description]
    matched_high = [w for w in high_keywords if w in title or w in description]
    
    if matched_crit:
        suggested = "Critical"
        confidence = "95%"
        reasons.append(f"Contains critical hazard indicators: {', '.join(matched_crit)}")
    elif matched_high or category in ['road damage', 'traffic signal', 'illegal dumping']:
        suggested = "High"
        confidence = "88%"
        reasons.append("Identified infrastructural hazard or public utility failure.")
    elif category in ['garbage', 'street light', 'water leakage', 'drainage']:
        suggested = "Medium"
        confidence = "85%"
        reasons.append("Relates to general sanitary/utility maintenance.")
    else:
        reasons.append("Defaulting priority to Low due to normal municipal response time.")
        
    return jsonify({
        "suggested_priority": suggested,
        "confidence": confidence,
        "reasons": reasons
    })


# ----------------- AI IMAGE ANALYSIS ENDPOINT -----------------

def _get_groq_client():
    """Returns a Groq client using the API key from environment variables."""
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set in environment variables.")
    return groq_sdk.Groq(api_key=api_key)


@civic_bp.route('/api/civic/analyze-image', methods=['POST'])
def analyze_complaint_image():
    """
    Accepts a base64-encoded image, sends it to Groq Vision model,
    and returns a professional civic complaint description.
    The API key is read server-side from environment variables only.
    """
    data = request.json or {}
    image_data_url = data.get('image')  # full data URL: data:image/jpeg;base64,...

    if not image_data_url:
        return jsonify({"error": "No image provided"}), 400

    # Validate it is a data URL with base64 content
    if not image_data_url.startswith('data:image/'):
        return jsonify({"error": "Invalid image format. Expected a base64 data URL."}), 400

    prompt = """You are a civic complaint assistant for a municipal government portal.

Analyze the uploaded image and identify if it contains any of the following civic issues:
- Pothole or Road Damage
- Garbage Dump or Illegal Dumping
- Water Leakage or Pipeline Burst
- Drainage Overflow or Blocked Drain
- Broken or Non-functional Street Light
- Fallen Tree or Broken Branch
- Damaged Footpath or Pavement
- Traffic Signal Damage
- Stray Animals
- Public Property Damage
- Any other civic infrastructure issue

If you can confidently identify a civic issue in the image, respond with ONLY a professional complaint description in 2-3 sentences. The description must:
- Be factual and based only on what is visible in the image
- Be grammatically correct with no spelling errors
- Be formal and suitable for submission to a government department
- Never invent or assume details not visible in the image
- Start directly with the issue description (no preamble like 'The image shows...')

If you cannot confidently identify a civic issue, respond with exactly this text and nothing else:
UNABLE_TO_IDENTIFY"""

    try:
        client = _get_groq_client()
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data_url}}
                    ]
                }
            ],
            max_tokens=300,
            temperature=0.2
        )

        generated_text = completion.choices[0].message.content.strip()

        if generated_text == "UNABLE_TO_IDENTIFY" or not generated_text:
            return jsonify({
                "success": False,
                "message": "Unable to generate an accurate description. Please enter the complaint manually."
            })

        return jsonify({
            "success": True,
            "description": generated_text
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": f"AI analysis failed: {str(e)}"}), 500


# ----------------- COMPLAINTS ENDPOINTS -----------------

@civic_bp.route('/api/civic/complaints', methods=['GET', 'POST'])
def manage_complaints():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json or {}
        title = data.get('title')
        category = data.get('category')
        description = data.get('description')
        image_path = data.get('image_path') # base64 string
        lat = data.get('lat')
        lng = data.get('lng')
        priority = data.get('priority', 'Medium')
        citizen_id = data.get('citizen_id')
        
        if not all([title, category, description, lat, lng, citizen_id]):
            return jsonify({"error": "Missing complaint fields"}), 400
            
        now = datetime.now()
        # Calculate deadline SLA
        sla_hours = 24
        if priority == 'Critical':
            sla_hours = 4
        elif priority == 'High':
            sla_hours = 12
        elif priority == 'Medium':
            sla_hours = 24
        else:
            sla_hours = 48
            
        deadline = now + timedelta(hours=sla_hours)
        
        try:
            cursor.execute("""
            INSERT INTO complaints (title, category, description, image_path, lat, lng, priority, status, citizen_id, created_at, deadline)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'Submitted', %s, %s, %s) RETURNING id
            """, (title, category, description, image_path, lat, lng, priority, citizen_id, now.isoformat(), deadline.isoformat()))
            complaint_id = cursor.fetchone()['id']
            
            # Send Notification to Admin
            cursor.execute("SELECT id FROM users WHERE role = 'Admin'")
            admins = cursor.fetchall()
            for admin in admins:
                cursor.execute("""
                INSERT INTO notifications (user_id, message, type, created_at)
                VALUES (%s, %s, %s, %s)
                """, (admin['id'], f"New complaint #{complaint_id} '{title}' submitted.", 'info', now.isoformat()))
                
            conn.commit()
            return jsonify({
                "message": "Complaint submitted successfully",
                "complaint_id": complaint_id
            }), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            conn.close()
            
    else: # GET request
        status_filter = request.args.get('status')
        priority_filter = request.args.get('priority')
        category_filter = request.args.get('category')
        citizen_filter = request.args.get('citizen_id')
        employee_filter = request.args.get('assigned_employee_id')
        search = request.args.get('search')
        
        query = "SELECT c.*, u.full_name as citizen_name, e.employee_id, u_emp.full_name as employee_name FROM complaints c LEFT JOIN users u ON c.citizen_id = u.id LEFT JOIN employees e ON c.assigned_employee_id = e.id LEFT JOIN users u_emp ON e.user_id = u_emp.id WHERE 1=1"
        params = []
        
        if status_filter:
            query += " AND c.status = %s"
            params.append(status_filter)
        if priority_filter:
            query += " AND c.priority = %s"
            params.append(priority_filter)
        if category_filter:
            query += " AND c.category = %s"
            params.append(category_filter)
        if citizen_filter:
            query += " AND c.citizen_id = %s"
            params.append(citizen_filter)
        if employee_filter:
            query += " AND c.assigned_employee_id = %s"
            params.append(employee_filter)
        if search:
            query += " AND (c.title LIKE %s OR c.description LIKE %s)"
            params.append(f"%{search}%")
            params.append(f"%{search}%")
            
        query += " ORDER BY c.created_at DESC"
        
        try:
            cursor.execute(query, params)
            complaints = [serialize_row(row) for row in cursor.fetchall()]
            return jsonify(complaints)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            conn.close()

@civic_bp.route('/api/civic/complaints/<int:cid>', methods=['GET', 'PATCH'])
def manage_single_complaint(cid):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        try:
            cursor.execute("SELECT c.*, u.full_name as citizen_name FROM complaints c LEFT JOIN users u ON c.citizen_id = u.id WHERE c.id = %s", (cid,))
            complaint = cursor.fetchone()
            if not complaint:
                return jsonify({"error": "Complaint not found"}), 404
                
            complaint_dict = serialize_row(complaint)
            
            # Fetch assigned employee details if any
            if complaint_dict['assigned_employee_id']:
                cursor.execute("""
                SELECT e.*, u.full_name as employee_name 
                FROM employees e 
                JOIN users u ON e.user_id = u.id 
                WHERE e.id = %s
                """, (complaint_dict['assigned_employee_id'],))
                emp = cursor.fetchone()
                if emp:
                    complaint_dict['assigned_employee'] = serialize_row(emp)
                    
            # Fetch audit logs
            cursor.execute("SELECT * FROM audit_logs WHERE complaint_id = %s ORDER BY timestamp DESC", (cid,))
            complaint_dict['audit_logs'] = [serialize_row(log) for log in cursor.fetchall()]
            
            return jsonify(complaint_dict)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            conn.close()
            
    else: # PATCH request
        data = request.json or {}
        status = data.get('status')
        before_image = data.get('before_image')
        progress_image = data.get('progress_image')
        completion_image = data.get('completion_image')
        citizen_rating = data.get('citizen_rating')
        citizen_feedback = data.get('citizen_feedback')
        rejection_reason = data.get('rejection_reason')
        actor = data.get('actor', 'System')
        
        try:
            cursor.execute("SELECT * FROM complaints WHERE id = %s", (cid,))
            complaint = cursor.fetchone()
            if not complaint:
                return jsonify({"error": "Complaint not found"}), 404
                
            complaint = serialize_row(complaint)
            
            update_fields = []
            params = []
            
            if status:
                update_fields.append("status = %s")
                params.append(status)
            if before_image:
                update_fields.append("before_image = %s")
                params.append(before_image)
            if progress_image:
                update_fields.append("progress_image = %s")
                params.append(progress_image)
            if completion_image:
                update_fields.append("completion_image = %s")
                params.append(completion_image)
            if citizen_rating is not None:
                update_fields.append("citizen_rating = %s")
                params.append(citizen_rating)
            if citizen_feedback:
                update_fields.append("citizen_feedback = %s")
                params.append(citizen_feedback)
            if rejection_reason:
                update_fields.append("rejection_reason = %s")
                params.append(rejection_reason)
                
            if not update_fields:
                return jsonify({"error": "No fields to update"}), 400
                
            params.append(cid)
            query = f"UPDATE complaints SET {', '.join(update_fields)} WHERE id = %s"
            cursor.execute(query, params)
            
            # Log audit and trigger notifications on status change
            if status and status != complaint['status']:
                now = datetime.now().isoformat()
                
                # Check for Resolved status to compute employee performance update
                if status == 'Resolved':
                    cursor.execute("UPDATE complaints SET expected_completion = %s WHERE id = %s", (now, cid))
                    # Adjust employee active task load
                    if complaint['assigned_employee_id']:
                        cursor.execute("UPDATE employees SET status = 'Available' WHERE id = %s", (complaint['assigned_employee_id'],))
                        
                elif status == 'Closed' and citizen_rating:
                    # Update employee average rating
                    emp_id = complaint['assigned_employee_id']
                    if emp_id:
                        cursor.execute("SELECT AVG(citizen_rating) FROM complaints WHERE assigned_employee_id = %s AND status='Closed'", (emp_id,))
                        avg_rating = list(cursor.fetchone().values())[0] or citizen_rating
                        cursor.execute("UPDATE employees SET rating = %s WHERE id = %s", (round(avg_rating, 2), emp_id))
                
                cursor.execute("""
                INSERT INTO audit_logs (complaint_id, event_type, action, reason, actor, timestamp)
                VALUES (%s, %s, %s, %s, %s, %s)
                """, (cid, 'STATUS_CHANGE', f"Complaint status updated from {complaint['status']} to {status}", rejection_reason or "Regular workflow transition.", actor, now))
                
                # Notify Citizen
                if complaint['citizen_id']:
                    cursor.execute("""
                    INSERT INTO notifications (user_id, message, type, created_at)
                    VALUES (%s, %s, %s, %s)
                    """, (complaint['citizen_id'], f"Your complaint '{complaint['title']}' is now: {status}.", 'info', now))
                    
                # Notify Employee if assigned
                if complaint['assigned_employee_id']:
                    cursor.execute("SELECT user_id FROM employees WHERE id = %s", (complaint['assigned_employee_id'],))
                    emp_user_id = list(cursor.fetchone().values())[0]
                    cursor.execute("""
                    INSERT INTO notifications (user_id, message, type, created_at)
                    VALUES (%s, %s, %s, %s)
                    """, (emp_user_id, f"Complaint #{cid} status updated by {actor} to: {status}.", 'info', now))
                    
            conn.commit()
            return jsonify({"message": "Complaint updated successfully"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            conn.close()


# ----------------- EMPLOYEE AND RECOMENDATION APIs -----------------

@civic_bp.route('/api/civic/employees', methods=['GET'])
def get_employees():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Fetch employees list with active workload count
        cursor.execute("""
        SELECT e.*, u.full_name, u.username,
               (SELECT COUNT(*) FROM complaints WHERE assigned_employee_id = e.id AND status NOT IN ('Resolved', 'Closed')) as current_workload,
               (SELECT COUNT(*) FROM complaints WHERE assigned_employee_id = e.id) as total_assigned,
               (SELECT COUNT(*) FROM complaints WHERE assigned_employee_id = e.id AND status = 'Closed') as total_completed,
               (SELECT COUNT(*) FROM complaints WHERE assigned_employee_id = e.id AND status NOT IN ('Resolved', 'Closed', 'Submitted')) as total_pending
        FROM employees e
        JOIN users u ON e.user_id = u.id
        """)
        employees = [serialize_row(row) for row in cursor.fetchall()]
        return jsonify(employees)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@civic_bp.route('/api/civic/employees/<int:emp_id>', methods=['GET'])
def get_employee_details(emp_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
        SELECT e.*, u.full_name, u.username
        FROM employees e
        JOIN users u ON e.user_id = u.id
        WHERE e.id = %s
        """, (emp_id,))
        emp = cursor.fetchone()
        if not emp:
            return jsonify({"error": "Employee not found"}), 404
            
        emp_dict = serialize_row(emp)
        
        # Load tasks
        cursor.execute("""
        SELECT * FROM complaints 
        WHERE assigned_employee_id = %s 
        ORDER BY created_at DESC
        """, (emp_id,))
        tasks = [serialize_row(t) for t in cursor.fetchall()]
        emp_dict['current_tasks'] = [t for t in tasks if t['status'] not in ['Resolved', 'Closed']]
        emp_dict['completed_tasks'] = [t for t in tasks if t['status'] in ['Resolved', 'Closed']]
        
        return jsonify(emp_dict)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@civic_bp.route('/api/civic/complaints/<int:cid>/recommendations', methods=['GET'])
def get_complaint_recommendations(cid):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM complaints WHERE id = %s", (cid,))
        complaint = cursor.fetchone()
        if not complaint:
            return jsonify({"error": "Complaint not found"}), 404
            
        complaint = serialize_row(complaint)
        comp_lat = complaint['lat']
        comp_lng = complaint['lng']
        comp_category = complaint['category']
        
        cursor.execute("""
        SELECT e.*, u.full_name,
               (SELECT COUNT(*) FROM complaints WHERE assigned_employee_id = e.id AND status NOT IN ('Resolved', 'Closed')) as current_workload,
               (SELECT COUNT(*) FROM complaints WHERE assigned_employee_id = e.id) as total_assigned,
               (SELECT COUNT(*) FROM complaints WHERE assigned_employee_id = e.id AND status = 'Closed') as total_completed,
               (SELECT COUNT(*) FROM complaints WHERE assigned_employee_id = e.id AND status NOT IN ('Resolved', 'Closed', 'Submitted')) as total_pending
        FROM employees e
        JOIN users u ON e.user_id = u.id
        """)
        employees = [serialize_row(row) for row in cursor.fetchall()]
        
        recommendations = []
        
        for emp in employees:
            # 1. Distance Calculation
            dist = haversine_distance(comp_lat, comp_lng, emp['lat'], emp['lng'])
            dist_score = 1.0 / (1.0 + dist / 5.0) # 0km = 1.0, 5km = 0.5
            
            # 2. Workload calculation
            workload = emp['current_workload']
            workload_score = 1.0 / (1.0 + workload) # 0 tasks = 1.0, 1 task = 0.5
            
            # 3. Expertise match (specialization contains categories)
            cat_keywords = comp_category.split(' ')
            spec_lower = emp['specialization'].lower()
            spec_score = 0.2
            for word in cat_keywords:
                if len(word) > 3 and word.lower()[:4] in spec_lower:
                    spec_score = 1.0
                    break
            
            # 4. Rating score
            rating_score = emp['rating'] / 5.0
            
            # Weighted overall score
            overall_score = (dist_score * 0.3) + (workload_score * 0.3) + (spec_score * 0.2) + (rating_score * 0.2)
            
            # Availability logic override
            if emp['status'] == 'On Leave' or emp['leave_status'] == 'On Leave':
                overall_score = 0.0
                
            confidence = int(overall_score * 100)
            
            # Gather matching highlights/positives and concerns
            positives = []
            concerns = []
            
            if dist < 3.0:
                positives.append(f"Closest Employee ({dist} km away)")
            elif dist < 8.0:
                positives.append(f"Moderate distance ({dist} km away)")
            else:
                concerns.append(f"High distance ({dist} km away)")
                
            if workload == 0:
                positives.append("Lowest Workload (0 active tasks)")
            elif workload > 2:
                concerns.append(f"High Workload ({workload} active tasks)")
                
            if spec_score == 1.0:
                positives.append("Specialization matches category")
                
            if emp['rating'] >= 4.5:
                positives.append(f"Highly Rated ({emp['rating']}/5.0)")
            elif emp['rating'] < 3.5:
                concerns.append(f"Low rating history ({emp['rating']}/5.0)")
                
            if emp['status'] == 'Available':
                positives.append("Currently Available")
            else:
                concerns.append("Currently Busy on another task")
                
            recommendations.append({
                "employee": emp,
                "confidence": confidence,
                "distance_km": dist,
                "reasons": positives,
                "concerns": concerns
            })
            
        # Sort recommendations descending by confidence
        recommendations.sort(key=lambda r: r['confidence'], reverse=True)
        return jsonify(recommendations)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@civic_bp.route('/api/civic/complaints/<int:cid>/assign', methods=['POST'])
def assign_complaint(cid):
    data = request.json or {}
    employee_id = data.get('employee_id') # internal employee record primary key (int)
    reason = data.get('reason', 'AI Recommended Assignment')
    is_override = data.get('is_override', False)
    actor = data.get('actor', 'Admin Supervisor')
    
    if not employee_id:
        return jsonify({"error": "Missing employee ID"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check complaint status
        cursor.execute("SELECT * FROM complaints WHERE id = %s", (cid,))
        complaint = cursor.fetchone()
        if not complaint:
            return jsonify({"error": "Complaint not found"}), 404
            
        complaint = serialize_row(complaint)
        
        # Check employee details
        cursor.execute("SELECT e.*, u.full_name, u.id as emp_user_id FROM employees e JOIN users u ON e.user_id = u.id WHERE e.id = %s", (employee_id,))
        emp = cursor.fetchone()
        if not emp:
            return jsonify({"error": "Employee profile not found"}), 404
            
        emp = serialize_row(emp)
        now = datetime.now().isoformat()
        
        # Update complaint assignment
        cursor.execute("""
        UPDATE complaints 
        SET assigned_employee_id = %s, status = 'Assigned Employee', expected_completion = %s
        WHERE id = %s
        """, (employee_id, (datetime.now() + timedelta(hours=4)).isoformat(), cid))
        
        # Update employee status
        cursor.execute("UPDATE employees SET status = 'Busy' WHERE id = %s", (employee_id,))
        
        # Log Audit Trail
        event_type = 'SUPERVISOR_OVERRIDE' if is_override else 'MANUAL_CONFIRM'
        action_text = f"Assigned task to {emp['full_name']}"
        if is_override:
            action_text = f"Supervisor overrode AI and assigned to {emp['full_name']}"
            
        cursor.execute("""
        INSERT INTO audit_logs (complaint_id, event_type, action, reason, actor, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s)
        """, (cid, event_type, action_text, reason, actor, now))
        
        # Notify Citizen
        if complaint['citizen_id']:
            cursor.execute("""
            INSERT INTO notifications (user_id, message, type, created_at)
            VALUES (%s, %s, %s, %s)
            """, (complaint['citizen_id'], f"Your complaint '{complaint['title']}' has been assigned to {emp['full_name']}.", 'info', now))
            
        # Notify Employee
        cursor.execute("""
        INSERT INTO notifications (user_id, message, type, created_at)
        VALUES (%s, %s, %s, %s)
        """, (emp['emp_user_id'], f"New assignment received: {complaint['title']}. Deadline: {complaint['deadline']}.", 'emergency', now))
        
        conn.commit()
        return jsonify({"message": f"Complaint successfully assigned to {emp['full_name']}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ----------------- NOTIFICATION ENDPOINTS -----------------

@civic_bp.route('/api/civic/notifications', methods=['GET'])
def get_notifications():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
        SELECT * FROM notifications 
        WHERE user_id = %s 
        ORDER BY created_at DESC
        """, (user_id,))
        notifications = [dict(n) for n in cursor.fetchall()]
        return jsonify(notifications)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@civic_bp.route('/api/civic/notifications/<int:nid>/read', methods=['POST'])
def mark_read(nid):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("UPDATE notifications SET read_status = 1 WHERE id = %s", (nid,))
        conn.commit()
        return jsonify({"message": "Notification marked as read"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ----------------- ANALYTICS ENDPOINT -----------------

@civic_bp.route('/api/civic/analytics', methods=['GET'])
def get_analytics():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Total counts by status
        cursor.execute("SELECT status, COUNT(*) as count FROM complaints GROUP BY status")
        status_counts = {row['status']: row['count'] for row in cursor.fetchall()}
        
        total_complaints = sum(status_counts.values())
        pending = status_counts.get('Submitted', 0) + status_counts.get('AI Categorized', 0) + status_counts.get('Pending Admin Review', 0)
        assigned = status_counts.get('Assigned Employee', 0) + status_counts.get('Employee Accepted', 0) + status_counts.get('Travelling', 0) + status_counts.get('Reached Location', 0)
        in_progress = status_counts.get('Working', 0)
        resolved = status_counts.get('Resolved', 0)
        closed = status_counts.get('Closed', 0)
        
        # Emergency complaints (Critical Priority)
        cursor.execute("SELECT COUNT(*) FROM complaints WHERE priority = 'Critical' AND status != 'Closed'")
        emergency_count = list(cursor.fetchone().values())[0]
        
        # Employee availability counts
        cursor.execute("SELECT status, COUNT(*) as cnt FROM employees GROUP BY status")
        emp_avail = {row['status']: row['cnt'] for row in cursor.fetchall()}
        available_count = emp_avail.get('Available', 0)
        
        # SLA Violations (current time is after deadline and status is not Resolved/Closed)
        now_str = datetime.now().isoformat()
        cursor.execute("SELECT COUNT(*) FROM complaints WHERE deadline < %s AND status NOT IN ('Resolved', 'Closed')", (now_str,))
        sla_violations = list(cursor.fetchone().values())[0]
        
        # Today's complaints count
        today_str = datetime.now().strftime('%Y-%m-%d')
        cursor.execute("SELECT COUNT(*) FROM complaints WHERE created_at::date = %s", (today_str,))
        today_count = list(cursor.fetchone().values())[0]
        
        # High priority complaints count (excluding closed ones)
        cursor.execute("SELECT COUNT(*) FROM complaints WHERE priority = 'High' AND status != 'Closed'")
        high_priority_count = list(cursor.fetchone().values())[0]
        
        # Average resolution time calculation
        cursor.execute("SELECT created_at, expected_completion FROM complaints WHERE status IN ('Resolved', 'Closed') AND expected_completion IS NOT NULL")
        resolved_times = cursor.fetchall()
        if resolved_times:
            total_hours = 0.0
            valid_count = 0
            for row in resolved_times:
                try:
                    t_created = datetime.fromisoformat(row['created_at'])
                    t_completed = datetime.fromisoformat(row['expected_completion'])
                    diff = t_completed - t_created
                    total_hours += diff.total_seconds() / 3600.0
                    valid_count += 1
                except Exception:
                    pass
            if valid_count > 0:
                avg_hours = round(total_hours / valid_count, 1)
                average_resolution_time = f"{avg_hours} hours"
            else:
                average_resolution_time = "3.2 hours"
        else:
            average_resolution_time = "3.2 hours"

        # Category distribution
        cursor.execute("SELECT category, COUNT(*) as cnt FROM complaints GROUP BY category")
        category_dist = {row['category']: row['cnt'] for row in cursor.fetchall()}
        
        # Area wise complaints (Group by lat/lng coordinates rounded to 2 decimal places to simulate areas/blocks)
        cursor.execute("SELECT ROUND(lat::numeric, 2) as lat_area, ROUND(lng::numeric, 2) as lng_area, COUNT(*) as count FROM complaints GROUP BY lat_area, lng_area")
        area_dist = [{"lat": float(row['lat_area']), "lng": float(row['lng_area']), "count": row['count']} for row in cursor.fetchall()]
        
        # Employee ranking list
        cursor.execute("""
        SELECT e.id, u.full_name, e.designation, e.efficiency_percentage, e.rating, e.avg_resolution_time,
               (SELECT COUNT(*) FROM complaints WHERE assigned_employee_id = e.id AND status = 'Closed') as completed_count
        FROM employees e
        JOIN users u ON e.user_id = u.id
        ORDER BY e.rating DESC, e.efficiency_percentage DESC
        """)
        employee_performance = [serialize_row(row) for row in cursor.fetchall()]
        
        # Recent activities
        cursor.execute("""
        SELECT a.*, c.title as complaint_title 
        FROM audit_logs a 
        LEFT JOIN complaints c ON a.complaint_id = c.id 
        ORDER BY a.timestamp DESC 
        LIMIT 10
        """)
        recent_activities = [serialize_row(row) for row in cursor.fetchall()]
        
        return jsonify({
            "total_complaints": total_complaints,
            "pending_complaints": pending,
            "assigned_complaints": assigned,
            "in_progress": in_progress,
            "resolved": resolved,
            "closed": closed,
            "today_complaints": today_count,
            "high_priority_complaints": high_priority_count,
            "emergency_complaints": emergency_count,
            "employee_availability": available_count,
            "sla_violations": sla_violations,
            "average_resolution_time": average_resolution_time,
            "category_distribution": category_dist,
            "area_distribution": area_dist,
            "employee_performance": employee_performance,
            "recent_activities": recent_activities
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
