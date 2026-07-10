import os

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
