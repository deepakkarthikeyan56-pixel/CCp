# Vercel entry point — re-exports the Flask app from backend/app.py
import sys
import os

# Add the backend directory to the path so all backend modules are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import app  # noqa: F401  (Vercel picks up 'app' from this module)
