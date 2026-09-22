import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FiZap,
  FiUpload,
  FiCpu,
  FiBarChart2,
  FiActivity,
  FiDownload,
  FiArrowRight,
  FiGithub,
  FiTwitter,
  FiLinkedin,
} from 'react-icons/fi';

const features = [
  {
    icon: <FiZap className="w-7 h-7" />,
    title: 'AI-Powered Predictions',
    description:
      'Leverage cutting-edge machine learning algorithms to predict customer churn with high accuracy.',
  },
  {
    icon: <FiUpload className="w-7 h-7" />,
    title: 'Easy Dataset Upload',
    description:
      'Simply drag and drop your CSV files. Our system auto-detects columns and handles preprocessing.',
  },
  {
    icon: <FiCpu className="w-7 h-7" />,
    title: 'Multiple Algorithms',
    description:
      'Choose from Logistic Regression, Random Forest, XGBoost, and more to find the best model.',
  },
  {
    icon: <FiBarChart2 className="w-7 h-7" />,
    title: 'Interactive Dashboard',
    description:
      'Visualize predictions, feature importance, and model performance through rich interactive charts.',
  },
  {
    icon: <FiActivity className="w-7 h-7" />,
    title: 'Real-time Analytics',
    description:
      'Get instant insights as models train. Monitor metrics and performance in real time.',
  },
  {
    icon: <FiDownload className="w-7 h-7" />,
    title: 'Export Reports',
    description:
      'Download detailed reports with predictions, model metrics, and actionable business insights.',
  },
];

const steps = [
  { number: '01', title: 'Upload Dataset', description: 'Drag & drop your customer data CSV file' },
  { number: '02', title: 'Train Model', description: 'Select an algorithm and train in one click' },
  { number: '03', title: 'Get Predictions', description: 'Receive churn probabilities for every customer' },
  { number: '04', title: 'Analyze Results', description: 'Explore dashboards and export insights' },
];

const stats = [
  { value: '10K+', label: 'Predictions Made' },
  { value: '95%+', label: 'Model Accuracy' },
  { value: '5+', label: 'ML Algorithms' },
  { value: '1000+', label: 'Happy Users' },
];

function AnimatedCounter({ target, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const numericTarget = parseInt(target.replace(/[^0-9]/g, ''), 10);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          let current = 0;
          const step = Math.max(1, Math.floor(numericTarget / 60));
          const interval = setInterval(() => {
            current += step;
            if (current >= numericTarget) {
              current = numericTarget;
              clearInterval(interval);
            }
            setCount(current);
          }, 30);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* Navbar */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled ? 'bg-gray-950/90 backdrop-blur-md shadow-lg shadow-black/20' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <FiZap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                ChurnAI
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Features
              </a>
              <a href="#about" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                About
              </a>
              <Link
                to="/login"
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium transition-all shadow-lg shadow-blue-500/25"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        {/* Animated gradient background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-3xl animate-pulse delay-500" />

          {/* Floating shapes */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white/5"
              style={{
                width: `${40 + i * 30}px`,
                height: `${40 + i * 30}px`,
                top: `${10 + i * 15}%`,
                left: `${5 + i * 16}%`,
                animation: `float ${6 + i}s ease-in-out infinite`,
                animationDelay: `${i * 0.8}s`,
              }}
            />
          ))}

          {/* Particles */}
          {[...Array(20)].map((_, i) => (
            <div
              key={`p-${i}`}
              className="absolute w-1 h-1 bg-blue-400/40 rounded-full"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `twinkle ${3 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
          }
          @keyframes twinkle {
            0%, 100% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.5); }
          }
          @keyframes gradient-shift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
            <FiZap className="w-4 h-4" />
            Powered by Machine Learning
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            Predict Customer{' '}
            <span
              className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent"
              style={{
                backgroundSize: '200% 200%',
                animation: 'gradient-shift 3s ease infinite',
              }}
            >
              Churn
            </span>{' '}
            with AI
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Harness the power of machine learning to identify at-risk customers before they leave.
            Upload your data, train models, and get actionable insights in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
            >
              Get Started Free
              <FiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium transition-all"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Reduce Churn
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              A complete toolkit for predicting, analyzing, and preventing customer churn.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-blue-500/30 hover:bg-white/[0.07] transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How It{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Works
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Four simple steps from raw data to actionable churn insights.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-xl font-bold mb-4 shadow-lg shadow-blue-500/25">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm">{step.description}</p>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)]">
                    <div className="border-t-2 border-dashed border-gray-700 w-full" />
                    <FiArrowRight className="absolute -right-2 -top-2.5 w-5 h-5 text-gray-600" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* What is Customer Churn */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                What is{' '}
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Customer Churn?
                </span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Customer churn occurs when a subscriber or customer stops doing business with a
                company. It is one of the most critical metrics for any subscription-based or
                recurring-revenue business.
              </p>
              <p className="text-gray-400 leading-relaxed mb-6">
                Acquiring a new customer costs{' '}
                <span className="text-blue-400 font-semibold">5 to 25 times more</span> than
                retaining an existing one. Even a small reduction in churn can lead to significant
                revenue growth.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-2xl font-bold text-blue-400 mb-1">~30%</div>
                  <div className="text-sm text-gray-400">Average annual churn rate</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-2xl font-bold text-cyan-400 mb-1">$1.6T</div>
                  <div className="text-sm text-gray-400">Lost to churn globally</div>
                </div>
              </div>
            </div>

            {/* How ML Helps */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                How{' '}
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Machine Learning
                </span>{' '}
                Helps
              </h2>
              <div className="space-y-4">
                {[
                  {
                    title: 'Pattern Recognition',
                    desc: 'ML models analyze hundreds of customer attributes to identify patterns that precede churn.',
                  },
                  {
                    title: 'Predictive Scoring',
                    desc: 'Each customer receives a churn probability score, enabling prioritized retention efforts.',
                  },
                  {
                    title: 'Automated Segmentation',
                    desc: 'Customers are automatically grouped by risk level for targeted marketing campaigns.',
                  },
                  {
                    title: 'Continuous Learning',
                    desc: 'Models improve over time as they process more data and adapt to changing behaviors.',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FiZap className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{item.title}</h4>
                      <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  <AnimatedCounter target={stat.value} suffix={stat.value.replace(/[0-9]/g, '')} />
                </div>
                <div className="text-gray-400 text-sm font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative p-12 sm:p-16 rounded-3xl bg-gradient-to-br from-blue-600/20 via-indigo-600/20 to-cyan-600/20 border border-white/10 text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-indigo-600/10 blur-3xl" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                Join thousands of businesses using AI to predict and prevent customer churn. Start
                for free today.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
              >
                Get Started Free
                <FiArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                  <FiZap className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  ChurnAI
                </span>
              </Link>
              <p className="text-gray-400 text-sm leading-relaxed">
                AI-powered customer churn prediction platform for modern businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    API Docs
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href="#about" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Careers
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} ChurnAI. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-gray-500 hover:text-white transition-colors">
                <FiGithub className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-500 hover:text-white transition-colors">
                <FiTwitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-500 hover:text-white transition-colors">
                <FiLinkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
