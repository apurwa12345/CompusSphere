import urllib.parse
from pymongo import MongoClient
import os

username = urllib.parse.quote_plus('ashaikh49096_db_user')
password = urllib.parse.quote_plus('Shaikh@1234567')

uri = f"mongodb+srv://{username}:{password}@cluster0.a5iwugk.mongodb.net/?authSource=admin&appName=Cluster0"
print(f"Generated URI: {uri}")

try:
    client = MongoClient(uri)
    client.admin.command('ping')
    print("Ping successful!")
except Exception as e:
    print(f"Ping failed: {e}")
