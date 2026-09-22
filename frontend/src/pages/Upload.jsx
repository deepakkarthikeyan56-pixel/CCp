import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  FiUploadCloud,
  FiFile,
  FiCheckCircle,
  FiAlertCircle,
  FiTrash2,
  FiRefreshCw,
  FiDatabase,
  FiColumns,
  FiAlertTriangle,
  FiCopy,
  FiEye,
  FiTarget,
  FiLoader,
  FiX,
} from 'react-icons/fi';
import Layout from '../components/Layout';

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const Upload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [loadingDataset, setLoadingDataset] = useState(true);
  const [targetColumn, setTargetColumn] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchDataset = useCallback(async () => {
    setLoadingDataset(true);
    try {
      const response = await fetch('/api/dataset');
      if (response.status === 404) {
        setDatasetInfo(null);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch dataset');
      const result = await response.json();
      setDatasetInfo(result);
      if (result.target_column) {
        setTargetColumn(result.target_column);
      } else if (result.columns && result.columns.length > 0) {
        const potential = result.columns.find(
          (c) => c.toLowerCase().includes('churn') || c.toLowerCase().includes('target')
        );
        setTargetColumn(potential || result.columns[result.columns.length - 1]);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load dataset info');
    } finally {
      setLoadingDataset(false);
    }
  }, []);

  useEffect(() => {
    fetchDataset();
  }, [fetchDataset]);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.warning('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      });

      const result = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.detail || err.message || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });

      toast.success('Dataset uploaded successfully!');
      setDatasetInfo(result);
      setSelectedFile(null);
      setUploadProgress(0);

      if (result.columns && result.columns.length > 0) {
        const potential = result.columns.find(
          (c) => c.toLowerCase().includes('churn') || c.toLowerCase().includes('target')
        );
        setTargetColumn(potential || result.columns[result.columns.length - 1]);
      }
    } catch (err) {
      toast.error(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/dataset', { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || err.message || 'Failed to delete dataset');
      }
      toast.success('Dataset deleted successfully');
      setDatasetInfo(null);
      setTargetColumn('');
      setShowDeleteConfirm(false);
    } catch (err) {
      toast.error(err.message || 'Failed to delete dataset');
    } finally {
      setDeleting(false);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
  };

  return (
    <div className="min-h-screen">
      <Layout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Upload Dataset</h1>
            <p className="text-gray-400 mt-1">Upload your customer data for churn prediction analysis</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/20 shadow-lg shadow-blue-500/5 p-8">
            <div
              {...getRootProps()}
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
                isDragActive
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/30'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center space-y-4">
                <div
                  className={`flex items-center justify-center w-20 h-20 rounded-2xl transition-colors duration-300 ${
                    isDragActive
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white'
                  }`}
                >
                  <FiUploadCloud className="w-10 h-10" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-slate-700">
                    {isDragActive ? 'Drop your file here' : 'Drag & drop your dataset'}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">
                    or click to browse files
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Supported formats: .csv, .xlsx, .xls
                </p>
              </div>
            </div>

            {selectedFile && (
              <div className="mt-6 p-4 rounded-xl bg-blue-50/50 border border-blue-200/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                      <FiFile className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400">
                        {formatFileSize(selectedFile.size)} &middot;{' '}
                        {selectedFile.type || 'Unknown type'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={removeSelectedFile}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    disabled={uploading}
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                {uploading && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className={`mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 ${
                    uploading
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30'
                  }`}
                >
                  {uploading ? (
                    <>
                      <FiLoader className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FiUploadCloud className="w-5 h-5" />
                      Upload Dataset
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {loadingDataset && (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="ml-3 text-slate-500 font-medium">Loading dataset info...</span>
            </div>
          )}

          {!loadingDataset && datasetInfo && (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/20 shadow-lg shadow-blue-500/5 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
                      <FiCheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Current Dataset</h3>
                      <p className="text-sm text-slate-400">Dataset is ready for use</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 font-medium text-sm transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/50">
                    <p className="text-xs text-blue-600 font-medium">Rows</p>
                    <p className="text-2xl font-bold text-blue-700 mt-1">
                      {datasetInfo.rows?.toLocaleString() ?? '—'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200/50">
                    <p className="text-xs text-indigo-600 font-medium">Columns</p>
                    <p className="text-2xl font-bold text-indigo-700 mt-1">
                      {datasetInfo.columns?.length ?? '—'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/50">
                    <p className="text-xs text-amber-600 font-medium">Missing Values</p>
                    <p className="text-2xl font-bold text-amber-700 mt-1">
                      {datasetInfo.missing_values?.toLocaleString() ?? 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200/50">
                    <p className="text-xs text-rose-600 font-medium">Duplicates</p>
                    <p className="text-2xl font-bold text-rose-700 mt-1">
                      {datasetInfo.duplicate_values?.toLocaleString() ?? 0}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/50">
                    <p className="text-xs text-emerald-600 font-medium">Target Column</p>
                    <p className="text-sm font-bold text-emerald-700 mt-2 truncate" title={targetColumn}>
                      {targetColumn || '—'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-50 to-cyan-100/50 border border-cyan-200/50">
                    <p className="text-xs text-cyan-600 font-medium">File Type</p>
                    <p className="text-sm font-bold text-cyan-700 mt-2">
                      {datasetInfo.file_type ?? '—'}
                    </p>
                  </div>
                </div>
              </div>

              {datasetInfo.columns && datasetInfo.columns.length > 0 && (
                <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/20 shadow-lg shadow-blue-500/5 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FiColumns className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-slate-800">Columns</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {datasetInfo.columns.map((col) => (
                      <span
                        key={col}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          col === targetColumn
                            ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {col}
                        {col === targetColumn && (
                          <FiTarget className="w-3 h-3 ml-1" />
                        )}
                      </span>
                    ))}
                  </div>

                  {datasetInfo.data_types && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-slate-600 mb-3">Data Types</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {Object.entries(datasetInfo.data_types).map(([col, dtype]) => (
                          <div
                            key={col}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100"
                          >
                            <span className="text-xs text-slate-600 truncate" title={col}>
                              {col}
                            </span>
                            <span className="text-xs font-mono text-slate-400 ml-2">
                              {dtype}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {datasetInfo.target_column === undefined && datasetInfo.columns && (
                <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/20 shadow-lg shadow-blue-500/5 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FiTarget className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-semibold text-slate-800">Target Column Selection</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    Select the column you want to predict (the churn label).
                  </p>
                  <select
                    value={targetColumn}
                    onChange={(e) => setTargetColumn(e.target.value)}
                    className="w-full max-w-md px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="">Select a column...</option>
                    {datasetInfo.columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {datasetInfo.preview && datasetInfo.preview.length > 0 && (
                <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/20 shadow-lg shadow-blue-500/5 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FiEye className="w-5 h-5 text-cyan-500" />
                    <h3 className="text-lg font-semibold text-slate-800">Data Preview</h3>
                    <span className="text-xs text-slate-400">(First 10 rows)</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100">
                          {datasetInfo.columns &&
                            datasetInfo.columns.map((col) => (
                              <th
                                key={col}
                                className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {datasetInfo.preview.slice(0, 10).map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-t border-slate-100 hover:bg-blue-50/30 transition-colors"
                          >
                            {datasetInfo.columns &&
                              datasetInfo.columns.map((col) => (
                                <td
                                  key={col}
                                  className="px-4 py-2.5 text-slate-600 whitespace-nowrap max-w-[200px] truncate"
                                  title={String(row[col] ?? '')}
                                >
                                  {row[col] != null ? String(row[col]) : '—'}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/20 shadow-lg shadow-blue-500/5 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <FiRefreshCw className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-semibold text-slate-800">Replace Dataset</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  Upload a new dataset to replace the current one. This will overwrite existing data.
                </p>
                <div
                  {...getRootProps()}
                  className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-300"
                >
                  <input {...getInputProps()} />
                  <FiUploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    Drop a new file or click to browse
                  </p>
                </div>
                {selectedFile && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-600 mb-2">
                      New file selected: <span className="font-semibold">{selectedFile.name}</span>
                    </p>
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-500/25 transition-all duration-300"
                    >
                      <FiRefreshCw className={`w-4 h-4 ${uploading ? 'animate-spin' : ''}`} />
                      Replace Dataset
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!loadingDataset && !datasetInfo && (
            <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/20 shadow-lg shadow-blue-500/5 p-12 text-center">
              <FiDatabase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-600 mb-2">No Dataset Uploaded</h3>
              <p className="text-slate-400 max-w-md mx-auto">
                Upload a CSV or Excel file containing customer data to get started with churn prediction.
              </p>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-100">
                    <FiAlertTriangle className="w-5 h-5 text-rose-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Delete Dataset</h3>
                </div>
                <p className="text-sm text-slate-500">
                  Are you sure you want to delete the current dataset? This action cannot be undone and will remove all uploaded data.
                </p>
                <div className="flex items-center gap-3 justify-end">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50"
                  >
                    {deleting ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <FiTrash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export default Upload;
