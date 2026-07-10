import os

# Manual parser to load .env variables into environment if file exists
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
if os.path.exists(env_path):
    try:
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip()
    except Exception as e:
        print(f"Error loading .env file: {e}")

class Config:
    """Base configuration settings for GovConnect Backend."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'govconnect-secret-key-129037')
    DEBUG = True
    
    # Supabase Integration Placeholders (to be configured in Phase 2)
    SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://placeholder-project-id.supabase.co')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY', 'placeholder-anon-key-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    
    # Department Module Custom Settings
    CIVIC_AUTO_ASSIGN = False
    RESCUE_AUTO_ASSIGN = True
    MEDICAL_AUTO_ASSIGN = True
