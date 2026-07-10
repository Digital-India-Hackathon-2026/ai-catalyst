// Global In-Memory Database and State Store

class Store {
  constructor() {
    this.officers = [];
    this.tasks = [];
    this.auditLogs = [];
    this.simulationActive = true;
    this.simulationSpeed = 3000; // milliseconds between events
    this.listeners = new Set();
    this.seedData();
  }

  // Subscribe to state changes
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.getState());
      } catch (err) {
        console.error("Error in store listener:", err);
      }
    }
  }

  getState() {
    return {
      officers: [...this.officers],
      tasks: [...this.tasks],
      auditLogs: [...this.auditLogs],
      simulationActive: this.simulationActive,
      simulationSpeed: this.simulationSpeed
    };
  }

  // --- Seed Data ---
  seedData() {
    // Seed Officers
    this.officers = [
      // Civic Module Officers (Mandal & Municipal)
      {
        id: "civic-01",
        name: "K. Rajesh Kumar",
        department: "Civic",
        role: "Mandal Revenue Officer (MRO)",
        expertise: ["land-records", "certificate-issuance", "grievances"],
        rating: 4.8,
        status: "Available",
        activeTasks: 0,
        lat: 17.3850,
        lng: 78.4867 // Hyderabad center
      },
      {
        id: "civic-02",
        name: "Ananya Sharma",
        department: "Civic",
        role: "Assistant Municipal Commissioner",
        expertise: ["sanitation", "water-supply", "encroachments"],
        rating: 4.5,
        status: "Available",
        activeTasks: 0,
        lat: 17.3980,
        lng: 78.4720
      },
      {
        id: "civic-03",
        name: "Mohammed Ali",
        department: "Civic",
        role: "Sanitation Inspector",
        expertise: ["waste-management", "sanitation", "public-hygiene"],
        rating: 4.2,
        status: "Available",
        activeTasks: 0,
        lat: 17.3610,
        lng: 78.4530
      },

      // Rescue Module Teams (NDRF & Fire Services)
      {
        id: "rescue-01",
        name: "SDRF Team A (Alpha)",
        department: "Rescue",
        role: "Disaster Response Unit",
        expertise: ["flood-rescue", "structural-collapse", "evacuation"],
        rating: 4.9,
        status: "Available",
        activeTasks: 0,
        lat: 17.4200,
        lng: 78.4300
      },
      {
        id: "rescue-02",
        name: "Secunderabad Fire Stn (Unit 1)",
        department: "Rescue",
        role: "Fire fighting & Rescue",
        expertise: ["fire-hazards", "chemical-spill", "emergency-extraction"],
        rating: 4.7,
        status: "Available",
        activeTasks: 0,
        lat: 17.4411,
        lng: 78.4983
      },

      // Medical Module Teams (Emergency Medical Response)
      {
        id: "medical-01",
        name: "108 Ambulance Unit 5",
        department: "Medical",
        role: "Paramedic Response",
        expertise: ["trauma-care", "life-support", "casualty-transport"],
        rating: 4.6,
        status: "Available",
        activeTasks: 0,
        lat: 17.3800,
        lng: 78.5200
      },
      {
        id: "medical-02",
        name: "Osmania ER Team Bravo",
        department: "Medical",
        role: "Critical Care Dispatch",
        expertise: ["triage", "cardiac-emergency", "accident-response"],
        rating: 4.9,
        status: "Available",
        activeTasks: 0,
        lat: 17.3660,
        lng: 78.4740
      }
    ];

    // Seed Completed Tasks (for analytics)
    this.tasks = [
      {
        id: "task-seed-01",
        title: "Pothole repair at Uppal Main Rd",
        type: "pothole",
        department: "Civic",
        priority: "Medium",
        status: "Completed",
        description: "Large pothole causing traffic jams near metro station.",
        officerId: "civic-02",
        assignedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 22).toISOString(),
        slaMinutes: 1440,
        location: { lat: 17.4010, lng: 78.5600 }
      },
      {
        id: "task-seed-02",
        title: "Water-logging at Khairatabad Subway",
        type: "water-logging",
        department: "Civic",
        priority: "High",
        status: "Completed",
        description: "Heavy rain causing water accumulation blocking public subway.",
        officerId: "civic-02",
        assignedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        slaMinutes: 240,
        location: { lat: 17.4120, lng: 78.4610 }
      },
      {
        id: "task-seed-03",
        title: "Short Circuit & Fire at Commercial complex",
        type: "fire",
        department: "Rescue",
        priority: "Critical",
        status: "Completed",
        description: "Transformer burst causing minor fire in cellar parking.",
        officerId: "rescue-02",
        assignedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 5.2).toISOString(),
        slaMinutes: 60,
        location: { lat: 17.4350, lng: 78.4800 }
      }
    ];

    // Seed Audit Logs
    this.auditLogs = [
      {
        id: "audit-01",
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        type: "AUTO_ASSIGN",
        taskId: "task-seed-01",
        officerId: "civic-02",
        action: "AI assigned task to Ananya Sharma",
        reason: "Highest skill match for sanitation and municipal complaint resolution.",
        user: "System (Auto)"
      },
      {
        id: "audit-02",
        timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
        type: "SUPERVISOR_OVERRIDE",
        taskId: "task-seed-03",
        officerId: "rescue-02",
        previousOfficerId: "rescue-01",
        action: "Supervisor overridden assignment to Secunderabad Fire Stn (Unit 1)",
        reason: "Active fire incident requires immediate firefighting unit instead of SDRF unit.",
        user: "Admin Supervisor (Municipal Commissioner)"
      }
    ];
  }

  // --- Actions ---
  addTask(task) {
    this.tasks.unshift(task);
    this.notify();
  }

  updateTaskStatus(taskId, status, officerId = null) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      if (status === "Completed") {
        task.completedAt = new Date().toISOString();
        // decrease officer active tasks
        const offId = officerId || task.officerId;
        const officer = this.officers.find(o => o.id === offId);
        if (officer) {
          officer.activeTasks = Math.max(0, officer.activeTasks - 1);
          if (officer.activeTasks === 0) {
            officer.status = "Available";
          }
        }
      } else if (status === "In Progress" && officerId) {
        task.officerId = officerId;
        task.assignedAt = new Date().toISOString();
        const officer = this.officers.find(o => o.id === officerId);
        if (officer) {
          officer.activeTasks += 1;
          officer.status = "Busy";
        }
      }
      this.notify();
    }
  }

  addAuditLog(log) {
    this.auditLogs.unshift({
      id: "audit-" + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      ...log
    });
    this.notify();
  }

  toggleSimulation() {
    this.simulationActive = !this.simulationActive;
    this.notify();
  }

  setSimulationSpeed(speedMs) {
    this.simulationSpeed = speedMs;
    this.notify();
  }
}

export const dbStore = new Store();
