# syntax=docker/dockerfile:1
# CloudPilot Backend Production Container
# Multi-stage, non-root user execution

FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Final Runtime Image ────────────────────────────────────────────────────────
FROM python:3.11-slim AS runner

WORKDIR /app

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root application user
RUN groupadd -g 10001 cloudpilot && \
    useradd -u 10001 -g cloudpilot -s /bin/bash -m cloudpilot

# Copy installed Python packages from builder
COPY --from=builder /root/.local /home/cloudpilot/.local
ENV PATH=/home/cloudpilot/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy backend source code
COPY --chown=cloudpilot:cloudpilot backend/ /app/

# Create data directory for SQLite database with appropriate permissions
RUN mkdir -p /app/data && chown -R cloudpilot:cloudpilot /app/data
ENV CLOUDPILOT_DB_PATH=/app/data/cloudpilot.db

USER cloudpilot

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health/liveness || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
