import os
import json
import uuid
from werkzeug.utils import secure_filename
import functools
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, send_file
from werkzeug.security import generate_password_hash, check_password_hash
import jwt

from database import get_db, log_activity
from preprocess import load_dataset, get_dataset_info, detect_target_column, preprocess_data, encode_single_input
from model import (
    ALGORITHMS, train_model, evaluate_model, compare_all_algorithms,
    save_model, load_model, predict_single
)
from utils import generate_pdf_report, generate_csv_report, generate_excel_report

api = Blueprint('api', __name__)

SECRET_KEY = os.environ.get('JWT_SECRET', 'churn-prediction-secret-key-2024')
# Resolve a writable upload directory.
# Priority: UPLOAD_DIR env var → /tmp/uploads (serverless) → local ../uploads fallback.
_LOCAL_UPLOAD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads')
UPLOAD_DIR = os.environ.get('UPLOAD_DIR') or (
    '/tmp/uploads' if os.path.exists('/tmp') else _LOCAL_UPLOAD
)


def token_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'error': 'Token is missing'}), 401

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            conn = get_db()
            user = conn.execute('SELECT * FROM users WHERE id = ?', (data['user_id'],)).fetchone()
            conn.close()
            if not user:
                return jsonify({'error': 'User not found'}), 401
            kwargs['current_user'] = dict(user)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(*args, **kwargs)
    return decorated


def generate_token(user_id):
    return jwt.encode(
        {'user_id': user_id, 'exp': datetime.utcnow() + timedelta(days=7)},
        SECRET_KEY,
        algorithm='HS256'
    )


# ─── Auth Routes ───────────────────────────────────────────

@api.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if '@' not in email:
        return jsonify({'error': 'Invalid email format'}), 400

    conn = get_db()
    existing = conn.execute(
        'SELECT id FROM users WHERE email = ? OR username = ?',
        (email, username)
    ).fetchone()

    if existing:
        conn.close()
        return jsonify({'error': 'User with this email or username already exists'}), 409

    colors = ['#2563EB', '#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
    avatar_color = colors[hash(username) % len(colors)]

    cursor = conn.execute(
        'INSERT INTO users (username, email, password_hash, avatar_color) VALUES (?, ?, ?, ?)',
        (username, email, generate_password_hash(password), avatar_color)
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    token = generate_token(user_id)
    log_activity(user_id, 'register', f'User {username} registered')

    return jsonify({
        'message': 'Registration successful',
        'token': token,
        'user': {
            'id': user_id,
            'username': username,
            'email': email,
            'avatar_color': avatar_color,
            'role': 'user'
        }
    }), 201


@api.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()

    if not user or not check_password_hash(user['password_hash'], password):
        conn.close()
        return jsonify({'error': 'Invalid email or password'}), 401

    conn.execute(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        (user['id'],)
    )

    conn.execute(
        'INSERT INTO login_history (user_id, ip_address, user_agent, status) VALUES (?, ?, ?, ?)',
        (user['id'], request.remote_addr, request.user_agent.string, 'success')
    )
    conn.commit()
    conn.close()

    token = generate_token(user['id'])
    log_activity(user['id'], 'login', 'User logged in')

    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'avatar_color': user['avatar_color'],
            'role': user['role']
        }
    })


@api.route('/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify({
        'user': {
            'id': current_user['id'],
            'username': current_user['username'],
            'email': current_user['email'],
            'avatar_color': current_user['avatar_color'],
            'role': current_user['role'],
            'created_at': current_user['created_at'],
            'last_login': current_user['last_login']
        }
    })


