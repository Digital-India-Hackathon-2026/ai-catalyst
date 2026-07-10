import urllib.request
import urllib.error
import json
import sqlite3
from datetime import datetime
import os
from flask import Blueprint, request, jsonify, session
from utils.db import get_db_connection

chatbot_bp = Blueprint('chatbot', __name__)

# Load .env manually to avoid extra pip dependencies
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v.strip(' "\'')

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

@chatbot_bp.route('/api/chat', methods=['POST'])
def chat():
    if 'role' not in session or session.get('role') != 'asha':
        return jsonify({"error": "Unauthorized. Only ASHA workers can use the AI Assistant."}), 403

    user_message = request.json.get('message', '')
    village = session.get('village', 'Unknown')
    
    # 1. Fetch Real-time Context from Database
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Current Inventory & Low Stock
    cursor.execute("""
        SELECT medicine_name, category, quantity, unit, minimum_stock
        FROM medicines
        WHERE village = ?
    """, (village,))
    inventory = cursor.fetchall()
    
    inventory_details = []
    low_stock_details = []
    total_stock = 0
    for item in inventory:
        med = f"- {item['medicine_name']}: {item['quantity']} {item['unit']}"
        inventory_details.append(med)
        total_stock += item['quantity']
        if item['quantity'] <= item['minimum_stock']:
            low_stock_details.append(f"{item['medicine_name']} (Only {item['quantity']} left, Min: {item['minimum_stock']})")

    # Today's Distributions
    today_str = datetime.now().strftime("%Y-%m-%d")
    cursor.execute("""
        SELECT medicine_name, SUM(d.quantity) as total_given
        FROM distributions d
        JOIN medicines m ON d.medicine_id = m.id
        WHERE d.village = ? AND d.distributed_date = ?
        GROUP BY medicine_name
    """, (village, today_str))
    distributions = cursor.fetchall()
    
    dist_details = []
    for item in distributions:
        dist_details.append(f"- {item['medicine_name']}: {item['total_given']} given")

    # Pending Requests
    cursor.execute("""
        SELECT m.medicine_name, r.requested_quantity, r.status
        FROM medicine_requests r
        JOIN medicines m ON r.medicine_id = m.id
        WHERE r.village = ? AND r.status = 'Pending'
    """, (village,))
    pending_requests = cursor.fetchall()
    
    req_details = []
    for item in pending_requests:
        req_details.append(f"- {item['medicine_name']}: {item['requested_quantity']} requested")

    conn.close()

    # 2. Build System Prompt
    system_prompt = f"""You are ASHA AI Assistant.

========================
CRITICAL LANGUAGE RULE
========================

This rule has the highest priority and must NEVER be ignored.

For EVERY user message:

Step 1:
Detect the language of the user's latest message.

Step 2:
Reply ONLY in that language.

Rules:

• English input → Reply ONLY in English.
• Telugu input → Reply ONLY in Telugu.


Never translate your answer into another language unless the user explicitly asks.

Never answer in Telugu if the user's message is completely in English.

Never answer in English if the user's message is completely in Telugu.

If the message mixes languages, determine which language is dominant.
Reply only in the dominant language.

Examples

User:
How many ORS packets are available?

Assistant:
There are 24 ORS packets currently available.

----------------------

User:
నాకు జ్వరం వచ్చింది.

Assistant:
మీకు జ్వరం ఉంటే, దయచేసి సమీప ఆరోగ్య కేంద్రాన్ని సంప్రదించండి. అవసరమైతే వైద్యుడి సూచన మేరకు మందులు వాడండి.

----------------------

User:
Paracetamol stock ఎంత ఉంది?

Assistant:
మీ దగ్గర ప్రస్తుతం 120 Paracetamol మాత్రలు ఉన్నాయి.

========================
ROLE
========================

You are an assistant for ASHA workers.

Help with:

• Medicine inventory
• Stock availability
• Medicine requests
• Patient medicine distribution
• Government health schemes
• Basic medicine information

========================
RESPONSE STYLE
========================

• Keep answers short.
• Be polite.
• Use simple language.
• Never switch languages.
• Follow only the language of the latest user message.

========================
MEDICAL SAFETY
========================

Do not diagnose diseases.

Do not prescribe medicines.

Provide general health information only.

For emergencies, advise visiting the nearest PHC or hospital.

---
REAL-TIME DATA CONTEXT FOR THE CURRENT ASHA WORKER (Village: {village})
Use this data to answer the user's questions. DO NOT invent or hallucinate data. If a medicine is not listed, say they don't have it in stock.

CURRENT INVENTORY:
{chr(10).join(inventory_details) if inventory_details else "No inventory found."}

LOW STOCK ALERTS:
{chr(10).join(low_stock_details) if low_stock_details else "No medicines are currently running low."}

DISTRIBUTED TODAY:
{chr(10).join(dist_details) if dist_details else "No medicines distributed today."}

PENDING REQUESTS:
{chr(10).join(req_details) if req_details else "No pending medicine requests."}
---
"""

    # 3. Call Groq API
    data = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.5,
        "max_tokens": 512
    }
    
    req = urllib.request.Request(
        GROQ_API_URL,
        data=json.dumps(data).encode('utf-8'),
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            ai_reply = result['choices'][0]['message']['content']
            return jsonify({"response": ai_reply})
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode('utf-8')
        print(f"Groq API Error: {error_msg}")
        return jsonify({"error": "Sorry, I am currently unavailable. Please try again later."}), 500
    except Exception as e:
        print(f"Chatbot Exception: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500

@chatbot_bp.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    if 'role' not in session or session.get('role') != 'asha':
        return jsonify({"error": "Unauthorized"}), 403

    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    audio_data = audio_file.read()

    # Manually construct multipart/form-data for urllib
    import uuid
    boundary = uuid.uuid4().hex
    
    body = b''
    # File part
    body += f"--{boundary}\r\n".encode('utf-8')
    body += f'Content-Disposition: form-data; name="file"; filename="recording.webm"\r\n'.encode('utf-8')
    body += f'Content-Type: audio/webm\r\n\r\n'.encode('utf-8')
    body += audio_data + b'\r\n'
    
    # Model part
    body += f"--{boundary}\r\n".encode('utf-8')
    body += f'Content-Disposition: form-data; name="model"\r\n\r\n'.encode('utf-8')
    body += f'whisper-large-v3-turbo\r\n'.encode('utf-8')

    # Prompt part to force Telugu/English scripts
    body += f"--{boundary}\r\n".encode('utf-8')
    body += f'Content-Disposition: form-data; name="prompt"\r\n\r\n'.encode('utf-8')
    body += f'Hello. నమస్కారం. నాకు మందులు కావాలి. I need medicines. (Please use Telugu script for Telugu words, do not use Hindi Devanagari).\r\n'.encode('utf-8')
    
    body += f"--{boundary}--\r\n".encode('utf-8')

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        data=body,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "Mozilla/5.0"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            return jsonify({"text": result.get("text", "")})
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode('utf-8')
        print(f"Groq Audio API Error: {error_msg}")
        return jsonify({"error": "Voice recognition currently unavailable."}), 500
    except Exception as e:
        print(f"Audio Exception: {str(e)}")
        return jsonify({"error": "An unexpected error occurred during transcription."}), 500

from flask import Response

@chatbot_bp.route('/api/synthesize', methods=['POST'])
def synthesize_audio():
    if 'role' not in session or session.get('role') != 'asha':
        return jsonify({"error": "Unauthorized"}), 403

    if not DEEPGRAM_API_KEY:
        return jsonify({"error": "Deepgram API key not configured in .env file."}), 500

    data = request.json
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400

    text = data.get("text", "").strip()
    
    # Strip basic markdown for cleaner speech reading
    clean_text = text.replace('*', '').replace('#', '').strip()

    payload = json.dumps({"text": clean_text}).encode('utf-8')

    req = urllib.request.Request(
        "https://api.deepgram.com/v1/speak?model=aura-asteria-en",
        data=payload,
        headers={
            "Authorization": f"Token {DEEPGRAM_API_KEY}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        response = urllib.request.urlopen(req)
        audio_data = response.read()
        return Response(audio_data, mimetype="audio/mpeg")
    except Exception as e:
        print(f"Deepgram TTS Exception: {str(e)}")
        return jsonify({"error": "Failed to generate speech via Deepgram."}), 500
