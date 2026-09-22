import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2';
import {
  FiUploadCloud,
  FiCpu,
  FiActivity,
  FiTrendingUp,
  FiCalendar,
  FiDatabase,
  FiTarget,
  FiClock,
  FiArrowRight,
  FiLoader,
  FiAlertCircle,
} from 'react-icons/fi';
import Layout from '../components/Layout';
import StatsCard from '../components/StatsCard';
import { useAuth } from '../context/AuthContext';


ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const COLORS = {
  blue: '#2563EB',
  blueLight: '#3B82F6',
  indigo: '#4F46E5',
  indigoLight: '#6366F1',
  cyan: '#06B6D4',
  cyanLight: '#22D3EE',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#F43F5E',
  slate: '#64748B',
};

const defaultDashboardData = {
  totalPredictions: 0,
  todayPredictions: 0,
  datasetUploaded: false,
  modelAccuracy: 0,
  churnDistribution: { churned: 0, stayed: 0 },
  predictionsByAlgorithm: {},
  monthlyTrend: { labels: [], data: [] },
  recentPredictions: [],
};

const ChartCard = ({ title, children, className = '' }) => (
  <div
    className={`relative overflow-hidden rounded-2xl glass p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 ${className}`}
  >
    <h3 className="text-lg font-semibold text-gray-200 mb-4">{title}</h3>
    {children}
  </div>
);

const LoadingState = () => null;

