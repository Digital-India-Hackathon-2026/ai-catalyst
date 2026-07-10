// Medical & Emergency Response Department Module

import { BaseModule } from "../base-module.js";

export class MedicalModule extends BaseModule {
  constructor() {
    super("Medical", {
      autoAssign: true, // Dispatch nearest ambulance immediately
      autoAssignThreshold: 0.75
    });
  }

  formatTaskData(data) {
    const base = super.formatTaskData(data);
    
    // Auto-tag based on medical issue
    const tags = new Set(base.tags);
    if (base.title.toLowerCase().includes("cardiac") || base.title.toLowerCase().includes("heart")) tags.add("cardiac-emergency");
    if (base.title.toLowerCase().includes("accident") || base.title.toLowerCase().includes("trauma")) tags.add("accident-response");
    if (base.title.toLowerCase().includes("stroke") || base.title.toLowerCase().includes("icu")) tags.add("trauma-care");
    
    base.tags = Array.from(tags);

    // Medical emergency SLA parameters
    base.priority = data.priority || "High";
    base.slaMinutes = base.priority === "Critical" ? 15 : 45; // Extremely tight timelines

    return base;
  }
}
