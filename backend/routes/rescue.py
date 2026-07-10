from flask import Blueprint, request, jsonify
from db import get_db_connection
from datetime import datetime
import re
import random
import json

rescue_bp = Blueprint('rescue', __name__)

# ─────────────────────────────────────────────
# AI RULE-BASED ENGINE
# ─────────────────────────────────────────────

RESCUE_RULES = [
    {
        'keywords': ['fire', 'blaze', 'burning', 'flames', 'smoke', 'arson', 'inferno'],
        'incident_type': 'Fire Emergency',
        'severity': 'Critical',
        'team': 'Fire Response Unit',
        'eta': 8,
        'confidence': 96,
        'departments': 'Fire Services, Disaster Management, Health Dept',
        'nearest_team': 'Ameerpet Fire Station Unit'
    },
    {
        'keywords': ['flood', 'drowning', 'swept', 'submerged', 'waterlogged', 'drowning', 'flash flood', 'washed away'],
        'incident_type': 'Flood / Water Rescue',
        'severity': 'Critical',
        'team': 'Flood Rescue (NDRF)',
        'eta': 10,
        'confidence': 94,
        'departments': 'Disaster Management (NDRF), Irrigation Dept',
        'nearest_team': 'Secunderabad NDRF Battalion'
    },
    {
        'keywords': ['collapse', 'collapsed', 'building fell', 'trapped', 'rubble', 'debris', 'structure', 'sinkhole', 'earthquake'],
        'incident_type': 'Structural Collapse',
        'severity': 'Critical',
        'team': 'SDRF Structural Response Team',
        'eta': 12,
        'confidence': 95,
        'departments': 'Disaster Management (SDRF), Municipal Corp (GHMC)',
        'nearest_team': 'Jubilee Hills SDRF Team'
    },
    {
        'keywords': ['gas leak', 'gas pipe', 'chemical', 'toxic', 'hazmat', 'poison', 'fumes', 'lpg', 'cylinder blast'],
        'incident_type': 'Hazardous Material Incident',
        'severity': 'High',
        'team': 'Hazmat Response Unit',
        'eta': 12,
        'confidence': 91,
        'departments': 'Fire Services, Pollution Control Board, Hazmat Response',
        'nearest_team': 'Gachibowli Hazmat Station'
    },
    {
        'keywords': ['accident', 'crash', 'collision', 'vehicle overturned', 'truck', 'bus', 'car', 'road', 'highway', 'injured', 'injury', 'hit'],
        'incident_type': 'Road Accident',
        'severity': 'High',
        'team': 'Emergency Response Team',
        'eta': 15,
        'confidence': 88,
        'departments': 'Police Department, Health Department (108)',
        'nearest_team': 'Madhapur Patrol Unit'
    },
    {
        'keywords': ['power line', 'electric wire', 'live wire', 'fallen wire', 'electrocution', 'transformer blast'],
        'incident_type': 'Electrical Emergency',
        'severity': 'Medium',
        'team': 'Electrical Emergency Unit',
        'eta': 20,
        'confidence': 85,
        'departments': 'Electricity Board (TSSPDCL), Fire Services',
        'nearest_team': 'Begumpet Power Grid Response'
    },
    {
        'keywords': ['fallen tree', 'tree fell', 'uprooted', 'tree blocking', 'storm damage', 'windstorm', 'cyclone damage'],
        'incident_type': 'Fallen Tree / Debris',
        'severity': 'Medium',
        'team': 'Civic Emergency Team',
        'eta': 25,
        'confidence': 82,
        'departments': 'Forest Department, Municipal Corp (GHMC)',
        'nearest_team': 'Kondapur Municipal Crew'
    },
    {
        'keywords': ['landslide', 'mudslide', 'mud', 'hillside', 'slope'],
        'incident_type': 'Landslide / Erosion',
        'severity': 'High',
        'team': 'SDRF Structural Response Team',
        'eta': 18,
        'confidence': 87,
        'departments': 'Disaster Management (SDRF), Geological Survey',
        'nearest_team': 'Hills SDRF Response Team'
    },
]

