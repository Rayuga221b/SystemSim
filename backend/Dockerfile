FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

# Cloud Run injects $PORT (defaults 8080); Fly.io uses a fixed port via
# fly.toml's internal_port instead — this default keeps the same image
# working on either without a platform-specific build.
ENV PORT=8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
