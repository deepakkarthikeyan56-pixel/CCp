"""
Model Training, Evaluation, and Prediction
==========================================

Provides both individual base-model training (legacy) and the full
stacked-ensemble meta-learning pipeline.

The ALGORITHMS dict is preserved for backward compatibility with the
frontend algorithm selector.  The meta-learner adds 'stacked_ensemble'
as a special algorithm key that triggers the full pipeline.
"""

import numpy as np
import json
import os
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import (
    RandomForestClassifier, GradientBoostingClassifier,
    HistGradientBoostingClassifier, VotingClassifier,
)
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix, roc_curve,
)
from sklearn.model_selection import train_test_split

# Resolve a writable model directory.
# Priority: MODEL_DIR env var → /tmp/models (serverless) → local ../models fallback.
_LOCAL_MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models')
MODEL_DIR = os.environ.get('MODEL_DIR') or (
    '/tmp/models' if os.path.exists('/tmp') else _LOCAL_MODEL
)

# ─── Base Algorithm Registry ─────────────────────────────────
ALGORITHMS = {
    'logistic_regression': {
        'name': 'Logistic Regression',
        'class': LogisticRegression,
        'params': {'max_iter': 1000, 'random_state': 42, 'class_weight': 'balanced'}
    },
    'random_forest': {
        'name': 'Random Forest',
        'class': RandomForestClassifier,
        'params': {'n_estimators': 300, 'random_state': 42, 'n_jobs': -1,
                   'class_weight': 'balanced', 'min_samples_leaf': 2}
    },
    'decision_tree': {
        'name': 'Decision Tree',
        'class': DecisionTreeClassifier,
        'params': {'random_state': 42, 'class_weight': 'balanced'}
    },
    'svm': {
        'name': 'Support Vector Machine',
        'class': SVC,
        'params': {'probability': True, 'random_state': 42, 'class_weight': 'balanced'}
    },
    'gradient_boosting': {
        'name': 'Gradient Boosting',
        'class': GradientBoostingClassifier,
        'params': {'n_estimators': 200, 'learning_rate': 0.05, 'max_depth': 4,
                   'subsample': 0.8, 'random_state': 42}
    },
    'hist_gradient_boosting': {
        'name': 'HistGradientBoosting',
        'class': HistGradientBoostingClassifier,
        'params': {'max_iter': 200, 'learning_rate': 0.05, 'max_depth': 4,
                   'random_state': 42}
    },
}

# Conditionally add XGBoost and LightGBM
try:
    from xgboost import XGBClassifier
    ALGORITHMS['xgboost'] = {
        'name': 'XGBoost',
        'class': XGBClassifier,
        'params': {'n_estimators': 300, 'learning_rate': 0.05, 'max_depth': 5,
                   'subsample': 0.8, 'colsample_bytree': 0.8,
                   'use_label_encoder': False, 'eval_metric': 'logloss',
                   'random_state': 42, 'n_jobs': -1, 'verbosity': 0}
    }
except ImportError:
    pass

try:
    from lightgbm import LGBMClassifier
    ALGORITHMS['lightgbm'] = {
        'name': 'LightGBM',
        'class': LGBMClassifier,
        'params': {'n_estimators': 300, 'learning_rate': 0.05, 'num_leaves': 31,
                   'subsample': 0.8, 'colsample_bytree': 0.8,
                   'class_weight': 'balanced', 'random_state': 42,
                   'n_jobs': -1, 'verbosity': -1}
    }
except ImportError:
    pass

# The stacked ensemble "algorithm" for the frontend selector
ALGORITHMS['stacked_ensemble'] = {
    'name': 'Stacked Ensemble (Meta-Learner)',
    'class': None,
    'params': {},
}


# ─── Individual Model Training (legacy) ──────────────────────

