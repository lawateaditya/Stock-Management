import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { UserProvider } from '@/context/UserContext';
import LoginPage from '@/pages/LoginPage';
import AuthCallback from '@/pages/AuthCallback';
import Dashboard from '@/pages/Dashboard';
import ItemMaster from '@/pages/ItemMaster';
import SupplierMaster from '@/pages/SupplierMaster';
import InwardPage from '@/pages/InwardPage';
import IssuePage from '@/pages/IssuePage';
import StockPage from '@/pages/StockPage';
import UsersPage from '@/pages/UsersPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import '@/App.css';

function AppRouter() {
  const location = useLocation();
  
  // Check URL fragment for session_id synchronously
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/items" element={<ProtectedRoute><ItemMaster /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><SupplierMaster /></ProtectedRoute>} />
      <Route path="/inward" element={<ProtectedRoute allowedRoles={['super_admin', 'inward_user']}><InwardPage /></ProtectedRoute>} />
      <Route path="/issue" element={<ProtectedRoute allowedRoles={['super_admin', 'issuer_user']}><IssuePage /></ProtectedRoute>} />
      <Route path="/stock" element={<ProtectedRoute allowedRoles={['super_admin']}><StockPage /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><UsersPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <UserProvider>
          <AppRouter />
          <Toaster position="top-right" />
        </UserProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;