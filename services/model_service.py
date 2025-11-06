import requests
from typing import List, Dict
from core.config import MODEL_API_VERSIONS, MODEL_ENDPOINTS, BASE_URL, API_KEY
from core.utils import get_model_type

def call_model(deployment: str, messages: List[Dict[str, str]]) -> str:
    api_version = MODEL_API_VERSIONS.get(deployment)
    model_type = get_model_type(deployment)
    endpoint = MODEL_ENDPOINTS.get(model_type)
    url = f"{BASE_URL}/deployments/{deployment}{endpoint}?api-version={api_version}"
    headers = {"Content-Type": "application/json", "api-key": API_KEY}

    if model_type in {"gpt", "deepseek"}:
        payload = {"messages": messages}
    elif model_type == "gemini":
        contents = [{"role": m["role"], "parts": [{"text": m["content"]}]} for m in messages]
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "candidateCount": 1,
                "topP": 0.95,
                "topK": 40
            },
            "stream": False
        }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if model_type in {"gpt", "deepseek"}:
            return data["choices"][0]["message"]["content"]
        if model_type == "gemini":
            return data["candidates"][0]["content"]["parts"][0]["text"]
        return "Unexpected response format"
    except Exception as e:
        print(f"[ERROR] Model {deployment} call failed: {str(e)}")
        return f"Model API error: {str(e)}"
