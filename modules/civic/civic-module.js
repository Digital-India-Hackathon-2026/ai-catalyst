// Civic/Municipal Department Module

import { BaseModule } from "../base-module.js";

export class CivicModule extends BaseModule {
  constructor() {
    super("Civic", {
      autoAssign: false, // Municipal issues are review-first by default
      autoAssignThreshold: 0.90
    });
  }

  // Override task formatting to extract civic-specific tags
  formatTaskData(data) {
    const base = super.formatTaskData(data);
    
    // Auto-tag based on common civic problem keywords
    const tags = new Set(base.tags);
    if (base.title.toLowerCase().includes("water")) tags.add("water-supply");
    if (base.title.toLowerCase().includes("garbage") || base.title.toLowerCase().includes("sanitation")) tags.add("sanitation");
    if (base.title.toLowerCase().includes("road") || base.title.toLowerCase().includes("pothole")) tags.add("infrastructure");
    if (base.title.toLowerCase().includes("certificate") || base.title.toLowerCase().includes("document")) tags.add("certificate-issuance");
    
    base.tags = Array.from(tags);
    
    // Add custom urgency multiplier to SLA if it is a major public issue
    if (base.priority === "High") {
      base.slaMinutes = 240; // 4 hours
    } else if (base.priority === "Critical") {
      base.slaMinutes = 60; // 1 hour
    } else {
      base.slaMinutes = 1440; // 24 hours
    }

    return base;
  }
}
