import os
import json
import urllib.request
import urllib.error

def analyze_emergency_with_gemini(description: str, image_b64: str = None) -> dict:
    """
    Calls the Gemini API to analyze emergency description and optional image.
    Returns a dict conforming to Phase 4 requirements, or returns None if it fails.
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print("[Gemini Service] GEMINI_API_KEY not found in environment.")
        return None

    # Construct the prompt requesting structured JSON output
    system_instruction = (
        "You are the GovConnect Rescue Dispatch AI. Analyze this emergency report to classify and recommend dispatch actions. "
        "You must return a JSON object with exactly the following fields (do not include markdown formatting or backticks around the JSON, just return raw JSON text):\n"
        "{\n"
        "  \"incident_type\": \"Type of emergency (e.g. Fire Emergency, Road Accident, Flood / Water Rescue, Hazardous Material Incident, Electrical Emergency, Fallen Tree / Debris, etc.)\",\n"
        "  \"severity\": \"Must be exactly one of: 'Critical', 'High', 'Medium', 'Low'\",\n"
        "  \"ai_decision_summary\": \"A clear, professional summary of the situation and reasoning for the classification\",\n"
        "  \"recommended_team\": \"Must be exactly one of: 'Fire Response Unit', 'Flood Rescue (NDRF)', 'SDRF Structural Response Team', 'Hazmat Response Unit', 'Emergency Response Team', 'Electrical Emergency Unit', 'Civic Emergency Team'\",\n"
        "  \"recommended_departments\": \"Comma-separated list of departments involved (e.g. 'Fire Services, Disaster Management, Health Dept')\",\n"
        "  \"possible_risks\": \"A comma-separated list of potential hazards at the scene\",\n"
        "  \"suggested_actions\": \"Immediate steps/actions that the rescue team should take\",\n"
        "  \"response_time_minutes\": Estimated time in minutes for team to arrive (an integer),\n"
        "  \"confidence_score\": Confidence level between 0 and 100 (an integer)\n"
        "}"
    )

    prompt = f"Analyze the following emergency report:\nDescription: {description}"

    parts = [{"text": prompt}]

    # If there is image evidence, attach it to parts
    if image_b64:
        try:
            # Parse the mime type and clean up the base64 string
            if ',' in image_b64:
                header, base64_data = image_b64.split(',', 1)
                mime_type = header.split(';')[0].split(':')[1]
            else:
                base64_data = image_b64
                mime_type = "image/jpeg"

            parts.append({
                "inlineData": {
                    "mimeType": mime_type,
                    "data": base64_data
                }
            })
        except Exception as img_err:
            print(f"[Gemini Service] Error parsing image base64: {img_err}")

    # Build request body
    req_body = {
        "contents": [{
            "parts": parts
        }],
        "systemInstruction": {
            "parts": [{"text": system_instruction}]
        },
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}

    try:
        data_bytes = json.dumps(req_body).encode('utf-8')
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method='POST')
        
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode('utf-8')
            res_json = json.loads(res_body)
            
            # Extract content text
            text_response = res_json['candidates'][0]['content']['parts'][0]['text']
            
            # Parse response JSON
            ai_result = json.loads(text_response.strip())
            return ai_result

    except Exception as e:
        print(f"[Gemini Service] API call failed: {e}")
        return None
