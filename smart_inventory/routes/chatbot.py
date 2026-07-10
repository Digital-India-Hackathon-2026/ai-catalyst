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
    system_prompt = f"""You are the "ASHA AI Assistant", a professional and highly helpful assistant built directly into the ASHA Inventory System.
Your job is to help ASHA workers manage their medicine inventory, answer health questions, and guide them on using the system.
You MUST be concise, professional, and use a friendly tone. You can use markdown for formatting (bullet points, bold text).

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

Rules:
1. Always base your inventory answers on the context above.
2. If asked how to do something in the app (e.g., "How do I request medicines?"), guide them to click the buttons like "Give Medicine" or "Ask for More" in the sidebar or dashboard.
3. Keep responses brief but informative.
"""

    # 3. Call Groq API
    data = {
        "model": "llama-3.1-8b-instant",
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
