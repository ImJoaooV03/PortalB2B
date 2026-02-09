import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import StoreLayout from '../layouts/StoreLayout';

export default function Layout() {
  const { isClient } = useAuth();

  // Route logic: Clients get the Store Layout, Admins/Sellers get the Dashboard Layout
  if (isClient) {
    return <StoreLayout />;
  }

  return <DashboardLayout />;
}
