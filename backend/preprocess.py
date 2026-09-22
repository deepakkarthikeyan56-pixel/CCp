"""
Data Preprocessing Module
=========================

Handles dataset loading, cleaning, feature engineering, encoding, and scaling.

Data Leakage Prevention:
    - Leaked/post-outcome columns are detected and excluded automatically.
    - LabelEncoders are fitted on training data only and reused for test/inference.
    - StandardScaler is fitted on training data only.
    - SMOTE (if used) is applied only within training folds, never before split.
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
import json
import os

# Known post-outcome / leakage columns that must never appear in features.
LEAKAGE_COLUMNS = {
    'churn score', 'churn_score',
    'customer status', 'customer_status',
    'churn category', 'churn_category',
    'churn reason', 'churn_reason',
    'satisfaction score', 'satisfaction_score',
    'lifestyle score', 'lifestyle_score',
    'cltv', 'customer_lifetime_value',
    'total_refunds', 'total_extra_data_charges',
    'quarter',
}


def load_dataset(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.csv':
        df = pd.read_csv(file_path)
    elif ext in ('.xlsx', '.xls'):
        df = pd.read_excel(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")
    return df


def get_dataset_info(df):
    missing = int(df.isnull().sum().sum())
    duplicates = int(df.duplicated().sum())
    dtypes = {}
    for col in df.columns:
        dtypes[col] = str(df[col].dtype)
    return {
        'rows': int(df.shape[0]),
        'columns': int(df.shape[1]),
        'column_names': list(df.columns),
        'missing_values': missing,
        'duplicate_values': duplicates,
        'dtypes': dtypes,
        'describe': df.describe(include='all').to_string() if not df.empty else '',
        'head': df.head(10).to_dict(orient='records'),
        'shape': list(df.shape),
    }


def detect_target_column(df):
    churn_keywords = ['churn', 'churned', 'left', 'exited', 'cancelled', 'canceled', 'lost', 'attrition']
    for col in df.columns:
        if col.lower().strip() in churn_keywords:
            return col
        if any(kw in col.lower() for kw in churn_keywords):
            return col
    last_col = df.columns[-1]
    unique_vals = last_col and df[last_col].dropna().unique()
    if unique_vals is not None and len(unique_vals) == 2:
        vals = set(str(v).lower().strip() for v in unique_vals)
        bool_like = {'yes', 'no', 'true', 'false', '1', '0', 'y', 'n'}
        if vals.issubset(bool_like) or vals == {0, 1} or vals == {True, False}:
            return last_col
    for col in df.columns:
        unique_vals = df[col].dropna().unique()
        if len(unique_vals) == 2:
            vals = set(str(v).lower().strip() for v in unique_vals)
            churn_vals = {'yes', 'no', 'true', 'false', '1', '0', 'y', 'n', 'churn', 'stay'}
            if vals.issubset(churn_vals):
                return col
    return df.columns[-1]


def detect_leakage_columns(df, target_column):
    """Return list of columns that are known data-leakage sources or the target itself."""
    leakage = []
    for col in df.columns:
        col_lower = col.lower().strip()
        if col_lower in {lc.lower() for lc in LEAKAGE_COLUMNS}:
            leakage.append(col)
        if col == target_column:
            leakage.append(col)
    return list(set(leakage))


def preprocess_data(df, target_column=None, test_size=0.2, random_state=42,
                    drop_leakage=True):
    """
    Full preprocessing pipeline.

    Returns a dict with train/test splits, fitted scaler, fitted label encoders,
    feature names, and a report.  Scaler and encoders are fitted ONLY on training
    data to prevent any form of data leakage.
    """
    report = {'steps': []}
    df_processed = df.copy()

    report['steps'].append({
        'step': 'Initial State',
        'details': f'Shape: {df_processed.shape}, Columns: {list(df_processed.columns)}'
    })

    # --- Target detection ---
    if target_column is None:
        target_column = detect_target_column(df_processed)
    report['target_column'] = target_column

    if target_column not in df_processed.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset")

    # --- Leakage detection & removal ---
    if drop_leakage:
        leakage_cols = detect_leakage_columns(df_processed, target_column)
        if leakage_cols:
            df_processed.drop(columns=leakage_cols, inplace=True, errors='ignore')
            report['steps'].append({
                'step': 'Leakage Columns Removed',
                'details': f'Excluded {len(leakage_cols)} leakage columns: {leakage_cols}'
            })
            report['leakage_columns'] = leakage_cols
        else:
            report['leakage_columns'] = []

    # --- Identify column types AFTER leakage removal ---
    numeric_cols = df_processed.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df_processed.select_dtypes(include=['object', 'category']).columns.tolist()
    if target_column in numeric_cols:
        numeric_cols.remove(target_column)
    if target_column in categorical_cols:
        categorical_cols.remove(target_column)

    # --- Train/Test split FIRST (before any fitting) ---
    X_raw = df_processed.drop(columns=[target_column])
    y_raw = df_processed[target_column]
    feature_names = list(X_raw.columns)

    X_train_raw, X_test_raw, y_train_raw, y_test_raw = train_test_split(
        X_raw, y_raw, test_size=test_size, random_state=random_state,
        stratify=y_raw if len(y_raw.unique()) > 1 else None
    )

    report['steps'].append({
        'step': 'Train-Test Split',
        'details': f'Train: {X_train_raw.shape[0]} samples, Test: {X_test_raw.shape[0]} samples'
    })

    # --- Fill missing values (fit on train, apply to both) ---
    missing_before = int(X_train_raw.isnull().sum().sum() + X_test_raw.isnull().sum().sum())

    fill_values = {}
    for col in X_train_raw.columns:
        if X_train_raw[col].isnull().sum() > 0:
            if X_train_raw[col].dtype in ['float64', 'int64', 'float32', 'int32']:
                fill_values[col] = X_train_raw[col].median()
            else:
                mode = X_train_raw[col].mode()
                fill_values[col] = mode[0] if not mode.empty else 'Unknown'

    for col, val in fill_values.items():
        X_train_raw[col] = X_train_raw[col].fillna(val)
        X_test_raw[col] = X_test_raw[col].fillna(val)

    report['steps'].append({
        'step': 'Missing Values Handled',
        'details': f'Filled {missing_before} missing values using train-set statistics'
    })

    # --- Drop duplicates only from training set ---
    dup_before = int(X_train_raw.duplicated().sum())
    if dup_before > 0:
        train_idx = X_train_raw.drop_duplicates().index
        y_train_raw = y_train_raw.loc[train_idx]
        X_train_raw = X_train_raw.loc[train_idx]
    report['steps'].append({
        'step': 'Duplicates Removed',
        'details': f'Removed {dup_before} duplicate rows from training set'
    })

    # --- Label Encoding (fit on train, transform both) ---
    label_encoders = {}
    for col in categorical_cols:
        le = LabelEncoder()
        # Fit on training data
        X_train_raw[col] = le.fit_transform(X_train_raw[col].astype(str))
        # Transform test data; handle unseen labels gracefully
        X_test_raw[col] = X_test_raw[col].astype(str).map(
            lambda v, _le=le: _le.transform([v])[0] if v in _le.classes_ else 0
        )
        label_encoders[col] = le

    # Encode target if categorical
    target_le = None
    if y_train_raw.dtype == 'object':
        target_le = LabelEncoder()
        y_train_raw = pd.Series(target_le.fit_transform(y_train_raw.astype(str)), index=y_train_raw.index)
        y_test_raw = pd.Series(target_le.transform(y_test_raw.astype(str)), index=y_test_raw.index)
        label_encoders['__target__'] = target_le

    report['steps'].append({
        'step': 'Label Encoding Applied',
        'details': f'Encoded {len(label_encoders)} categorical columns'
    })

    # --- Feature Scaling (fit on train only) ---
    scaler = StandardScaler()
    X_train_arr = scaler.fit_transform(X_train_raw)
    X_test_arr = scaler.transform(X_test_raw)

    X_train = pd.DataFrame(X_train_arr, columns=feature_names, index=y_train_raw.index)
    X_test = pd.DataFrame(X_test_arr, columns=feature_names, index=y_test_raw.index)

    report['steps'].append({
        'step': 'Feature Scaling',
        'details': f'Scaled {len(feature_names)} features using StandardScaler (fit on train only)'
    })

    report['feature_names'] = feature_names
    report['n_features'] = len(feature_names)
    report['class_distribution'] = y_train_raw.value_counts().to_dict()
    report['encoded_columns'] = list(label_encoders.keys())

    return {
        'X_train': X_train,
        'X_test': X_test,
        'y_train': y_train_raw,
        'y_test': y_test_raw,
        'scaler': scaler,
        'label_encoders': label_encoders,
        'feature_names': feature_names,
        'target_column': target_column,
        'report': report,
        'df_processed': pd.concat([X_train_raw, y_train_raw], axis=1),
    }


def encode_single_input(input_data, label_encoders, feature_names, scaler):
    """
    Encode a single raw customer input for prediction.
    Uses the fitted label encoders and scaler (no fitting here).
    """
    input_df = pd.DataFrame([input_data])

    for col in input_df.columns:
        if col in label_encoders and col != '__target__':
            le = label_encoders[col]
            val = str(input_df[col].iloc[0])
            if val in le.classes_:
                input_df[col] = le.transform([val])[0]
            else:
                input_df[col] = 0

    for col in feature_names:
        if col not in input_df.columns:
            input_df[col] = 0

    input_df = input_df[feature_names]

    input_scaled = pd.DataFrame(scaler.transform(input_df), columns=feature_names)

    return input_scaled
