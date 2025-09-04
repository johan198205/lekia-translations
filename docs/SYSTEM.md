# SYSTEM
Syfte: PDD-styrd utveckling av ett verktyg som: importerar Litium-Excel → urval → AI-optimering (SV) → översättning (DA/NO) → exporterar Excel med samma struktur.

## Principer (PDD)
- Spec → Test → Code.
- Minsta möjliga diff; 1–2 filer/iteration.
- Unified diffs only.
- Leave TODO if uncertain; stop.
- Keep public APIs stable.
- Never change configs/linters unless explicitly allowed.
- UI settings are the only source of truth; no hardcoded defaults/overrides.

## Domänflöde
1) Upload `.xlsx` (≤16 MB) → normalisera kolumner → skapa Batch + Products.
2) Optimize (SV): systemprompt med hårda regler (ingen ny fakta, bevara varumärken/siffror, rubriklista, sektion-max).
3) Translate (DA/NO): bevara rubriker/ordning/punktlistor exakt.
4) Export: exceljs genererar fil med original + `optimized_sv`, `translated_da`, `translated_no`.

## Kvalitet (prompts & resultat)
- Fakta orubblig (inga nya specs).
- Struktur: H1/H2 + punktlistor (nyckel: värde).
- Ton: professionell, konverteringsdriven.
- Längd: max/sektion (t.ex. 120 ord).
- Översättning: identisk struktur.

## Teknik (beslutade)
- Next.js 14 (App Router), TypeScript.
- Prisma + PostgreSQL.
- Redis + BullMQ (workers separat process).
- exceljs för läs/skriv .xlsx.
- SSE för progress (alternativt WS senare).
- Test: `npm test` (Jest/Vitest).

## I/O-kontrakt (min)
Import: `product_name_sv`, `description_sv`, `attributes?`, `tone_hint?`
Export: + `optimized_sv`, `translated_da`, `translated_no`

## Rate limiting & driftsregler (v1)
- Concurrency styrs i BullMQ.
- Retries: 3, exponential backoff med jitter.
- Idempotency per (`productId`, steg).