def train_model(X_train, y_train, algorithm='random_forest'):
    if algorithm not in ALGORITHMS:
        raise ValueError(f"Unknown algorithm: {algorithm}")
    if ALGORITHMS[algorithm]['class'] is None:
        raise ValueError(
            f"'{algorithm}' requires the meta-learning pipeline. "
            "Use train_stacked_ensemble() instead."
        )

    algo_info = ALGORITHMS[algorithm]
    model = algo_info['class'](**algo_info['params'])
    model.fit(X_train, y_train)
    return model


def evaluate_model(model, X_test, y_test):
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else y_pred

    accuracy = float(accuracy_score(y_test, y_pred))
    precision = float(precision_score(y_test, y_pred, average='weighted', zero_division=0))
    recall = float(recall_score(y_test, y_pred, average='weighted', zero_division=0))
    f1 = float(f1_score(y_test, y_pred, average='weighted', zero_division=0))

    try:
        roc = float(roc_auc_score(y_test, y_prob))
    except ValueError:
        roc = 0.0

    try:
        auc_pr = float(average_precision_score(y_test, y_prob))
    except ValueError:
        auc_pr = 0.0

    cm = confusion_matrix(y_test, y_pred).tolist()

    fpr, tpr, _ = roc_curve(y_test, y_prob)
    roc_data = {'fpr': fpr.tolist(), 'tpr': tpr.tolist()}

    feature_importance = None
    if hasattr(model, 'feature_importances_'):
        feature_importance = model.feature_importances_.tolist()
    elif hasattr(model, 'coef_'):
        feature_importance = np.abs(model.coef_[0]).tolist()

    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1_score': f1,
        'roc_auc': roc,
        'auc_pr': auc_pr,
        'confusion_matrix': cm,
        'roc_data': roc_data,
        'feature_importance': feature_importance,
        'y_pred': y_pred.tolist(),
    }


def compare_all_algorithms(X_train, y_train, X_test, y_test, algorithms=None):
    """Compare individual base learners (not the ensemble)."""
    if algorithms is None:
        algorithms = [k for k in ALGORITHMS.keys()
                      if ALGORITHMS[k]['class'] is not None]

    results = {}
    best_algo = None
    best_accuracy = 0

    for algo in algorithms:
        try:
            model = train_model(X_train, y_train, algo)
            metrics = evaluate_model(model, X_test, y_test)
            results[algo] = {
                'name': ALGORITHMS[algo]['name'],
                'metrics': metrics,
            }
            if metrics['accuracy'] > best_accuracy:
                best_accuracy = metrics['accuracy']
                best_algo = algo
        except Exception as e:
            results[algo] = {
                'name': ALGORITHMS[algo]['name'],
                'error': str(e),
            }

    return results, best_algo, best_accuracy


# ─── Stacked Ensemble Training ───────────────────────────────

def train_stacked_ensemble(X_train, y_train, X_test, y_test,
                           random_state=42, n_splits=5, use_gating=True):
    """
    Train the full stacked ensemble meta-learning pipeline.

    Returns
    -------
    dict with keys:
        'pipeline' : StackedEnsemblePipeline (fitted)
        'metrics'  : evaluation metrics on X_test
        'comparison' : dict of all approach metrics (individual, voting, stacking, meta)
        'report'   : training report
    """
    from meta_model import (
        StackedEnsemblePipeline, compare_all_approaches, print_comparison_table,
        _compute_metrics,
    )

    # Split training data to get a validation set for threshold optimization
    X_tr, X_val, y_tr, y_val = train_test_split(
        X_train, y_train, test_size=0.15, random_state=random_state, stratify=y_train
    )

    # Train the full pipeline
    pipeline = StackedEnsemblePipeline(random_state=random_state, n_splits=n_splits)
    pipeline.fit(X_tr, y_tr, X_val=X_val, y_val=y_val, use_gating=use_gating)

    # Refit on the complete training set using the optimized threshold
    pipeline_full = StackedEnsemblePipeline(random_state=random_state, n_splits=n_splits)
    pipeline_full.fit(X_train, y_train, X_val=None, y_val=None, use_gating=use_gating)
    pipeline_full.threshold = pipeline.threshold

    # Evaluate on test set
    y_prob = pipeline_full.predict_proba(X_test)
    y_pred = (y_prob >= pipeline_full.threshold).astype(int)
    metrics = _compute_metrics(y_test, y_pred, y_prob)

    return {
        'pipeline': pipeline_full,
        'metrics': metrics,
        'report': pipeline_full.training_report,
    }


