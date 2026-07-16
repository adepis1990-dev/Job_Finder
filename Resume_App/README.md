# AI Resume Builder

Edit an existing resume or generate one from scratch using GPT-4o.

---

## Project Structure

```
Resume_App/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Setup

### 1. Backend (Python / FastAPI)

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Add your OpenAI API key
copy .env.example .env
# then open .env and paste your key

# Start the server
uvicorn main:app --reload --port 8000
```

### 2. Frontend (React / Vite)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Usage

- **Edit Existing** — Upload a PDF resume, describe what to change, download the updated version.
- **Create New** — Describe yourself and your experience, get a full resume as a PDF.

---

## Requirements

- Python 3.9+
- Node.js 18+
- An OpenAI API key (GPT-4o access)
