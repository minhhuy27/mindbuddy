import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import './Profile.css';

const METRIC_LABELS = {
  stress: 'Stress',
  energy: 'Năng lượng',
  sleep: 'Giấc ngủ',
  focus: 'Tập trung',
};

const GOAL_ICON_OPTIONS = [
  '🌿', '🌙', '🍅', '🎯', '🧘', '💪', '📚', '✍️',
  '☀️', '🌱', '💧', '🎧', '🚶', '🏃', '🛌', '🧠',
  '❤️', '✨', '🔥', '🧭', '🪴', '🍵', '🫶', '🏆',
];

function cleanNote(note = '') {
  return note.replace(/\s*\[.+\]$/, '').trim();
}

function extractCauses(note = '') {
  return note.match(/\[(.+)\]$/)?.[1]?.split(', ').filter(Boolean) || [];
}

function metricValue(metrics, id) {
  const value = Number(metrics?.[id]);
  return Number.isFinite(value) ? Math.min(5, Math.max(1, value)) : null;
}

function average(values) {
  const valid = values.filter(value => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'yyyy-MM-dd');
}

function getTimeBucket(value) {
  const date = new Date(value);
  const hour = Number.isNaN(date.getTime()) ? 12 : date.getHours();
  if (hour >= 5 && hour < 12) return 'Sáng';
  if (hour >= 12 && hour < 18) return 'Chiều';
  return 'Tối';
}