const ErrorState = ({ message, onRetry }) => null;

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(defaultDashboardData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const result = await response.json();

      const churnDist = result.churn_distribution || [];
      const churned = churnDist.find(c => c.prediction_result === 'Churn')?.count || 0;
      const stayed = churnDist.find(c => c.prediction_result === 'Stay')?.count || 0;

      const algoStats = result.algo_stats || [];
      const predictionsByAlgorithm = {};
      algoStats.forEach(a => { predictionsByAlgorithm[a.algorithm_used] = a.count; });

      const monthlyData = result.monthly_data || [];
      const monthlyTrend = {
        labels: monthlyData.map(m => m.month).reverse(),
        data: monthlyData.map(m => m.count).reverse(),
      };

      setData({
        totalPredictions: result.total_predictions ?? 0,
        todayPredictions: result.today_predictions ?? 0,
        datasetUploaded: !!result.dataset,
        modelAccuracy: result.model_accuracy ? result.model_accuracy * 100 : 0,
        churnDistribution: { churned, stayed },
        predictionsByAlgorithm,
        monthlyTrend,
        recentPredictions: result.recent_predictions ?? [],
      });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const pieChartData = {
    labels: ['Churned', 'Stayed'],
    datasets: [
      {
        data: [data.churnDistribution.churned, data.churnDistribution.stayed],
        backgroundColor: [COLORS.rose, COLORS.blue],
        borderColor: ['#fff', '#fff'],
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 20, usePointStyle: true, pointStyleWidth: 10, font: { size: 13, weight: '500' } },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
      },
    },
  };

  const algorithmLabels = Object.keys(data.predictionsByAlgorithm);
  const algorithmValues = Object.values(data.predictionsByAlgorithm);

  const barChartData = {
    labels: algorithmLabels.length ? algorithmLabels : ['No Data'],
    datasets: [
      {
        label: 'Predictions',
        data: algorithmValues.length ? algorithmValues : [0],
        backgroundColor: [COLORS.blue, COLORS.indigo, COLORS.cyan, COLORS.emerald, COLORS.amber],
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 36,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 12, weight: '500' }, color: '#64748B' },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { font: { size: 12 }, color: '#64748B' },
        beginAtZero: true,
      },
    },
  };

  const lineChartData = {
    labels: data.monthlyTrend.labels.length
      ? data.monthlyTrend.labels
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Predictions',
        data: data.monthlyTrend.data.length
          ? data.monthlyTrend.data
          : [0, 0, 0, 0, 0, 0],
        fill: true,
        borderColor: COLORS.indigo,
        backgroundColor: (ctx) => {
          if (!ctx.chart.chartArea) return 'rgba(79, 70, 229, 0.1)';
          const gradient = ctx.chart.ctx.createLinearGradient(
            0,
            ctx.chart.chartArea.top,
            0,
            ctx.chart.chartArea.bottom
          );
          gradient.addColorStop(0, 'rgba(79, 70, 229, 0.25)');
          gradient.addColorStop(1, 'rgba(79, 70, 229, 0.02)');
          return gradient;
        },
        tension: 0.4,
        pointBackgroundColor: COLORS.indigo,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        intersect: false,
        mode: 'index',
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 12, weight: '500' }, color: '#64748B' },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { font: { size: 12 }, color: '#64748B' },
        beginAtZero: true,
      },
    },
  };

  const accuracyRanges = ['Excellent (90%+)', 'Good (75-90%)', 'Fair (60-75%)', 'Poor (<60%)'];
  const accuracyColors = [COLORS.blue, COLORS.indigo, COLORS.cyan, COLORS.slate];

  const accuracyDistribution = () => {
    const acc = data.modelAccuracy;
    if (acc >= 90) return [1, 0, 0, 0];
    if (acc >= 75) return [0, 1, 0, 0];
    if (acc >= 60) return [0, 0, 1, 0];
    if (acc > 0) return [0, 0, 0, 1];
    return [0, 0, 0, 0];
  };

  const doughnutChartData = {
    labels: accuracyRanges,
    datasets: [
      {
        data: accuracyDistribution(),
        backgroundColor: accuracyColors,
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 8,
        cutout: '70%',
      },
    ],
  };

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12, weight: '500' } },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
      },
    },
  };

  if (loading) return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <FiLoader className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-lg text-gray-400 font-medium">Loading dashboard...</p>
      </div>
    </Layout>
  );

  if (error) return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <FiAlertCircle className="w-12 h-12 text-rose-500" />
        <p className="text-lg text-gray-300 font-medium">{message}</p>
        <button
          onClick={fetchDashboard}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Welcome back, <span className="gradient-text">{user?.username || 'User'}</span>
              </h1>
              <p className="text-gray-400 mt-1 flex items-center gap-2">
                <FiCalendar className="w-4 h-4" />
                {today}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Total Predictions"
              value={data.totalPredictions.toLocaleString()}
              icon={FiActivity}
              color="blue"
            />
            <StatsCard
              title="Today's Predictions"
              value={data.todayPredictions.toLocaleString()}
              icon={FiTrendingUp}
              color="indigo"
            />
            <StatsCard
              title="Dataset Status"
              value={data.datasetUploaded ? 'Uploaded' : 'Not Uploaded'}
              icon={FiDatabase}
              color={data.datasetUploaded ? 'green' : 'amber'}
            />
            <StatsCard
              title="Model Accuracy"
              value={data.modelAccuracy > 0 ? `${data.modelAccuracy.toFixed(1)}%` : 'N/A'}
              icon={FiTarget}
              color="cyan"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Customer Churn Distribution">
              <div className="h-72">
                <Pie data={pieChartData} options={pieChartOptions} />
              </div>
            </ChartCard>

            <ChartCard title="Predictions by Algorithm">
              <div className="h-72">
                <Bar data={barChartData} options={barChartOptions} />
              </div>
            </ChartCard>

            <ChartCard title="Monthly Predictions Trend">
              <div className="h-72">
                <Line data={lineChartData} options={lineChartOptions} />
              </div>
            </ChartCard>

            <ChartCard title="Model Accuracy Distribution">
              <div className="h-72">
                <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
              </div>
            </ChartCard>
          </div>

          <ChartCard title="Recent Predictions">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Prediction</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Confidence</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Algorithm</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPredictions.length > 0 ? (
                    data.recentPredictions.slice(0, 5).map((pred, idx) => (
                      <tr
                        key={pred.id || idx}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-gray-400 font-mono">
                          {pred.id ?? `#${idx + 1}`}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-300 font-medium">
                          {pred.customer_name ?? pred.customer ?? pred.customer_id ?? '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              pred.prediction_result === 'Churn' || pred.prediction === 'Churn'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-green-500/20 text-green-400'
                            }`}
                          >
                            {pred.prediction_result || pred.prediction || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {pred.probability != null ? `${(pred.probability * 100).toFixed(1)}%` : pred.confidence != null ? `${(pred.confidence * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {pred.algorithm_used ?? pred.algorithm ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {pred.created_at ?? pred.date ?? '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        No predictions yet. Make your first prediction!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              to="/upload"
              className="group flex items-center justify-center gap-3 px-6 py-4 rounded-2xl glass hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                <FiUploadCloud className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-200">Upload Dataset</p>
                <p className="text-xs text-gray-400">Upload CSV or Excel</p>
              </div>
              <FiArrowRight className="w-4 h-4 text-gray-500 group-hover:text-blue-500 transition-colors ml-auto" />
            </Link>

            <Link
              to="/train"
              className="group flex items-center justify-center gap-3 px-6 py-4 rounded-2xl glass hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600">
                <FiCpu className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-200">Train Model</p>
                <p className="text-xs text-gray-400">Train & compare algorithms</p>
              </div>
              <FiArrowRight className="w-4 h-4 text-gray-500 group-hover:text-indigo-500 transition-colors ml-auto" />
            </Link>

            <Link
              to="/predict"
              className="group flex items-center justify-center gap-3 px-6 py-4 rounded-2xl glass hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600">
                <FiActivity className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-200">Make Prediction</p>
                <p className="text-xs text-gray-400">Predict customer churn</p>
              </div>
              <FiArrowRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-500 transition-colors ml-auto" />
            </Link>
          </div>
        </div>
      </Layout>
  );
};

export default Dashboard;
