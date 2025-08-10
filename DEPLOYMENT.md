# Deployment Runbook – Multi‑Agent AI Assistant

## 1. Azure Resource Provisioning

### Resource Group
```bash
az group create --name ai-assistant-rg --location eastus
```

### Azure Postgres
```bash
az postgres flexible-server create \
  --name ai-assistant-db \
  --resource-group ai-assistant-rg \
  --location eastus \
  --admin-user dbadmin \
  --admin-password <POSTGRES_PASSWORD> \
  --sku-name Standard_B1ms
```
Set env var:
```
DATABASE_URL=postgresql+psycopg2://dbadmin:<POSTGRES_PASSWORD>@ai-assistant-db.postgres.database.azure.com:5432/postgres
```

### Blob Storage
```bash
az storage account create --name aiassistantblob --resource-group ai-assistant-rg --location eastus --sku Standard_LRS
az storage container create --account-name aiassistantblob --name uploads --public-access blob
```
Set env vars:
```
AZURE_BLOB_CONNECTION_STRING=<from portal>
AZURE_BLOB_CONTAINER=uploads
BLOB_PUBLIC_BASE=https://aiassistantblob.blob.core.windows.net/uploads
```

### Azure Cognitive Search
```bash
az search service create --name ai-assistant-search --resource-group ai-assistant-rg --sku basic --location eastus
```
```
AZURE_SEARCH_SERVICE_URL=https://ai-assistant-search.search.windows.net
AZURE_SEARCH_API_KEY=<from portal>
```

### Azure OpenAI
```bash
az cognitiveservices account create \
  --name ai-assistant-openai \
  --resource-group ai-assistant-rg \
  --kind OpenAI \
  --sku s0 \
  --location eastus
```
Deploy models: `gpt-4o`, `gpt-5-chat`, `text-embedding-ada-002`
Set env vars:
```
AZURE_OPENAI_API_BASE=https://ai-assistant-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=<from portal>
```

### Bing Search
```
BING_SEARCH_API_KEY=<from portal>
```

---

## 2. Backend Deployment

### Dockerfile
```dockerfile
FROM python:3.11
WORKDIR /app
COPY backend/ .
RUN pip install --no-cache-dir -r requirements.txt
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Push image to Azure Container Registry and deploy to Azure Web App for Containers.

---

## 3. Frontend Deployment

Build Next.js:
```bash
cd frontend
npm install
npm run build
```
Deploy to Azure Static Web Apps:
```bash
az staticwebapp create --name ai-assistant-ui --source . --location eastus
```
Set `NEXT_PUBLIC_API_URL` in app settings.

---

## 4. Migrations
```bash
cd backend
alembic upgrade head
```
Seed DB with default capabilities and LLM configs.

---

## 5. Post‑Deployment Test Plan
1. API health check (`GET /`)
2. Agent CRUD works in Admin UI
3. File upload to Blob successful
4. RAG doc upload/index/search works
5. Hybrid RAG + Web Search returns combined results
6. Pipeline execution (spreadsheet → chart → docgen) successful

---

## 6. Promote to Prod
Use slot swap or clone resources.