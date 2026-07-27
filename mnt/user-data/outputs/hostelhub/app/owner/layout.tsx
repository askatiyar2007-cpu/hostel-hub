'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import {
  LayoutDashboard, 
  Building2, 
  Users, 
  DollarSign,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  Zap,
  MessageSquare
} from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/owner/dashboard' },
  { icon: Building2, label: 'Hostels', href: '/owner/hostels' },
  { icon: Home, label: 'Rooms', href: '/owner/rooms' },
  { icon: Users, label: 'Students', href: '/owner/students' },
  { icon: Users, label: 'Parents', href: '/owner/parents' },
  { icon: DollarSign, label: 'Billing', href: '/owner/billing' },
  { icon: Zap, label: 'Electricity', href: '/owner/electricity' },
  { icon: MessageSquare, label: 'Complaints', href: '/owner/complaints' },
  { icon: FileText, label: 'Announcements', href: '/owner/announcements' },
  { icon: Settings, label: 'Settings', href: '/owner/settings' },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { signOut, profile } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 bg-secondary text-white transition-all duration-300 z-40 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } border-r border-secondary/20`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-secondary/20">
          {sidebarOpen && <h1 className="font-display font-bold text-xl">HostelHub</h1>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-secondary/80 rounded-lg"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-secondary/80 transition-colors group"
            >
              <item.icon size={20} />
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Profile & Logout */}
        <div className="border-t border-secondary/20 p-4 space-y-2">
          {sidebarOpen && (
            <div className="px-4 py-3 bg-secondary/50 rounded-lg">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs text-secondary-foreground/70 truncate">{profile?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-secondary/80 transition-colors text-red-400"
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 overflow-auto transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Top Bar */}
        <div className="bg-card border-b border-border sticky top-0 z-30">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-display font-bold">Owner Dashboard</h2>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground">Hostel Owner</p>
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
