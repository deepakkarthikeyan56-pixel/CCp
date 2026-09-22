import os
import sys

# Ensure all sibling backend modules are importable regardless of CWD
# (needed when Vercel invokes this file from the project root)
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from flask import Flask, send_from_directory
from flask_cors import CORS
from database import init_db
from routes import api

app = Flask(__name__, static_folder='../frontend/build', static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.register_blueprint(api, url_prefix='/api')

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'build')


@app.route('/')
def serve_frontend():
    if os.path.exists(os.path.join(FRONTEND_DIR, 'index.html')):
        return send_from_directory(FRONTEND_DIR, 'index.html')
    return '<h1>Customer Churn Prediction API</h1><p>Frontend not built. Run: cd frontend && npm run build</p>'


@app.route('/<path:path>')
def serve_static(path):
    file_path = os.path.join(FRONTEND_DIR, path)
    if os.path.exists(file_path):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.errorhandler(404)
def not_found(e):
    return '<h1>404 Not Found</h1>', 404


@app.errorhandler(500)
def server_error(e):
    return '<h1>Internal Server Error</h1>', 500


if __name__ == '__main__':
    init_db()
    print("=" * 60)
    print("  Customer Churn Prediction System")
    print("  Server running at http://localhost:5000")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)