def run_ai_analysis(description: str) -> dict:
    """
    Rule-based AI engine fallback.
    Returns schema matching Gemini structure:
    incident_type, severity, confidence_score, ai_summary, required_departments, possible_risks, suggested_rescue_actions, estimated_response_time, landmark, address.
    """
    text = description.lower()
    
    for rule in RESCUE_RULES:
        for keyword in rule['keywords']:
            if keyword in text:
                return {
                    'incident_type': rule['incident_type'],
                    'severity': rule['severity'],
                    'confidence_score': rule['confidence'],
                    'ai_summary': f"Emergency classified as {rule['incident_type']} ({rule['severity']} severity) based on matching keywords: {keyword}.",
                    'required_departments': [d.strip() for d in rule['departments'].split(',')] if rule.get('departments') else [],
                    'possible_risks': ["Secondary hazards", "public safety danger", "escalation risk"],
                    'suggested_rescue_actions': [f"Dispatch {rule['team']} immediately", "Establish safety perimeter", "Assess victims"],
                    'estimated_response_time': rule['eta'],
                    'landmark': rule['nearest_team'],
                    'address': ""
                }
    
    # Default fallback
    return {
        'incident_type': 'General Emergency',
        'severity': 'Low',
        'confidence_score': 70,
        'ai_summary': "General emergency classification applied due to lack of specific keywords.",
        'required_departments': ["Municipal Services"],
        'possible_risks': ["General safety hazards", "minor traffic obstruction"],
        'suggested_rescue_actions': ["Dispatch local patrol crew to investigate"],
        'estimated_response_time': 45,
        'landmark': "Local Patrol Area",
        'address': ""
    }


def determine_team_from_incident(incident_type: str, description: str) -> str:
    """
    Flask backend logic: decides the recommended_team based on incident type and description.
    Do NOT allow Gemini to decide this.
    """
    inc_type_lower = str(incident_type).lower()
    desc_lower = str(description).lower()
    
    if 'fire' in inc_type_lower or 'blaze' in inc_type_lower or 'burn' in inc_type_lower:
        return 'Fire Response Unit'
    elif 'flood' in inc_type_lower or 'drown' in inc_type_lower or 'water' in inc_type_lower:
        return 'Flood Rescue (NDRF)'
    elif 'collapse' in inc_type_lower or 'earthquake' in inc_type_lower or 'structural' in inc_type_lower:
        return 'SDRF Structural Response Team'
    elif 'hazmat' in inc_type_lower or 'chemical' in inc_type_lower or 'gas' in inc_type_lower or 'toxic' in inc_type_lower:
        return 'Hazmat Response Unit'
    elif 'accident' in inc_type_lower or 'crash' in inc_type_lower or 'medical' in inc_type_lower or 'injury' in inc_type_lower:
        return 'Emergency Response Team'
    elif 'electric' in inc_type_lower or 'power' in inc_type_lower or 'wire' in inc_type_lower:
        return 'Electrical Emergency Unit'
    elif 'tree' in inc_type_lower or 'debris' in inc_type_lower:
        return 'Civic Emergency Team'
        
    # Fallback checks on description text
    if 'fire' in desc_lower or 'blaze' in desc_lower:
        return 'Fire Response Unit'
    elif 'flood' in desc_lower or 'water' in desc_lower:
        return 'Flood Rescue (NDRF)'
    elif 'collapse' in desc_lower or 'rubble' in desc_lower:
        return 'SDRF Structural Response Team'
    elif 'gas' in desc_lower or 'chemical' in desc_lower:
        return 'Hazmat Response Unit'
    elif 'accident' in desc_lower or 'injury' in desc_lower:
        return 'Emergency Response Team'
    elif 'electric' in desc_lower or 'wire' in desc_lower:
        return 'Electrical Emergency Unit'
        
    return 'Civic Emergency Team'