@api.route('/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    data = request.get_json()
    conn = get_db()

    if 'username' in data:
        conn.execute(
            'UPDATE users SET username = ? WHERE id = ?',
            (data['username'], current_user['id'])
        )

    if 'avatar_color' in data:
        conn.execute(
            'UPDATE users SET avatar_color = ? WHERE id = ?',
            (data['avatar_color'], current_user['id'])
        )

    conn.commit()
    conn.close()

    return jsonify({'message': 'Profile updated successfully'})


# ─── Dashboard ─────────────────────────────────────────────

@api.route('/dashboard', methods=['GET'])
@token_required
def dashboard(current_user):
    conn = get_db()
    uid = current_user['id']

    total_predictions = conn.execute(
        'SELECT COUNT(*) as count FROM predictions WHERE user_id = ?', (uid,)
    ).fetchone()['count']

    today = datetime.now().strftime('%Y-%m-%d')
    today_predictions = conn.execute(
        "SELECT COUNT(*) as count FROM predictions WHERE user_id = ? AND date(created_at) = ?",
        (uid, today)
    ).fetchone()['count']

    dataset = conn.execute(
        'SELECT * FROM datasets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        (uid,)
    ).fetchone()

    best_model = conn.execute(
        'SELECT * FROM model_history WHERE user_id = ? ORDER BY accuracy DESC LIMIT 1',
        (uid,)
    ).fetchone()

    recent_predictions = conn.execute(
        'SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        (uid,)
    ).fetchall()

    monthly_data = conn.execute('''
        SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
        FROM predictions WHERE user_id = ?
        GROUP BY month ORDER BY month DESC LIMIT 12
    ''', (uid,)).fetchall()

    algo_stats = conn.execute('''
        SELECT algorithm_used, COUNT(*) as count, AVG(probability) as avg_prob
        FROM predictions WHERE user_id = ? AND algorithm_used IS NOT NULL
        GROUP BY algorithm_used
    ''', (uid,)).fetchall()

    churn_dist = conn.execute('''
        SELECT prediction_result, COUNT(*) as count
        FROM predictions WHERE user_id = ?
        GROUP BY prediction_result
    ''', (uid,)).fetchall()

    conn.close()

    return jsonify({
        'total_predictions': total_predictions,
        'today_predictions': today_predictions,
        'dataset': dict(dataset) if dataset else None,
        'model_accuracy': best_model['accuracy'] if best_model else None,
        'best_algorithm': best_model['algorithm'] if best_model else None,
        'recent_predictions': [dict(p) for p in recent_predictions],
        'monthly_data': [dict(m) for m in monthly_data],
        'algo_stats': [dict(a) for a in algo_stats],
        'churn_distribution': [dict(c) for c in churn_dist],
    })


# ─── Dataset Routes ────────────────────────────────────────

@api.route('/upload', methods=['POST'])
@token_required
def upload_dataset(current_user):
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ('.csv', '.xlsx', '.xls'):
        return jsonify({'error': 'Only CSV and Excel files are supported'}), 400

    # Ensure the upload directory exists (created per-request so boot never crashes).
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
    except OSError as e:
        return jsonify({'error': f'Upload directory unavailable: {str(e)}'}), 500

    # Sanitize original filename and give the stored file a UUID-based name.
    safe_original = secure_filename(file.filename) or 'upload'
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    try:
        file.save(file_path)
    except OSError as e:
        return jsonify({'error': f'Failed to save uploaded file: {str(e)}'}), 500

    try:
        df = load_dataset(file_path)
        info = get_dataset_info(df)
    except Exception as e:
        try:
            os.remove(file_path)
        except OSError:
            pass
        return jsonify({'error': f'Failed to process file: {str(e)}'}), 400

    conn = get_db()
    target_col = detect_target_column(df)

    cursor = conn.execute('''
        INSERT INTO datasets (user_id, filename, original_filename, file_path, rows_count,
            columns_count, column_names, missing_values, duplicate_values, target_column, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        current_user['id'], filename, safe_original, file_path,
        info['rows'], info['columns'], json.dumps(info['column_names']),
        info['missing_values'], info['duplicate_values'], target_col,
        os.path.getsize(file_path)
    ))
    dataset_id = cursor.lastrowid
    conn.commit()
    conn.close()

    log_activity(current_user['id'], 'upload_dataset', f'Uploaded {safe_original}')

    return jsonify({
        'message': 'Dataset uploaded successfully',
        'dataset': {
            'id': dataset_id,
            'filename': safe_original,
            'rows': info['rows'],
            'columns': info['columns'],
            'column_names': info['column_names'],
            'missing_values': info['missing_values'],
            'duplicate_values': info['duplicate_values'],
            'target_column': target_col,
            'dtypes': info['dtypes'],
            'head': info['head'],
        }
    }), 201


@api.route('/dataset', methods=['GET'])
@token_required
def get_dataset(current_user):
    conn = get_db()
    dataset = conn.execute(
        'SELECT * FROM datasets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        (current_user['id'],)
    ).fetchone()
    conn.close()

    if not dataset:
        return jsonify({'dataset': None})

    ds = dict(dataset)
    ds['column_names'] = json.loads(ds['column_names']) if ds['column_names'] else []

    try:
        df = load_dataset(ds['file_path'])
        info = get_dataset_info(df)
        ds['dtypes'] = info['dtypes']
        ds['head'] = info['head']
    except Exception:
        ds['dtypes'] = {}
        ds['head'] = []

    return jsonify({'dataset': ds})


@api.route('/dataset', methods=['DELETE'])
@token_required
def delete_dataset(current_user):
    conn = get_db()
    dataset = conn.execute(
        'SELECT * FROM datasets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        (current_user['id'],)
    ).fetchone()

    if not dataset:
        conn.close()
        return jsonify({'error': 'No dataset found'}), 404

    try:
        if os.path.exists(dataset['file_path']):
            os.remove(dataset['file_path'])
    except Exception:
        pass

    conn.execute('DELETE FROM datasets WHERE id = ?', (dataset['id'],))
    conn.commit()
    conn.close()

    log_activity(current_user['id'], 'delete_dataset', f'Deleted dataset {dataset["original_filename"]}')

    return jsonify({'message': 'Dataset deleted successfully'})


# ─── Model Routes ──────────────────────────────────────────

@api.route('/train', methods=['POST'])
@token_required
def train(current_user):
    conn = get_db()
    dataset = conn.execute(
        'SELECT * FROM datasets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        (current_user['id'],)
    ).fetchone()

    if not dataset:
        conn.close()
        return jsonify({'error': 'No dataset found. Please upload a dataset first.'}), 400

    data = request.get_json() or {}
    algorithm = data.get('algorithm', 'random_forest')
    target_column = data.get('target_column', dataset['target_column'])
    compare = data.get('compare', False)

    try:
        df = load_dataset(dataset['file_path'])
        preprocessed = preprocess_data(df, target_column)
    except Exception as e:
        conn.close()
        return jsonify({'error': f'Preprocessing failed: {str(e)}'}), 400

    try:
        if compare:
            results, best_algo, best_acc = compare_all_algorithms(
                preprocessed['X_train'], preprocessed['y_train'],
                preprocessed['X_test'], preprocessed['y_test']
            )

            all_model_records = []
            for algo_key, result in results.items():
                if 'error' in result:
                    continue

                model = train_model(preprocessed['X_train'], preprocessed['y_train'], algo_key)
                save_info = save_model(
                    model, preprocessed['scaler'], preprocessed['label_encoders'],
                    algo_key, current_user['id'], dataset['id'], result['metrics']
                )

                cursor = conn.execute('''
                    INSERT INTO model_history (user_id, dataset_id, algorithm, accuracy,
                        precision_score, recall_score, f1_score, roc_auc, model_path,
                        model_size, confusion_matrix, feature_importance)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    current_user['id'], dataset['id'], algo_key,
                    result['metrics']['accuracy'], result['metrics']['precision'],
                    result['metrics']['recall'], result['metrics']['f1_score'],
                    result['metrics']['roc_auc'], save_info['model_path'],
                    save_info['model_size'],
                    json.dumps(result['metrics']['confusion_matrix']),
                    json.dumps(result['metrics']['feature_importance'])
                ))

                all_model_records.append({
                    'algorithm': algo_key,
                    'name': result['name'],
                    'accuracy': result['metrics']['accuracy'],
                    'precision': result['metrics']['precision'],
                    'recall': result['metrics']['recall'],
                    'f1_score': result['metrics']['f1_score'],
                    'roc_auc': result['metrics']['roc_auc'],
                    'confusion_matrix': result['metrics']['confusion_matrix'],
                    'feature_importance': result['metrics']['feature_importance'],
                    'roc_data': result['metrics'].get('roc_data'),
                })

            conn.commit()
            conn.close()

            log_activity(current_user['id'], 'train_model', f'Compared all algorithms, best: {best_algo}')

            return jsonify({
                'message': 'All models trained and compared',
                'results': all_model_records,
                'best_algorithm': best_algo,
                'best_accuracy': best_acc,
            })

        else:
            model = train_model(preprocessed['X_train'], preprocessed['y_train'], algorithm)
            metrics = evaluate_model(model, preprocessed['X_test'], preprocessed['y_test'])
            save_info = save_model(
                model, preprocessed['scaler'], preprocessed['label_encoders'],
                algorithm, current_user['id'], dataset['id'], metrics
            )

            cursor = conn.execute('''
                INSERT INTO model_history (user_id, dataset_id, algorithm, accuracy,
                    precision_score, recall_score, f1_score, roc_auc, model_path,
                    model_size, confusion_matrix, feature_importance)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                current_user['id'], dataset['id'], algorithm,
                metrics['accuracy'], metrics['precision'], metrics['recall'],
                metrics['f1_score'], metrics['roc_auc'], save_info['model_path'],
                save_info['model_size'],
                json.dumps(metrics['confusion_matrix']),
                json.dumps(metrics['feature_importance'])
            ))
            conn.commit()
            conn.close()

            log_activity(current_user['id'], 'train_model', f'Trained {algorithm}: {metrics["accuracy"]:.4f}')

            return jsonify({
                'message': f'{ALGORITHMS[algorithm]["name"]} trained successfully',
                'algorithm': algorithm,
                'accuracy': metrics['accuracy'],
                'precision': metrics['precision'],
                'recall': metrics['recall'],
                'f1_score': metrics['f1_score'],
                'roc_auc': metrics['roc_auc'],
                'confusion_matrix': metrics['confusion_matrix'],
                'feature_importance': metrics['feature_importance'],
                'roc_data': metrics.get('roc_data'),
                'model_size': save_info['model_size'],
            })

    except Exception as e:
        conn.close()
        return jsonify({'error': f'Training failed: {str(e)}'}), 500


@api.route('/accuracy', methods=['GET'])
@token_required
def get_accuracy(current_user):
    conn = get_db()
    models = conn.execute(
        'SELECT * FROM model_history WHERE user_id = ? ORDER BY created_at DESC',
        (current_user['id'],)
    ).fetchall()
    conn.close()

    return jsonify({
        'models': [dict(m) for m in models]
    })


# ─── Prediction Routes ─────────────────────────────────────

@api.route('/predict', methods=['POST'])
@token_required
def predict(current_user):
    data = request.get_json()
    input_data = data.get('input_data', {})
    customer_name = data.get('customer_name', 'Customer')
    algorithm = data.get('algorithm', None)

    conn = get_db()
    dataset = conn.execute(
        'SELECT * FROM datasets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        (current_user['id'],)
    ).fetchone()

    if not dataset:
        conn.close()
        return jsonify({'error': 'No dataset found'}), 400

    if algorithm:
        model_record = conn.execute(
            'SELECT * FROM model_history WHERE user_id = ? AND algorithm = ? ORDER BY created_at DESC LIMIT 1',
            (current_user['id'], algorithm)
        ).fetchone()
    else:
        model_record = conn.execute(
            'SELECT * FROM model_history WHERE user_id = ? ORDER BY accuracy DESC, created_at DESC LIMIT 1',
            (current_user['id'],)
        ).fetchone()

    if not model_record:
        conn.close()
        return jsonify({'error': 'No trained model found. Please train a model first.'}), 400

    try:
        model_data = load_model(model_record['model_path'])
        input_scaled = encode_single_input(
            input_data,
            model_data['label_encoders'],
            model_data.get('feature_names') or [],
            model_data['scaler']
        )
        result = predict_single(model_data, input_scaled)

        prediction_label = 'Churn' if result['prediction'] == 1 else 'Stay'

        cursor = conn.execute('''
            INSERT INTO predictions (user_id, dataset_id, customer_name, input_data,
                prediction_result, probability, algorithm_used)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            current_user['id'], dataset['id'], customer_name,
            json.dumps(input_data), prediction_label,
            result['churn_probability'], model_record['algorithm']
        ))
        conn.commit()
        pred_id = cursor.lastrowid
        conn.close()

        log_activity(current_user['id'], 'predict', f'{customer_name}: {prediction_label} ({result["churn_probability"]:.2%})')

        return jsonify({
            'prediction_id': pred_id,
            'result': prediction_label,
            'probability': result['churn_probability'],
            'stay_probability': 1 - result['churn_probability'],
            'algorithm': model_record['algorithm'],
            'model_accuracy': model_record['accuracy'],
        })

    except Exception as e:
        conn.close()
        return jsonify({'error': f'Prediction failed: {str(e)}'}), 500


