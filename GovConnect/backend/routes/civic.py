from flask import Blueprint, jsonify

civic_bp = Blueprint('civic', __name__)

@civic_bp.route('/api/civic', methods=['GET'])
def get_civic_status():
    """Returns placeholder JSON for Civic module status in Phase 1."""
    return jsonify({
        "status": "Module Ready",
        "message": "Phase 1 Completed",
        "department": "Civic Issues & Municipal Management",
        "categories": [
            "Sanitation & Garbage Disposal",
            "Water Supply Grievances",
            "Road Repairs & Potholes",
            "Mandal Certificate Issuance"
        ],
        "features_planned": [
            "Autonomous Workload Balancing",
            "Explainable Officer Allocation",
            "Citizen Grievance Tracking Portal"
        ]
    })
