import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import PitchHud from './components/PitchHud';
import Overview from './pages/Overview';
import Connect from './pages/Connect';
import Discover from './pages/Discover';
import PassportPage from './pages/PassportPage';
import Approve from './pages/Approve';
import AuditTrail from './pages/AuditTrail';

function AppLayout() {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
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
        </Routes>
        {/* Presenter Pitch HUD with Talking Points for Competitions & Recorded Demos */}
        <PitchHud currentPath={location.pathname} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
