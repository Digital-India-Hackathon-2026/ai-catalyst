from flask import Blueprint, jsonify

medical_bp = Blueprint('medical', __name__)

@medical_bp.route('/api/medical', methods=['GET'])
def get_medical_status():
    """Returns placeholder JSON for Medical module status in Phase 1."""
    return jsonify({
        "status": "Module Ready",
        "message": "Phase 1 Completed",
        "department": "Medical Emergency & EMS Routing",
        "categories": [
            "Accident & Trauma Response",
            "Cardiac Emergency Dispatch",
            "Critical ICU Patient Transfers",
            "Hospital Bed Availability Tracking"
        ],
        "features_planned": [
            "108 Ambulance smart routing engine",
            "Real-time ER bed triage dashboard",
            "First responder vital stats synchronization"
        ]
    })