def get_default_nearest_team(recommended_team: str) -> str:
    """
    Flask backend logic: decides the default nearest team mapping.
    """
    mapping = {
        'Fire Response Unit': 'Ameerpet Fire Station Unit',
        'Flood Rescue (NDRF)': 'Secunderabad NDRF Battalion',
        'SDRF Structural Response Team': 'Jubilee Hills SDRF Team',
        'Hazmat Response Unit': 'Gachibowli Hazmat Station',
        'Emergency Response Team': 'Madhapur Patrol Unit',
        'Electrical Emergency Unit': 'Begumpet Power Grid Response',
        'Civic Emergency Team': 'Kondapur Municipal Crew'
    }
    return mapping.get(recommended_team, 'Kondapur Municipal Crew')


SUB_UNITS = {
    'Fire Response Unit': ['Fire Unit 1', 'Fire Unit 2', 'Fire Unit 3'],
    'Flood Rescue (NDRF)': ['NDRF Unit A', 'NDRF Unit B'],
    'SDRF Structural Response Team': ['SDRF Unit 1', 'SDRF Unit 2'],
    'Hazmat Response Unit': ['Hazmat Unit Alpha', 'Hazmat Unit Beta'],
    'Emergency Response Team': ['ERT Unit 1', 'ERT Unit 2'],
    'Electrical Emergency Unit': ['EE Unit A', 'EE Unit B'],
    'Civic Emergency Team': ['Civic Crew 1', 'Civic Crew 2']
}

def get_least_loaded_unit(cursor, recommended_team: str) -> str:
    """
    Finds the sub-unit with the lowest cumulative time burden.
    Time burden = SUM of response_time_minutes for all active non-completed cases.
    This ensures fair distribution based on how long current assignments will take.
    """
    units = SUB_UNITS.get(recommended_team, [recommended_team])
    if len(units) <= 1:
        return units[0]

    burdens = {}
    for unit in units:
        cursor.execute("""
            SELECT COALESCE(SUM(response_time_minutes), 0) FROM rescue_emergencies
            WHERE nearest_rescue_team = ?
              AND status NOT IN ('Mission Completed', 'Rescue Completed', 'Case Closed')
        """, (unit,))
        burdens[unit] = cursor.fetchone()[0]

    # Assign to unit with lowest total time burden
    sorted_units = sorted(burdens.items(), key=lambda x: x[1])
    return sorted_units[0][0]


# ─── Unit Credentials (hardcoded for prototype) ───
UNIT_CREDENTIALS = {
    'FIRE1':   {'unit_label': 'Fire Unit 1',       'primary': 'Fire Response Unit',           'pin': '1111'},
    'FIRE2':   {'unit_label': 'Fire Unit 2',       'primary': 'Fire Response Unit',           'pin': '2222'},
    'FIRE3':   {'unit_label': 'Fire Unit 3',       'primary': 'Fire Response Unit',           'pin': '3333'},
    'NDRF_A':  {'unit_label': 'NDRF Unit A',       'primary': 'Flood Rescue (NDRF)',          'pin': '4444'},
    'NDRF_B':  {'unit_label': 'NDRF Unit B',       'primary': 'Flood Rescue (NDRF)',          'pin': '5555'},
    'SDRF1':   {'unit_label': 'SDRF Unit 1',       'primary': 'SDRF Structural Response Team','pin': '6666'},
    'SDRF2':   {'unit_label': 'SDRF Unit 2',       'primary': 'SDRF Structural Response Team','pin': '7777'},
    'HM_A':    {'unit_label': 'Hazmat Unit Alpha', 'primary': 'Hazmat Response Unit',         'pin': '8888'},
    'HM_B':    {'unit_label': 'Hazmat Unit Beta',  'primary': 'Hazmat Response Unit',         'pin': '9999'},
    'ERT1':    {'unit_label': 'ERT Unit 1',        'primary': 'Emergency Response Team',      'pin': '1212'},
    'ERT2':    {'unit_label': 'ERT Unit 2',        'primary': 'Emergency Response Team',      'pin': '2121'},
    'EE_A':    {'unit_label': 'EE Unit A',         'primary': 'Electrical Emergency Unit',    'pin': '3434'},
    'EE_B':    {'unit_label': 'EE Unit B',         'primary': 'Electrical Emergency Unit',    'pin': '4343'},
    'CIVIC1':  {'unit_label': 'Civic Crew 1',      'primary': 'Civic Emergency Team',         'pin': '5656'},
    'CIVIC2':  {'unit_label': 'Civic Crew 2',      'primary': 'Civic Emergency Team',         'pin': '6565'},
}


