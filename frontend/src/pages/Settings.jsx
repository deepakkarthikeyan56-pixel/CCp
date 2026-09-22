import React, { useState } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import api from "../utils/api";
import {
  FiSun,
  FiMoon,
  FiBell,
  FiMail,
  FiZap,
  FiCpu,
  FiLock,
  FiTrash2,
  FiDownload,
  FiLink,
  FiCheck,
  FiX,
  FiInfo,
  FiDatabase,
  FiAlertTriangle,
} from "react-icons/fi";

export default function Settings() {
  const { logout } = useAuth();

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });
  const [primaryColor, setPrimaryColor] = useState(
    localStorage.getItem("primaryColor") || "#6366F1"
  );

  const [notifications, setNotifications] = useState({
    email: true,
    predictions: true,
    modelTraining: false,
  });

  const [passwords, setPasswords] = useState({
    current: "",
    newPassword: "",
    confirm: "",
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [clearing, setClearing] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const COLORS = [
    { name: "Indigo", value: "#6366F1" },
    { name: "Blue", value: "#2563EB" },
    { name: "Purple", value: "#8B5CF6" },
    { name: "Cyan", value: "#06B6D4" },
    { name: "Emerald", value: "#10B981" },
    { name: "Rose", value: "#F43F5E" },
  ];

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    toast.success(`Switched to ${newTheme} mode`);
  };

  const handleColorChange = (color) => {
    setPrimaryColor(color);
    localStorage.setItem("primaryColor", color);
    toast.success("Primary color updated");
  };

  const handleNotificationToggle = (key) => {
    setNotifications((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      toast.success(
        `${key.replace(/([A-Z])/g, " $1").trim()} ${
          updated[key] ? "enabled" : "disabled"
        }`
      );
      return updated;
    });
  };

  const handlePasswordChange = async () => {
    if (!passwords.current || !passwords.newPassword || !passwords.confirm) {
      toast.error("All password fields are required");
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (passwords.newPassword !== passwords.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      await api.put("/profile", { password: passwords.newPassword, current_password: passwords.current });
      setPasswords({ current: "", newPassword: "", confirm: "" });
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to change password");
    }
  };

  const handleClearData = async (type) => {
    setClearing(type);
    try {
      if (type === "predictions") {
        await api.delete("/predictions");
      } else if (type === "models") {
        await api.delete("/models");
      }
      toast.success(`${type === "predictions" ? "Prediction" : "Model"} history cleared`);
    } catch (err) {
      toast.error("Failed to clear data");
    } finally {
      setClearing(null);
    }
  };

  const handleDownloadAllData = async () => {
    try {
      const response = await api.get("/download/csv", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "churn_all_data.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Data downloaded successfully");
    } catch (err) {
      toast.error("Failed to download data");
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      await api.get("/algorithms");
      setConnectionStatus("success");
      toast.success("API connection successful");
    } catch (err) {
      setConnectionStatus("error");
      toast.error("API connection failed");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      toast.info("Account deletion is not yet supported");
      setShowDeleteConfirm(false);
    } catch (err) {
      toast.error("Failed to delete account");
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-gray-400 mt-1">
            Customize your application preferences
          </p>
        </div>

        {/* Theme Settings */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FiSun className="w-4 h-4 text-indigo-400" />
            Theme Settings
          </h3>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-3">
                Appearance
              </label>
              <div className="flex gap-3">
                {[
                  { key: "light", label: "Light", icon: FiSun },
                  { key: "dark", label: "Dark", icon: FiMoon },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => handleThemeChange(key)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                      theme === key
                        ? "bg-gradient-to-r from-indigo-500/20 to-purple-600/20 border-indigo-500/50 text-white"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-3">
                Primary Color
              </label>
              <div className="flex flex-wrap gap-3">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => handleColorChange(color.value)}
                    className={`w-10 h-10 rounded-full transition-all duration-200 ${
                      primaryColor === color.value
                        ? "ring-2 ring-offset-2 ring-offset-gray-900 scale-110"
                        : "hover:scale-110"
                    }`}
                    style={{
                      backgroundColor: color.value,
                      ...(primaryColor === color.value
                        ? {
                            boxShadow: `0 0 0 2px #0f172a, 0 0 0 4px ${color.value}`,
                          }
                        : {}),
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FiBell className="w-4 h-4 text-indigo-400" />
            Notification Settings
          </h3>
          <div className="space-y-4">
            {[
              {
                key: "email",
                label: "Email Notifications",
                desc: "Receive email updates about your account activity",
                icon: FiMail,
              },
              {
                key: "predictions",
                label: "Prediction Alerts",
                desc: "Get notified when predictions complete",
                icon: FiZap,
              },
              {
                key: "modelTraining",
                label: "Model Training Alerts",
                desc: "Notifications for model training status updates",
                icon: FiCpu,
              },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/5 text-gray-400">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleNotificationToggle(item.key)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                    notifications[item.key]
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600"
                      : "bg-gray-700"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                      notifications[item.key]
                        ? "translate-x-[22px]"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Account Settings */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FiLock className="w-4 h-4 text-indigo-400" />
            Account Settings
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={passwords.current}
                onChange={(e) =>
                  setPasswords((prev) => ({ ...prev, current: e.target.value }))
                }
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                placeholder="Enter current password"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords((prev) => ({
                      ...prev,
                      newPassword: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) =>
                    setPasswords((prev) => ({
                      ...prev,
                      confirm: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <button
              onClick={handlePasswordChange}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:from-indigo-600 hover:to-purple-700 transition-all"
            >
              <FiLock className="w-4 h-4" />
              Change Password
            </button>

            <div className="border-t border-white/5 pt-4 mt-4">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                  Delete Account
                </button>
              ) : (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 animate-slide-in">
                  <div className="flex items-start gap-3">
                    <FiAlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-400">
                        Are you sure?
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        This action cannot be undone. All your data will be
                        permanently deleted.
                      </p>
                      <div className="flex gap-3 mt-3">
                        <button
                          onClick={handleDeleteAccount}
                          className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-4 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs font-medium hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FiDatabase className="w-4 h-4 text-indigo-400" />
            Data Management
          </h3>
          <div className="space-y-3">
            {[
              {
                key: "predictions",
                label: "Clear Prediction History",
                desc: "Remove all past prediction records",
                icon: FiTrash2,
              },
              {
                key: "models",
                label: "Clear Model History",
                desc: "Remove all trained model records and files",
                icon: FiTrash2,
              },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/5 text-gray-400">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleClearData(item.key)}
                  disabled={clearing === item.key}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {clearing === item.key ? (
                    <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                  ) : (
                    <FiTrash2 className="w-3.5 h-3.5" />
                  )}
                  Clear
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 text-gray-400">
                  <FiDownload className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Download All Data
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Export all your prediction data as CSV
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadAllData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition-colors"
              >
                <FiDownload className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FiLink className="w-4 h-4 text-indigo-400" />
            API Configuration
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                API URL
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value="http://localhost:5000/api"
                  readOnly
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-400 focus:outline-none"
                />
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    connectionStatus === "success"
                      ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                      : connectionStatus === "error"
                      ? "bg-red-500/20 border border-red-500/30 text-red-400"
                      : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {testingConnection ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : connectionStatus === "success" ? (
                    <FiCheck className="w-4 h-4" />
                  ) : connectionStatus === "error" ? (
                    <FiX className="w-4 h-4" />
                  ) : (
                    <FiLink className="w-4 h-4" />
                  )}
                  {testingConnection
                    ? "Testing..."
                    : connectionStatus === "success"
                    ? "Connected"
                    : connectionStatus === "error"
                    ? "Failed"
                    : "Test Connection"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FiInfo className="w-4 h-4 text-indigo-400" />
            About
          </h3>
          <div className="space-y-3">
            {[
              { label: "Application", value: "ChurnAI - Customer Churn Prediction" },
              { label: "Version", value: "1.0.0" },
              { label: "Framework", value: "React + Flask + scikit-learn" },
              { label: "License", value: "MIT" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <span className="text-sm text-gray-400">{item.label}</span>
                <span className="text-sm font-medium text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