@api.route('/history', methods=['GET'])
@token_required
def get_history(current_user):
    conn = get_db()

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '')
    algorithm = request.args.get('algorithm', '')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')

    query = 'SELECT * FROM predictions WHERE user_id = ?'
    params = [current_user['id']]

    if search:
        query += ' AND (customer_name LIKE ? OR prediction_result LIKE ?)'
        params.extend([f'%{search}%', f'%{search}%'])

    if algorithm:
        query += ' AND algorithm_used = ?'
        params.append(algorithm)

    if date_from:
        query += ' AND date(created_at) >= ?'
        params.append(date_from)

    if date_to:
        query += ' AND date(created_at) <= ?'
        params.append(date_to)

    count_query = query.replace('SELECT *', 'SELECT COUNT(*) as count')
    total = conn.execute(count_query, params).fetchone()['count']

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.extend([per_page, (page - 1) * per_page])

    predictions = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify({
        'predictions': [dict(p) for p in predictions],
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page,
    })


@api.route('/prediction/<int:pred_id>', methods=['DELETE'])
@token_required
def delete_prediction(current_user, pred_id):
    conn = get_db()
    pred = conn.execute(
        'SELECT * FROM predictions WHERE id = ? AND user_id = ?',
        (pred_id, current_user['id'])
    ).fetchone()

    if not pred:
        conn.close()
        return jsonify({'error': 'Prediction not found'}), 404

    conn.execute('DELETE FROM predictions WHERE id = ?', (pred_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Prediction deleted'})


# ─── Model History ─────────────────────────────────────────

@api.route('/model-history', methods=['GET'])
@token_required
def get_model_history(current_user):
    conn = get_db()
    models = conn.execute(
        'SELECT * FROM model_history WHERE user_id = ? ORDER BY created_at DESC',
        (current_user['id'],)
    ).fetchall()
    conn.close()

    result = []
    for m in models:
        d = dict(m)
        if d.get('confusion_matrix'):
            d['confusion_matrix'] = json.loads(d['confusion_matrix'])
        if d.get('feature_importance'):
            d['feature_importance'] = json.loads(d['feature_importance'])
        result.append(d)

    return jsonify({'models': result})


@api.route('/model/<int:model_id>/download', methods=['GET'])
@token_required
def download_model(current_user, model_id):
    conn = get_db()
    model_rec = conn.execute(
        'SELECT * FROM model_history WHERE id = ? AND user_id = ?',
        (model_id, current_user['id'])
    ).fetchone()
    conn.close()

    if not model_rec or not os.path.exists(model_rec['model_path']):
        return jsonify({'error': 'Model not found'}), 404

    return send_file(
        model_rec['model_path'],
        as_attachment=True,
        download_name=f"model_{model_rec['algorithm']}.pkl"
    )


@api.route('/model/<int:model_id>', methods=['DELETE'])
@token_required
def delete_model(current_user, model_id):
    conn = get_db()
    model_rec = conn.execute(
        'SELECT * FROM model_history WHERE id = ? AND user_id = ?',
        (model_id, current_user['id'])
    ).fetchone()

    if not model_rec:
        conn.close()
        return jsonify({'error': 'Model not found'}), 404

    try:
        if model_rec['model_path'] and os.path.exists(model_rec['model_path']):
            os.remove(model_rec['model_path'])
    except Exception:
        pass

    conn.execute('DELETE FROM model_history WHERE id = ?', (model_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Model deleted'})


# ─── Reports ───────────────────────────────────────────────

@api.route('/download/pdf', methods=['GET'])
@token_required
def download_pdf(current_user):
    buffer = generate_pdf_report(current_user['id'])
    return send_file(
        buffer, as_attachment=True,
        download_name=f"churn_report_{datetime.now().strftime('%Y%m%d')}.pdf",
        mimetype='application/pdf'
    )


@api.route('/download/csv', methods=['GET'])
@token_required
def download_csv(current_user):
    buffer = generate_csv_report(current_user['id'])
    return send_file(
        buffer, as_attachment=True,
        download_name=f"churn_predictions_{datetime.now().strftime('%Y%m%d')}.csv",
        mimetype='text/csv'
    )


@api.route('/download/excel', methods=['GET'])
@token_required
def download_excel(current_user):
    buffer = generate_excel_report(current_user['id'])
    return send_file(
        buffer, as_attachment=True,
        download_name=f"churn_report_{datetime.now().strftime('%Y%m%d')}.xlsx",
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


# ─── Stats ─────────────────────────────────────────────────

@api.route('/stats', methods=['GET'])
@token_required
def get_stats(current_user):
    conn = get_db()
    uid = current_user['id']

    total_users = conn.execute('SELECT COUNT(*) as c FROM users').fetchone()['c']
    total_datasets = conn.execute('SELECT COUNT(*) as c FROM datasets WHERE user_id = ?', (uid,)).fetchone()['c']
    total_predictions = conn.execute('SELECT COUNT(*) as c FROM predictions WHERE user_id = ?', (uid,)).fetchone()['c']
    total_models = conn.execute('SELECT COUNT(*) as c FROM model_history WHERE user_id = ?', (uid,)).fetchone()['c']

    conn.close()

    return jsonify({
        'total_users': total_users,
        'total_datasets': total_datasets,
        'total_predictions': total_predictions,
        'total_models': total_models,
        'algorithms_available': len(ALGORITHMS),
    })


@api.route('/algorithms', methods=['GET'])
@token_required
def get_algorithms(current_user):
    return jsonify({
        'algorithms': [
            {'key': k, 'name': v['name']}
            for k, v in ALGORITHMS.items()
        ]
    })


@api.route('/activities', methods=['GET'])
@token_required
def get_activities(current_user):
    conn = get_db()
    activities = conn.execute(
        'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        (current_user['id'],)
    ).fetchall()
    conn.close()

    return jsonify({'activities': [dict(a) for a in activities]})
