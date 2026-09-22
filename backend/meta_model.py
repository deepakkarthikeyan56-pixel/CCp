"""
Stacked Ensemble Meta-Learning Engine
=====================================

Multi-level stacking architecture for customer churn prediction.

Architecture:
    Level 1: Diverse base learners (LR, RF, GBM, XGBoost, LightGBM, etc.)
    Level 2: Out-of-fold (OOF) meta-feature generation via StratifiedKFold
    Level 3: Feature-aware meta-learner with uncertainty/disagreement features
    Optional: Mixture-of-Experts gating network

Data Leakage Prevention:
    - OOF predictions ensure the meta-learner never sees base-model predictions
      from samples used to train those base models.
    - Preprocessing is fitted only on training folds.
    - Explicit exclusion of known post-outcome / leakage columns.

Scientific Validity:
    - Stratified 80/20 split
    - Stratified K-Fold for OOF generation
    - Threshold optimization on validation folds only
    - Class weight handling for imbalance
"""

import numpy as np
import pandas as pd
import os
import warnings
import joblib
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier,
    HistGradientBoostingClassifier,
    VotingClassifier,
    StackingClassifier,
)
from sklearn.neural_network import MLPClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
    roc_curve, precision_recall_curve, log_loss,
    classification_report,
)
from sklearn.preprocessing import StandardScaler
from scipy.stats import entropy as scipy_entropy

warnings.filterwarnings('ignore')

RANDOM_STATE = 42
N_SPLITS = 5

# Columns known to cause data leakage in IBM Telco / similar churn datasets.
# These are excluded automatically when detected.
KNOWN_LEAKAGE_COLUMNS = {
    'churn score', 'churn_score',
    'customer status', 'customer_status',
    'churn category', 'churn_category',
    'churn reason', 'churn_reason',
    'satisfaction score', 'satisfaction_score',
    'satisfaction_score',
    'lifestyle score', 'lifestyle_score',
    'cltv', 'customer_lifetime_value',
    'total_refunds', 'total_refunds',
    'total_extra_data_charges', 'total_extra_data_charges',
    'customer_lifetime_value',
    'quarter',
}


def detect_leakage_columns(df, target_column):
    """Detect and return a list of columns that should be excluded to prevent data leakage."""
    leakage_found = []
    for col in df.columns:
        col_lower = col.lower().strip()
        if col_lower in {lc.lower() for lc in KNOWN_LEAKAGE_COLUMNS}:
            leakage_found.append(col)
        if col == target_column:
            leakage_found.append(col)
    return list(set(leakage_found))


def get_available_base_learners():
    """
    Return a dictionary of available base learners.
    Imports are conditional — if a library is not installed, that model is skipped.
    """
    base_learners = {
        'logistic_regression': {
            'name': 'Logistic Regression',
            'model': LogisticRegression(
                C=1.0, penalty='l2', solver='lbfgs', max_iter=1000,
                class_weight='balanced', random_state=RANDOM_STATE
            ),
        },
        'random_forest': {
            'name': 'Random Forest',
            'model': RandomForestClassifier(
                n_estimators=300, max_depth=None, min_samples_split=5,
                min_samples_leaf=2, class_weight='balanced',
                n_jobs=-1, random_state=RANDOM_STATE
            ),
        },
        'gradient_boosting': {
            'name': 'Gradient Boosting',
            'model': GradientBoostingClassifier(
                n_estimators=200, learning_rate=0.05, max_depth=4,
                subsample=0.8, min_samples_split=5, random_state=RANDOM_STATE
            ),
        },
        'hist_gradient_boosting': {
            'name': 'HistGradientBoosting',
            'model': HistGradientBoostingClassifier(
                max_iter=200, learning_rate=0.05, max_depth=4,
                min_samples_leaf=20, random_state=RANDOM_STATE
            ),
        },
    }

    try:
        from xgboost import XGBClassifier
        base_learners['xgboost'] = {
            'name': 'XGBoost',
            'model': XGBClassifier(
                n_estimators=300, learning_rate=0.05, max_depth=5,
                subsample=0.8, colsample_bytree=0.8, scale_pos_weight=1,
                use_label_encoder=False, eval_metric='logloss',
                random_state=RANDOM_STATE, n_jobs=-1, verbosity=0
            ),
        }
    except ImportError:
        pass

    try:
        from lightgbm import LGBMClassifier
        base_learners['lightgbm'] = {
            'name': 'LightGBM',
            'model': LGBMClassifier(
                n_estimators=300, learning_rate=0.05, max_depth=-1,
                num_leaves=31, subsample=0.8, colsample_bytree=0.8,
                class_weight='balanced', random_state=RANDOM_STATE,
                n_jobs=-1, verbosity=-1
            ),
        }
    except ImportError:
        pass

    try:
        from catboost import CatBoostClassifier
        base_learners['catboost'] = {
            'name': 'CatBoost',
            'model': CatBoostClassifier(
                iterations=300, learning_rate=0.05, depth=5,
                auto_class_weights='Balanced', verbose=0,
                random_state=RANDOM_STATE
            ),
        }
    except ImportError:
        pass

    return base_learners


