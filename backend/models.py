import os
import openai
from typing import Any, List, Optional


def _configure_openai_base(base_url: Optional[str], api_key: Optional[str], api_version: Optional[str] = None):
    """Configure openai.client globals to use the HKBU OpenAI-compatible route.

    The HKBU server exposes an OpenAI-compatible path under `/openai`.
    """
    if not base_url:
        return

    # Ensure we have a base that points to the OpenAI-compatible route
    if base_url.rstrip('/').endswith('/openai'):
        api_base = base_url.rstrip('/')
    else:
        api_base = base_url.rstrip('/') + '/openai'

    openai.api_key = api_key
    openai.api_base = api_base


class HKBUEmbeddings:
    """Wrapper around LangChain/OpenAI embeddings configured for HKBU.

    If LangChain's `OpenAIEmbeddings` is available we instantiate it with
    the HKBU OpenAI-compatible base. Otherwise we fall back to a simple
    requests-based implementation (not required for typical setups).
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None,
                 model: Optional[str] = None, api_version: Optional[str] = None, **kwargs: Any):
        self.api_key = api_key or os.getenv('HKBU_API_KEY') or os.getenv('API_KEY')
        self.base_url = base_url or os.getenv('HKBU_BASE_URL') or os.getenv('BASE_URL')
        self.model = model or os.getenv('EMBEDDING_MODEL')
        self.api_version = api_version or os.getenv('EMBEDDING_API_VERSION')

        _configure_openai_base(self.base_url, self.api_key, self.api_version)

        # Do NOT instantiate LangChain's OpenAIEmbeddings here because it
        # will call the wrong `/openai/embeddings` path (missing
        # `/deployments/{model}/`). Use direct HTTP calls to the HKBU
        # OpenAI-compatible `/openai/deployments/{model}/embeddings` route.
        self._impl = None

    def embed_query(self, text: str) -> List[float]:
        if self._impl:
            return self._impl.embed_query(text)

        # Minimal HTTP fallback using the HKBU direct REST embeddings route
        import requests
        import time as _time
        url = (
            f"{(self.base_url or '').rstrip('/')}"
            f"/deployments/{self.model}/embeddings?api-version={self.api_version}"
        )
        max_retries = 6
        for attempt in range(max_retries):
            resp = requests.post(
                url,
                headers={
                    'api-key': self.api_key,
                    'Content-Type': 'application/json'
                },
                json={'input': text}
            )
            if resp.status_code in (429, 403):
                wait = 2 ** attempt * 10
                print(f"  ⏳ HTTP {resp.status_code}, retrying in {wait}s... (attempt {attempt + 1}/{max_retries})")
                _time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()['data'][0]['embedding']
        resp.raise_for_status()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if self._impl:
            return self._impl.embed_documents(texts)

        # Batch all texts in a single API call (OpenAI accepts input as a list)
        import requests
        import time as _time
        url = (
            f"{(self.base_url or '').rstrip('/')}"
            f"/deployments/{self.model}/embeddings?api-version={self.api_version}"
        )
        max_retries = 6
        for attempt in range(max_retries):
            resp = requests.post(
                url,
                headers={
                    'api-key': self.api_key,
                    'Content-Type': 'application/json'
                },
                json={'input': texts}
            )
            if resp.status_code in (429, 403):
                wait = 2 ** attempt * 10  # 10s, 20s, 40s, 80s, 160s, 320s
                print(f"  ⏳ HTTP {resp.status_code}, retrying in {wait}s... (attempt {attempt + 1}/{max_retries})")
                _time.sleep(wait)
                continue
            resp.raise_for_status()
            data = resp.json()['data']
            # data is sorted by index
            return [item['embedding'] for item in sorted(data, key=lambda x: x['index'])]
        resp.raise_for_status()


class HKBULLM:
    """Light wrapper that configures LangChain ChatOpenAI to use HKBU OpenAI route.

    If `langchain.chat_models.ChatOpenAI` is available we instantiate it so
    the object behaves as a LangChain LLM. Otherwise a minimal requests-based
    `__call__` is provided for basic usage.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None,
                 model: Optional[str] = None, api_version: Optional[str] = None,
                 temperature: float = 0.0, max_tokens: int = 512, **kwargs: Any):
        self.api_key = api_key or os.getenv('HKBU_API_KEY') or os.getenv('API_KEY')
        self.base_url = base_url or os.getenv('HKBU_BASE_URL') or os.getenv('BASE_URL')
        self.model = model or os.getenv('FAISS_MODEL_NAME')
        self.api_version = api_version or os.getenv('FAISS_API_VERSION')
        self.temperature = temperature
        self.max_tokens = max_tokens

        _configure_openai_base(self.base_url, self.api_key, self.api_version)

        # Skip LangChain's ChatOpenAI completely — use the REST fallback below.
        self._impl = None

    def __call__(self, prompt, **kwargs):
        # Always use direct REST call to HKBU-compatible endpoint.
        import requests
        url = f"{(self.base_url or '').rstrip('/')}/deployments/{self.model}/chat/completions?api-version={self.api_version}"
        messages = prompt if isinstance(prompt, list) else [{"role": "user", "content": str(prompt)}]
        payload = {
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
        # Allow caller to override or pass extra fields via kwargs
        payload.update(kwargs.get('json', {}))
        headers = {
            'api-key': self.api_key,
            'Content-Type': 'application/json'
        }
        resp = requests.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()['choices'][0]['message']['content']
