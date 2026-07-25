FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .

RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Install with retries and increased timeout to handle slow/flaky PyPI connections
RUN pip install --no-cache-dir --timeout=120 --retries=5 -r requirements.txt

COPY . .

# Train model during build so it's ready when container starts
RUN python train_model.py

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
