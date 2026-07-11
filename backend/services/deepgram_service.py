import urllib.request
import urllib.error
import json
import os

def transcribe_audio(audio_data, content_type='audio/webm'):
    """
    Transcribes raw binary audio data using the Deepgram API.
    Uses Python's native urllib.request to maintain zero dependency.
    """
    api_key = os.environ.get('DEEPGRAM_API_KEY')
    if not api_key:
        raise ValueError("DEEPGRAM_API_KEY environment variable is not configured on the server.")

    # We use model=nova-2, enable smart formatting (punctuation), and detect_language=true to support multi-language speech.
    url = "https://api.deepgram.com/v1/listen?smart_format=true&model=nova-2&detect_language=true"

    req = urllib.request.Request(
        url,
        data=audio_data,
        headers={
            "Authorization": f"Token {api_key}",
            "Content-Type": content_type
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_data = response.read()
            res_json = json.loads(res_data.decode('utf-8'))
            
            # Navigate Deepgram's standard response object structure
            channels = res_json.get('results', {}).get('channels', [])
            if not channels:
                raise ValueError("Deepgram transcription returned empty channels.")
            
            alternatives = channels[0].get('alternatives', [])
            if not alternatives:
                raise ValueError("Deepgram transcription returned empty alternatives.")
            
            transcript = alternatives[0].get('transcript', '')
            
            # Map detected language to full name: English, Hindi, Telugu. Default to English.
            dg_lang = channels[0].get('detected_language') or 'en'
            lang_mapping = {
                'en': 'English',
                'hi': 'Hindi',
                'te': 'Telugu'
            }
            language_name = lang_mapping.get(dg_lang[:2].lower(), 'English')
            
            return transcript.strip(), language_name
            
    except urllib.error.HTTPError as he:
        err_msg = he.read().decode('utf-8')
        try:
            err_json = json.loads(err_msg)
            deepgram_err = err_json.get('err_msg') or err_json.get('message') or err_msg
        except Exception:
            deepgram_err = err_msg
        raise RuntimeError(f"Deepgram service error: {deepgram_err}")
    except Exception as e:
        raise RuntimeError(f"Transcription failed: {str(e)}")
