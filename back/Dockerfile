# Lightweight base: change to a PyTorch CUDA image for GPU-enabled builds (notes below)
FROM python:3.10-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    wget \
    libsndfile1 \
 && rm -rf /var/lib/apt/lists/*

# Environment
ENV APP_DIR=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR $APP_DIR


# Install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy everything
COPY src/ .

# Expose API port
EXPOSE 8000

# Launch backend
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--reload"]