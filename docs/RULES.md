# RULES
- Touch only: explicit listade filer i uppgiften.
- Unified diffs only.
- Smallest possible change; inga orelaterade refactors.
- Leave TODO if uncertain; stop.
- Keep public APIs stable.
- Never change configs/linters unless explicitly allowed.
- UI settings are the only source of truth; no hardcoded defaults/overrides.

## Kod & Test
- TypeScript strikt; Zod vid gräns.
- Tests först där möjligt; annars minimal testrigg.
- Köpolicy: concurrency via BullMQ; retries 3; idempotency keys.

## Säkerhet & data
- Validera MIME/size; skanna rubriker/kolumner.
- S3-kompatibel lagring (signed URLs).
- Loggning: strukturerad baslogg + felorsak per produkt.
