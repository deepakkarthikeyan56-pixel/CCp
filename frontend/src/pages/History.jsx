import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import api from "../utils/api";
import DataTable from "../components/DataTable";
import { toast } from "react-toastify";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  FiSearch,
  FiTrash2,
  FiClock,
  FiFileText,
  FiGrid,
  FiFile,
} from "react-icons/fi";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function History() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [algorithmFilter, setAlgorithmFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [distribution, setDistribution] = useState({ churn: 0, stay: 0 });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: 15 };
      if (search) params.search = search;
      if (algorithmFilter) params.algorithm = algorithmFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await api.get("/history", { params });
      setPredictions(res.data.predictions);
      setTotalPages(res.data.total_pages);
      setTotal(res.data.total);

      const churnCount = res.data.predictions.filter(
        (p) => p.prediction_result === "Churn"
      ).length;
      const stayCount = res.data.predictions.length - churnCount;
      setDistribution({ churn: churnCount, stay: stayCount });
    } catch {
      toast.error("Failed to load prediction history");
    } finally {
      setLoading(false);
    }
  }, [page, search, algorithmFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    setPage(1);
  }, [search, algorithmFilter, dateFrom, dateTo]);

  async function handleDelete(row) {
    try {
      await api.delete(`/prediction/${row.id}`);
      toast.success("Prediction deleted");
      fetchHistory();
    } catch {
      toast.error("Failed to delete prediction");
    }
  }

  function downloadFile(url, filename) {
    api
      .get(url, { responseType: "blob" })
      .then((res) => {
        const blob = new Blob([res.data]);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success(`${filename} downloaded`);
      })
      .catch(() => toast.error("Download failed"));
  }

  const chartData = {
    labels: ["Churn", "Stay"],
    datasets: [
      {
        data: [distribution.churn, distribution.stay],
        backgroundColor: ["rgba(239, 68, 68, 0.8)", "rgba(34, 197, 94, 0.8)"],
        borderColor: ["rgba(239, 68, 68, 1)", "rgba(34, 197, 94, 1)"],
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };

  const columns = [
    {
      accessor: "id",
      header: "ID",
      render: (v) => <span className="text-gray-500">#{v}</span>,
    },
    {
      accessor: "customer_name",
      header: "Customer",
      render: (v) => (
        <span className="font-medium text-gray-900 dark:text-gray-200">{v || "N/A"}</span>
      ),
    },
    {
      accessor: "prediction_result",
      header: "Result",
      render: (v) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            v === "Churn"
              ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 dark:border dark:border-red-500/20"
              : "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400 dark:border dark:border-green-500/20"
          }`}
        >
          {v}
        </span>
      ),
    },
    {
      accessor: "probability",
      header: "Probability",
      render: (v) => {
        const pct = v != null ? Math.round(v * 100) : 0;
        const color = pct > 50 ? "bg-red-500" : "bg-green-500";
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{pct}%</span>
          </div>
        );
      },
    },
    {
      accessor: "algorithm_used",
      header: "Algorithm",
      render: (v) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {v
            ? v.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
            : "N/A"}
        </span>
      ),
    },
    {
      accessor: "created_at",
      header: "Date",
      render: (v) => {
        const d = new Date(v);
        return (
          <span className="text-xs text-gray-500">
            {d.toLocaleDateString()}{" "}
            {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        );
      },
    },
  ];

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FiClock className="text-blue-500" /> Prediction History
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {total} total predictions
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => downloadFile("/download/csv", "predictions.csv")}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <FiFile className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => downloadFile("/download/excel", "predictions.xlsx")}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <FiGrid className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              onClick={() => downloadFile("/download/pdf", "report.pdf")}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <FiFileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>

        <div className="backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/50 rounded-2xl p-4 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              title="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              title="To date"
            />
            <select
              value={algorithmFilter}
              onChange={(e) => setAlgorithmFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none"
            >
              <option value="" className="bg-gray-900">All Algorithms</option>
              <option value="random_forest" className="bg-gray-900">Random Forest</option>
              <option value="logistic_regression" className="bg-gray-900">Logistic Regression</option>
              <option value="decision_tree" className="bg-gray-900">Decision Tree</option>
              <option value="gradient_boosting" className="bg-gray-900">Gradient Boosting</option>
              <option value="svm" className="bg-gray-900">SVM</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 animate-fade-in-up delay-100">
            <DataTable
              columns={columns}
              data={predictions}
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              loading={loading}
              onDelete={handleDelete}
            />
          </div>

          <div className="backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 animate-fade-in-up delay-200">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Distribution
            </h3>
            {total > 0 ? (
              <div className="flex justify-center">
                <div className="w-full max-w-[200px]">
                  <Bar
                    data={chartData}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: { color: "#9CA3AF", padding: 12 },
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: { color: "#9CA3AF", stepSize: 1 },
                          grid: { color: "rgba(255,255,255,0.05)" },
                        },
                        x: {
                          ticks: { color: "#9CA3AF" },
                          grid: { display: false },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 text-sm py-8">No data yet</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
