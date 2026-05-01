import React, { useState } from 'react';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import './Login.css';

export default function Login() {
  const [mode, setMode] = useState('login'); // login | register
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'Email đã được sử dụng.',
        'auth/invalid-email': 'Email không hợp lệ.',
        'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự.',
        'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
      };
      setError(msgs[err.code] || 'Đã có lỗi xảy ra. Thử lại.');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🧠</div>
        <h1>MindBuddy</h1>
        <p className="login-slogan">"Cùng bạn vượt qua áp lực, kiến tạo tương lai."</p>

        <div className="mode-switch">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>
            Đăng nhập
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>
            Đăng ký
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'register' && (
            <div className="field">
              <label>Tên của bạn</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Tên hoặc biệt danh..." required />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com" required />
          </div>
          <div className="field">
            <label>Mật khẩu</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Ít nhất 6 ký tự" required />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" style={{ marginTop: 16, padding: 12 }} disabled={loading}>
            {loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập 🚀' : 'Tạo tài khoản ✨'}
          </button>
        </form>
      </div>
    </div>
  );
}
