import os
from dotenv import load_dotenv

load_dotenv(override=True)

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'super-secret-key-change-me'
    MONGO_URI = os.environ.get('MONGO_URI') or 'mongodb+srv://ashaikh49096_db_user:<db_password>@cluster0.a5iwugk.mongodb.net/?appName=Cluster0'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-string-change-me'
    JWT_ACCESS_TOKEN_EXPIRES = 3600 # 1 hour
    FRONTEND_URL = os.environ.get('FRONTEND_URL') or 'http://localhost:5173'
    MAIL_SERVER = os.environ.get('MAIL_SERVER') or 'smtp.gmail.com'
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 587)
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_SENDER = os.environ.get('MAIL_SENDER') or MAIL_USERNAME
