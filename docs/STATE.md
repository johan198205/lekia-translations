# STATE (initial)
## Beslutade
- Stack: Next.js 14 (TS), Prisma/Postgres, Redis/BullMQ, exceljs, SSE.
- Test: `npm test` (Jest/Vitest).
- UI är single source of truth för promptinställningar.

## Datamodell (arbetsversion)
- ProductBatch: id, filename, upload_date, total_products, status(pending|running|completed|error)
- Product: id, batch_id, name_sv, description_sv, attributes, tone_hint,
  optimized_sv, translated_da, translated_no,
  status(pending|optimizing|optimized|translating|completed|error),
  error_message, created_at, updated_at

## Flöde
Upload → Normalize → Create Batch/Products → Enqueue Optimize → Update → Enqueue Translate → Update → Export.

## Begränsningar
- Upload ≤16 MB.
- Långa beskrivningar trunkeras (~4000 tecken) före prompt.
- Partial success: fel på subset stoppar inte batch.

## Öppna frågor
- Sektionrubriker & maxlängder (fast lista v1?). 
- Kolumnalias från Litium-export (ev. mapping-tabell v1?).
- Max concurrency initialt (t.ex. 2–3 jobb/worker).
