import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DemoProvider } from './context/DemoContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Lazy loading route components for code splitting & fast initial paint
const Overview = lazy(() => import('./pages/Overview'));
const Connect = lazy(() => import('./pages/Connect'));
const Discover = lazy(() => import('./pages/Discover'));
const DeployCenter = lazy(() => import('./pages/DeployCenter'));
const PassportPage = lazy(() => import('./pages/PassportPage'));
const Approve = lazy(() => import('./pages/Approve'));
const AuditTrail = lazy(() => import('./pages/AuditTrail'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Contact = lazy(() => import('./pages/Contact'));

function PageLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 14,
        color: 'var(--text-tertiary)',
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: '3px solid rgba(0, 113, 227, 0.15)',
          borderTopColor: 'var(--apple-blue)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span>Loading Cloud Environment...</span>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const isPublicRoute = ['/privacy', '/contact'].includes(location.pathname);

  if (!isAuthenticated && !isPublicRoute && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="layout-main">
        <Navbar />
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/deploy" element={<DeployCenter />} />
            <Route path="/passport" element={<PassportPage />} />
            <Route path="/approve" element={<Approve />} />
            <Route path="/audit" element={<AuditTrail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/contact" element={<Contact />} />

            {/* ── 301 / Client Redirect Aliases ── */}
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/deployments" element={<Navigate to="/deploy" replace />} />
            <Route path="/passports" element={<Navigate to="/passport" replace />} />
            <Route path="/audit-trail" element={<Navigate to="/audit" replace />} />
            <Route path="/remediation" element={<Navigate to="/approve" replace />} />
            <Route path="/support" element={<Navigate to="/contact" replace />} />

            {/* ── Custom 404 Route ── */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DemoProvider>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={<ProtectedLayout />} />
            </Routes>
          </Suspense>
        </DemoProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