def compare_all_approaches_full(X_train, y_train, X_test, y_test, n_splits=5):
    """
    Compare all approaches: individual models, soft voting, static stacking,
    and the full stacked ensemble meta-learner.
    """
    from meta_model import compare_all_approaches, print_comparison_table
    results, pipeline = compare_all_approaches(X_train, y_train, X_test, y_test, n_splits)
    print_comparison_table(results)
    return results, pipeline


# ─── Model Save / Load ───────────────────────────────────────

def save_model(model, scaler, label_encoders, algorithm, user_id, dataset_id, metrics):
    try:
        os.makedirs(MODEL_DIR, exist_ok=True)
    except OSError as e:
        raise RuntimeError(f'Model directory unavailable: {e}') from e

    timestamp = __import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"model_{user_id}_{dataset_id}_{algorithm}_{timestamp}.pkl"
    model_path = os.path.join(MODEL_DIR, filename)

    model_data = {
        'model': model,
        'scaler': scaler,
        'label_encoders': label_encoders,
        'algorithm': algorithm,
        'feature_names': list(scaler.feature_names_in_) if hasattr(scaler, 'feature_names_in_') else None,
    }
    joblib.dump(model_data, model_path)

    model_size = os.path.getsize(model_path) / (1024 * 1024)
    return {
        'model_path': model_path,
        'filename': filename,
        'model_size': round(model_size, 2),
    }


def save_stacked_ensemble(pipeline, scaler, label_encoders, user_id, dataset_id, metrics):
    """Save the full stacked ensemble pipeline alongside preprocessing objects."""
    try:
        os.makedirs(MODEL_DIR, exist_ok=True)
    except OSError as e:
        raise RuntimeError(f'Model directory unavailable: {e}') from e

    timestamp = __import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"stacked_ensemble_{user_id}_{dataset_id}_{timestamp}.pkl"
    model_path = os.path.join(MODEL_DIR, filename)

    model_data = {
        'pipeline': pipeline,
        'scaler': scaler,
        'label_encoders': label_encoders,
        'algorithm': 'stacked_ensemble',
        'feature_names': list(scaler.feature_names_in_) if hasattr(scaler, 'feature_names_in_') else None,
    }
    joblib.dump(model_data, model_path)

    model_size = os.path.getsize(model_path) / (1024 * 1024)
    return {
        'model_path': model_path,
        'filename': filename,
        'model_size': round(model_size, 2),
    }


def load_model(model_path):
    return joblib.load(model_path)


# ─── Prediction ──────────────────────────────────────────────

def predict_single(model_data, input_scaled):
    """Predict using either a single model or a stacked ensemble pipeline."""
    algorithm = model_data.get('algorithm', '')

    if algorithm == 'stacked_ensemble':
        pipeline = model_data['pipeline']
        results = pipeline.predict_with_details(input_scaled)
        detail = results[0]
        return {
            'prediction': detail['prediction'],
            'probability': [1 - detail['churn_probability'], detail['churn_probability']],
            'churn_probability': detail['churn_probability'],
            'threshold': detail['threshold_used'],
            'base_model_probabilities': detail.get('base_model_probabilities', {}),
            'uncertainty_features': detail.get('uncertainty_features', {}),
            'gate_weights': detail.get('gate_weights', {}),
        }

    model = model_data['model']
    prediction = model.predict(input_scaled)[0]
    probability = model.predict_proba(input_scaled)[0].tolist() if hasattr(model, 'predict_proba') else [0, 0]
    return {
        'prediction': int(prediction),
        'probability': probability,
        'churn_probability': float(probability[1]) if len(probability) > 1 else float(probability[0]),
    }