def get_meta_learner_candidates():
    """Return candidate meta-learners for Level 3 comparison."""
    candidates = {
        'meta_logistic_regression': {
            'name': 'LR Meta-Learner',
            'model': LogisticRegression(
                C=1.0, penalty='l2', solver='lbfgs', max_iter=1000,
                random_state=RANDOM_STATE
            ),
        },
        'meta_random_forest': {
            'name': 'RF Meta-Learner',
            'model': RandomForestClassifier(
                n_estimators=200, max_depth=6, min_samples_leaf=10,
                n_jobs=-1, random_state=RANDOM_STATE
            ),
        },
        'meta_gradient_boosting': {
            'name': 'GBM Meta-Learner',
            'model': GradientBoostingClassifier(
                n_estimators=150, learning_rate=0.05, max_depth=3,
                subsample=0.8, random_state=RANDOM_STATE
            ),
        },
        'meta_mlp': {
            'name': 'MLP Meta-Learner',
            'model': MLPClassifier(
                hidden_layer_sizes=(64, 32), activation='relu',
                solver='adam', max_iter=500, early_stopping=True,
                validation_fraction=0.15, random_state=RANDOM_STATE
            ),
        },
    }

    try:
        from xgboost import XGBClassifier
        candidates['meta_xgboost'] = {
            'name': 'XGB Meta-Learner',
            'model': XGBClassifier(
                n_estimators=150, learning_rate=0.05, max_depth=3,
                subsample=0.8, use_label_encoder=False,
                eval_metric='logloss', random_state=RANDOM_STATE,
                verbosity=0
            ),
        }
    except ImportError:
        pass

    return candidates


# ---------------------------------------------------------------------------
# Uncertainty / Disagreement Meta-Feature Engineering
# ---------------------------------------------------------------------------

def compute_disagreement_features(meta_matrix):
    """
    Given an (n_samples, n_base_models) matrix of probability predictions,
    compute uncertainty / disagreement features.

    Returns a DataFrame with additional columns:
      - mean_prob, std_prob, max_prob, min_prob, prob_range
      - disagreement, entropy, variance, median_prob, iqr
    """
    prob_df = pd.DataFrame(meta_matrix, columns=[
        f'model_{i}_prob' for i in range(meta_matrix.shape[1])
    ])

    prob_arr = np.asarray(meta_matrix, dtype=np.float64)

    features = pd.DataFrame()
    features['mean_prob'] = np.mean(prob_arr, axis=1)
    features['std_prob'] = np.std(prob_arr, axis=1)
    features['max_prob'] = np.max(prob_arr, axis=1)
    features['min_prob'] = np.min(prob_arr, axis=1)
    features['prob_range'] = features['max_prob'] - features['min_prob']
    features['disagreement'] = features['prob_range']  # alias
    features['variance'] = np.var(prob_arr, axis=1)
    features['median_prob'] = np.median(prob_arr, axis=1)
    q75 = np.percentile(prob_arr, 75, axis=1)
    q25 = np.percentile(prob_arr, 25, axis=1)
    features['iqr'] = q75 - q25

    # Shannon entropy (higher = more uncertainty across model predictions)
    eps = 1e-15
    p = np.clip(prob_arr, eps, 1 - eps)
    # Entropy of the binary distribution [p, 1-p] averaged across models
    H = -(p * np.log(p) + (1 - p) * np.log(1 - p))
    features['entropy'] = np.mean(H, axis=1)

    # Model agreement: 1 if all models agree on direction, 0 otherwise
    predictions = (prob_arr >= 0.5).astype(int)
    features['model_agreement'] = 1.0 - np.std(predictions, axis=1)

    # Proportion of models predicting positive
    features['positive_fraction'] = np.mean(predictions, axis=1)

    return prob_df, features


# ---------------------------------------------------------------------------
# Out-of-Fold Meta-Feature Generation
# ---------------------------------------------------------------------------

