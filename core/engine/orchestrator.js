// Core Workflow Orchestrator for GovConnect

import { dbStore } from "../db/store.js";
import { getRecommendations } from "./recommender.js";
import { generateExplanation } from "./explanations.js";

class Orchestrator {
  constructor() {
    this.modules = new Map();
  }

  /**
   * Registers a specific government department module.
   * @param {String} name Module name (e.g. 'Civic', 'Rescue')
   * @param {BaseModule} moduleInstance Subclass of BaseModule
   */
  registerModule(name, moduleInstance) {
    this.modules.set(name.toLowerCase(), moduleInstance);
    console.log(`Module Registered: ${name}`);
  }

  /**
   * Processes a newly created task, computes recommendations, and saves it.
   * @param {Object} taskData Parameters for the task
   */
  processNewTask(taskData) {
    const task = {
      id: "task-" + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      status: "Pending Assignment",
      ...taskData
    };

    // Calculate recommendations
    const officers = dbStore.getState().officers;
    const recommendations = getRecommendations(task, officers);

    // Attach recommendation options
    task.recommendations = recommendations.map(rec => ({
      officerId: rec.officer.id,
      officerName: rec.officer.name,
      score: rec.score,
      distance: rec.distance,
      explanation: generateExplanation(rec, task)
    }));

    // Add to DB store
    dbStore.addTask(task);

    // If auto-assign is enabled on the module and confidence is high, do auto-assignment
    const module = this.modules.get(task.department.toLowerCase());
    const autoAssignEnabled = module ? module.config.autoAssign : false;
    const autoAssignThreshold = module ? module.config.autoAssignThreshold : 0.85;

    if (autoAssignEnabled && task.recommendations.length > 0) {
      const topRec = task.recommendations[0];
      if (topRec.score >= autoAssignThreshold) {
        this.confirmAssignment(task.id, topRec.officerId, true);
        return;
      }
    }

    // Otherwise, generate audit log for pending recommendation
    dbStore.addAuditLog({
      type: "RECOMMENDATION_GENERATED",
      taskId: task.id,
      action: `AI recommended assignments generated for '${task.title}'`,
      reason: task.recommendations.length > 0 
        ? `Top recommendation: ${task.recommendations[0].officerName} with ${Math.round(task.recommendations[0].score * 100)}% confidence.`
        : "No suitable officers found.",
      user: "System (Auto)"
    });
  }

  /**
   * Confirms the recommended assignment.
   */
  confirmAssignment(taskId, officerId, isAuto = false) {
    const task = dbStore.getState().tasks.find(t => t.id === taskId);
    if (!task) return;

    dbStore.updateTaskStatus(taskId, "In Progress", officerId);

    dbStore.addAuditLog({
      type: isAuto ? "AUTO_ASSIGN" : "MANUAL_CONFIRM",
      taskId: taskId,
      officerId: officerId,
      action: isAuto 
        ? `System auto-assigned task to ${task.recommendations.find(r => r.officerId === officerId)?.officerName}`
        : `Supervisor approved assignment to ${task.recommendations.find(r => r.officerId === officerId)?.officerName}`,
      reason: isAuto 
        ? "Confidence score exceeds auto-assign threshold."
        : "Supervisor confirmed AI recommendation.",
      user: isAuto ? "System (Auto)" : "Supervisor"
    });
  }

  /**
   * Overrides the recommended assignment with a supervisor selected officer.
   */
  overrideAssignment(taskId, officerId, reason) {
    const task = dbStore.getState().tasks.find(t => t.id === taskId);
    if (!task) return;

    const previousOfficerId = task.officerId;
    const selectedOfficer = dbStore.getState().officers.find(o => o.id === officerId);
    
    dbStore.updateTaskStatus(taskId, "In Progress", officerId);

    dbStore.addAuditLog({
      type: "SUPERVISOR_OVERRIDE",
      taskId: taskId,
      officerId: officerId,
      previousOfficerId: previousOfficerId,
      action: `Supervisor overrode assignment to ${selectedOfficer?.name}`,
      reason: reason || "No override reason provided.",
      user: "Supervisor"
    });
  }

  /**
   * Marks a task as resolved/completed.
   */
  completeTask(taskId) {
    dbStore.updateTaskStatus(taskId, "Completed");

    dbStore.addAuditLog({
      type: "TASK_RESOLVED",
      taskId: taskId,
      action: `Task marked as Completed`,
      reason: `Officer completed work and closed the request.`,
      user: "Officer"
    });
  }
}

export const orchestrator = new Orchestrator();
