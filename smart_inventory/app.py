import os
from flask import Flask
from utils.db import init_db
from routes.auth import auth_bp
from routes.asha import asha_bp
from routes.mandal import mandal_bp

def create_app():
    # Set templates and static folder paths relative to this file
    app = Flask(__name__, 
                template_folder='templates',
                static_folder='static')
    
    app.secret_key = os.urandom(24)

    # Initialize SQLite database
    init_db()

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(asha_bp)
    app.register_blueprint(mandal_bp)

    return app

if __name__ == '__main__':
    app = create_app()
    # Running on local port 8000 to avoid conflicting with other services (like GovConnect on 5000)
    print("ASHA Workers Smart Inventory System running on http://127.0.0.1:8000")
    app.run(host='127.0.0.1', port=8000, debug=True)
