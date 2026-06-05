import requests

LOGIN_URL = "http://localhost:5000/api/auth/login"
PROFILE_URL = "http://localhost:5000/api/auth/profile"

data = {
    "email": "s25_abdul_rahman@mgmcen.ac.in",
    "password": "Student@123"
}

response = requests.post(LOGIN_URL, json=data)
if response.status_code == 200:
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    profile_response = requests.get(PROFILE_URL, headers=headers)
    print("Status Code:", profile_response.status_code)
    print("Profile Data:", profile_response.json())
else:
    print("Login failed:", response.status_code, response.text)