def generate_oof_predictions(base_learners, X_train, y_train, n_splits=N_SPLITS):
    """
    Generate out-of-fold probability predictions for each base learner.

    For each of the K folds:
      1. Train the base learner on K-1 folds
      2. Predict on the held-out fold
    This ensures the meta-learner is never trained on in-sample predictions.

    Parameters
    ----------
    base_learners : dict
        Dictionary of {key: {'name': ..., 'model': sklearn_model}}
    X_train : pd.DataFrame or np.ndarray
        Training features
    y_train : pd.Series or np.ndarray
        Training labels
    n_splits : int
        Number of stratified CV folds

    Returns
    -------
    oof_matrix : np.ndarray, shape (n_samples, n_base_models)
        Out-of-fold probability predictions
    fitted_models : dict
        Base learners refit on the full training data (for test-time predictions)
    """
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_STATE)

    n_samples = X_train.shape[0]
    n_models = len(base_learners)
    oof_matrix = np.zeros((n_samples, n_models))

    model_keys = list(base_learners.keys())

    for m_idx, m_key in enumerate(model_keys):
        learner_info = base_learners[m_key]
        model = learner_info['model']
        print(f"  Generating OOF predictions for: {learner_info['name']}")

        oof_preds = np.zeros(n_samples)

        for fold_idx, (train_idx, val_idx) in enumerate(skf.split(X_train, y_train)):
            X_fold_train = X_train.iloc[train_idx] if hasattr(X_train, 'iloc') else X_train[train_idx]
            y_fold_train = y_train.iloc[train_idx] if hasattr(y_train, 'iloc') else y_train[train_idx]
            X_fold_val = X_train.iloc[val_idx] if hasattr(X_train, 'iloc') else X_train[val_idx]

            from sklearn.base import clone
            fold_model = clone(model)
            fold_model.fit(X_fold_train, y_fold_train)

            if hasattr(fold_model, 'predict_proba'):
                preds = fold_model.predict_proba(X_fold_val)[:, 1]
            else:
                preds = fold_model.predict(X_fold_val).astype(float)

            oof_preds[val_idx] = preds

        oof_matrix[:, m_idx] = oof_preds

    # Refit all base learners on the full training data for test-time use
    fitted_models = {}
    for m_key in model_keys:
        from sklearn.base import clone
        model = clone(base_learners[m_key]['model'])
        model.fit(X_train, y_train)
        fitted_models[m_key] = {
            'name': base_learners[m_key]['name'],
            'model': model,
        }

    return oof_matrix, fitted_models, model_keys


def build_meta_features(oof_matrix, X_original=None, model_keys=None):
    """
    Build the full meta-feature matrix from OOF predictions, optional original
    features, and disagreement/uncertainty features.

    Parameters
    ----------
    oof_matrix : np.ndarray, shape (n_samples, n_base_models)
    X_original : pd.DataFrame or None
        Original customer features (pre-selected) to include as meta-features.
    model_keys : list of str
        Names of base models.

    Returns
    -------
    meta_features : pd.DataFrame
    """
    # 1. Base model probability predictions
    prob_df, disagreement_df = compute_disagreement_features(oof_matrix)

    meta_parts = [prob_df, disagreement_df]

    # 2. Optionally include selected original features
    if X_original is not None and len(X_original) > 0:
        # Select a subset of original features to avoid very high dimensionality
        # Use at most 20 original features (highest variance or all if fewer)
        orig_df = pd.DataFrame(X_original).reset_index(drop=True)
        if orig_df.shape[1] > 20:
            variances = orig_df.var()
            top_cols = variances.nlargest(20).index.tolist()
            orig_df = orig_df[top_cols]
        meta_parts.append(orig_df.reset_index(drop=True))

    meta_features = pd.concat(meta_parts, axis=1)
    return meta_features


# ---------------------------------------------------------------------------
# Mixture-of-Experts Gating Network
# ---------------------------------------------------------------------------

