from flask import Blueprint, request, jsonify
from db import get_db_connection
from datetime import datetime
import re
import random

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
    Rule-based AI engine to classify rescue emergencies.
    Returns incident_type, severity, recommended_team, response_time_minutes, confidence_score, recommended_departments, nearest_rescue_team.
    """
    text = description.lower()
    
    for rule in RESCUE_RULES:
        for keyword in rule['keywords']:
            if keyword in text:
                return {
                    'incident_type': rule['incident_type'],
                    'severity': rule['severity'],
                    'recommended_team': rule['team'],
                    'response_time_minutes': rule['eta'],
                    'confidence_score': rule['confidence'],
                    'recommended_departments': rule['departments'],
                    'nearest_rescue_team': rule['nearest_team']
                }
    
    # Default fallback
    return {
        'incident_type': 'General Emergency',
        'severity': 'Low',
        'recommended_team': 'General Rescue Team',
        'response_time_minutes': 45,
        'confidence_score': 70,
        'recommended_departments': 'Municipal Services',
        'nearest_rescue_team': 'Local Patrol Squad'
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
        "version": "1.0.0",
        "phase": "Phase 1 - MVP",
        "status": "Online",
        "endpoints": [
            "POST /api/rescue/submit",
            "GET  /api/rescue/emergencies",
            "GET  /api/rescue/emergencies/<id>",
            "PATCH /api/rescue/emergencies/<id>",
            "GET  /api/rescue/track/<emergency_id>"
        ]
    })


@rescue_bp.route('/api/rescue/submit', methods=['POST'])
def submit_emergency():
    """
    Submit a new emergency.
    Runs AI analysis, applies decision policy, stores result.
    """
    data = request.json or {}
    description = (data.get('description') or '').strip()
    image_path   = data.get('image_path')   # base64 string (optional)
    lat          = data.get('lat')
    lng          = data.get('lng')
    landmark     = (data.get('landmark') or '').strip()

    if not description:
        return jsonify({"error": "Emergency description is required."}), 400

    # Run AI Analysis
    ai = run_ai_analysis(description)
    status = get_initial_status(ai['severity'])
    now = datetime.now().isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        emergency_id = generate_emergency_id(conn)

        cursor.execute("""
        INSERT INTO rescue_emergencies
            (emergency_id, description, image_path, lat, lng, landmark,
             incident_type, severity, recommended_team, response_time_minutes,
             confidence_score, status, submitted_at, updated_at,
             recommended_departments, nearest_rescue_team)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            emergency_id, description, image_path, lat, lng, landmark,
            ai['incident_type'], ai['severity'], ai['recommended_team'],
            ai['response_time_minutes'], ai['confidence_score'],
            status, now, now,
            ai['recommended_departments'], ai['nearest_rescue_team']
        ))

        # Log the event
        event_type = 'AUTO_DISPATCH' if ai['severity'] == 'Critical' else 'AI_ANALYSIS'
        action_msg = (
            f"System auto-dispatched {ai['recommended_team']} due to Critical severity."
            if ai['severity'] == 'Critical'
            else f"AI classified as {ai['severity']} severity {ai['incident_type']}. Status: {status}."
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
                "incident_type": ai['incident_type'],
                "severity": ai['severity'],
                "recommended_team": ai['recommended_team'],
                "response_time_minutes": ai['response_time_minutes'],
                "confidence_score": ai['confidence_score'],
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

        # PATCH – supervisor action
        data   = request.json or {}
        action = data.get('action')   # 'approve', 'close', 'modify' (optional)
        status_input = data.get('status') # Allow direct status update
        note   = data.get('note', '')
        actor  = data.get('actor', 'Supervisor')

        if not action and not status_input:
            return jsonify({"error": "action or status is required."}), 400

        now = datetime.now().isoformat()

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