# ─── Team Roster (hardcoded for prototype) ───
TEAM_ROSTER = {
    'Fire Unit 1':       {'leader': 'Cpt. Arjun Reddy',     'driver': 'Const. Manoj Kumar',    'members': ['FF. Sai Kiran', 'FF. Ravi Teja'],         'specialization': 'Structural Fire & Rescue'},
    'Fire Unit 2':       {'leader': 'Cpt. Priya Sharma',    'driver': 'Const. Deepak Rao',     'members': ['FF. Anjali Devi', 'FF. Kiran Babu'],       'specialization': 'Industrial Fire Response'},
    'Fire Unit 3':       {'leader': 'Cpt. Suresh Naidu',    'driver': 'Const. Arun Verma',     'members': ['FF. Pooja Singh', 'FF. Rahul Nair'],       'specialization': 'High-Rise Fire Ops'},
    'NDRF Unit A':       {'leader': 'Cmdr. Vikram Singh',   'driver': 'Hav. Santhosh Kumar',   'members': ['Sep. Lokesh', 'Sep. Dinesh', 'Sep. Amar'], 'specialization': 'Flood Search & Rescue'},
    'NDRF Unit B':       {'leader': 'Cmdr. Meena Patel',    'driver': 'Hav. Gopal Reddy',      'members': ['Sep. Naveen', 'Sep. Karthik'],             'specialization': 'Water Rescue & Evacuation'},
    'SDRF Unit 1':       {'leader': 'Insp. Raju Yadav',     'driver': 'HC. Venkat Rao',        'members': ['PC. Sunil', 'PC. Madhu', 'PC. Bhaskar'],  'specialization': 'Debris Removal & Collapse Rescue'},
    'SDRF Unit 2':       {'leader': 'Insp. Lakshmi Devi',   'driver': 'HC. Prasad Goud',       'members': ['PC. Uday', 'PC. Shyam'],                  'specialization': 'Earthquake Response'},
    'Hazmat Unit Alpha': {'leader': 'Maj. Aditya Kapoor',   'driver': 'Sgt. Ramesh Babu',      'members': ['Tch. Anand', 'Tch. Vijay', 'Tch. Mohan'], 'specialization': 'Chemical & Gas Leak Response'},
    'Hazmat Unit Beta':  {'leader': 'Maj. Sunita Reddy',    'driver': 'Sgt. Harish Nair',      'members': ['Tch. Sridhar', 'Tch. Swamy'],             'specialization': 'Biological Hazard Containment'},
    'ERT Unit 1':        {'leader': 'Dr. Kavitha Rao',      'driver': 'EMT. Ganesh Prasad',    'members': ['Para. Suresh', 'Para. Ramya'],             'specialization': 'Advanced Life Support'},
    'ERT Unit 2':        {'leader': 'Dr. Sameer Khan',      'driver': 'EMT. Arjun Goud',       'members': ['Para. Preethi', 'Para. Siva Kumar'],       'specialization': 'Mass Casualty Response'},
    'EE Unit A':         {'leader': 'Eng. Nagaraju Pillai', 'driver': 'Tech. Ravi Shankar',    'members': ['Line. Murali', 'Line. Sekhar'],            'specialization': 'HV Line & Transformer Faults'},
    'EE Unit B':         {'leader': 'Eng. Padma Kumari',    'driver': 'Tech. Balaji Redd',     'members': ['Line. Srinivas', 'Line. Naresh'],          'specialization': 'Underground Cable & Grid Faults'},
    'Civic Crew 1':      {'leader': 'Sup. Mahesh Gupta',    'driver': 'Op. Ramu Naidu',        'members': ['Wk. Jagadeesh', 'Wk. Prakash'],           'specialization': 'Tree Fall & Road Blockage'},
    'Civic Crew 2':      {'leader': 'Sup. Rekha Babu',      'driver': 'Op. Satish Kumar',      'members': ['Wk. Venkatesh', 'Wk. Sridhar Rao'],       'specialization': 'Building Collapse & Civic Debris'},
}