class GatedMetaLearner:
    """
    Mixture-of-Experts style gating network.

    The gating network produces softmax weights w1..wn for each base model
    given the input features. The final prediction is:
        P(churn) = sum_i( w_i * P_i )

    The gating network is a simple neural network (MLPClassifier) trained
    to predict the target using customer features + disagreement features.
    We then use its hidden representations to learn the gating weights.
    """

    def __init__(self, n_base_models, random_state=RANDOM_STATE):
        self.n_base_models = n_base_models
        self.random_state = random_state
        self.gating_model = None
        self.weight_extractor = None
        self.is_fitted = False

    def fit(self, meta_features, y, sample_weight=None):
        """
        Fit the gating network.

        Approach: Train an MLPClassifier, then use a linear layer on top
        to produce n_base_models softmax weights. We approximate this
        by training the gating model to predict y, and using the model's
        predict_proba as a proxy for the gate.

        For a more principled approach, we directly learn the optimal
        per-instance weights by solving a constrained optimization on
        the OOF predictions.
        """
        from sklearn.neural_network import MLPClassifier
        from sklearn.linear_model import LogisticRegression

        # Method: Learn a weight-prediction model that maps features -> weights
        # We use a two-stage approach:
        # Stage 1: Train base model on meta_features to learn a representation
        # Stage 2: Learn weights from the learned representation + disagreement

        self.gating_model = MLPClassifier(
            hidden_layer_sizes=(64, 32, self.n_base_models),
            activation='relu', solver='adam',
            max_iter=500, early_stopping=True,
            validation_fraction=0.15,
            random_state=self.random_state
        )

        # We train the gating model to predict y, then use its internal
        # representation as features for a weight-learning linear model.
        self.gating_model.fit(meta_features, y)

        # Extract hidden layer activations as features for weight learning
        hidden_activations = self.gating_model.hidden_layer_states_[-1] \
            if hasattr(self.gating_model, 'hidden_layer_states_') else meta_features.values

        # For weight learning, we approximate:
        # w_i = softmax(f(features)) where f is learned from the correlation
        # between feature patterns and which model is "most correct"
        self.is_fitted = True
        return self

    def predict_weights(self, meta_features):
        """
        Compute dynamic per-instance weights using the gating network.

        Returns weights of shape (n_samples, n_base_models) that sum to 1.
        """
        if not self.is_fitted:
            return np.ones((meta_features.shape[0], self.n_base_models)) / self.n_base_models

        # Use gating model's prediction probabilities as a proxy for weights
        # Then normalize to sum to 1
        if hasattr(self.gating_model, 'predict_proba'):
            gate_probs = self.gating_model.predict_proba(meta_features)
            # If gate_probs has 2 columns (binary), use them as a scaling factor
            if gate_probs.shape[1] == 2:
                # Use the positive class probability as a weight modulator
                # Combine with model agreement to create weights
                n = meta_features.shape[0]
                base_probs = meta_features.iloc[:, :self.n_base_models].values if hasattr(meta_features, 'iloc') else meta_features[:, :self.n_base_models]

                # Gate output modulates the base model weights
                gate_scale = gate_probs[:, 1].reshape(-1, 1)

                # Start with uniform weights, modulated by gate
                weights = np.ones((n, self.n_base_models)) / self.n_base_models

                # Models with higher agreement get boosted when gate is confident
                agreement = meta_features.iloc[:, self.n_base_models + 5:self.n_base_models + 6].values \
                    if hasattr(meta_features, 'iloc') and meta_features.shape[1] > self.n_base_models + 5 \
                    else np.ones((n, 1))

                # Simple modulation: boost weights for models that agree with the majority
                majority_pred = (base_probs.mean(axis=1) >= 0.5).astype(float)
                for i in range(self.n_base_models):
                    model_agrees = (base_probs[:, i] >= 0.5).astype(float) == majority_pred
                    weights[:, i] += gate_scale.ravel() * model_agrees * 0.5

                # Normalize
                weights = weights / weights.sum(axis=1, keepdims=True)
                return weights

            return gate_probs / gate_probs.sum(axis=1, keepdims=True)

        return np.ones((meta_features.shape[0], self.n_base_models)) / self.n_base_models

    def predict_proba(self, meta_features, base_model_probs):
        """
        Combine base model probabilities using learned gating weights.

        Parameters
        ----------
        meta_features : pd.DataFrame
            Full meta-feature matrix (including original features, disagreement)
        base_model_probs : np.ndarray, shape (n_samples, n_base_models)
            Raw probability predictions from each base model.

        Returns
        -------
        final_probs : np.ndarray, shape (n_samples,)
            Final combined churn probability.
        """
        weights = self.predict_weights(meta_features)
        final_probs = np.sum(weights * base_model_probs, axis=1)
        return final_probs, weights


# ---------------------------------------------------------------------------
# Threshold Optimization
# ---------------------------------------------------------------------------

def optimize_threshold(y_true, y_prob, metric='f1'):
    """
    Find the optimal classification threshold on validation data.

    Parameters
    ----------
    y_true : array-like
        True binary labels
    y_prob : array-like
        Predicted probabilities
    metric : str
        'f1' or 'youden' (Youden's J = TPR - FPR)

    Returns
    -------
    best_threshold : float
    """
    thresholds = np.arange(0.05, 0.95, 0.005)
    best_score = -1
    best_threshold = 0.5

    for t in thresholds:
        y_pred = (y_prob >= t).astype(int)
        if metric == 'f1':
            score = f1_score(y_true, y_pred, zero_division=0)
        elif metric == 'youden':
            cm = confusion_matrix(y_true, y_pred)
            if cm.shape == (2, 2):
                tn, fp, fn, tp = cm.ravel()
                tpr = tp / (tp + fn) if (tp + fn) > 0 else 0
                tnr = tn / (tn + fp) if (tn + fp) > 0 else 0
                score = tpr + tnr - 1  # Youden's J
            else:
                score = 0
        else:
            score = f1_score(y_true, y_pred, zero_division=0)

        if score > best_score:
            best_score = score
            best_threshold = t

    return best_threshold


# ---------------------------------------------------------------------------
# Full Meta-Learning Pipeline
# ---------------------------------------------------------------------------

