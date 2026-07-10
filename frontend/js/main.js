// GovConnect Main Frontend Script

const API_BASE_URL = "http://127.0.0.1:5000";

/**
 * Helper to fetch data from the Flask API.
 * Gracefully handles offline fallback in case the server isn't running.
 * @param {String} endpoint The endpoint path (e.g. '/api/civic')
 * @returns {Promise<Object>} The JSON response
 */
export async function fetchFromAPI(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`API call to ${endpoint} failed. Using offline mockup fallback.`, error);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Fallback data structure mimicking Flask blueprints
    const type = endpoint.split('/').pop();
    return {
      status: "Module Ready (Offline Fallback)",
      message: "Phase 1 Completed",
      department: getDeptName(type),
      categories: getMockCategories(type),
      features_planned: [
        "Interactive analytics map & routing visualization",
        "Autonomous workload balancing algorithm",
        "Explainable AI justifications panel"
      ],
      offline: true
    };
  }
}

function getDeptName(type) {
  if (type === 'civic') return "Civic Issues & Municipal Management";
  if (type === 'rescue') return "Rescue & Disaster Emergency Services";
  if (type === 'medical') return "Medical Emergency & EMS Routing";
  return "Government Service Module";
}

function getMockCategories(type) {
  if (type === 'civic') return [
    "Sanitation & Garbage Disposal",
    "Water Supply Grievances",
    "Road Repairs & Potholes",
    "Mandal Certificate Issuance"
  ];
  if (type === 'rescue') return [
    "Fire Response & Containment",
    "Flood Rescue Operations",
    "Structural Collapse Incidents",
    "Emergency Evacuations"
  ];
  if (type === 'medical') return [
    "Accident & Trauma Response",
    "Cardiac Emergency Dispatch",
    "Critical ICU Patient Transfers",
    "Hospital Bed Availability Tracking"
  ];
  return ["General Request Allocation"];
}
