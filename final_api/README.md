# Final API

This is the only API entry point for the project. It imports the existing
frozen SWaT, AI4I, PPE and fusion models and the new agent/RAG layer; it does
not copy or retrain any model.

Run from `D:\etai`:

```powershell
D:\etai\.venv-1\Scripts\python.exe -m uvicorn final_api.main:app --reload --host 127.0.0.1 --port 8000
```

Open Swagger at `http://127.0.0.1:8000/docs`.

Use only `/api/...` routes from React. A 404 means the route is missing its
`/api` prefix or the Final API server was not started with the command above.

Key endpoints: `POST /api/demo/run`, `POST /api/live/start`,
`GET /api/live/status/{zone}`, `PUT /api/live/context/{zone}`,
`POST /api/live/stop/{zone}`, `POST /api/agents/analyze`,
`POST /api/agents/chat`, and `POST /api/rag/compliance`.