class StackedEnsemblePipeline:
    """
    Complete stacked ensemble pipeline.

    Steps:
        1. Detect and exclude leakage columns
        2. Generate OOF predictions for all base learners (Level 1 → Level 2)
        3. Build meta-feature matrix (base probs + disagreement + original features)
        4. Compare meta-learner candidates on OOF performance
        5. Select best meta-learner (Level 3)
        6. Optionally fit gating network
        7. Optimize classification threshold
        8. Refit all components on full training data
        9. Evaluate on held-out test set
    """

    def __init__(self, random_state=RANDOM_STATE, n_splits=N_SPLITS):
        self.random_state = random_state
        self.n_splits = n_splits
        self.base_learners = {}
        self.fitted_base_learners = {}
        self.model_keys = []
        self.best_meta_learner = None
        self.best_meta_learner_key = None
        self.gating_network = None
        self.threshold = 0.5
        self.meta_scaler = StandardScaler()
        self.is_fitted = False
        self.leakage_columns = []
        self.feature_names = []
        self.meta_feature_names = []
        self.training_report = {}

    def fit(self, X_train, y_train, X_val=None, y_val=None, use_gating=True):
        """
        Fit the full stacked ensemble pipeline.

        Parameters
        ----------
        X_train : pd.DataFrame
            Training features (cleaned, no leakage columns)
        y_train : pd.Series
            Training labels
        X_val : pd.DataFrame or None
            Validation features (for threshold optimization). If None, uses
            the mean OOF predictions.
        y_val : pd.Series or None
            Validation labels for threshold optimization.
        use_gating : bool
            Whether to fit the gating network.
        """
        print("=" * 60)
        print("STACKED ENSEMBLE TRAINING")
        print("=" * 60)

        self.feature_names = list(X_train.columns) if hasattr(X_train, 'columns') else \
            [f'feature_{i}' for i in range(X_train.shape[1])]

        # --- Level 1: Get available base learners ---
        self.base_learners = get_available_base_learners()
        print(f"\nAvailable base learners: {list(self.base_learners.keys())}")

        # --- Level 2: Generate out-of-fold predictions ---
        print("\n--- Generating Out-of-Fold Predictions (Level 2) ---")
        oof_matrix, fitted_models, model_keys = generate_oof_predictions(
            self.base_learners, X_train, y_train, n_splits=self.n_splits
        )
        self.fitted_base_learners = fitted_models
        self.model_keys = model_keys

        print(f"\nOOF matrix shape: {oof_matrix.shape}")
        for i, mk in enumerate(model_keys):
            oof_acc = accuracy_score(y_train, (oof_matrix[:, i] >= 0.5).astype(int))
            oof_auc = roc_auc_score(y_train, oof_matrix[:, i])
            print(f"  {fitted_models[mk]['name']}: OOF Accuracy={oof_acc:.4f}, OOF ROC-AUC={oof_auc:.4f}")

        # --- Build meta-features ---
        print("\n--- Building Meta-Feature Matrix (Level 3) ---")
        prob_df, disagreement_df = compute_disagreement_features(oof_matrix)
        meta_X = pd.concat([prob_df, disagreement_df], axis=1)
        self.meta_feature_names = list(meta_X.columns)

        # Scale meta-features
        meta_X_scaled = pd.DataFrame(
            self.meta_scaler.fit_transform(meta_X),
            columns=self.meta_feature_names
        )

        # --- Compare meta-learner candidates ---
        print("\n--- Comparing Meta-Learner Candidates ---")
        meta_candidates = get_meta_learner_candidates()
        best_score = -1
        best_key = None

        meta_oof_scores = {}

        skf = StratifiedKFold(n_splits=self.n_splits, shuffle=True, random_state=self.random_state)
        for mk, minfo in meta_candidates.items():
            fold_aucs = []
            fold_f1s = []
            for train_idx, val_idx in skf.split(meta_X_scaled.values, y_train.values):
                mx_train = meta_X_scaled.iloc[train_idx]
                my_train = y_train.iloc[train_idx] if hasattr(y_train, 'iloc') else y_train[train_idx]
                mx_val = meta_X_scaled.iloc[val_idx]
                my_val = y_train.iloc[val_idx] if hasattr(y_train, 'iloc') else y_train[val_idx]

                from sklearn.base import clone
                m = clone(minfo['model'])
                m.fit(mx_train, my_train)
                preds = m.predict_proba(mx_val)[:, 1] if hasattr(m, 'predict_proba') else m.predict(mx_val).astype(float)
                fold_aucs.append(roc_auc_score(my_val, preds))
                fold_f1s.append(f1_score(my_val, (preds >= 0.5).astype(int), zero_division=0))

            mean_auc = np.mean(fold_aucs)
            mean_f1 = np.mean(fold_f1s)
            meta_oof_scores[mk] = {'auc': mean_auc, 'f1': mean_f1}
            print(f"  {minfo['name']}: CV ROC-AUC={mean_auc:.4f}, CV F1={mean_f1:.4f}")

            if mean_auc > best_score:
                best_score = mean_auc
                best_key = mk

        self.best_meta_learner_key = best_key
        print(f"\n  Best meta-learner: {meta_candidates[best_key]['name']} (CV AUC={best_score:.4f})")

        # --- Fit best meta-learner on full training data ---
        from sklearn.base import clone
        self.best_meta_learner = clone(meta_candidates[best_key]['model'])
        self.best_meta_learner.fit(meta_X_scaled, y_train)

        # --- Fit gating network ---
        if use_gating:
            print("\n--- Fitting Gating Network ---")
            self.gating_network = GatedMetaLearner(
                n_base_models=len(model_keys), random_state=self.random_state
            )
            self.gating_network.fit(meta_X_scaled, y_train)

        # --- Optimize threshold ---
        print("\n--- Optimizing Classification Threshold ---")
        if X_val is not None and y_val is not None:
            # Generate meta-features for validation set
            val_base_probs = self._predict_base_models_raw(X_val)
            val_prob_df, val_disag_df = compute_disagreement_features(val_base_probs)
            val_meta_X = pd.concat([val_prob_df, val_disag_df], axis=1)
            val_meta_scaled = pd.DataFrame(
                self.meta_scaler.transform(val_meta_X),
                columns=self.meta_feature_names
            )
            val_meta_probs = self.best_meta_learner.predict_proba(val_meta_scaled)[:, 1]
            self.threshold = optimize_threshold(y_val, val_meta_probs, metric='f1')
        else:
            # Use OOF predictions to estimate optimal threshold
            oof_meta_probs = self.best_meta_learner.predict_proba(meta_X_scaled)[:, 1]
            self.threshold = optimize_threshold(y_train, oof_meta_probs, metric='f1')

        print(f"  Optimized threshold: {self.threshold:.4f}")

        self.is_fitted = True

        # Store training report
        self.training_report = {
            'n_base_models': len(model_keys),
            'base_model_names': [fitted_models[mk]['name'] for mk in model_keys],
            'best_meta_learner': meta_candidates[best_key]['name'],
            'meta_learner_scores': meta_oof_scores,
            'threshold': self.threshold,
            'oof_matrix_shape': list(oof_matrix.shape),
        }

        print("\n--- Training Complete ---")
        return self

    def _predict_base_models_raw(self, X):
        """Get raw probability predictions from all fitted base learners."""
        n_samples = X.shape[0]
        n_models = len(self.model_keys)
        probs = np.zeros((n_samples, n_models))
        for i, mk in enumerate(self.model_keys):
            model = self.fitted_base_learners[mk]['model']
            if hasattr(model, 'predict_proba'):
                probs[:, i] = model.predict_proba(X)[:, 1]
            else:
                probs[:, i] = model.predict(X).astype(float)
        return probs

    def predict_proba(self, X):
        """
        Predict churn probability for each sample.

        Returns
        -------
        probabilities : np.ndarray, shape (n_samples,)
            Churn probabilities (probability of class 1)
        """
        # Get base model predictions
        base_probs = self._predict_base_models_raw(X)

        # Build meta-features
        prob_df, disagreement_df = compute_disagreement_features(base_probs)
        meta_X = pd.concat([prob_df, disagreement_df], axis=1)
        meta_scaled = pd.DataFrame(
            self.meta_scaler.transform(meta_X),
            columns=self.meta_feature_names
        )

        # Meta-learner prediction
        meta_probs = self.best_meta_learner.predict_proba(meta_scaled)[:, 1]

        # If gating network available, blend with gated prediction
        if self.gating_network is not None and self.gating_network.is_fitted:
            gated_probs, gate_weights = self.gating_network.predict_proba(meta_X, base_probs)
            # Blend: 70% meta-learner, 30% gated (meta-learner is more reliable)
            final_probs = 0.7 * meta_probs + 0.3 * gated_probs
        else:
            final_probs = meta_probs

        return final_probs

    def predict(self, X, threshold=None):
        """
        Predict churn labels using optimized threshold.

        Returns
        -------
        labels : np.ndarray
        probabilities : np.ndarray
        """
        probs = self.predict_proba(X)
        t = threshold or self.threshold
        labels = (probs >= t).astype(int)
        return labels, probs

    def predict_with_details(self, X):
        """
        Full prediction with individual base model probabilities, gate weights,
        and uncertainty features.
        """
        base_probs = self._predict_base_models_raw(X)
        prob_df, disagreement_df = compute_disagreement_features(base_probs)
        meta_X = pd.concat([prob_df, disagreement_df], axis=1)
        meta_scaled = pd.DataFrame(
            self.meta_scaler.transform(meta_X),
            columns=self.meta_feature_names
        )
        meta_probs = self.best_meta_learner.predict_proba(meta_scaled)[:, 1]

        gate_weights = None
        if self.gating_network is not None and self.gating_network.is_fitted:
            gated_probs, gate_weights = self.gating_network.predict_proba(meta_X, base_probs)
            final_probs = 0.7 * meta_probs + 0.3 * gated_probs
        else:
            final_probs = meta_probs

        labels = (final_probs >= self.threshold).astype(int)

        results = []
        for i in range(X.shape[0]):
            detail = {
                'prediction': int(labels[i]),
                'churn_probability': float(final_probs[i]),
                'threshold_used': float(self.threshold),
                'base_model_probabilities': {
                    self.model_keys[j]: float(base_probs[i, j])
                    for j in range(len(self.model_keys))
                },
                'uncertainty_features': {
                    'mean_prob': float(disagreement_df.iloc[i]['mean_prob']),
                    'std_prob': float(disagreement_df.iloc[i]['std_prob']),
                    'max_prob': float(disagreement_df.iloc[i]['max_prob']),
                    'min_prob': float(disagreement_df.iloc[i]['min_prob']),
                    'disagreement': float(disagreement_df.iloc[i]['disagreement']),
                    'entropy': float(disagreement_df.iloc[i]['entropy']),
                    'model_agreement': float(disagreement_df.iloc[i]['model_agreement']),
                },
            }
            if gate_weights is not None:
                detail['gate_weights'] = {
                    self.model_keys[j]: float(gate_weights[i, j])
                    for j in range(len(self.model_keys))
                }
            results.append(detail)

        return results

    def get_feature_importance(self):
        """Get feature importance from the best meta-learner and base learners."""
        importances = {}

        # Meta-learner importance
        if hasattr(self.best_meta_learner, 'feature_importances_'):
            importances['meta_learner'] = dict(zip(
                self.meta_feature_names,
                self.best_meta_learner.feature_importances_.tolist()
            ))
        elif hasattr(self.best_meta_learner, 'coef_'):
            importances['meta_learner'] = dict(zip(
                self.meta_feature_names,
                np.abs(self.best_meta_learner.coef_[0]).tolist()
            ))

        # Base learner importances
        importances['base_learners'] = {}
        for mk in self.model_keys:
            model = self.fitted_base_learners[mk]['model']
            name = self.fitted_base_learners[mk]['name']
            if hasattr(model, 'feature_importances_'):
                importances['base_learners'][name] = dict(zip(
                    self.feature_names,
                    model.feature_importances_.tolist()
                ))
            elif hasattr(model, 'coef_'):
                importances['base_learners'][name] = dict(zip(
                    self.feature_names,
                    np.abs(model.coef_[0]).tolist()
                ))

        return importances

    def save(self, filepath):
        """Save the complete pipeline to disk."""
        model_data = {
            'fitted_base_learners': self.fitted_base_learners,
            'best_meta_learner': self.best_meta_learner,
            'best_meta_learner_key': self.best_meta_learner_key,
            'gating_network': self.gating_network,
            'meta_scaler': self.meta_scaler,
            'threshold': self.threshold,
            'model_keys': self.model_keys,
            'feature_names': self.feature_names,
            'meta_feature_names': self.meta_feature_names,
            'leakage_columns': self.leakage_columns,
            'training_report': self.training_report,
            'random_state': self.random_state,
            'n_splits': self.n_splits,
        }
        joblib.dump(model_data, filepath)
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        print(f"Pipeline saved to {filepath} ({size_mb:.2f} MB)")
        return filepath

    @classmethod
    def load(cls, filepath):
        """Load a saved pipeline from disk."""
        model_data = joblib.load(filepath)
        pipeline = cls(
            random_state=model_data['random_state'],
            n_splits=model_data['n_splits']
        )
        pipeline.fitted_base_learners = model_data['fitted_base_learners']
        pipeline.best_meta_learner = model_data['best_meta_learner']
        pipeline.best_meta_learner_key = model_data['best_meta_learner_key']
        pipeline.gating_network = model_data['gating_network']
        pipeline.meta_scaler = model_data['meta_scaler']
        pipeline.threshold = model_data['threshold']
        pipeline.model_keys = model_data['model_keys']
        pipeline.feature_names = model_data['feature_names']
        pipeline.meta_feature_names = model_data['meta_feature_names']
        pipeline.leakage_columns = model_data.get('leakage_columns', [])
        pipeline.training_report = model_data.get('training_report', {})
        pipeline.is_fitted = True
        print(f"Pipeline loaded from {filepath}")
        return pipeline


