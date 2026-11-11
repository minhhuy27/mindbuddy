import React from 'react';
import { MoodLineChart } from './WeeklyMoodChart';

export default function GoalProgress({ last7, allMoods, hasMoodLogs, activeGoals, userGoal, setUserGoal }) {
  return (
    <section className="dashboard-focus-grid secondary-dashboard-grid dashboard-custom-block">
      <MoodLineChart last7={last7} allMoods={allMoods} hasMoodLogs={hasMoodLogs} />

      <div className="card goal-widget">
        <div className="section-heading-row">
          <div>
            <h3>Mục tiêu cá nhân</h3>
            <p className="text-muted">MindBuddy sẽ ưu tiên insight và lời khuyên theo mục tiêu này.</p>
          </div>
        </div>
        <div className="goal-options">
          {activeGoals.map(goal => (
            <button
              key={goal.id}
              className={`goal-option ${userGoal === goal.id ? 'active' : ''}`}
              onClick={() => setUserGoal(goal.id)}
              aria-pressed={userGoal === goal.id}
            >
              <strong>{goal.label}</strong>
              <span>{goal.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
