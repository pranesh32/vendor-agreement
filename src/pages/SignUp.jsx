import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import LogoHeader from '../components/LogoHeader';

const AdminSignup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const handleSignup = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setMsg('✅ Signup successful. Redirecting...');
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err) {
      setMsg('❌ Signup failed: ' + err.message);
    }
  };

  return (
    <div className="auth-container">
      <LogoHeader />
      <h2>Admin Signup</h2>
      <input type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
      <button onClick={handleSignup}>Sign Up</button>
      <p>{msg}</p>
      <p>Already have an account? <a href="/">Login</a></p>
    </div>
  );
};

export default AdminSignup;