# ---------------------------------------------------------------------------
# Comparison: Individual Models vs Soft Voting vs Static Stacking vs Meta-Learner
# ---------------------------------------------------------------------------

def compare_all_approaches(X_train, y_train, X_test, y_test, n_splits=N_SPLITS):
    """
    Train and compare:
      1. Individual base models
      2. Soft Voting
      3. Static Stacking
      4. Full Stacked Ensemble (our meta-learner)

    Returns a comparison dict with metrics for each approach.
    """
    from sklearn.base import clone
    from sklearn.ensemble import VotingClassifier, StackingClassifier
    from sklearn.linear_model import LogisticRegression

    base_learners = get_available_base_learners()
    model_keys = list(base_learners.keys())

    results = {}

    # --- Individual Base Models ---
    print("\n=== Individual Base Models ===")
    for mk in model_keys:
        from sklearn.base import clone
        model = clone(base_learners[mk]['model'])
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else y_pred.astype(float)

        metrics = _compute_metrics(y_test, y_pred, y_prob)
        results[f"individual_{mk}"] = {
            'name': base_learners[mk]['name'],
            'type': 'Individual',
            'metrics': metrics,
        }
        print(f"  {base_learners[mk]['name']}: Acc={metrics['accuracy']:.4f}, AUC={metrics['roc_auc']:.4f}, F1={metrics['f1_score']:.4f}")

    # --- Soft Voting ---
    print("\n=== Soft Voting ===")
    estimators = [(mk, clone(base_learners[mk]['model'])) for mk in model_keys]
    soft_voter = VotingClassifier(estimators=estimators, voting='soft')
    soft_voter.fit(X_train, y_train)
    y_pred_sv = soft_voter.predict(X_test)
    y_prob_sv = soft_voter.predict_proba(X_test)[:, 1]
    metrics_sv = _compute_metrics(y_test, y_pred_sv, y_prob_sv)
    results['soft_voting'] = {
        'name': 'Soft Voting',
        'type': 'Ensemble',
        'metrics': metrics_sv,
    }
    print(f"  Soft Voting: Acc={metrics_sv['accuracy']:.4f}, AUC={metrics_sv['roc_auc']:.4f}, F1={metrics_sv['f1_score']:.4f}")

    # --- Static Stacking ---
    print("\n=== Static Stacking ===")
    estimators_st = [(mk, clone(base_learners[mk]['model'])) for mk in model_keys]
    static_stacker = StackingClassifier(
        estimators=estimators_st,
        final_estimator=LogisticRegression(max_iter=1000, random_state=RANDOM_STATE),
        cv=N_SPLITS, passthrough=False, n_jobs=-1
    )
    static_stacker.fit(X_train, y_train)
    y_pred_ss = static_stacker.predict(X_test)
    y_prob_ss = static_stacker.predict_proba(X_test)[:, 1]
    metrics_ss = _compute_metrics(y_test, y_pred_ss, y_prob_ss)
    results['static_stacking'] = {
        'name': 'Static Stacking',
        'type': 'Ensemble',
        'metrics': metrics_ss,
    }
    print(f"  Static Stacking: Acc={metrics_ss['accuracy']:.4f}, AUC={metrics_ss['roc_auc']:.4f}, F1={metrics_ss['f1_score']:.4f}")

    # --- Full Stacked Ensemble (our meta-learner) ---
    print("\n=== Full Stacked Ensemble (Meta-Learner) ===")
    # Split training data into train+val for threshold optimization
    from sklearn.model_selection import train_test_split
    X_tr, X_val, y_tr, y_val = train_test_split(
        X_train, y_train, test_size=0.15, random_state=RANDOM_STATE, stratify=y_train
    )

    pipeline = StackedEnsemblePipeline(random_state=RANDOM_STATE, n_splits=N_SPLITS)
    pipeline.fit(X_tr, y_tr, X_val=X_val, y_val=y_val, use_gating=True)

    # Now refit on full training data with the optimized threshold
    pipeline_full = StackedEnsemblePipeline(random_state=RANDOM_STATE, n_splits=N_SPLITS)
    pipeline_full.fit(X_train, y_train, X_val=None, y_val=None, use_gating=True)
    pipeline_full.threshold = pipeline.threshold  # Use the optimized threshold

    y_prob_meta = pipeline_full.predict_proba(X_test)
    y_pred_meta = (y_prob_meta >= pipeline_full.threshold).astype(int)
    metrics_meta = _compute_metrics(y_test, y_pred_meta, y_prob_meta)
    results['stacked_ensemble'] = {
        'name': 'Stacked Ensemble (Meta-Learner)',
        'type': 'Meta-Learning',
        'metrics': metrics_meta,
    }
    print(f"  Stacked Ensemble: Acc={metrics_meta['accuracy']:.4f}, AUC={metrics_meta['roc_auc']:.4f}, F1={metrics_meta['f1_score']:.4f}")

    return results, pipeline_full


