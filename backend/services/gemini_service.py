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
        "You are the GovConnect Rescue Dispatch AI. Analyze the emergency report below.\n"
        "Do NOT assign or suggest a specific rescue team or unit name — the system handles this operationally.\n\n"

        "LANGUAGE DETECTION:\n"
        "Detect the primary language used in the citizen's complaint. Only three languages are supported:\n"
        "  - English\n"
        "  - Hindi\n"
        "  - Telugu\n"
        "If the language is not one of these three, treat it as English.\n\n"

        "OUTPUT FORMAT:\n"
        "Return ONLY a single valid JSON object at the root level with exactly two keys:\n"
        "  1. \"system_analysis\" — always written in English, for internal dispatch use.\n"
        "  2. \"citizen_analysis\" — written in the SAME language as the citizen's complaint.\n\n"

        "Each of the two objects must contain exactly these fields:\n"
        "{\n"
        "  \"incident_type\": \"Type of emergency (e.g. Fire Emergency, Road Accident, Flood / Water Rescue, Hazardous Material Incident, Electrical Emergency, Fallen Tree / Debris, etc.)\",\n"
        "  \"severity\": \"Must be exactly one of: Critical, High, Medium, Low\",\n"
        "  \"confidence_score\": \"Integer between 0 and 100\",\n"
        "  \"ai_summary\": \"A clear professional summary of the situation and reasoning\",\n"
        "  \"required_departments\": [\"List of required departments as strings\"],\n"
        "  \"possible_risks\": [\"List of potential hazards as strings\"],\n"
        "  \"suggested_rescue_actions\": [\"List of immediate recommended actions as strings\"],\n"
        "  \"estimated_response_time\": \"Estimated response time in minutes as a number\",\n"
        "  \"landmark\": \"Notable landmark from context or image, or empty string\",\n"
        "  \"address\": \"Address from context or image, or empty string\"\n"
        "}\n\n"

        "RULES:\n"
        "- system_analysis values must always be in English regardless of citizen language.\n"
        "- citizen_analysis values must be fully translated into the citizen's detected language.\n"
        "- severity in both objects must always use the English words: Critical, High, Medium, Low.\n"
        "- Do not include markdown, backticks, or any text outside the JSON.\n"
        "- Return raw valid JSON only.\n\n"

        "EXAMPLE OUTPUT STRUCTURE (do not copy values, only the structure):\n"
        "{\n"
        "  \"system_analysis\": {\n"
        "    \"incident_type\": \"Fire Emergency\",\n"
        "    \"severity\": \"Critical\",\n"
        "    \"confidence_score\": 95,\n"
        "    \"ai_summary\": \"...\",\n"
        "    \"required_departments\": [\"Fire Services\"],\n"
        "    \"possible_risks\": [\"structural collapse\"],\n"
        "    \"suggested_rescue_actions\": [\"evacuate area\"],\n"
        "    \"estimated_response_time\": 8,\n"
        "    \"landmark\": \"...\",\n"
        "    \"address\": \"...\"\n"
        "  },\n"
        "  \"citizen_analysis\": {\n"
        "    \"incident_type\": \"అగ్ని అత్యవసరం\",\n"
        "    \"severity\": \"Critical\",\n"
        "    \"confidence_score\": 95,\n"
        "    \"ai_summary\": \"...(in citizen language)...\",\n"
        "    \"required_departments\": [\"అగ్నిమాపక సేవలు\"],\n"
        "    \"possible_risks\": [\"నిర్మాణ పతనం\"],\n"
        "    \"suggested_rescue_actions\": [\"ప్రాంతాన్ని ఖాళీ చేయండి\"],\n"
        "    \"estimated_response_time\": 8,\n"
        "    \"landmark\": \"...\",\n"
        "    \"address\": \"...\"\n"
        "  }\n"
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

    # Auto-detect key type:
    #   AIza...  → standard API key via ?key= query param
    #   AQ....   → OAuth2 bearer token via Authorization header
    if api_key.startswith('AIza'):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
    else:
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

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
