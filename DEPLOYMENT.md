# PRAXIS Deployment MVP

This is the first hosted-deployment shape for PRAXIS.

## Local

```powershell
npm start
```

Open `http://localhost:4173`.

## Docker

```bash
docker build -t praxis-mvp:local .
docker run --env-file .env -p 4173:4173 praxis-mvp:local
```

## Cloud Run sketch

```bash
gcloud builds submit --tag gcr.io/$PROJECT/praxis-mvp
gcloud run deploy praxis-mvp \
  --image gcr.io/$PROJECT/praxis-mvp \
  --region us-central1 \
  --allow-unauthenticated=false
```

## Required production replacements

- Replace `data/praxis-db.json` with managed Postgres using `schema.sql`.
- Store uploaded files in object storage with malware scanning and retention rules.
- Put the service behind TLS, SSO, WAF, and private networking for enterprise pilots.
- Move secrets to managed KMS/Vault. The local `.env` is for development only.
