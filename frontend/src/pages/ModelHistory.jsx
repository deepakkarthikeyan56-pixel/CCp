import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import api from "../utils/api";
import { toast } from "react-toastify";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import {
  FiCpu,
  FiTrash2,
  FiDownload,
  FiPlus,
  FiLoader,
  FiBarChart2,
  FiActivity,
  FiTarget,
  FiCheck,
  FiX,
} from "react-icons/fi";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const ALGO_LABELS = {
  logistic_regression: "Logistic Regression",
  random_forest: "Random Forest",
  decision_tree: "Decision Tree",
  gradient_boosting: "Gradient Boosting",
  svm: "SVM",
};

const ALGO_COLORS = [
  "#2563EB",
  "#4F46E5",
  "#06B6D4",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

function ConfusionMatrix({ matrix }) {
  if (!matrix || !Array.isArray(matrix) || matrix.length === 0) return null;
  const labels = ["Stay", "Churn"];
  const maxVal = Math.max(...matrix.flat());

  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-1 text-xs text-gray-500 mb-1">
        <span className="w-16" />
        {labels.map((l) => (
          <span key={l} className="w-16 text-center font-medium">
            {l}
          </span>
        ))}
      </div>
      {matrix.map((row, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="w-16 text-right text-xs text-gray-500 font-medium">
            {labels[i]}
          </span>
          {row.map((val, j) => {
            const intensity = maxVal > 0 ? val / maxVal : 0;
            const bg =
              i === j
                ? `rgba(34, 197, 94, ${0.15 + intensity * 0.6})`
                : `rgba(239, 68, 68, ${0.1 + intensity * 0.5})`;
            return (
              <div
                key={j}
                className="w-16 h-12 flex items-center justify-center rounded-lg text-sm font-semibold"
                style={{
                  backgroundColor: bg,
                  color: intensity > 0.4 ? "#fff" : "#9CA3AF",
                }}
              >
                {val}
              </div>
            );
          })}
        </div>
      ))}
      <p className="text-[10px] text-gray-600 text-center mt-2">
        Rows = Actual, Columns = Predicted
      </p>
    </div>
  );
}

