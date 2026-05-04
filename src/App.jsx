import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginScreen from './pages/LoginScreen';
import HomePage from './pages/HomePage';
import PatientView from './pages/PatientView';
import CareManagerView from './pages/CareManagerView';
import HealthcareProviderView from './pages/HealthcareProviderView';
import { clearSession } from './services/auth';
import './index.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('p360_token'));

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    const role = localStorage.getItem('p360_role') || '';
    const refId = localStorage.getItem('p360_ref_id') || '';

    if (role === 'PATIENT') {
      window.location.href = `/patient-view?id=${refId}`;
    } else if (role === 'PROVIDER') {
      window.location.href = `/healthcare-provider?id=${refId}`;
    } else if (role === 'CARE_MANAGER') {
      window.location.href = `/care-manager?id=${refId}`;
    } else {
      window.location.href = `/?id=${refId}`;
    }
  };

  const handleLogout = () => {
    clearSession();
    setIsLoggedIn(false);
    window.location.href = '/';
  };

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage onLogout={handleLogout} />} />
        <Route path="/patient-view" element={<PatientView onLogout={handleLogout} />} />
        <Route path="/care-manager" element={<CareManagerView onLogout={handleLogout} />} />
        <Route path="/healthcare-provider" element={<HealthcareProviderView onLogout={handleLogout} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
