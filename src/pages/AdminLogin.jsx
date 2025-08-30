import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import LogoHeader from '../components/LogoHeader';
import '../styles/main.css';
const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMsg('✅ Login successful.');
      setTimeout(() => navigate('/admin'), 1000);
    } catch (err) {
      setMsg('❌ Login failed: ' + err.message);
    }
  };

  return (
    <div className="auth-container">
        <div className="auth-card">
      <LogoHeader />
      <h2>Admin Login</h2>
      <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Log In</button>
      <p>{msg}</p>
      <p>New here? <a href="/signup">Sign up</a></p>
      <p style={{ marginTop: 10 }}>
  <a href="/reset-password">Forgot Password?</a>
</p>
      </div>
    </div>
  );
};

export default AdminLogin;
