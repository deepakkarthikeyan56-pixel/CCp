import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import api from "../utils/api";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import {
  FiDownload,
  FiFileText,
  FiFile,
  FiGrid,
  FiTrendingUp,
  FiPieChart,
  FiBarChart2,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiActivity,
} from "react-icons/fi";
import { toast } from "react-toastify";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

export default function Reports() {
  const [dashboardData, setDashboardData] = useState(null);
  const [modelHistory, setModelHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashRes, modelRes] = await Promise.all([
        api.get("/dashboard"),
        api.get("/model-history"),
      ]);
      setDashboardData(dashRes.data);
      setModelHistory(modelRes.data.models || []);
    } catch (err) {
      toast.error("Failed to load reports data");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (type) => {
    try {
      const response = await api.get(`/download/${type}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const ext = type === "pdf" ? "pdf" : type === "csv" ? "csv" : "xlsx";
      link.setAttribute(
        "download",
        `churn_report_${new Date().toISOString().slice(0, 10)}.${ext}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} report downloaded`);
    } catch (err) {
      toast.error(`Failed to download ${type.toUpperCase()} report`);
    }
  };

  const churnChartData = {
    labels:
      dashboardData?.churn_distribution?.map((d) => d.prediction_result) || [],
    datasets: [
      {
        data: dashboardData?.churn_distribution?.map((d) => d.count) || [],
        backgroundColor: ["#EF4444", "#10B981"],
        borderColor: ["#DC2626", "#059669"],
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  const monthlyChartData = {
    labels:
      dashboardData?.monthly_data
        ?.slice()
        .reverse()
        .map((d) => d.month) || [],
    datasets: [
      {
        label: "Predictions",
        data:
          dashboardData?.monthly_data
            ?.slice()
            .reverse()
            .map((d) => d.count) || [],
        borderColor: "#6366F1",
        backgroundColor: "rgba(99,102,241,0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#6366F1",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const algoChartData = {
    labels: dashboardData?.algo_stats?.map((a) => a.algorithm_used) || [],
    datasets: [
      {
        label: "Usage Count",
        data: dashboardData?.algo_stats?.map((a) => a.count) || [],
        backgroundColor: [
          "rgba(99,102,241,0.8)",
          "rgba(139,92,246,0.8)",
          "rgba(6,182,212,0.8)",
          "rgba(16,185,129,0.8)",
          "rgba(245,158,11,0.8)",
          "rgba(239,68,68,0.8)",
        ],
        borderColor: [
          "#6366F1",
          "#8B5CF6",
          "#06B6D4",
          "#10B981",
          "#F59E0B",
          "#EF4444",
        ],
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: "#9CA3AF", padding: 16, usePointStyle: true, pointStyleWidth: 10 },
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: { color: "#9CA3AF" },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: { color: "#9CA3AF" },
        beginAtZero: true,
      },
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#9CA3AF" },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: { color: "#9CA3AF" },
        beginAtZero: true,
      },
    },
  };

  const totalPredictions = dashboardData?.total_predictions || 0;
  const churnRate =
    dashboardData?.churn_distribution?.length > 0
      ? (
          ((dashboardData.churn_distribution.find((d) => d.prediction_result === "Churn")
            ?.count || 0) /
            totalPredictions) *
          100
        ).toFixed(1)
      : "0.0";
  const avgProbability =
    dashboardData?.algo_stats?.length > 0
      ? (
          dashboardData.algo_stats.reduce((sum, a) => sum + (a.avg_prob || 0), 0) /
          dashboardData.algo_stats.length
        ).toFixed(2)
      : "0.00";
  const bestModel = dashboardData?.best_algorithm || "N/A";

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading reports...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Reports</h1>
            <p className="text-sm text-gray-400 mt-1">
              Comprehensive analytics and downloadable reports
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Predictions",
              value: totalPredictions,
              icon: FiActivity,
              color: "from-indigo-500 to-purple-600",
            },
            {
              label: "Churn Rate",
              value: `${churnRate}%`,
              icon: FiAlertCircle,
              color: "from-red-500 to-rose-600",
            },
            {
              label: "Avg Probability",
              value: avgProbability,
              icon: FiPieChart,
              color: "from-cyan-500 to-blue-600",
            },
            {
              label: "Best Model",
              value: bestModel,
              icon: FiCheckCircle,
              color: "from-emerald-500 to-green-600",
            },
          ].map((card, i) => (
            <div
              key={i}
              className="glass rounded-2xl p-5 hover:scale-[1.02] transition-transform duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {card.value}
                  </p>
                </div>
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}
                >
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FiPieChart className="w-4 h-4 text-indigo-400" />
              Prediction Distribution
            </h3>
            <div className="h-64">
              {dashboardData?.churn_distribution?.length > 0 ? (
                <Pie data={churnChartData} options={pieOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  No prediction data yet
                </div>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FiTrendingUp className="w-4 h-4 text-indigo-400" />
              Monthly Predictions Trend
            </h3>
            <div className="h-64">
              {dashboardData?.monthly_data?.length > 0 ? (
                <Line data={monthlyChartData} options={lineOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  No monthly data yet
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FiBarChart2 className="w-4 h-4 text-indigo-400" />
              Algorithm Usage
            </h3>
            <div className="h-64">
              {dashboardData?.algo_stats?.length > 0 ? (
                <Bar data={algoChartData} options={barOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  No algorithm data yet
                </div>
              )}
            </div>
          </div>

          {/* Download Section */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FiDownload className="w-4 h-4 text-indigo-400" />
              Download Reports
            </h3>
            <div className="space-y-3">
              {[
                {
                  type: "pdf",
                  label: "PDF Report",
                  desc: "Complete report with charts and analysis",
                  icon: FiFileText,
                  bg: "from-red-500/20 to-red-600/20",
                  border: "border-red-500/30",
                  text: "text-red-400",
                  hover: "hover:from-red-500/30 hover:to-red-600/30",
                },
                {
                  type: "csv",
                  label: "CSV Report",
                  desc: "Raw prediction data in spreadsheet format",
                  icon: FiFile,
                  bg: "from-emerald-500/20 to-green-600/20",
                  border: "border-emerald-500/30",
                  text: "text-emerald-400",
                  hover: "hover:from-emerald-500/30 hover:to-green-600/30",
                },
                {
                  type: "excel",
                  label: "Excel Report",
                  desc: "Formatted workbook with multiple sheets",
                  icon: FiGrid,
                  bg: "from-blue-500/20 to-indigo-600/20",
                  border: "border-blue-500/30",
                  text: "text-blue-400",
                  hover: "hover:from-blue-500/30 hover:to-indigo-600/30",
                },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleDownload(item.type)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r ${item.bg} border ${item.border} ${item.hover} transition-all duration-200 group`}
                >
                  <div className={`p-2 rounded-lg bg-white/5 ${item.text}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-white">
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                  <FiDownload className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Predictions Table */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FiClock className="w-4 h-4 text-indigo-400" />
            Recent Predictions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Probability
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Algorithm
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dashboardData?.recent_predictions?.length > 0 ? (
                  dashboardData.recent_predictions.map((pred) => (
                    <tr
                      key={pred.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-white font-medium">
                        {pred.customer_name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            pred.prediction_result === "Churn"
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {pred.prediction_result}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {(pred.probability * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {pred.algorithm_used || "N/A"}
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {new Date(pred.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="5"
                      className="py-8 text-center text-gray-500"
                    >
                      No predictions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Model Performance Comparison */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FiBarChart2 className="w-4 h-4 text-indigo-400" />
            Model Performance Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Algorithm
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Accuracy
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Precision
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Recall
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    F1 Score
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    ROC AUC
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {modelHistory.length > 0 ? (
                  modelHistory.map((model) => (
                    <tr
                      key={model.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-white font-medium">
                        {model.algorithm}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                              style={{
                                width: `${(model.accuracy * 100).toFixed(0)}%`,
                              }}
                            />
                          </div>
                          <span className="text-gray-300 text-xs">
                            {(model.accuracy * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {(model.precision_score * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {(model.recall_score * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {(model.f1_score * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {(model.roc_auc * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {new Date(model.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="7"
                      className="py-8 text-center text-gray-500"
                    >
                      No models trained yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
