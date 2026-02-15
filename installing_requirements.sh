#!/bin/bash

# Define the virtual environment directory name
VENV_DIR=".venv"

# Create the virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment '$VENV_DIR'..."
    python3 -m venv "$VENV_DIR"
    echo "Virtual environment created."
fi

# Activate the virtual environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Install requirements
if [ -f "requirements.txt" ]; then
    echo "Installing requirements from requirements.txt..."
    pip3 install -r requirements.txt
    echo "Requirements installed."
else
    echo "requirements.txt not found. Skipping installation."
fi

echo "Environment ready. You are in the virtual environment."
# running the python flask 
exec bash
