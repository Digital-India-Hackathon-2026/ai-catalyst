// Multi-Criteria Decision Recommender Engine

/**
 * Calculates the Haversine distance between two coordinates in kilometers.
 */
function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

/**
 * Recommends officers for a given task.
 * @param {Object} task The task to assign.
 * @param {Array} officers List of candidate officers.
 * @returns {Array} List of officers with recommendation scores, sorted descending.
 */
export function getRecommendations(task, officers) {
  // Filter officers by department
  const deptOfficers = officers.filter(
    o => o.department.toLowerCase() === task.department.toLowerCase()
  );

  if (deptOfficers.length === 0) return [];

  // Default weights
  const weights = {
    expertise: 0.35,
    workload: 0.30,
    distance: 0.20,
    rating: 0.15
  };

  const results = deptOfficers.map(officer => {
    // 1. Expertise Match
    // Check if task type or description keywords match officer expertise tags
    let expertiseScore = 0;
    const taskTags = [task.type, ...(task.tags || [])];
    const matches = officer.expertise.filter(exp => 
      taskTags.some(tag => tag && tag.toLowerCase().includes(exp.toLowerCase())) ||
      (task.title && task.title.toLowerCase().includes(exp.toLowerCase())) ||
      (task.description && task.description.toLowerCase().includes(exp.toLowerCase()))
    );
    if (officer.expertise.length > 0) {
      expertiseScore = matches.length / Math.min(officer.expertise.length, 3);
      if (expertiseScore > 1) expertiseScore = 1;
    }

    // 2. Workload Score (Lower workload = higher score)
    // 0 active tasks = 1.0, 1 active task = 0.5, 2 active tasks = 0.33, etc.
    const workloadScore = 1 / (1 + (officer.activeTasks || 0));

    // 3. Proximity Score (Closer = higher score)
    let dist = 999;
    let distanceScore = 0;
    if (task.location && officer.lat && officer.lng) {
      dist = getDistance(task.location.lat, task.location.lng, officer.lat, officer.lng);
      // Scale: 0 km = 1.0, 5 km = 0.5, 20 km = 0.2, etc.
      distanceScore = 1 / (1 + dist / 5);
    }

    // 4. Rating Score
    const ratingScore = (officer.rating || 0) / 5;

    // Calculate final weighted score
    const score =
      expertiseScore * weights.expertise +
      workloadScore * weights.workload +
      distanceScore * weights.distance +
      ratingScore * weights.rating;

    return {
      officer,
      score: parseFloat(score.toFixed(3)),
      distance: parseFloat(dist.toFixed(2)),
      breakdown: {
        expertise: parseFloat(expertiseScore.toFixed(2)),
        workload: parseFloat(workloadScore.toFixed(2)),
        distance: parseFloat(distanceScore.toFixed(2)),
        rating: parseFloat(ratingScore.toFixed(2))
      }
    };
  });

  // Sort descending by score
  return results.sort((a, b) => b.score - a.score);
}
