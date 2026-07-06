FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

# --proxy-headers: dietro il proxy Railway, ricava l'IP reale del client da
# X-Forwarded-For (usato da rate limiting e audit log) invece dell'IP del proxy
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "*"]
