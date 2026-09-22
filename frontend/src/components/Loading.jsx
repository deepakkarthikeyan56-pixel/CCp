import React from "react";

export default function Loading({ fullPage = false, text = "Loading..." }) {
  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 border-r-purple-500 animate-spin" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
            {text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 border-r-purple-500 animate-spin" />
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
        {text}
      </p>
    </div>
  );
}
