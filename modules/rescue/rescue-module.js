// Disaster Response & Rescue Department Module

import { BaseModule } from "../base-module.js";

export class RescueModule extends BaseModule {
  constructor() {
    super("Rescue", {
      autoAssign: true, // Urgent responses auto-dispatch if threshold is met
      autoAssignThreshold: 0.80
    });
  }

  formatTaskData(data) {
    const base = super.formatTaskData(data);
    
    // Auto-tag based on common rescue scenarios
    const tags = new Set(base.tags);
    if (base.title.toLowerCase().includes("fire")) tags.add("fire-hazards");
    if (base.title.toLowerCase().includes("flood") || base.title.toLowerCase().includes("water")) tags.add("flood-rescue");
    if (base.title.toLowerCase().includes("collapse") || base.title.toLowerCase().includes("building")) tags.add("structural-collapse");
    
    base.tags = Array.from(tags);

    // Emergency rescue incidents always have a strict SLA
    base.priority = "Critical"; 
    base.slaMinutes = 30; // 30 minutes SLA for emergencies

    return base;
  }
}
