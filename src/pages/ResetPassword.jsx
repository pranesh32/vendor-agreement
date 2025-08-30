import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import LogoHeader from '../components/LogoHeader';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handleReset = async () => {
    setMsg('');
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg('📩 Reset link sent! Check your inbox.');
    } catch (error) {
      console.error(error);
      setError('❌ Failed to send reset email. Please check the email or try again.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f9f9f9',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '40px',
          borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <LogoHeader />
        <h2 style={{ marginBottom: 20, textAlign: 'center' }}>🔐 Reset Password</h2>
        <input
          type="email"
          placeholder="Enter your admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 15px',
            marginBottom: '15px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            fontSize: '14px',
          }}
        />

        <button
          onClick={handleReset}
          style={{
            width: '100%',
            padding: '12px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          Send Reset Link
        </button>

        {msg && (
          <p style={{ marginTop: 15, color: 'green', fontSize: '14px' }}>{msg}</p>
        )}
        {error && (
          <p style={{ marginTop: 15, color: 'red', fontSize: '14px' }}>{error}</p>
        )}

        <p style={{ marginTop: 20, fontSize: 13, color: '#888', textAlign: 'center' }}>
          Back to <a href="/">Login</a>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;