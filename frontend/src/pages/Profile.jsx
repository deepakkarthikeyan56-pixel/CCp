import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import {
  FiUser,
  FiMail,
  FiShield,
  FiCalendar,
  FiClock,
  FiEdit3,
  FiSave,
  FiCheckCircle,
  FiActivity,
  FiCpu,
  FiUpload,
  FiZap,
} from "react-icons/fi";

const AVATAR_COLORS = [
  { name: "Blue", value: "#2563EB" },
  { name: "Indigo", value: "#4F46E5" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Green", value: "#10B981" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Red", value: "#EF4444" },
  { name: "Purple", value: "#8B5CF6" },
];

const ACTIVITY_ICONS = {
  login: FiUser,
  register: FiUser,
  upload_dataset: FiUpload,
  train_model: FiCpu,
  predict: FiZap,
  delete_dataset: FiActivity,
};

export default function Profile() {
  const { user, setUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profileRes, actRes] = await Promise.all([
        api.get("/profile"),
        api.get("/activities"),
      ]);
      const data = profileRes.data.user;
      setProfileData(data);
      setUsername(data.username);
      setSelectedColor(data.avatar_color);
      setActivities(actRes.data.activities || []);
    } catch (err) {
      toast.error("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      toast.error("Username cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await api.put("/profile", {
        username: username.trim(),
        avatar_color: selectedColor,
      });
      setProfileData((prev) => ({
        ...prev,
        username: username.trim(),
        avatar_color: selectedColor,
      }));
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      storedUser.name = username.trim();
      storedUser.username = username.trim();
      storedUser.avatar_color = selectedColor;
      localStorage.setItem("user", JSON.stringify(storedUser));
      setUser({ ...user, name: username.trim(), username: username.trim(), avatar_color: selectedColor });
      setEditing(false);
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const initials = (profileData?.username || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading profile...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Profile Header Card */}
        <div className="glass rounded-2xl p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg"
              style={{ backgroundColor: selectedColor || profileData?.avatar_color || "#6366F1" }}
            >
              {initials}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold text-white">
                {profileData?.username}
              </h2>
              <p className="text-gray-400 text-sm mt-1">{profileData?.email}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <FiShield className="w-3.5 h-3.5" />
                  {profileData?.role || "User"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <FiCalendar className="w-3.5 h-3.5" />
                  Joined{" "}
                  {profileData?.created_at
                    ? new Date(profileData.created_at).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })
                    : "N/A"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <FiClock className="w-3.5 h-3.5" />
                  Last login{" "}
                  {profileData?.last_login
                    ? new Date(profileData.last_login).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setEditing(!editing)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 transition-colors"
            >
              <FiEdit3 className="w-4 h-4" />
              {editing ? "Cancel" : "Edit Profile"}
            </button>
          </div>
        </div>

        {/* Edit Profile Section */}
        {editing && (
          <div className="glass rounded-2xl p-6 animate-slide-in">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FiEdit3 className="w-4 h-4 text-indigo-400" />
              Edit Profile
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Avatar Color
                </label>
                <div className="flex flex-wrap gap-3">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setSelectedColor(color.value)}
                      className={`w-10 h-10 rounded-full transition-all duration-200 ${
                        selectedColor === color.value
                          ? "ring-2 ring-offset-2 ring-offset-gray-900 scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{
                        backgroundColor: color.value,
                        ringColor: color.value,
                        ...(selectedColor === color.value
                          ? { boxShadow: `0 0 0 2px #0f172a, 0 0 0 4px ${color.value}` }
                          : {}),
                      }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FiSave className="w-4 h-4" />
                )}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Account Statistics */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FiActivity className="w-4 h-4 text-indigo-400" />
              Account Statistics
            </h3>
            <div className="space-y-3">
              {[
                { label: "Role", value: profileData?.role || "User" },
                {
                  label: "Member Since",
                  value: profileData?.created_at
                    ? new Date(profileData.created_at).toLocaleDateString()
                    : "N/A",
                },
                {
                  label: "Last Login",
                  value: profileData?.last_login
                    ? new Date(profileData.last_login).toLocaleString()
                    : "N/A",
                },
                {
                  label: "Account Status",
                  value: "Active",
                  valueClass: "text-emerald-400",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
                >
                  <span className="text-sm text-gray-400">{item.label}</span>
                  <span className={`text-sm font-medium text-white ${item.valueClass || ""}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Log */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FiClock className="w-4 h-4 text-indigo-400" />
              Recent Activity
            </h3>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {activities.length > 0 ? (
                activities.slice(0, 10).map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.action] || FiActivity;
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 py-2"
                    >
                      <div className="p-1.5 rounded-lg bg-white/5 text-indigo-400 mt-0.5">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300 truncate">
                          {activity.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(activity.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
