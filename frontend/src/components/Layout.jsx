import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FiHome,
  FiUpload,
  FiZap,
  FiClock,
  FiCpu,
  FiBarChart2,
  FiUser,
  FiSettings,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import Navbar from "./Navbar";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: FiHome },
  { path: "/upload", label: "Upload Data", icon: FiUpload },
  { path: "/predict", label: "Predict", icon: FiZap },
  { path: "/history", label: "History", icon: FiClock },
  { path: "/model-history", label: "Model History", icon: FiCpu },
  { path: "/reports", label: "Reports", icon: FiBarChart2 },
  { path: "/profile", label: "Profile", icon: FiUser },
  { path: "/settings", label: "Settings", icon: FiSettings },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen transition-all duration-300 flex flex-col
          ${sidebarOpen ? "w-64" : "w-20"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          bg-gray-900/80 backdrop-blur-xl border-r border-white/10`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/5">
          {sidebarOpen && (
            <span className="text-lg font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              ChurnAI
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {sidebarOpen ? <FiChevronLeft className="w-5 h-5" /> : <FiChevronRight className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${active
                    ? "bg-blue-500/15 text-blue-400 shadow-lg shadow-blue-500/5"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                  } ${!sidebarOpen ? "justify-center" : ""}`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <Navbar onToggleSidebar={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 p-4 lg:p-6 bg-gradient-mesh">{children}</main>
      </div>
    </div>
  );
}
