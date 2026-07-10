from flask import Blueprint, jsonify

rescue_bp = Blueprint('rescue', __name__)

@rescue_bp.route('/api/rescue', methods=['GET'])
def get_rescue_status():
    """Returns placeholder JSON for Rescue module status in Phase 1."""
    return jsonify({
        "status": "Module Ready",
        "message": "Phase 1 Completed",
        "department": "Rescue & Disaster Emergency Services",
        "categories": [
            "Fire Response & Containment",
            "Flood Rescue Operations",
            "Structural Collapse Incidents",
            "Emergency Evacuations"
        ],
        "features_planned": [
            "Auto-dispatch of SDRF/NDRF assets",
            "Real-time geographic threat mapping",
            "Resource tracking and availability monitoring"
        ]
    })
