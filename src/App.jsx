import { Routes, Route } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin';
import AdminSignup from './pages/SignUp';
import AdminDashboard from './pages/AdminDashboard';
import VendorSignPage from './pages/VendorSignPage';
import ResetPassword from './pages/ResetPassword'

function App() {
  return (
    <Routes>
      <Route path="/" element={<AdminLogin />} />
      <Route path="/signup" element={<AdminSignup />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/sign/:id" element={<VendorSignPage />} />
      <Route path="/reset-password" element={<ResetPassword />} />
    </Routes>
  );
}

export default App;


