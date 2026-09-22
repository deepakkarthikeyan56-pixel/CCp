import React from "react";

export default function ChartCard({ title, children, className = "" }) {
  return (
    <div
      className={`backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/50 rounded-2xl overflow-hidden ${className}`}
    >
      {title && (
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
