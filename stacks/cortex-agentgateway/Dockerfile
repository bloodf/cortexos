FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    AGENTGATEWAY_PORT=18800 \
    AGENTGATEWAY_CONFIG=/app/config/tools.json

WORKDIR /app
RUN groupadd --system cortex \
 && useradd --system --gid cortex --home /app --shell /usr/sbin/nologin cortex

COPY stacks/cortex-agentgateway/app.py ./app.py
COPY stacks/cortex-agentgateway/config ./config
RUN chown -R cortex:cortex /app

USER cortex
EXPOSE 18800
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:18800/health', timeout=3).read()" || exit 1

CMD ["python", "/app/app.py"]
