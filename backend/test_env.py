import os
from dotenv import load_dotenv

load_dotenv()
uri = os.environ.get('MONGO_URI')
print(f"MONGO_URI from env: {uri}")

if uri:
    from pymongo import MongoClient
    try:
        client = MongoClient(uri)
        client.admin.command('ping')
        print("Ping successful!")
    except Exception as e:
        print(f"Ping failed: {e}")
else:
    print("MONGO_URI not found in environment")
