# Fallback deployment for hosts other than Vercel.
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.3 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PATH="/srv/.venv/bin:$PATH"

WORKDIR /srv

# Dependencies first so code changes do not invalidate the cached layer.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY app ./app
# The index and the copies app/prepare.py makes: everything the service reads at runtime.
COPY data ./data
RUN uv sync --locked --no-dev

RUN useradd --system --no-create-home rehla
USER rehla

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
