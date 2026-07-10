# GovConnect AI Decision Matching Engine (AssignIQ Python stub)

class RecommenderEngine:
    def __init__(self):
        # Weighting factors for allocation
        self.weights = {
            'expertise': 0.35,
            'workload': 0.30,
            'distance': 0.20,
            'rating': 0.15
        }

    def compute_recommendations(self, task, officers):
        """
        Calculates recommendation scores for a task against a list of officers.
        Each score is a float between 0.0 and 1.0.
        """
        recommendations = []
        for officer in officers:
            if officer.get('department') != task.get('department'):
                continue
                
            # Placeholder weights scoring
            exp_score = 1.0 if any(tag in officer.get('expertise', []) for tag in task.get('tags', [])) else 0.5
            work_score = 1.0 / (1.0 + officer.get('active_tasks', 0))
            dist_score = 0.9  # Simulated high proximity
            rating_score = officer.get('rating', 5.0) / 5.0
            
            final_score = (
                exp_score * self.weights['expertise'] +
                work_score * self.weights['workload'] +
                dist_score * self.weights['distance'] +
                rating_score * self.weights['rating']
            )
            
            recommendations.append({
                'officer_id': officer.get('id'),
                'officer_name': officer.get('name'),
                'score': round(final_score, 3),
                'distance_km': 2.4,
                'explanation': f"Recommended based on expertise match and low workload ({officer.get('active_tasks')} active tasks)."
            })
            
        # Sort by score descending
        return sorted(recommendations, key=lambda x: x['score'], reverse=True)
