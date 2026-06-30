FROM python:3.11-slim

WORKDIR /app

# System deps for asyncpg/psql build + healthcheck curl.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .

# CPU-only torch (keeps the image lean), then the project deps.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -e .

# Pre-download the e5-base embedding model INTO the image layer.
# CRITICAL: the demo must never depend on a HuggingFace download over conference Wi-Fi.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-base'); print('e5-base pre-downloaded')"

COPY . .

# Block any HuggingFace network access at runtime (the model is already baked in).
ENV TRANSFORMERS_OFFLINE=1
ENV HF_DATASETS_OFFLINE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
