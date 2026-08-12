FROM python:3.12-slim@sha256:229a2c5bfa27522db7815ea81f9bed70af17ccb9de9fc7ad142b1877b5830d36

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    WATCH_LAB_DATA_MODE=synthetic_demo \
    WATCH_LAB_DB=/tmp/watch-lab-demo.duckdb \
    PORT=7860

WORKDIR /app

RUN pip install --no-cache-dir uv==0.8.14

COPY pyproject.toml uv.lock README.md LICENSE ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
RUN uv sync --frozen --no-dev

RUN useradd --create-home --uid 1000 watchlab
USER watchlab

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:' + __import__('os').environ['PORT'] + '/healthz', timeout=3)"

CMD ["sh", "-c", "/app/.venv/bin/watch-lab demo --database \"$WATCH_LAB_DB\" && exec /app/.venv/bin/watch-lab serve --host 0.0.0.0 --port \"$PORT\""]
