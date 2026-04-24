import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import OrderLanding from './pages/OrderLanding';
import OrderConfirmation from './pages/OrderConfirmation';
import PaymentProofUpload from './pages/PaymentProofUpload';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminOrders from './pages/AdminOrders';
import AdminOrderDetail from './pages/AdminOrderDetail';

import AdminCampaigns from './pages/AdminCampaigns';
import AdminCampaignSettings from './pages/AdminCampaignSettings';
import AdminProducts from './pages/AdminProducts';
import AdminPackageConfigs from './pages/AdminPackageConfigs';
import AdminUsers from './pages/AdminUsers';
import AdminSettings from './pages/AdminSettings';
import AdminAuditLogs from './pages/AdminAuditLogs';

// Route guard component
function AdminRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const token = localStorage.getItem('admin_token');
  const storedUser = localStorage.getItem('admin_user');
  const user = storedUser ? JSON.parse(storedUser) : null;

  if (!token) {
    return <Navigate to="/admin" replace />;
  }

  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    // Redirect based on role
    if (user.role === 'supplier') {
      return <Navigate to="/admin/products" replace />;
    }
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<OrderLanding />} />
        <Route path="/campaign/:scenarioKey" element={<OrderLanding />} />
        <Route path="/order/success" element={<OrderConfirmation />} />
        <Route path="/payment-proof/:orderNum" element={<PaymentProofUpload />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}>
            <AdminDashboard />
          </AdminRoute>
        } />
        <Route path="/admin/orders" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}>
            <AdminOrders />
          </AdminRoute>
        } />
        <Route path="/admin/orders/:id" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}>
            <AdminOrderDetail />
          </AdminRoute>
        } />
        <Route path="/admin/products" element={
          <AdminRoute allowedRoles={['super_admin', 'admin', 'supplier']}>
            <AdminProducts />
          </AdminRoute>
        } />
        <Route path="/admin/package-configs" element={
          <AdminRoute allowedRoles={['super_admin', 'admin']}>
            <AdminPackageConfigs />
          </AdminRoute>
        } />
        <Route path="/admin/campaigns" element={
          <AdminRoute allowedRoles={['super_admin']}>
            <AdminCampaigns />
          </AdminRoute>
        } />
        <Route path="/admin/campaigns/:scenarioKey/settings" element={
          <AdminRoute allowedRoles={['super_admin']}>
            <AdminCampaignSettings />
          </AdminRoute>
        } />
        <Route path="/admin/users" element={
          <AdminRoute allowedRoles={['super_admin']}>
            <AdminUsers />
          </AdminRoute>
        } />
        <Route path="/admin/settings" element={
          <AdminRoute allowedRoles={['super_admin']}>
            <AdminSettings />
          </AdminRoute>
        } />
        <Route path="/admin/audit-logs" element={
          <AdminRoute allowedRoles={['super_admin']}>
            <AdminAuditLogs />
          </AdminRoute>
        } />

      </Routes>
    </Router>
  );
}

export default App;
