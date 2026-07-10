// Base Module Interface for GovConnect Departments

import { orchestrator } from "../core/engine/orchestrator.js";

export class BaseModule {
  /**
   * @param {String} name Department name
   * @param {Object} config Custom configuration parameters
   */
  constructor(name, config = {}) {
    this.name = name;
    this.config = {
      autoAssign: false,
      autoAssignThreshold: 0.85,
      ...config
    };
    
    // Auto register this module with the core orchestrator
    orchestrator.registerModule(this.name, this);
  }

  /**
   * Dispatches a request payload through the core orchestrator.
   * Can be overridden by subclasses to validate or enrich data.
   * @param {Object} data The input request data
   */
  submitRequest(data) {
    const formattedTask = this.formatTaskData(data);
    
    // Forward to orchestrator
    orchestrator.processNewTask(formattedTask);
  }

  /**
   * Standardizes the incoming payload to match GovConnect's internal task schema.
   * Subclasses should override this to specify their custom fields and mappings.
   */
  formatTaskData(data) {
    return {
      title: data.title || `${this.name} Request`,
      type: data.type || "general",
      department: this.name,
      priority: data.priority || "Medium",
      description: data.description || "",
      slaMinutes: data.slaMinutes || 720, // default 12 hours
      location: data.location || { lat: 17.3850, lng: 78.4867 },
      tags: data.tags || []
    };
  }
}
