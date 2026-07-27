'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import {
  LayoutDashboard,
  DollarSign,
  AlertCircle,
  Bell,
  LogOut,
  Menu,
  X,
  FileText,
} from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/student/dashboard' },
  { icon: DollarSign, label: 'Bills', href: '/student/bills' },
  { icon: AlertCircle, label: 'Complaints', href: '/student/complaints' },
  { icon: FileText, label: 'Documents', href: '/student/documents' },
  { icon: Bell, label: 'Announcements', href: '/student/announcements' },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { signOut } = useAuth();

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
              className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <item.icon size={20} />
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-secondary/20 p-4">
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
        {children}
      </div>
    </div>
  );
}
