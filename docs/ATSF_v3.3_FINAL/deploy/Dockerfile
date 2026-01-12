# ATSF v3.2 Production Dockerfile
# ================================

FROM python:3.11-slim

# Labels
LABEL maintainer="ATSF Team"
LABEL version="3.2.0"
LABEL description="Agentic Trust Scoring Framework"

# Environment
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ATSF_ENV=production

# Create app user
RUN groupadd -r atsf && useradd -r -g atsf atsf

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY atsf_v3_package/src/ ./src/
COPY deploy/entrypoint.sh .

# Set permissions
RUN chown -R atsf:atsf /app
RUN chmod +x entrypoint.sh

# Switch to non-root user
USER atsf

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Entrypoint
ENTRYPOINT ["./entrypoint.sh"]
CMD ["uvicorn", "src.atsf_api:app", "--host", "0.0.0.0", "--port", "8000"]
