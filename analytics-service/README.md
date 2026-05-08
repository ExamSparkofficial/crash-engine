# CrashPulse AI Analytics Service

Optional FastAPI microservice for statistical ML enrichment.

```bash
cd analytics-service
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Endpoints:

- `GET /health`
- `POST /analyze`

All results are probability analytics only and are not guaranteed predictions.
