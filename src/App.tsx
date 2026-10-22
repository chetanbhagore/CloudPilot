import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DemoProvider } from './context/DemoContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Overview from './pages/Overview';
import Connect from './pages/Connect';
import Discover from './pages/Discover';
import PassportPage from './pages/PassportPage';
import Approve from './pages/Approve';
import AuditTrail from './pages/AuditTrail';
import Settings from './pages/Settings';
import Login from './pages/Login';

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="layout-main">
        <Navbar />
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/passport" element={<PassportPage />} />
          <Route path="/approve" element={<Approve />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DemoProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </DemoProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
