import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Truck,
  Building2,
  Users,
  BarChart3,
  BookOpen,
  Moon,
  Sun,
  LogOut,
  ArrowRightLeft,
  FileText,
  Settings,
  Wallet
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { RibbonTab } from '../../types/pharmacy';

export const TopRibbon: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    logout,
    settings,
    toggleDarkMode,
  } = usePharmacy();

  const navItems: { id: RibbonTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sale', label: 'Sale', icon: ShoppingCart },
    { id: 'stock', label: 'Stock', icon: Boxes },
    { id: 'adjustments', label: 'Qty Adjustments', icon: ArrowRightLeft },
    { id: 'purchase', label: 'Purchase', icon: Truck },
    { id: 'supplier', label: 'Supplier', icon: Building2 },
    { id: 'customer', label: 'Customer', icon: Users },
    { id: 'finance', label: 'Finance', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'scientifics', label: 'Scientifics', icon: BookOpen },
    { id: 'logs', label: 'Logs', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const userInitials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'PH';

  return (
    <header className="sticky top-0 z-40 w-full flex flex-col shrink-0 select-none shadow-xs">
      {/* High-Density Primary Navigation Bar (Teal-700) */}
      <nav className="bg-teal-700 text-white px-2 sm:px-4 py-2 flex min-w-0 items-center gap-2 shadow-xs border-b border-teal-800">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-5">
          {/* Logo & Brand Identity */}
          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex shrink-0 items-center cursor-pointer font-bold text-base tracking-tight hover:opacity-95 transition-opacity sm:text-lg"
          >
            <svg
              className="w-5 h-5 mr-2 text-teal-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19.423 15.441c.067.12.115.255.14.397.013.067.02.135.02.203 0 .552-.448 1-1 1h-11c-.552 0-1-.448-1-1 0-.068.007-.136.02-.203.025-.142.073-.277.14-.397.054-.097.12-.187.195-.268L10.586 12l-3.763-3.173a1.002 1.002 0 01-.195-.268c-.067-.12-.115-.255-.14-.397a1.001 1.001 0 01.98-1.162h11c.552 0 1 .448 1 1 0 .068-.007.136-.02.203-.025.142-.073.277-.14.397a1.002 1.002 0 01-.195.268L13.414 12l3.763 3.173a1.002 1.002 0 01.195.268z"
              />
            </svg>
            <span className="hidden font-extrabold tracking-wide sm:inline">PHARMA-LBN</span>
            <span className="font-extrabold tracking-wide sm:hidden">PHARMA</span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-teal-800 text-white font-bold shadow-2xs'
                      : 'hover:bg-teal-600 text-teal-100 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Status Actions & Profile */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="rounded p-1.5 text-teal-100 hover:bg-teal-600 hover:text-white transition-colors"
            title={settings.darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {settings.darkMode ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* User Profile Badge */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-teal-600">
              <span className="hidden text-xs font-medium text-teal-100 md:inline">{currentUser.name.split(' ')[0]}</span>
              <div
                className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center text-xs font-bold text-white shadow-2xs uppercase"
                title={`${currentUser.name} (${currentUser.role})`}
              >
                {userInitials}
              </div>
              <button
                onClick={logout}
                className="rounded p-1 text-teal-200 hover:bg-teal-600 hover:text-red-200 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};
