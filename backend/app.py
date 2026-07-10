from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from config import Config
from routes.civic import civic_bp
from routes.rescue import rescue_bp
from routes.medical import medical_bp
from db import init_db
import os

# Load environment variables from .env file
load_dotenv()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize SQLite database
    init_db()
    
    # Enable Cross-Origin Resource Sharing (CORS) for development
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Register API Blueprints
    app.register_blueprint(civic_bp)
    app.register_blueprint(rescue_bp)
    app.register_blueprint(medical_bp)
    
    @app.route('/', methods=['GET'])
    def index():
        return jsonify({
            "portal": "Smart Government Services Portal (GovConnect) API",
            "version": "1.0.0",
            "phase": "Phase 1 - Complete",
            "status": "Online"
        })
        
    return app

if __name__ == '__main__':
    app = create_app()
    print("GovConnect Flask API running on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
