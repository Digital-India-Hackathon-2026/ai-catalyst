// Explainable AI (XAI) Explanation Generator

/**
 * Generates confidence scores and detailed explanations for recommended assignments.
 * @param {Object} recommendation The recommendation object returned by the recommender.
 * @param {Object} task The task details.
 * @returns {Object} An object containing confidence, summaries, positives, and concerns.
 */
export function generateExplanation(recommendation, task) {
  const { officer, score, distance, breakdown } = recommendation;
  const confidence = Math.round(score * 100);

  const positives = [];
  const concerns = [];

  // 1. Analyze Expertise Match
  if (breakdown.expertise >= 0.8) {
    positives.push(`Excellent skill match. Expertise in [${officer.expertise.join(", ")}] aligns directly with the requirements for a '${task.type}' incident.`);
  } else if (breakdown.expertise >= 0.4) {
    positives.push(`Partial skill match. The officer has relevant expertise, though some custom domain handling may be needed.`);
  } else {
    concerns.push(`Low expertise match. This type of task is outside of the officer's primary specialties.`);
  }

  // 2. Analyze Workload
  if (officer.activeTasks === 0) {
    positives.push(`Optimal workload. Officer is currently free and can commit 100% bandwidth immediately.`);
  } else if (officer.activeTasks === 1) {
    positives.push(`Low workload. Officer has only 1 active task, ensuring quick transition.`);
  } else {
    concerns.push(`High workload. Officer is currently managing ${officer.activeTasks} active tasks, which could lead to SLA delays.`);
  }

  // 3. Analyze Distance / Proximity
  if (distance < 3) {
    positives.push(`High proximity. Officer is located very close (${distance} km away), ensuring rapid response time.`);
  } else if (distance < 8) {
    positives.push(`Moderate proximity. Located ${distance} km away, travel time is estimated at under 15 minutes.`);
  } else if (distance !== 999) {
    concerns.push(`High travel distance. Officer is located ${distance} km away, which may delay arrival.`);
  }

  // 4. Analyze Rating
  if (officer.rating >= 4.7) {
    positives.push(`Exceptional performance history. Ranked highly with a ${officer.rating}/5.0 satisfaction rating.`);
  }

  // Generate a human-readable summary
  let summary = `${officer.name} is recommended with a confidence score of ${confidence}%. `;
  if (officer.activeTasks === 0 && distance < 3) {
    summary += `They are currently free, highly skilled, and located nearby.`;
  } else if (officer.activeTasks > 1) {
    summary += `They have the highest expertise match, though currently managing multiple tasks.`;
  } else {
    summary += `They offer the best overall balance of distance, rating, and availability for this task.`;
  }

  return {
    officerId: officer.id,
    officerName: officer.name,
    confidence,
    summary,
    positives,
    concerns
  };
}
