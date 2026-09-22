import React from "react";
import { FiArrowUp, FiArrowDown } from "react-icons/fi";

const colorMap = {
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    icon: "text-indigo-600 dark:text-indigo-400",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-500/10",
    icon: "text-purple-600 dark:text-purple-400",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-500/10",
    icon: "text-green-600 dark:text-green-400",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    icon: "text-blue-600 dark:text-blue-400",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-500/10",
    icon: "text-red-600 dark:text-red-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-400",
  },
  cyan: {
    bg: "bg-cyan-50 dark:bg-cyan-500/10",
    icon: "text-cyan-600 dark:text-cyan-400",
  },
};

export default function StatsCard({
  title,
  value,
  icon: Icon,
  color = "indigo",
  change,
  changeType,
}) {
  const palette = colorMap[color] || colorMap.indigo;
  const isPositive = changeType === "up";

  return (
    <div className="backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white animate-in fade-in slide-in-from-bottom-2 duration-500">
            {value}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5">
              {isPositive ? (
                <FiArrowUp className="w-4 h-4 text-green-500" />
              ) : (
                <FiArrowDown className="w-4 h-4 text-red-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  isPositive
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {change}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                vs last period
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${palette.bg}`}>
            <Icon className={`w-6 h-6 ${palette.icon}`} />
          </div>
        )}
      </div>
    </div>
  );
}
