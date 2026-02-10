# Multi-stage build for backend with GeNN, CUDA, and CMake
# Stage 1: Builder with GeNN and dependencies
FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04 as builder

ARG GENN_VER=latest
LABEL maintainer="SNNverse Team"

# Non-interactive timezone configuration
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Berlin

# Set environment variables
ENV GENN_PATH=/opt/genn
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install build dependencies
RUN apt-get update && \
    apt-get upgrade -y && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone && \
    apt-get install -yq --no-install-recommends \
        build-essential \
        cmake \
        git \
        python3-dev \
        python3-pip \
        swig \
        pkg-config \
        libffi-dev \
        curl \
        wget \
        ninja-build \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Set python3 as default python
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3 1

# Upgrade pip and install base Python dependencies
RUN python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install numpy jupyter matplotlib psutil pybind11

# Clone and build GeNN
RUN mkdir -p ${GENN_PATH} && \
    git clone https://github.com/genn-team/genn.git ${GENN_PATH}

WORKDIR ${GENN_PATH}

# Build GeNN with CUDA support
RUN python3 setup.py develop

# Stage 2: Runtime image
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# Non-interactive timezone configuration
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Berlin

# Set environment variables
ENV GENN_PATH=/opt/genn
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV APP_DIR=/app

WORKDIR ${APP_DIR}

# Install runtime dependencies
RUN apt-get update && \
    apt-get upgrade -y && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone && \
    apt-get install -yq --no-install-recommends \
        python3.10 \
        python3-pip \
        build-essential \
        cmake \
        git \
        libffi7 \
        libssl3 \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Set python3 as default python
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1

# Upgrade pip
RUN python -m pip install --upgrade pip setuptools wheel

# Copy GeNN from builder stage
COPY --from=builder ${GENN_PATH} ${GENN_PATH}

# Copy application requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directory for GeNN models
RUN mkdir -p /tmp/genn_models

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/health')" || exit 1

# Expose API and WebSocket ports
EXPOSE 8000 9001 9002

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]