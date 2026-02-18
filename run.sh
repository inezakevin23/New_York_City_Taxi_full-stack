#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Load .env if present
if [ -f .env ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

# Default values (will not overwrite if set in .env)
: "${DB_HOST:=localhost}"
: "${DB_USER:=kevin}"
: "${DB_PASSWORD:=1234}"
: "${DB_NAME:=NYC_Taxi}"
: "${DB_PORT:=3306}"
: "${FLASK_DEBUG:=1}"

# Create & activate virtualenv if missing
if [ ! -d .venv ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
  . .venv/bin/activate
  pip install --upgrade pip setuptools wheel
  pip install -r requirements.txt
else
  . .venv/bin/activate
fi

export DB_HOST DB_USER DB_PASSWORD DB_NAME DB_PORT FLASK_DEBUG

echo "Starting Flask app (DB=${DB_USER}@${DB_HOST}/${DB_NAME})"
exec python3 app.py
