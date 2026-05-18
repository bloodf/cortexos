# cortex-graph — multi-stage Python 3.13-slim image
# - non-root runtime user
# - dumb-init as PID 1 to reap zombies and forward signals
# - venv layer cached separately from app source

FROM python:3.13-slim AS builder
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml ./
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
RUN pip install --upgrade pip setuptools wheel \
 && pip install .

FROM python:3.13-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:${PATH}" \
    PORT=8090
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init libpq5 ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system cortex \
 && useradd --system --gid cortex --home-dir /app --shell /usr/sbin/nologin cortex
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY app ./app
COPY README.md ./
RUN chown -R cortex:cortex /app
USER cortex
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0) if urllib.request.urlopen('http://127.0.0.1:8090/healthz', timeout=3).status==200 else sys.exit(1)" || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
