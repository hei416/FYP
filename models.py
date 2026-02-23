import requests
from typing import List, Optional, Any
from langchain_core.embeddings import Embeddings
from langchain_core.language_models.llms import LLM
from langchain_core.callbacks.manager import CallbackManagerForLLMRun


class HKBUEmbeddings(Embeddings):
    """HKBU Embedding Model Wrapper for LangChain"""
    
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str = "text-embedding-3-small",
        api_version: str = "2024-02-01"
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.api_version = api_version
        self.endpoint = f"{base_url}/deployments/{model}/embeddings?api-version={api_version}"
    
    def _call_api(self, texts: List[str]) -> List[List[float]]:
        """Call HKBU embedding API"""
        headers = {
            "Content-Type": "application/json",
            "api-key": self.api_key
        }
        
        payload = {"input": texts}
        
        try:
            response = requests.post(
                self.endpoint,
                json=payload,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            if "data" in data and isinstance(data["data"], list):
                return [item["embedding"] for item in data["data"]]
            else:
                raise ValueError(f"Unexpected API response format: {data}")
                
        except Exception as e:
            print(f"[ERROR] Embedding API call failed: {str(e)}")
            raise
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of documents"""
        batch_size = 20
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            embeddings = self._call_api(batch)
            all_embeddings.extend(embeddings)
        
        return all_embeddings
    
    def embed_query(self, text: str) -> List[float]:
        """Embed a single query"""
        embeddings = self._call_api([text])
        return embeddings[0]


class HKBULLM(LLM):
    """HKBU LLM Wrapper for LangChain"""
    
    api_key: str
    base_url: str
    model: str = "qwen3-max"
    api_version: str = "2024-11-04"
    temperature: float = 0.3
    max_tokens: int = 400
    
    @property
    def _llm_type(self) -> str:
        return "hkbu_llm"
    
    def _call(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        """Call HKBU LLM API"""
        endpoint = f"{self.base_url}/deployments/{self.model}/chat/completions?api-version={self.api_version}"
        
        headers = {
            "Content-Type": "application/json",
            "api-key": self.api_key
        }
        
        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens
        }
        
        try:
            response = requests.post(
                endpoint,
                json=payload,
                headers=headers,
                timeout=60
            )
            response.raise_for_status()
            data = response.json()
            
            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"]
            else:
                raise ValueError(f"Unexpected API response format: {data}")
                
        except Exception as e:
            print(f"[ERROR] LLM API call failed: {str(e)}")
            raise
    
    @property
    def _identifying_params(self):
        """Get identifying parameters"""
        return {
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens
        }
