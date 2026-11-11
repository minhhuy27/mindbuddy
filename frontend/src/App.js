import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DailyReview from './pages/DailyReview';
import Needs from './pages/Needs';
import Timeline from './pages/Timeline';
import StorageManager from './pages/StorageManager';
import Profile from './pages/Profile';
import Counseling from './pages/Counseling';
import MoodTracker from './pages/MoodTracker';
import Pomodoro from './pages/Pomodoro';
import Community from './pages/Community';
import Garden from './pages/Garden';
import SOS from './pages/SOS';
import Login from './pages/Login';
import './App.css';

function JournalSyncState() {
  return (
    <section className="journal-sync-state" role="status" aria-live="polite" aria-busy="true">
      <div className="journal-sync-banner">
        <span className="journal-sync-icon" aria-hidden="true">🧠</span>
        <div>
          <span className="journal-sync-kicker">Firestore</span>
          <h1>Đang tải nhật ký…</h1>
          <p>MindBuddy đang đồng bộ check-in, Timeline và các chỉ số của bạn.</p>
        </div>
      </div>

      <div className="journal-sync-grid" aria-hidden="true">
        <div className="journal-sync-card journal-sync-card-main">
          <span className="journal-sync-line short" />
          <span className="journal-sync-line title" />
          <span className="journal-sync-line" />
          <span className="journal-sync-line medium" />
          <div className="journal-sync-options">
            <span /><span /><span /><span /><span />
          </div>
        </div>
        <div className="journal-sync-card journal-sync-card-side">
          <span className="journal-sync-square" />
          <span className="journal-sync-line title" />
          <span className="journal-sync-line" />
          <span className="journal-sync-line medium" />
        </div>
        <div className="journal-sync-card journal-sync-card-wide">
          <span className="journal-sync-line short" />
          <span className="journal-sync-line" />
          <span className="journal-sync-line medium" />
        </div>
      </div>
    </section>
  );
}

function DailyReviewDetailRoute() {
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return <Navigate to="/timeline?view=review" replace />;
  }
  return <DailyReview />;
}

function AppRoutes() {
  const { user, dataReady } = useApp();
  if (!user) return <Login />;
  return (
    <Layout>
      {dataReady ? (
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/needs" element={<Needs />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/daily-review" element={<DailyReviewDetailRoute />} />
          <Route path="/good-moments" element={<Navigate to="/timeline?view=positive" replace />} />
          <Route path="/memories" element={<Navigate to="/timeline?view=media" replace />} />
          <Route path="/storage" element={<StorageManager />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/counseling" element={<Counseling />} />
          <Route path="/mood" element={<MoodTracker />} />
          <Route path="/pomodoro" element={<Pomodoro />} />
          <Route path="/community" element={<Community />} />
          <Route path="/garden" element={<Garden />} />
          <Route path="/sos" element={<SOS />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      ) : <JournalSyncState />}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
