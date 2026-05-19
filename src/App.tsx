import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';

// Layouts
import AdminLayout from '@/components/layout/AdminLayout';

// Pages
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ClientsPage from '@/pages/ClientsPage';
import ClientDetailPage from '@/pages/ClientDetailPage';
import JobsPage from '@/pages/JobsPage';
import JobDetailPage from '@/pages/JobDetailPage';
import NewJobPage from '@/pages/NewJobPage';
import AuditLogPage from '@/pages/AuditLogPage';
import SettingsPage from '@/pages/SettingsPage';

// Client Portal
import ClientPortalPage from '@/pages/ClientPortalPage';
import ClientJobViewPage from '@/pages/ClientJobViewPage';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  console.log('AdminRoute:', { isLoading, isAuthenticated, role: user?.role });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('Redirecting: not authenticated');
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'ADMIN') {
    console.log('Redirecting: not admin');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Client Portal - Default Landing */}
      <Route path="/" element={<ClientPortalPage />} />
      <Route path="/portal" element={<Navigate to="/" replace />} />
      <Route path="/job/:jobId" element={<ClientJobViewPage />} />
      
      {/* Admin Login */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* Admin Routes - Protected */}
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <AdminLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/:id" element={<ClientDetailPage />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/jobs/new" element={<NewJobPage />} />
                <Route path="/jobs/:id" element={<JobDetailPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </AdminLayout>
          </AdminRoute>
        }
      />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