export default function Profile() {
  const {
    user, moodLogs, MOODS, customMoods, userGoal, setUserGoal,
    goalOptions, currentGoal, saveGoalOptions,
    getStreak, pomodoroCount, gardenLevel, earnedBadges, BADGES,
    importDataFromUid, reloadUserData, inspectCurrentUserData, getCurrentUserRawData, recoverMoodLogsFromReviews,
  } = useApp();
  const [goalEditorOpen, setGoalEditorOpen] = React.useState(false);
  const [editingGoalId, setEditingGoalId] = React.useState('');
  const [goalDraft, setGoalDraft] = React.useState({ icon: '🎯', label: '', desc: '' });
  const [goalError, setGoalError] = React.useState('');
  const [restoreUid, setRestoreUid] = React.useState('');
  const [restoreStatus, setRestoreStatus] = React.useState(null);
  const [restoreLoading, setRestoreLoading] = React.useState(false);
  const [firestoreCheck, setFirestoreCheck] = React.useState(null);
  const [firestoreLoading, setFirestoreLoading] = React.useState(false);
  const [exportingRaw, setExportingRaw] = React.useState(false);
  const [recoveringReviews, setRecoveringReviews] = React.useState(false);

  const allMoods = React.useMemo(
    () => [...MOODS, ...(customMoods || [])],
    [MOODS, customMoods]
  );

  const enrichedLogs = React.useMemo(() => (
    moodLogs.map(log => {
      const mood = allMoods.find(item => item.id === log.mood);
      return {
        ...log,
        mood,
        moodScore: mood?.score || 3,
        noteText: cleanNote(log.note || ''),
        causes: extractCauses(log.note || ''),
      };
    })
  ), [allMoods, moodLogs]);

  const uniqueDays = React.useMemo(() => (
    new Set(enrichedLogs.map(log => dateKey(log.date)).filter(Boolean))
  ), [enrichedLogs]);

  const metricAverages = React.useMemo(() => {
    return Object.keys(METRIC_LABELS).reduce((acc, key) => {
      acc[key] = average(enrichedLogs.map(log => metricValue(log.metrics, key)));
      return acc;
    }, {});
  }, [enrichedLogs]);

  const moodAverage = React.useMemo(() => average(enrichedLogs.map(log => log.moodScore)), [enrichedLogs]);

  const causeStats = React.useMemo(() => {
    const map = new Map();
    enrichedLogs.forEach(log => {
      log.causes.forEach(cause => {
        const current = map.get(cause) || {
          cause,
          count: 0,
          moodTotal: 0,
          stressValues: [],
          positiveCount: 0,
        };
        current.count += 1;
        current.moodTotal += log.moodScore;
        const stress = metricValue(log.metrics, 'stress');
        if (stress !== null) current.stressValues.push(stress);
        if (log.moodScore >= 4) current.positiveCount += 1;
        map.set(cause, current);
      });
    });

    return Array.from(map.values())
      .map(item => ({
        ...item,
        avgMood: item.moodTotal / item.count,
        avgStress: average(item.stressValues),
      }))
      .sort((a, b) => b.count - a.count || b.avgMood - a.avgMood);
  }, [enrichedLogs]);

  const stabilizers = React.useMemo(() => {
    const positiveCauses = causeStats
      .filter(item => item.count >= 1 && (item.avgMood >= 3.5 || item.positiveCount > 0))
      .sort((a, b) => b.avgMood - a.avgMood || b.positiveCount - a.positiveCount)
      .slice(0, 3)
      .map(item => ({
        title: item.cause,
        detail: `${item.count} lần, mood TB ${item.avgMood.toFixed(1)}/5${item.avgStress ? `, stress TB ${item.avgStress.toFixed(1)}/5` : ''}`,
      }));

    const bucketMap = new Map();
    enrichedLogs.forEach(log => {
      const bucket = getTimeBucket(log.date);
      const current = bucketMap.get(bucket) || { bucket, count: 0, focus: [], energy: [], mood: [] };
      current.count += 1;
      const focus = metricValue(log.metrics, 'focus');
      const energy = metricValue(log.metrics, 'energy');
      if (focus !== null) current.focus.push(focus);
      if (energy !== null) current.energy.push(energy);
      current.mood.push(log.moodScore);
      bucketMap.set(bucket, current);
    });

    const bestBucket = Array.from(bucketMap.values())
      .map(item => ({
        ...item,
        focusAvg: average(item.focus),
        energyAvg: average(item.energy),
        moodAvg: average(item.mood),
      }))
      .filter(item => item.count >= 1)
      .sort((a, b) => (
        ((b.focusAvg || 0) + (b.energyAvg || 0) + (b.moodAvg || 0)) -
        ((a.focusAvg || 0) + (a.energyAvg || 0) + (a.moodAvg || 0))
      ))[0];

    const results = [...positiveCauses];
    if (bestBucket) {
      results.push({
        title: `Khung ${bestBucket.bucket.toLowerCase()}`,
        detail: `Thường ổn hơn ở ${bestBucket.bucket.toLowerCase()}: focus ${bestBucket.focusAvg?.toFixed(1) || '-'}/5, năng lượng ${bestBucket.energyAvg?.toFixed(1) || '-'}/5.`,
      });
    }

    const positiveNote = enrichedLogs.find(log => log.moodScore >= 4 && log.noteText);
    if (positiveNote) {
      results.push({
        title: 'Ghi nhận điều tốt',
        detail: `Gần đây: “${positiveNote.noteText.slice(0, 92)}${positiveNote.noteText.length > 92 ? '...' : ''}”`,
      });
    }

    return results.slice(0, 5);
  }, [causeStats, enrichedLogs]);

  const recentLogs = enrichedLogs.slice(0, 5);
  const activeGoals = goalOptions || [];
  const streak = getStreak(moodLogs);
  const earnedBadgeItems = BADGES.filter(badge => earnedBadges?.includes(badge.id));
  const firstLog = [...enrichedLogs].sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const firstLogLabel = firstLog ? format(new Date(firstLog.date), 'dd/MM/yyyy', { locale: vi }) : 'Chưa có';
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Bạn';

  const resetGoalDraft = () => {
    setEditingGoalId('');
    setGoalDraft({ icon: '🎯', label: '', desc: '' });
    setGoalError('');
  };

  const startEditGoal = (goal) => {
    setGoalEditorOpen(true);
    setEditingGoalId(goal.id);
    setGoalDraft({
      icon: goal.icon || '🎯',
      label: goal.label || '',
      desc: goal.desc || '',
    });
    setGoalError('');
  };

  const saveGoalDraft = async () => {
    const label = goalDraft.label.trim();
    const desc = goalDraft.desc.trim();
    const icon = goalDraft.icon.trim() || '🎯';
    if (!label) {
      setGoalError('Hãy nhập tên mục tiêu.');
      return;
    }
    if (!desc) {
      setGoalError('Hãy nhập mô tả ngắn cho mục tiêu.');
      return;
    }

    const nextGoal = {
      id: editingGoalId || `goal_${Date.now()}`,
      icon,
      label,
      desc,
    };
    const nextGoals = editingGoalId
      ? activeGoals.map(goal => goal.id === editingGoalId ? nextGoal : goal)
      : [...activeGoals, nextGoal];
    await saveGoalOptions(nextGoals);
    resetGoalDraft();
  };

  const deleteGoal = async (goal) => {
    if (activeGoals.length <= 1) {
      setGoalError('Cần giữ lại ít nhất một mục tiêu.');
      return;
    }
    const confirmed = window.confirm(`Xóa mục tiêu "${goal.label}"?`);
    if (!confirmed) return;
    const nextGoals = activeGoals.filter(item => item.id !== goal.id);
    await saveGoalOptions(nextGoals);
    if (editingGoalId === goal.id) resetGoalDraft();
  };

  const restoreFromUid = async () => {
    setRestoreStatus(null);
    setRestoreLoading(true);
    try {
      const result = await importDataFromUid(restoreUid);
      setRestoreStatus({
        type: 'success',
        message: `Đã gộp dữ liệu từ ${result.sourceUid}. Hiện có ${result.moodLogs} ghi chú cảm xúc trong tài khoản này.`,
      });
      setRestoreUid('');
    } catch (err) {
      setRestoreStatus({
        type: 'error',
        message: err.message || 'Không thể khôi phục dữ liệu từ UID này.',
      });
    } finally {
      setRestoreLoading(false);
    }
  };

  const refreshFromFirestore = async () => {
    setFirestoreLoading(true);
    setFirestoreCheck(null);
    try {
      await reloadUserData();
      setFirestoreCheck({
        type: 'success',
        message: 'Đã tải lại dữ liệu trực tiếp từ Firestore.',
      });
    } catch (err) {
      setFirestoreCheck({
        type: 'error',
        message: err.message || 'Không thể tải lại dữ liệu từ Firestore.',
      });
    } finally {
      setFirestoreLoading(false);
    }
  };

  const checkFirestoreDocument = async () => {
    setFirestoreLoading(true);
    setFirestoreCheck(null);
    try {
      const result = await inspectCurrentUserData();
      if (!result.exists) {
        setFirestoreCheck({
          type: 'error',
          message: `Không tìm thấy document users/${result.uid}.`,
        });
        return;
      }
      setFirestoreCheck({
        type: 'success',
        message: `Firestore đọc được document hiện tại: moodLogs ${result.counts.moodLogs}, aiMemory ${result.counts.aiMemory}, customMoods ${result.counts.customMoods}, dailyReviews ${result.counts.dailyReviews}.`,
        fields: result.fields,
      });
    } catch (err) {
      setFirestoreCheck({
        type: 'error',
        message: err.message || 'Không thể kiểm tra document Firestore.',
      });
    } finally {
      setFirestoreLoading(false);
    }
  };

  const downloadRawFirestore = async () => {
    setExportingRaw(true);
    setFirestoreCheck(null);
    try {
      const payload = await getCurrentUserRawData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mindbuddy-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setFirestoreCheck({
        type: 'success',
        message: 'Đã tải toàn bộ document Firestore hiện tại thành file JSON.',
      });
    } catch (err) {
      setFirestoreCheck({
        type: 'error',
        message: err.message || 'Không thể tải dữ liệu Firestore.',
      });
    } finally {
      setExportingRaw(false);
    }
  };

  const rebuildMoodLogsFromReviews = async () => {
    const confirmed = window.confirm(
      'MindBuddy sẽ dựng lại nhật ký từ dữ liệu Nhìn lại ngày còn trong Firestore và gộp vào moodLogs hiện tại. Tiếp tục?'
    );
    if (!confirmed) return;
    setRecoveringReviews(true);
    setFirestoreCheck(null);
    try {
      const result = await recoverMoodLogsFromReviews();
      setFirestoreCheck({
        type: 'success',
        message: `Đã dựng lại ${result.recovered} entry (${result.fromReviews} từ dailyReviews, ${result.fromMemory} từ aiMemory). moodLogs hiện có ${result.total} ghi chú.`,
      });
    } catch (err) {
      setFirestoreCheck({
        type: 'error',
        message: err.message || 'Không thể dựng lại nhật ký từ dailyReviews.',
      });
    } finally {
      setRecoveringReviews(false);
    }
  };

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div>
          <span className="profile-kicker">Hồ sơ cá nhân</span>
          <h1>{displayName}</h1>
          <p>
            Một nơi nhìn nhanh mình đang theo dõi điều gì, điều gì lặp lại nhiều,
            và những dấu hiệu đang giúp mình ổn hơn theo dữ liệu nhật ký.
          </p>
        </div>
        <div className="profile-hero-stats">
          <div>
            <strong>{uniqueDays.size}</strong>
            <span>ngày đã ghi</span>
          </div>
          <div>
            <strong>{streak}</strong>
            <span>ngày streak</span>
          </div>
          <div>
            <strong>{moodAverage ? moodAverage.toFixed(1) : '-'}/5</strong>
            <span>mood TB</span>
          </div>
        </div>
      </section>

      <section className="card profile-restore-card">
        <div className="profile-card-head">
          <div>
            <span>Khôi phục dữ liệu Firestore</span>
            <h2>Đối chiếu UID tài khoản</h2>
          </div>
        </div>
        <p>
          App đang đọc document <code>users/{user?.uid}</code>. Nếu dữ liệu cũ nằm ở một document UID khác,
          hãy nhập UID cũ tại đây để gộp dữ liệu về tài khoản hiện tại.
        </p>
        <div className="profile-restore-form">
          <input
            value={restoreUid}
            onChange={e => setRestoreUid(e.target.value)}
            placeholder="Dán UID cũ từ Firestore, ví dụ OEWALV6Ov..."
            spellCheck={false}
          />
          <button type="button" onClick={restoreFromUid} disabled={restoreLoading || !restoreUid.trim()}>
            {restoreLoading ? 'Đang gộp...' : 'Gộp dữ liệu'}
          </button>
        </div>
        {restoreStatus && (
          <p className={`profile-restore-status ${restoreStatus.type}`} role="status">
            {restoreStatus.message}
          </p>
        )}
        <div className="profile-restore-actions">
          <button type="button" onClick={checkFirestoreDocument} disabled={firestoreLoading}>
            {firestoreLoading ? 'Đang kiểm tra...' : 'Kiểm tra document hiện tại'}
          </button>
          <button type="button" onClick={refreshFromFirestore} disabled={firestoreLoading}>
            Tải lại từ Firestore
          </button>
          <button type="button" onClick={downloadRawFirestore} disabled={exportingRaw}>
            {exportingRaw ? 'Đang tải JSON...' : 'Tải JSON Firestore'}
          </button>
          <button type="button" onClick={rebuildMoodLogsFromReviews} disabled={recoveringReviews}>
            {recoveringReviews ? 'Đang dựng lại...' : 'Dựng lại từ dữ liệu còn lại'}
          </button>
        </div>
        {firestoreCheck && (
          <div className={`profile-restore-status ${firestoreCheck.type}`} role="status">
            <p>{firestoreCheck.message}</p>
            {firestoreCheck.fields?.length > 0 && (
              <details>
                <summary>Field app đọc được</summary>
                <ul>
                  {firestoreCheck.fields.map(field => (
                    <li key={field.key}>
                      <code>{field.key}</code> <span>{field.type}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="profile-grid">
        <div className="card profile-goal-card">
          <div className="profile-card-head">
            <div>
              <span>Mục tiêu hiện tại</span>
              <h2>{currentGoal.icon} {currentGoal.label}</h2>
            </div>
            <button
              type="button"
              className="profile-head-action"
              onClick={() => {
                setGoalEditorOpen(open => !open);
                if (goalEditorOpen) resetGoalDraft();
              }}
            >
              {goalEditorOpen ? 'Đóng' : 'Quản lý'}
            </button>
          </div>
          <p>{currentGoal.desc}</p>
          <div className="profile-goal-options">
            {activeGoals.map(goal => (
              <div key={goal.id} className={`profile-goal-item ${userGoal === goal.id ? 'active' : ''}`}>
                <button
                  type="button"
                  className="profile-goal-select"
                  onClick={() => setUserGoal(goal.id)}
                  aria-pressed={userGoal === goal.id}
                >
                  <strong>{goal.icon} {goal.label}</strong>
                  <small>{goal.desc}</small>
                </button>
                {goalEditorOpen && (
                  <div className="profile-goal-actions">
                    <button type="button" onClick={() => startEditGoal(goal)}>Sửa</button>
                    <button type="button" onClick={() => deleteGoal(goal)}>Xóa</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {goalEditorOpen && (
            <div className="profile-goal-editor">
              <div className="profile-goal-editor-grid">
                <label>
                  <span>Icon</span>
                  <input
                    value={goalDraft.icon}
                    onChange={e => setGoalDraft(prev => ({ ...prev, icon: e.target.value }))}
                    maxLength={4}
                  />
                </label>
                <label>
                  <span>Tên mục tiêu</span>
                  <input
                    value={goalDraft.label}
                    onChange={e => setGoalDraft(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Ví dụ: Vận động đều hơn"
                    maxLength={42}
                  />
                </label>
              </div>
              <div className="profile-goal-icon-picker" aria-label="Chọn icon mục tiêu">
                {GOAL_ICON_OPTIONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    className={goalDraft.icon === icon ? 'active' : ''}
                    onClick={() => setGoalDraft(prev => ({ ...prev, icon }))}
                    aria-label={`Chọn icon ${icon}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <label>
                <span>Mô tả</span>
                <textarea
                  value={goalDraft.desc}
                  onChange={e => setGoalDraft(prev => ({ ...prev, desc: e.target.value }))}
                  placeholder="MindBuddy sẽ ưu tiên insight và lời khuyên theo mục tiêu này."
                  rows={3}
                  maxLength={150}
                />
              </label>
              {goalError && <p className="profile-goal-error" role="alert">{goalError}</p>}
              <div className="profile-goal-editor-actions">
                <button type="button" className="btn btn-primary" onClick={saveGoalDraft}>
                  {editingGoalId ? 'Lưu thay đổi' : 'Thêm mục tiêu'}
                </button>
                {editingGoalId && (
                  <button type="button" className="btn btn-secondary" onClick={resetGoalDraft}>
                    Hủy sửa
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card profile-progress-card">
          <div className="profile-card-head">
            <div>
              <span>Tiến trình</span>
              <h2>Nhịp chăm sóc</h2>
            </div>
            <Link to="/garden">Vườn</Link>
          </div>
          <div className="profile-progress-list">
            <div>
              <span>Vườn</span>
              <strong>{gardenLevel}%</strong>
              <i><b style={{ width: `${Math.min(100, gardenLevel)}%` }} /></i>
            </div>
            <div>
              <span>Pomodoro</span>
              <strong>{pomodoroCount}</strong>
              <i><b style={{ width: `${Math.min(100, pomodoroCount * 10)}%` }} /></i>
            </div>
            <div>
              <span>Huy hiệu</span>
              <strong>{earnedBadgeItems.length}/{BADGES.length}</strong>
              <i><b style={{ width: `${Math.min(100, (earnedBadgeItems.length / Math.max(1, BADGES.length)) * 100)}%` }} /></i>
            </div>
          </div>
          <p className="profile-muted">Bắt đầu ghi từ {firstLogLabel}.</p>
        </div>
      </section>

      <section className="profile-grid metrics">
        <div className="card profile-metrics-card">
          <div className="profile-card-head">
            <div>
              <span>Chỉ số trung bình</span>
              <h2>Cơ thể và tập trung</h2>
            </div>
            <Link to="/mood?tab=history">Lịch sử</Link>
          </div>
          <div className="profile-metric-grid">
            {Object.entries(METRIC_LABELS).map(([key, label]) => {
              const value = metricAverages[key];
              const width = value ? (value / 5) * 100 : 0;
              return (
                <div key={key} className={`profile-metric ${key}`}>
                  <span>{label}</span>
                  <strong>{value ? value.toFixed(1) : '-'}/5</strong>
                  <i><b style={{ width: `${width}%` }} /></i>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card profile-causes-card">
          <div className="profile-card-head">
            <div>
              <span>Nguyên nhân hay gặp</span>
              <h2>Mẫu lặp lại</h2>
            </div>
            <Link to="/mood">Ghi thêm</Link>
          </div>
          {causeStats.length ? (
            <div className="profile-cause-list">
              {causeStats.slice(0, 6).map(item => (
                <div key={item.cause}>
                  <strong>{item.cause}</strong>
                  <span>{item.count} lần</span>
                  <i><b style={{ width: `${Math.min(100, (item.count / Math.max(1, causeStats[0].count)) * 100)}%` }} /></i>
                  <small>Mood TB {item.avgMood.toFixed(1)}/5{item.avgStress ? ` · Stress TB ${item.avgStress.toFixed(1)}/5` : ''}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="profile-empty">Chưa có đủ nguyên nhân. Khi check-in, chọn vài tag để hồ sơ tự rõ hơn.</p>
          )}
        </div>
      </section>

      <section className="profile-grid lower">
        <div className="card profile-stabilizers-card">
          <div className="profile-card-head">
            <div>
              <span>Những điều giúp mình ổn hơn</span>
              <h2>Dấu hiệu đáng giữ</h2>
            </div>
            <Link to="/good-moments">Điều tốt</Link>
          </div>
          {stabilizers.length ? (
            <div className="profile-stabilizer-list">
              {stabilizers.map(item => (
                <div key={`${item.title}-${item.detail}`}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="profile-empty">Ghi thêm vài ngày nữa, MindBuddy sẽ tự rút ra điều gì thường giúp bạn ổn hơn.</p>
          )}
        </div>

        <div className="card profile-recent-card">
          <div className="profile-card-head">
            <div>
              <span>Gần đây</span>
              <h2>5 check-in mới nhất</h2>
            </div>
            <Link to="/mood?tab=history">Mở lịch sử</Link>
          </div>
          {recentLogs.length ? (
            <div className="profile-recent-list">
              {recentLogs.map(log => (
                <div key={log.id || log.date}>
                  <time>{format(new Date(log.date), 'dd/MM HH:mm', { locale: vi })}</time>
                  <strong>{log.mood?.emoji} {log.mood?.label || 'Không rõ'}</strong>
                  <p>{log.noteText || 'Không có ghi chú.'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="profile-empty">Chưa có check-in nào.</p>
          )}
        </div>
      </section>
    </div>
  );
}