def get_initial_status(severity: str) -> str:
    """Determine initial status based on Decision Policy."""
    if severity == 'Critical':
        return 'Auto Dispatched'
    elif severity in ('High', 'Medium'):
        return 'Pending Supervisor Approval'
    else:
        return 'Pending Review'


def generate_emergency_id(conn) -> str:
    """Generate unique sequential emergency ID like RES-0004."""
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM rescue_emergencies")
    count = cursor.fetchone()[0]
    return f"RES-{(count + 1):04d}"


# ─────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────

@rescue_bp.route('/api/rescue', methods=['GET'])
def rescue_status():
    """Module health check."""
    return jsonify({
        "module": "Rescue & Emergency Response",
        "version": "2.0.0",
        "phase": "Phase 3 - Team Dashboard",
        "status": "Online",
        "endpoints": [
            "POST /api/rescue/submit",
            "POST /api/rescue/team/login",
            "GET  /api/rescue/team/<unit_label>/missions",
            "GET  /api/rescue/emergencies",
            "GET  /api/rescue/emergencies/<id>",
            "PATCH /api/rescue/emergencies/<id>",
            "GET  /api/rescue/track/<emergency_id>",
            "GET  /api/rescue/config/maps-key"
        ]
    })


@rescue_bp.route('/api/rescue/config/maps-key', methods=['GET'])
def get_maps_key():
    """Returns the Google Maps API Key from environment variables."""
    import os
    key = os.environ.get('GOOGLE_MAPS_API_KEY', '')
    return jsonify({"key": key})



@rescue_bp.route('/api/rescue/team/login', methods=['POST'])
def team_login():
    """
    Rescue team unit login using Unit ID + PIN.
    Returns unit info on success.
    """
    data = request.json or {}
    unit_id = (data.get('unit_id') or '').strip().upper()
    pin     = (data.get('pin') or '').strip()

    cred = UNIT_CREDENTIALS.get(unit_id)
    if not cred:
        return jsonify({'error': 'Unknown Unit ID. Check your credentials.'}), 401
    if cred['pin'] != pin:
        return jsonify({'error': 'Incorrect PIN. Please try again.'}), 401

    return jsonify({
        'unit_label': cred['unit_label'],
        'primary_team': cred['primary'],
        'unit_id': unit_id,
        'authenticated': True
    })


@rescue_bp.route('/api/rescue/team/<path:unit_label>/missions', methods=['GET'])
def team_missions(unit_label):
    """
    Returns all active missions assigned to a specific unit, sorted by priority.
    Also includes the unit's total current time burden.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT * FROM rescue_emergencies
            WHERE nearest_rescue_team = ?
              AND status NOT IN ('Case Closed')
            ORDER BY
              CASE severity
                WHEN 'Critical' THEN 1
                WHEN 'High'     THEN 2
                WHEN 'Medium'   THEN 3
                ELSE 4
              END,
              submitted_at ASC
        """, (unit_label,))
        rows = [dict(r) for r in cursor.fetchall()]

        # Calculate total time burden (active only)
        cursor.execute("""
            SELECT COALESCE(SUM(response_time_minutes), 0) FROM rescue_emergencies
            WHERE nearest_rescue_team = ?
              AND status NOT IN ('Mission Completed', 'Rescue Completed', 'Case Closed')
        """, (unit_label,))
        total_burden = cursor.fetchone()[0]
        active_count = len([r for r in rows if r['status'] not in ('Mission Completed', 'Rescue Completed', 'Case Closed')])

        return jsonify({
            'unit_label': unit_label,
            'missions': rows,
            'active_count': active_count,
            'total_time_burden_minutes': total_burden
        })
    finally:
        conn.close()