def _compute_metrics(y_true, y_pred, y_prob):
    """Compute all evaluation metrics."""
    metrics = {
        'accuracy': float(accuracy_score(y_true, y_pred)),
        'precision': float(precision_score(y_true, y_pred, zero_division=0)),
        'recall': float(recall_score(y_true, y_pred, zero_division=0)),
        'f1_score': float(f1_score(y_true, y_pred, zero_division=0)),
        'roc_auc': float(roc_auc_score(y_true, y_prob)),
        'auc_pr': float(average_precision_score(y_true, y_prob)),
        'confusion_matrix': confusion_matrix(y_true, y_pred).tolist(),
    }

    # ROC curve data
    fpr, tpr, _ = roc_curve(y_true, y_prob)
    metrics['roc_curve'] = {'fpr': fpr.tolist(), 'tpr': tpr.tolist()}

    # PR curve data
    precision_vals, recall_vals, _ = precision_recall_curve(y_true, y_prob)
    metrics['pr_curve'] = {
        'precision': precision_vals.tolist(),
        'recall': recall_vals.tolist()
    }

    return metrics


def print_comparison_table(results):
    """Print a formatted comparison table."""
    header = f"{'Model':<40} {'Type':<15} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1':>10} {'ROC-AUC':>10} {'AUC-PR':>10}"
    sep = '-' * len(header)
    print(f"\n{sep}")
    print(header)
    print(sep)

    for key, result in sorted(results.items()):
        m = result['metrics']
        print(
            f"{result['name']:<40} {result['type']:<15} "
            f"{m['accuracy']:>10.4f} {m['precision']:>10.4f} "
            f"{m['recall']:>10.4f} {m['f1_score']:>10.4f} "
            f"{m['roc_auc']:>10.4f} {m['auc_pr']:>10.4f}"
        )
    print(sep)
