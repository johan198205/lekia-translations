# ARCHITECTURE (lite)
## Översikt
- Next.js 14 (App Router) som både frontend och API (route handlers).
- PostgreSQL via Prisma för persistens av batcher/produkter.
- Redis + BullMQ för köer: `optimize`, `translate`, `export`.
- Workers körs som separat Node-process nära Redis.
- Lagring: S3/R2 för original- och exportfiler (signed URLs).
- Progress: SSE `/api/events` publicerar batchstatus (% klart, fel, senaste uppdateringar).

## Dataflöde
Upload `.xlsx` → `POST /api/upload`:
- Validera MIME/size, lägg råfil i S3, normalisera kolumner (exceljs).
- Skapa `ProductBatch` + `Product` poster.

Start optimize → `POST /api/batches/:id/optimize`:
- Enqueue ett jobb per produkt med throttling/ratelimit.
- Worker hämtar produkt → kallar OpenAI → skriver `optimized_sv` → sätter status → enque `translate`.

Translate → `POST /api/batches/:id/translate` (eller auto-kedja):
- Worker kör DA och NO (ett eller två deljobb) → uppdaterar fält → status `completed`.

Export → `GET /api/batches/:id/export`:
- Server-side exceljs bygger fil (original + nya kolumner) → lägger i S3 → return signed URL.

## Observability/Reliability
- Retries(3) + exponential backoff; idempotency per (`productId`, steg).
- Partial success: behåll fel per produkt, stöd “återkör fel”.
- Baslogg (pino) + Sentry (senare).

## Säkerhet
- UI-styrda prompts (ingen hårdkodning i backend).
- Zod-validering på alla payloads.
- Signed URLs för filhämtning.