export default function ModelHistory() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [selectedAlgo, setSelectedAlgo] = useState("random_forest");
  const [algorithms, setAlgorithms] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [trainResult, setTrainResult] = useState(null);

  useEffect(() => {
    fetchModels();
    fetchAlgorithms();
  }, []);

  async function fetchModels() {
    try {
      setLoading(true);
      const res = await api.get("/model-history");
      setModels(res.data.models);
    } catch {
      toast.error("Failed to load model history");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAlgorithms() {
    try {
      const res = await api.get("/algorithms");
      setAlgorithms(res.data.algorithms);
    } catch {
      /* silent */
    }
  }

  async function handleTrain() {
    setTraining(true);
    setTrainResult(null);
    try {
      const res = await api.post("/train", {
        algorithm: selectedAlgo,
        compare: false,
      });
      setTrainResult(res.data);
      toast.success(res.data.message || "Model trained successfully");
      fetchModels();
    } catch (err) {
      toast.error(err.response?.data?.error || "Training failed");
    } finally {
      setTraining(false);
    }
  }

  async function handleCompareAll() {
    setTraining(true);
    setTrainResult(null);
    try {
      const res = await api.post("/train", { compare: true });
      setTrainResult({
        ...res.data,
        isComparison: true,
        results: res.data.results,
      });
      toast.success(
        `Best algorithm: ${
          ALGO_LABELS[res.data.best_algorithm] || res.data.best_algorithm
        } (${(res.data.best_accuracy * 100).toFixed(1)}%)`
      );
      fetchModels();
    } catch (err) {
      toast.error(err.response?.data?.error || "Comparison failed");
    } finally {
      setTraining(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/model/${deleteId}`);
      toast.success("Model deleted");
      setShowDeleteModal(false);
      setDeleteId(null);
      if (selectedModel?.id === deleteId) setSelectedModel(null);
      fetchModels();
    } catch {
      toast.error("Failed to delete model");
    }
  }

  function handleDownload(id, algo) {
    api
      .get(`/model/${id}/download`, { responseType: "blob" })
      .then((res) => {
        const blob = new Blob([res.data]);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `model_${algo}.pkl`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success("Model downloaded");
      })
      .catch(() => toast.error("Download failed"));
  }

  /* ─── Chart Data ─── */
  const comparisonChartData =
    models.length > 0
      ? {
          labels: models.map(
            (m) => ALGO_LABELS[m.algorithm] || m.algorithm
          ),
          datasets: [
            {
              label: "Accuracy",
              data: models.map((m) => (m.accuracy * 100).toFixed(1)),
              backgroundColor: "rgba(37, 99, 235, 0.8)",
              borderRadius: 6,
            },
            {
              label: "F1 Score",
              data: models.map((m) => (m.f1_score * 100).toFixed(1)),
              backgroundColor: "rgba(16, 185, 129, 0.8)",
              borderRadius: 6,
            },
            {
              label: "ROC AUC",
              data: models.map((m) => (m.roc_auc * 100).toFixed(1)),
              backgroundColor: "rgba(139, 92, 246, 0.8)",
              borderRadius: 6,
            },
          ],
        }
      : null;

  const comparisonChartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: "#9CA3AF", padding: 16 } },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { color: "#9CA3AF" },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      x: {
        ticks: { color: "#9CA3AF", maxRotation: 45 },
        grid: { display: false },
      },
    },
  };

  const featureImportanceData =
    selectedModel?.feature_importance
      ? {
          labels: Object.keys(selectedModel.feature_importance),
          datasets: [
            {
              label: "Importance",
              data: Object.values(selectedModel.feature_importance),
              backgroundColor: Object.keys(
                selectedModel.feature_importance
              ).map((_, i) => `${ALGO_COLORS[i % ALGO_COLORS.length]}cc`),
              borderRadius: 4,
            },
          ],
        }
      : null;

  const featureImportanceOptions = {
    indexAxis: "y",
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { color: "#9CA3AF" },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      y: {
        ticks: { color: "#9CA3AF", font: { size: 10 } },
        grid: { display: false },
      },
    },
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FiCpu className="text-purple-400" /> Model History
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {models.length} trained model{models.length !== 1 && "s"}
          </p>
        </div>

        {/* Train Section */}
        <div className="glass rounded-2xl p-6 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Train New Model
          </h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1.5">
                Algorithm
              </label>
              <select
                value={selectedAlgo}
                onChange={(e) => setSelectedAlgo(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all appearance-none"
              >
                {algorithms.map((a) => (
                  <option key={a.key} value={a.key} className="bg-gray-900">
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleTrain}
              disabled={training}
              className="px-6 py-2.5 bg-gradient-primary text-white text-sm font-semibold rounded-xl hover:bg-gradient-primary-hover disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {training ? (
                <>
                  <FiLoader className="w-4 h-4 animate-loading-spinner" />{" "}
                  Training...
                </>
              ) : (
                <>
                  <FiPlus className="w-4 h-4" /> Train
                </>
              )}
            </button>
            <button
              onClick={handleCompareAll}
              disabled={training}
              className="px-6 py-2.5 bg-purple-500/15 text-purple-400 text-sm font-semibold rounded-xl hover:bg-purple-500/25 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {training ? (
                <>
                  <FiLoader className="w-4 h-4 animate-loading-spinner" />{" "}
                  Comparing...
                </>
              ) : (
                <>
                  <FiActivity className="w-4 h-4" /> Compare All
                </>
              )}
            </button>
          </div>

          {/* Train Result */}
          {trainResult && !trainResult.isComparison && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl animate-scale-in">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Accuracy", value: trainResult.accuracy },
                  { label: "Precision", value: trainResult.precision },
                  { label: "Recall", value: trainResult.recall },
                  { label: "F1 Score", value: trainResult.f1_score },
                  { label: "ROC AUC", value: trainResult.roc_auc },
                ].map((m) => (
                  <div key={m.label} className="text-center">
                    <p className="text-xs text-gray-500">{m.label}</p>
                    <p className="text-lg font-bold text-green-400">
                      {(m.value * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {trainResult?.isComparison && trainResult.results && (
            <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl animate-scale-in">
              <p className="text-sm text-purple-300 font-medium mb-3">
                Best: {ALGO_LABELS[trainResult.best_algorithm]} (
                {(trainResult.best_accuracy * 100).toFixed(1)}%)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-gray-500">
                        Algorithm
                      </th>
                      <th className="text-right py-2 text-gray-500">Acc</th>
                      <th className="text-right py-2 text-gray-500">Prec</th>
                      <th className="text-right py-2 text-gray-500">Rec</th>
                      <th className="text-right py-2 text-gray-500">F1</th>
                      <th className="text-right py-2 text-gray-500">AUC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainResult.results.map((r, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-1.5 text-gray-300">
                          {ALGO_LABELS[r.algorithm] || r.algorithm}
                        </td>
                        <td className="text-right text-gray-400">
                          {(r.accuracy * 100).toFixed(1)}%
                        </td>
                        <td className="text-right text-gray-400">
                          {(r.precision * 100).toFixed(1)}%
                        </td>
                        <td className="text-right text-gray-400">
                          {(r.recall * 100).toFixed(1)}%
                        </td>
                        <td className="text-right text-gray-400">
                          {(r.f1_score * 100).toFixed(1)}%
                        </td>
                        <td className="text-right text-gray-400">
                          {(r.roc_auc * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Model Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-loading-spinner" />
          </div>
        ) : models.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center animate-fade-in">
            <FiCpu className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">
              No Models Trained
            </h3>
            <p className="text-gray-500 text-sm">
              Train your first model using the section above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map((m, i) => (
              <div
                key={m.id}
                onClick={() => setSelectedModel(m)}
                className={`glass rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] animate-fade-in-up ${
                  selectedModel?.id === m.id
                    ? "ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10"
                    : ""
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {ALGO_LABELS[m.algorithm] || m.algorithm}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{
                      backgroundColor: `${ALGO_COLORS[i % ALGO_COLORS.length]}20`,
                      color: ALGO_COLORS[i % ALGO_COLORS.length],
                    }}
                  >
                    {Math.round(m.accuracy * 100)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[
                    {
                      label: "Precision",
                      value: m.precision_score,
                      color: "blue",
                    },
                    {
                      label: "Recall",
                      value: m.recall_score,
                      color: "cyan",
                    },
                    {
                      label: "F1 Score",
                      value: m.f1_score,
                      color: "green",
                    },
                    { label: "ROC AUC", value: m.roc_auc, color: "purple" },
                  ].map((s) => (
                    <div key={s.label} className="bg-white/5 rounded-lg p-2">
                      <p className="text-[10px] text-gray-500">{s.label}</p>
                      <p className={`text-xs font-semibold text-${s.color}-400`}>
                        {(s.value * 100).toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>

                {m.model_size && (
                  <p className="text-[10px] text-gray-600 mt-3">
                    Size: {(m.model_size / 1024).toFixed(1)} KB
                  </p>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(m.id, m.algorithm);
                    }}
                    className="flex-1 py-1.5 bg-blue-500/10 text-blue-400 text-xs rounded-lg hover:bg-blue-500/20 transition-all flex items-center justify-center gap-1"
                  >
                    <FiDownload className="w-3 h-3" /> Download
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(m.id);
                      setShowDeleteModal(true);
                    }}
                    className="py-1.5 px-3 bg-red-500/10 text-red-400 text-xs rounded-lg hover:bg-red-500/20 transition-all flex items-center justify-center gap-1"
                  >
                    <FiTrash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Model Details */}
        {selectedModel && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="glass rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Confusion Matrix —{" "}
                {ALGO_LABELS[selectedModel.algorithm] || selectedModel.algorithm}
              </h3>
              <div className="flex justify-center">
                <ConfusionMatrix matrix={selectedModel.confusion_matrix} />
              </div>
            </div>

            {featureImportanceData && (
              <div className="glass rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                  Feature Importance
                </h3>
                <div className="max-h-[400px]">
                  <Bar
                    data={featureImportanceData}
                    options={featureImportanceOptions}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comparison Chart */}
        {comparisonChartData && models.length > 1 && (
          <div className="glass rounded-2xl p-6 animate-fade-in-up">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FiBarChart2 className="text-blue-400" /> Model Comparison
            </h3>
            <div className="max-h-[350px]">
              <Bar data={comparisonChartData} options={comparisonChartOptions} />
            </div>
          </div>
        )}

        {/* Performance Timeline */}
        {models.length > 1 && (
          <div className="glass rounded-2xl p-6 animate-fade-in-up">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FiTarget className="text-green-400" /> Accuracy Trend
            </h3>
            <div className="max-h-[280px]">
              <Line
                data={{
                  labels: [...models]
                    .reverse()
                    .map((m) => ALGO_LABELS[m.algorithm] || m.algorithm),
                  datasets: [
                    {
                      label: "Accuracy",
                      data: [...models]
                        .reverse()
                        .map((m) => (m.accuracy * 100).toFixed(1)),
                      borderColor: "#2563EB",
                      backgroundColor: "rgba(37, 99, 235, 0.1)",
                      fill: true,
                      tension: 0.4,
                      pointBackgroundColor: "#2563EB",
                      pointBorderColor: "#fff",
                      pointBorderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { labels: { color: "#9CA3AF" } },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      ticks: { color: "#9CA3AF" },
                      grid: { color: "rgba(255,255,255,0.05)" },
                    },
                    x: {
                      ticks: {
                        color: "#9CA3AF",
                        maxRotation: 45,
                        font: { size: 10 },
                      },
                      grid: { display: false },
                    },
                  },
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 w-full max-w-sm mx-4 animate-scale-in">
            <h3 className="text-lg font-semibold text-white mb-2">
              Delete Model
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to delete this trained model? This action
              cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteId(null);
                }}
                className="px-4 py-2 bg-white/5 text-gray-400 text-sm rounded-xl hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500/20 text-red-400 text-sm font-medium rounded-xl hover:bg-red-500/30 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
