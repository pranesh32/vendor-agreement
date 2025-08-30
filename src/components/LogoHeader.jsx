import React from 'react';
import logo from '../assets/logo.png'; 

const LogoHeader = () => (
  <div style={{ textAlign: 'center', margin: '20px 0' }}>
    <img src={logo} alt="Company Logo" style={{ height: '60px' }} />
  </div>
);

export default LogoHeader;
