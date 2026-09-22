import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/Layout";
import api from "../utils/api";
import { toast } from "react-toastify";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
import {
  FiZap,
  FiRefreshCw,
  FiTrash2,
  FiInfo,
  FiLoader,
  FiCheck,
  FiX,
} from "react-icons/fi";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

const ALGORITHM_LABELS = {
  logistic_regression: "Logistic Regression",
  random_forest: "Random Forest",
  decision_tree: "Decision Tree",
  gradient_boosting: "Gradient Boosting",
  svm: "Support Vector Machine",
};

function detectColumnType(dtype, values) {
  if (!dtype) return "text";
  const d = String(dtype).toLowerCase();
  if (
    d.includes("int") ||
    d.includes("float") ||
    d.includes("double") ||
    d.includes("numeric")
  )
    return "number";
  if (d.includes("object") || d.includes("category") || d.includes("bool"))
    return "categorical";
  return "text";
}

export default function Predict() {
  const [columns, setColumns] = useState([]);
  const [dtypes, setDtypes] = useState({});
  const [columnValues, setColumnValues] = useState({});
  const [formData, setFormData] = useState({});
  const [customerName, setCustomerName] = useState("");
  const [algorithm, setAlgorithm] = useState("");
  const [algorithms, setAlgorithms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [result, setResult] = useState(null);
  const resultRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setFetching(true);
      const [dsRes, algoRes] = await Promise.all([
        api.get("/dataset"),
        api.get("/algorithms"),
      ]);

      const dataset = dsRes.data.dataset;
      const algs = algoRes.data.algorithms;
      setAlgorithms(algs);

      if (!dataset) {
        toast.info("Please upload a dataset first.");
        return;
      }

      const cols = (dataset.column_names || []).filter(
        (c) => c !== dataset.target_column
      );
      const dt = dataset.dtypes || {};
      setDtypes(dt);
      setColumns(cols);

      const vals = {};
      const defaults = {};
      cols.forEach((c) => {
        const rows = dataset.head || [];
        const rawVals = rows.map((r) => r[c]).filter((v) => v != null);
        const unique = [...new Set(rawVals.map(String))];
        vals[c] = unique;
        defaults[c] = "";
      });
      setColumnValues(vals);
      setFormData(defaults);

      if (algs.length > 0) {
        setAlgorithm(algs[0].key);
      }
    } catch {
      toast.error("Failed to load form data");
    } finally {
      setFetching(false);
    }
  }

  function handleChange(col, value) {
    setFormData((prev) => ({ ...prev, [col]: value }));
  }

  function autoFill() {
    const filled = {};
    columns.forEach((col) => {
      const type = detectColumnType(dtypes[col], columnValues[col]);
      const unique = columnValues[col];
      if (type === "number") {
        const nums = unique.map(Number).filter((n) => !isNaN(n));
        if (nums.length > 0) {
          const min = Math.min(...nums);
          const max = Math.max(...nums);
          filled[col] = String(
            Math.round((min + Math.random() * (max - min)) * 100) / 100
          );
          return;
        }
      }
      if (unique.length > 0) {
        filled[col] = unique[Math.floor(Math.random() * unique.length)];
      } else {
        filled[col] = type === "number" ? "0" : "sample";
      }
    });
    setFormData(filled);
    setCustomerName(
      `Customer ${Math.floor(Math.random() * 9000 + 1000)}`
    );
    toast.success("Form auto-filled with sample data");
  }

  function resetForm() {
    const blank = {};
    columns.forEach((c) => (blank[c] = ""));
    setFormData(blank);
    setCustomerName("");
    setResult(null);
  }

  async function handlePredict() {
    const hasEmpty = columns.some((c) => formData[c] === "" || formData[c] == null);
    if (hasEmpty) {
      toast.warning("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/predict", {
        input_data: formData,
        customer_name: customerName || "Customer",
        algorithm: algorithm || undefined,
      });
      setResult(res.data);
      toast.success(`Prediction: ${res.data.result}`);
      setTimeout(
        () =>
          resultRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        200
      );
    } catch (err) {
      toast.error(err.response?.data?.error || "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  function renderField(col) {
    const type = detectColumnType(dtypes[col], columnValues[col]);
    const vals = columnValues[col] || [];
    const label = col
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    if (type === "categorical" && vals.length > 0 && vals.length <= 50) {
      return (
        <select
          value={formData[col] || ""}
          onChange={(e) => handleChange(col, e.target.value)}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all appearance-none"
        >
          <option value="" className="bg-gray-900">
            Select {label}
          </option>
          {vals.map((v) => (
            <option key={v} value={v} className="bg-gray-900">
              {v}
            </option>
          ))}
        </select>
      );
    }

    if (type === "number") {
      return (
        <input
          type="number"
          step="any"
          value={formData[col] || ""}
          onChange={(e) => handleChange(col, e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
        />
      );
    }

    return (
      <input
        type="text"
        value={formData[col] || ""}
        onChange={(e) => handleChange(col, e.target.value)}
        placeholder={`Enter ${label.toLowerCase()}`}
        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
      />
    );
  }

  const barChartData = result
    ? {
        labels: ["Churn", "Stay"],
        datasets: [
          {
            data: [
              Math.round(result.probability * 100),
              Math.round(result.stay_probability * 100),
            ],
            backgroundColor: ["rgba(239, 68, 68, 0.8)", "rgba(34, 197, 94, 0.8)"],
            borderColor: ["rgba(239, 68, 68, 1)", "rgba(34, 197, 94, 1)"],
            borderWidth: 1,
            borderRadius: 8,
          },
        ],
      }
    : null;

  const pieChartData = result
    ? {
        labels: ["Churn", "Stay"],
        datasets: [
          {
            data: [
              Math.round(result.probability * 100),
              Math.round(result.stay_probability * 100),
            ],
            backgroundColor: ["rgba(239, 68, 68, 0.8)", "rgba(34, 197, 94, 0.8)"],
            borderColor: ["rgba(239, 68, 68, 1)", "rgba(34, 197, 94, 1)"],
            borderWidth: 2,
          },
        ],
      }
    : null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FiZap className="text-yellow-400" /> Predict Churn
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Fill in customer details to predict churn probability
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={autoFill}
              className="px-4 py-2 bg-indigo-500/15 text-indigo-400 text-sm font-medium rounded-xl hover:bg-indigo-500/25 transition-all flex items-center gap-2"
            >
              <FiRefreshCw className="w-4 h-4" /> Auto Fill
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-white/5 text-gray-400 text-sm font-medium rounded-xl hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <FiTrash2 className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-loading-spinner" />
          </div>
        ) : columns.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center animate-fade-in">
            <FiInfo className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">
              No Dataset Found
            </h3>
            <p className="text-gray-500">
              Please upload a dataset first to start making predictions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2 space-y-4">
              {/* Customer Name + Algorithm */}
              <div className="glass rounded-2xl p-6 animate-fade-in-up">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Algorithm
                    </label>
                    <select
                      value={algorithm}
                      onChange={(e) => setAlgorithm(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all appearance-none"
                    >
                      {algorithms.map((a) => (
                        <option key={a.key} value={a.key} className="bg-gray-900">
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Dynamic Fields */}
              <div className="glass rounded-2xl p-6 animate-fade-in-up delay-100">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                  Customer Features
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {columns.map((col) => (
                    <div key={col}>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        {col.replace(/_/g, " ").replace(/\b\w/g, (l) =>
                          l.toUpperCase()
                        )}
                      </label>
                      {renderField(col)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Predict Button */}
              <button
                onClick={handlePredict}
                disabled={loading}
                className="w-full py-3 bg-gradient-primary text-white font-semibold rounded-xl hover:bg-gradient-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {loading ? (
                  <>
                    <FiLoader className="w-5 h-5 animate-loading-spinner" />{" "}
                    Predicting...
                  </>
                ) : (
                  <>
                    <FiZap className="w-5 h-5" /> Predict Churn
                  </>
                )}
              </button>
            </div>

            {/* Result Panel */}
            <div className="space-y-4" ref={resultRef}>
              {result ? (
                <div className="glass rounded-2xl p-6 animate-scale-in space-y-6">
                  {/* Main Indicator */}
                  <div className="text-center">
                    <div
                      className={`inline-flex items-center justify-center w-24 h-24 rounded-full text-3xl font-bold animate-bounce ${
                        result.result === "Churn"
                          ? "bg-red-500/20 text-red-400 shadow-lg shadow-red-500/20"
                          : "bg-green-500/20 text-green-400 shadow-lg shadow-green-500/20"
                      }`}
                    >
                      {result.result === "Churn" ? (
                        <FiX className="w-12 h-12" />
                      ) : (
                        <FiCheck className="w-12 h-12" />
                      )}
                    </div>
                    <h2
                      className={`text-2xl font-bold mt-3 ${
                        result.result === "Churn"
                          ? "text-red-400"
                          : "text-green-400"
                      }`}
                    >
                      {result.result}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Prediction Result
                    </p>
                  </div>

                  {/* Probability Bars */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-red-400 font-medium">Churn</span>
                        <span className="text-gray-400">
                          {Math.round(result.probability * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${Math.round(result.probability * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-green-400 font-medium">Stay</span>
                        <span className="text-gray-400">
                          {Math.round(result.stay_probability * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${Math.round(
                              result.stay_probability * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">Algorithm</p>
                      <p className="text-sm font-semibold text-gray-200 mt-1">
                        {ALGORITHM_LABELS[result.algorithm] || result.algorithm}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">Model Accuracy</p>
                      <p className="text-sm font-semibold text-blue-400 mt-1">
                        {result.model_accuracy
                          ? `${(result.model_accuracy * 100).toFixed(1)}%`
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Bar Chart */}
                  {barChartData && (
                    <div className="bg-white/5 rounded-xl p-4">
                      <Bar
                        data={barChartData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: false },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              max: 100,
                              ticks: { color: "#9CA3AF" },
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
                  )}

                  {/* Pie Chart */}
                  {pieChartData && (
                    <div className="bg-white/5 rounded-xl p-4 flex justify-center">
                      <div className="w-48 h-48">
                        <Pie
                          data={pieChartData}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: {
                                position: "bottom",
                                labels: { color: "#9CA3AF", padding: 12 },
                              },
                            },
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass rounded-2xl p-8 text-center animate-fade-in">
                  <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <FiZap className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm">
                    Fill in the form and click Predict to see results
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
