#!/usr/bin/env bash
set -e

echo "FloodGuard setup starting..."

if ! command -v python >/dev/null 2>&1; then
  echo "Python is required but was not found."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found."
  exit 1
fi

echo "Creating Python virtual environment..."
cd backend
python -m venv venv

echo "Installing backend dependencies..."
if [ -f "venv/Scripts/activate" ]; then
  # Git Bash on Windows
  source venv/Scripts/activate
else
  source venv/bin/activate
fi

python -m pip install --upgrade pip
pip install -r requirements.txt

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "Created backend/.env from backend/.env.example"
fi

cd ../frontend

echo "Installing frontend dependencies..."
npm install

cd ..

echo ""
echo "FloodGuard setup complete."
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your RDS and AWS values."
echo "2. Edit frontend/.env if your backend URL is not http://localhost:8000."
echo "3. Start backend:"
echo "   cd backend"
echo "   source venv/bin/activate   # or venv\\Scripts\\activate on Windows PowerShell"
echo "   uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo "4. Start frontend in a second terminal:"
echo "   cd frontend"
echo "   npm run dev"
echo "5. Run sensor simulator after backend is running:"
echo "   python sensor_simulator.py http://localhost:8000"