@rescue_bp.route('/api/rescue/submit', methods=['POST'])
def submit_emergency():
    """
    Submit a new emergency.
    Runs AI analysis using Gemini, saves raw JSON and individual columns,
    and forces the Flask backend to handle all operational routing decisions.
    """
    data = request.json or {}
    description = (data.get('description') or '').strip()
    image_path   = data.get('image_path')   # base64 string (optional)
    lat          = data.get('lat')
    lng          = data.get('lng')
    citizen_landmark = (data.get('landmark') or '').strip()

    if not description:
        return jsonify({"error": "Emergency description is required."}), 400

    # 1. Try Gemini analysis
    gemini_raw_result = None
    try:
        from services.gemini_service import analyze_emergency_with_gemini
        gemini_raw_result = analyze_emergency_with_gemini(description, image_path)
    except Exception as gemini_err:
        print(f"[Rescue Route] Gemini execution/parsing error: {gemini_err}")
        gemini_raw_result = None

    # Fallback to rules if Gemini fails or is unconfigured
    if not gemini_raw_result or not isinstance(gemini_raw_result, dict):
        print("[Rescue Route] Falling back to rule-based classification.")
        gemini_raw_result = run_ai_analysis(description)

    # 2. Extract and Sanitize fields
    incident_type = gemini_raw_result.get('incident_type', 'General Emergency')
    severity = gemini_raw_result.get('severity', 'Medium')
    if severity not in ('Low', 'Medium', 'High', 'Critical'):
        severity = 'Medium'

    try:
        confidence = int(gemini_raw_result.get('confidence_score', 85))
    except:
        confidence = 85

    try:
        response_time = int(gemini_raw_result.get('estimated_response_time', 15))
    except:
        response_time = 15

    ai_summary = gemini_raw_result.get('ai_summary', 'AI analyzed emergency report.')
    
    # Handle list types safely for SQL storage (join by comma)
    req_depts = gemini_raw_result.get('required_departments')
    if isinstance(req_depts, list):
        depts_str = ', '.join(req_depts)
    else:
        depts_str = str(req_depts or 'Disaster Management')

    risks = gemini_raw_result.get('possible_risks')
    if isinstance(risks, list):
        risks_str = ', '.join(risks)
    else:
        risks_str = str(risks or 'Potential hazard at scene.')

    actions = gemini_raw_result.get('suggested_rescue_actions')
    if isinstance(actions, list):
        actions_str = ', '.join(actions)
    else:
        actions_str = str(actions or 'Dispatch response team.')

    # Fallback landmark from Gemini if citizen did not enter one
    ai_landmark = gemini_raw_result.get('landmark', '')
    landmark = citizen_landmark if citizen_landmark else ai_landmark

    # 3. Backend Operational Decisions: Assign team based on backend logic
    recommended_team = determine_team_from_incident(incident_type, description)
    default_nearest = get_default_nearest_team(recommended_team)

    # Serialized full Gemini response
    ai_analysis_json = json.dumps(gemini_raw_result)

    status = get_initial_status(severity)
    now = datetime.now().isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        emergency_id = generate_emergency_id(conn)

        # Smart assignment logic: least loaded for Critical, otherwise default nearest
        assigned_team_unit = default_nearest
        if severity == 'Critical':
            status = 'Team Assigned'
            assigned_team_unit = get_least_loaded_unit(cursor, recommended_team)

        cursor.execute("""
        INSERT INTO rescue_emergencies
            (emergency_id, description, image_path, lat, lng, landmark,
             incident_type, severity, recommended_team, response_time_minutes,
             confidence_score, status, submitted_at, updated_at,
             recommended_departments, nearest_rescue_team,
             ai_decision_summary, possible_risks, suggested_actions, ai_analysis_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            emergency_id, description, image_path, lat, lng, landmark,
            incident_type, severity, recommended_team, response_time,
            confidence, status, now, now,
            depts_str, assigned_team_unit,
            ai_summary, risks_str, actions_str, ai_analysis_json
        ))

        # Log the event
        event_type = 'AUTO_ASSIGN' if severity == 'Critical' else 'AI_ANALYSIS'
        action_msg = (
            f"System auto-assigned Critical emergency directly to {assigned_team_unit} based on lowest workload."
            if severity == 'Critical'
            else f"AI classified as {severity} severity {incident_type}. Status: {status}."
        )
        cursor.execute("""
        INSERT INTO rescue_audit_logs (emergency_id, event_type, action, actor, timestamp)
        VALUES (?, ?, ?, ?, ?)
        """, (emergency_id, event_type, action_msg, 'AI System', now))

        conn.commit()

        return jsonify({
            "message": "Emergency submitted successfully.",
            "emergency_id": emergency_id,
            "ai_result": {
                "incident_type": incident_type,
                "severity": severity,
                "recommended_team": recommended_team,
                "response_time_minutes": response_time,
                "confidence_score": confidence,
                "status": status
            }
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@rescue_bp.route('/api/rescue/emergencies', methods=['GET'])
def list_emergencies():
    """
    List all rescue emergencies for Control Room Dashboard.
    Supports filtering by severity and status.
    Each record includes team roster details for display.
    """
    severity_filter = request.args.get('severity')
    status_filter   = request.args.get('status')

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        query = "SELECT * FROM rescue_emergencies WHERE 1=1"
        params = []

        if severity_filter:
            query += " AND severity = ?"
            params.append(severity_filter)
        if status_filter:
            query += " AND status = ?"
            params.append(status_filter)

        query += " ORDER BY submitted_at DESC"
        cursor.execute(query, params)
        emergencies = [dict(row) for row in cursor.fetchall()]

        # Inject team roster for each emergency
        for e in emergencies:
            unit = e.get('nearest_rescue_team') or e.get('recommended_team') or ''
            roster = TEAM_ROSTER.get(unit)
            if roster:
                e['team_leader']        = roster['leader']
                e['team_driver']        = roster['driver']
                e['team_members']       = ', '.join(roster['members'])
                e['team_specialization'] = roster['specialization']
            else:
                e['team_leader']        = None
                e['team_driver']        = None
                e['team_members']       = None
                e['team_specialization'] = None

        return jsonify(emergencies)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@rescue_bp.route('/api/rescue/emergencies/<eid>', methods=['GET', 'PATCH'])
def manage_emergency(eid):
    """
    GET  – Fetch single emergency with audit trail.
    PATCH – Supervisor approve / modify / close.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM rescue_emergencies WHERE emergency_id = ?", (eid,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Emergency not found."}), 404

        if request.method == 'GET':
            emergency = dict(row)
            cursor.execute(
                "SELECT * FROM rescue_audit_logs WHERE emergency_id = ? ORDER BY timestamp DESC",
                (eid,)
            )
            emergency['audit_trail'] = [dict(r) for r in cursor.fetchall()]
            return jsonify(emergency)

        # PATCH – supervisor/team action
        data   = request.json or {}
        action = data.get('action')   # 'approve', 'close', 'modify' (optional)
        status_input = data.get('status') # Allow direct status update
        note   = data.get('note', '')
        actor  = data.get('actor', 'Supervisor')
        
        team_lat = data.get('team_lat')
        team_lng = data.get('team_lng')

        now = datetime.now().isoformat()

        # Update coordinates if provided
        if team_lat is not None and team_lng is not None:
            cursor.execute("""
            UPDATE rescue_emergencies SET team_lat = ?, team_lng = ?, updated_at = ?
            WHERE emergency_id = ?
            """, (team_lat, team_lng, now, eid))

        if not action and not status_input:
            conn.commit()
            return jsonify({
                "message": f"Emergency {eid} team GPS updated.",
                "team_lat": team_lat,
                "team_lng": team_lng
            })

        STATUS_MAP = {
            'approve': 'Team Dispatched',
            'close':   'Case Closed',
            'modify':  'Pending Supervisor Approval',
        }
        new_status = status_input or STATUS_MAP.get(action)
        if not new_status:
            return jsonify({"error": f"Unknown action: {action}"}), 400

        cursor.execute("""
        UPDATE rescue_emergencies SET status = ?, supervisor_note = ?, updated_at = ?
        WHERE emergency_id = ?
        """, (new_status, note, now, eid))

        event_label = 'SUPERVISOR_UPDATE'
        if action in ('approve', 'close', 'modify'):
            event_label = {
                'approve': 'SUPERVISOR_APPROVED',
                'close':   'CASE_CLOSED',
                'modify':  'SUPERVISOR_MODIFIED',
            }[action]

        action_description = f"Status updated to '{new_status}'"
        if action:
            action_description = f"Supervisor {action}d emergency. Note: {note or 'N/A'}"
        else:
            action_description = f"Status updated manually to '{new_status}'. Note: {note or 'N/A'}"

        cursor.execute("""
        INSERT INTO rescue_audit_logs (emergency_id, event_type, action, actor, timestamp)
        VALUES (?, ?, ?, ?, ?)
        """, (eid, event_label, action_description, actor, now))

        conn.commit()
        return jsonify({"message": f"Emergency {eid} updated to '{new_status}'.", "new_status": new_status})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()



