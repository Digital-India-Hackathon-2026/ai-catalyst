import os
from flask import Flask
from utils.db import init_db
from routes.auth import auth_bp
from routes.asha import asha_bp
from routes.mandal import mandal_bp
from routes.chatbot import chatbot_bp

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
    app.register_blueprint(chatbot_bp)

    from flask import session
    from utils.db import get_db_connection

    @app.context_processor
    def inject_notifications():
        if 'role' in session:
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                if session['role'] == 'asha':
                    cursor.execute("SELECT COUNT(*) FROM notifications WHERE user_role = 'asha' AND village = ? AND is_read = 0;", (session['village'],))
                    unread_count = cursor.fetchone()[0]
                    cursor.execute("SELECT * FROM notifications WHERE user_role = 'asha' AND village = ? ORDER BY created_at DESC LIMIT 5;", (session['village'],))
                    recent_notifs = cursor.fetchall()
                else:
                    cursor.execute("SELECT COUNT(*) FROM notifications WHERE user_role = 'mandal' AND is_read = 0;")
                    unread_count = cursor.fetchone()[0]
                    cursor.execute("SELECT * FROM notifications WHERE user_role = 'mandal' ORDER BY created_at DESC LIMIT 5;")
                    recent_notifs = cursor.fetchall()
                conn.close()
                return dict(unread_notifications_count=unread_count, recent_notifications=recent_notifs)
            except Exception:
                pass
        return dict(unread_notifications_count=0, recent_notifications=[])

    return app

if __name__ == '__main__':
    app = create_app()
    # Running on local port 8000 to avoid conflicting with other services (like GovConnect on 5000)
    print("ASHA Workers Smart Inventory System running on http://127.0.0.1:8000")
    app.run(host='127.0.0.1', port=8000, debug=True)
