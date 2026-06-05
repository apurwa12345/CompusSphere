# College Student Management and Examination Portal

A full-stack web application for managing college academics, students, faculty, examinations, marks, results, fees, notifications, and role-based dashboards.

## Overview

This project is built for a college environment with separate access for Admin, Exam Cell, Faculty, Students, and Accountant users. It supports institutional email login, protected role-based routes, student profile management, exam workflows, marks entry, result processing, hall tickets, fee records, notifications, and a student-only forgot-password flow using Gmail OTP.

## Tech Stack

### Frontend

- React
- Vite
- React Router
- Tailwind CSS
- Axios
- Lucide React icons
- Recharts
- jsPDF, html2canvas, html-to-image
- xlsx
- qrcode

### Backend

- Python
- Flask
- Flask-CORS
- Flask-JWT-Extended
- Flask-PyMongo / PyMongo
- Werkzeug password hashing
- python-dotenv
- Gmail SMTP for password reset OTP

### Database

- MongoDB 

## Main Features

- Role-based login for Admin, Exam Cell, Faculty, Student, and Accountant
- Protected dashboards and routes based on user role
- Institutional email validation using `@mgmcen.ac.in`
- Admin student management
- Staff account creation for Faculty, Exam Cell, and Accountant
- Department, subject, and academic setup
- Exam setup and form workflows
- Internal and external marks management
- Result processing and result publishing
- Hall ticket generation and student hall ticket view
- Student profile, subjects, exams, fees, and results pages
- Accountant fee collection and partial payment records
- Notifications and audit logs
- Student-only forgot password using Gmail OTP

## Project Structure

```text
Final1/
  backend/
    app/
      routes/
      utils/
    config.py
    requirements.txt
    run.py
    .env
  frontend/
    src/
      components/
      context/
      pages/
      services/
    package.json
    vite.config.js
```

## Prerequisites

- Node.js and npm
- Python 3.10 or later
- MongoDB connection string
- Gmail account with an App Password for OTP email sending

## Backend Setup

Go to the backend folder:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python -m venv venv
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create or update `backend/.env`:

```env
SECRET_KEY=change-this-secret
JWT_SECRET_KEY=change-this-jwt-secret
MONGO_URI=your_mongodb_connection_string

FRONTEND_URL=http://localhost:5173
MAIL_USERNAME=yourgmail@gmail.com
MAIL_PASSWORD=your_gmail_app_password
MAIL_SENDER=yourgmail@gmail.com
```

Run the backend:

```bash
python run.py
```

The backend runs on:

```text
http://localhost:5000
```

## Frontend Setup

Go to the frontend folder:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```



## Authentication

All login emails must end with:

```text
@mgmcen.ac.in  you may change according to Your Org.
```

Supported roles:

- Admin
- Exam Cell
- Faculty
- Student
- Accountant

JWT tokens are stored in browser local storage and used for authenticated API requests.

## Student Forgot Password Flow

The forgot-password feature is available only for students.

Flow:

1. Student clicks **Forgot password?** on the Student login page.
2. Student enters their institutional email.
3. Backend checks that the email belongs to a Student user and exists in the students collection.
4. A 6-digit OTP is sent through Gmail SMTP.
5. Student verifies OTP.
6. New password and confirm password fields appear.
7. Student changes password and returns to login.

OTP details:

- OTP expires in 10 minutes.
- OTP is single-use.
- OTP is stored hashed in MongoDB.
- Passwords are stored using Werkzeug password hashing.

## Useful Commands

Frontend build:

```bash
cd frontend
npm run build
```

Frontend lint:

```bash
cd frontend
npm run lint
```

Backend compile check:

```bash
python -m py_compile backend\app\routes\auth.py backend\config.py
```

## Important Notes

- Do not commit real `.env` secrets to version control.
- Gmail requires an App Password, not the normal Gmail account password.
- The frontend URL in `.env` should match the frontend address used by students.
- For local mobile testing, OTP is preferred over reset links because localhost links do not open correctly on other devices.

