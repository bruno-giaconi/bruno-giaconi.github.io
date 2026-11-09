FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LANGSMITH_TRACING=false

WORKDIR /app
ARG REQUIREMENTS_FILE=requirements.txt
COPY requirements.txt requirements-azure.txt ./
RUN python -m pip install --no-cache-dir -r "$REQUIREMENTS_FILE"

COPY --chown=10001:10001 pv_demo ./pv_demo
USER 10001:10001
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "pv_demo.api:app", "--host", "0.0.0.0", "--port", "8000"]