@rescue_bp.route('/api/rescue/track/<eid>', methods=['GET'])
def track_emergency(eid):
    """
    Citizen-facing endpoint: returns emergency + status progress for the 7-step tracker.
    """
    TRACKING_STEPS = [
        'Complaint Received',
        'AI Analysis Completed',
        'Team Assigned',
        'Mission Accepted',
        'Start Journey',
        'Reached Location',
        'Rescue in Progress',
        'Mission Completed'
    ]

    STATUS_TO_STEP = {
        'Complaint Received':           0,
        'Complaint Submitted':          0,
        'AI Analysis Completed':        1,
        'AI Analysis Complete':         1,
        'Pending Supervisor Approval':  1,
        'Pending Review':               1,
        'Auto Dispatched':              2,
        'Team Assigned':                2,
        'Mission Accepted':             3,
        'Start Journey':                4,
        'Team Dispatched':              4,
        'Reached Location':             5,
        'Team Arrived':                 5,
        'Rescue in Progress':           6,
        'Mission Completed':            7,
        'Rescue Completed':             7,
        'Case Closed':                  7
    }

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM rescue_emergencies WHERE emergency_id = ?", (eid,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Emergency not found."}), 404

        emergency = dict(row)
        current_step_index = STATUS_TO_STEP.get(emergency['status'], 0)

        return jsonify({
            "emergency": emergency,
            "tracking_steps": TRACKING_STEPS,
            "current_step_index": current_step_index,
            "current_step_label": TRACKING_STEPS[current_step_index]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@rescue_bp.route('/api/rescue/transcribe', methods=['POST'])
def transcribe_speech():
    """
    Speech-to-text transcription endpoint using Deepgram.
    Expects audio file in request.files['file'].
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        from services.deepgram_service import transcribe_audio
        audio_data = file.read()
        content_type = file.content_type or 'audio/webm'
        transcript = transcribe_audio(audio_data, content_type)
        return jsonify({"transcript": transcript})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

