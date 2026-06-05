import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DailyReview from './pages/DailyReview';
import Needs from './pages/Needs';
import Timeline from './pages/Timeline';
import GoodMoments from './pages/GoodMoments';
import MediaCenter from './pages/MediaCenter';
import StorageManager from './pages/StorageManager';
import Profile from './pages/Profile';
import Counseling from './pages/Counseling';
import MoodTracker from './pages/MoodTracker';
import Pomodoro from './pages/Pomodoro';
import Community from './pages/Community';
import Garden from './pages/Garden';
import SOS from './pages/SOS';
import Login from './pages/Login';

function AppRoutes() {
  const { user } = useApp();
  if (!user) return <Login />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/needs" element={<Needs />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/daily-review" element={<DailyReview />} />
        <Route path="/good-moments" element={<GoodMoments />} />
        <Route path="/memories" element={<MediaCenter />} />
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
