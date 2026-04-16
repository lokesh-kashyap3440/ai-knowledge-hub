#!/usr/bin/env bash
set -e

cd /home/lokesh3440/development/ai-knowledge-hub

source venv/bin/activate

cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

cd ../frontend
npm run dev
