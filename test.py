import requests

url = "http://localhost:8001/explain"
data = {
    "user_input": "Explain NullPointerException in Java.",
    "code_snippet": "",
    "history": []
}

response = requests.post(url, json=data)
print(response.json())
