import os
import json
import urllib.request
import urllib.error

def detect_language(text: str, api_key: str) -> str:
    """
    Detects if the primary language of the text is English, Hindi, or Telugu.
    Uses Unicode script checks first for native characters, then falls back to Gemini for Latin transliterated script (Hinglish/Teluglish).
    """
    if not text:
        return "English"

    # 1. Direct Unicode Script Check
    has_telugu = any('\u0c00' <= char <= '\u0c7f' for char in text)
    has_hindi = any('\u0900' <= char <= '\u097f' for char in text)
    if has_telugu:
        return "Telugu"
    if has_hindi:
        return "Hindi"

    # 2. Call Gemini for Latin-script Hindi (Hinglish) / Telugu (Teluglish) / English
    system_instruction = (
        "Identify the primary spoken language of the user's text. "
        "Choose only from: English, Hindi, Telugu. "
        "Even if written in Latin/English script (like Hinglish or Teluglish), detect the spoken language. "
        "Your response must be exactly one word: 'English', 'Hindi', or 'Telugu'. Default to 'English' if unsure."
    )
    
    req_body = {
        "contents": [{"parts": [{"text": f"Text to analyze: {text}"}]}],
        "systemInstruction": {
            "parts": [{"text": system_instruction}]
        }
    }
    
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
        with urllib.request.urlopen(req, timeout=5) as response:
            res_body = response.read().decode('utf-8')
            res_json = json.loads(res_body)
            detected = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
            cleaned = detected.split('\n')[0].strip().replace('*', '').replace('`', '')
            if "telugu" in cleaned.lower():
                return "Telugu"
            if "hindi" in cleaned.lower():
                return "Hindi"
            return "English"
    except Exception as e:
        print(f"[Gemini Service] Language detection call failed: {e}")
        return "English"


def analyze_emergency_with_gemini(description: str, image_b64: str = None, detected_language: str = None) -> dict:
    """
    Calls the Gemini API to analyze emergency description and optional image.
    Returns a dict with 'system_analysis' and 'citizen_analysis'.
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print("[Gemini Service] GEMINI_API_KEY not found in environment.")
        return None

    # Detect language if not provided
    if not detected_language:
        detected_language = detect_language(description, api_key)

    print(f"[Gemini Service] Processing report with detected language: {detected_language}")

    # Construct the prompt requesting structured JSON output
    system_instruction = (
        "You are the GovConnect Rescue Dispatch AI. Analyze the emergency report below.\n"
        "Do NOT assign or suggest a specific rescue team or unit name — the system handles this operationally.\n\n"

        f"LANGUAGE INSTRUCTION:\n"
        f"The citizen's complaint has been identified as: {detected_language}.\n"
        f"You must translate and write all values in \"citizen_analysis\" in that exact language ({detected_language}).\n"
        f"If the language is English, keep it in English. If Hindi, translate/write in Hindi. If Telugu, translate/write in Telugu.\n\n"

        "OUTPUT FORMAT:\n"
        "Return ONLY a single valid JSON object at the root level with exactly two keys:\n"
        "  1. \"system_analysis\" — always written in English, for internal dispatch use.\n"
        "  2. \"citizen_analysis\" — written in the citizen's language (English, Hindi, or Telugu).\n\n"

        "Each of the two objects must contain exactly these fields:\n"
        "{\n"
        "  \"incident_type\": \"Type of emergency (e.g. Fire Emergency, Road Accident, etc.)\",\n"
        "  \"severity\": \"Must be Critical, High, Medium, or Low\",\n"
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
        "- system_analysis values must always be in English. Severity MUST be exactly one of: Critical, High, Medium, Low.\n"
        f"- citizen_analysis values must be fully translated into the detected language ({detected_language}).\n"
        f"- In citizen_analysis, ALL values (including severity, incident_type, ai_summary, possible_risks, etc.) must be in the target language.\n"
        "- Do not include markdown, backticks, or any text outside the JSON. Return raw valid JSON only.\n"
    )

    prompt = (
        f"Analyze the following emergency report:\n"
        f"Description: {description}\n"
        f"Detected Language: {detected_language}"
    )

    parts = [{"text": prompt}]

    # If there is image evidence, attach it to parts
    if image_b64:
        try:
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
