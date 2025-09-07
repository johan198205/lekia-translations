# KOMPLETT SETUP-GUIDE

## 🏠 LOKAL UTVECKLING

### 1. Skapa `.env` fil
Skapa en `.env` fil i projektroten med följande innehåll:

```bash
# Database (SQLite för lokal utveckling)
DATABASE_URL="file:./dev.db"

# Redis (för köhantering)
REDIS_URL="redis://localhost:6379"

# OpenAI (valfritt - kan konfigureras via UI)
OPENAI_API_KEY="sk-din-openai-nyckel-här"
OPENAI_MODE="live"  # eller "stub" för mock-läge
OPENAI_BASE_URL="https://api.openai.com/v1"
```

### 2. Installera Redis (för köhantering)
```bash
# macOS med Homebrew
brew install redis
brew services start redis

# Eller använd Docker
docker run -d -p 6379:6379 redis:alpine
```

### 3. Installera dependencies och sätt upp databas
```bash
npm install
npx prisma generate
npx prisma db push
```

### 4. Starta appen
```bash
npm run dev
```

### 5. Konfigurera OpenAI via UI
1. Gå till `/installningar` i appen
2. Lägg till din OpenAI API-nyckel
3. Konfigurera prompts och språkinställningar

---

## ☁️ VERCEL DEPLOYMENT

### 1. Databas på Vercel
**Alternativ A: Vercel Postgres (Rekommenderat)**
1. Gå till ditt Vercel-projekt
2. Klicka på "Storage" → "Create Database" → "Postgres"
3. Välj "Connect to existing project"
4. `DATABASE_URL` sätts automatiskt

**Alternativ B: Extern databas**
- Använd t.ex. [Neon](https://neon.tech), [Supabase](https://supabase.com), eller [Railway](https://railway.app)
- Lägg till `DATABASE_URL` som environment variable i Vercel

### 2. Environment Variables i Vercel
Lägg till följande i Vercel Project Settings → Environment Variables:

```bash
# Database (sätts automatiskt med Vercel Postgres)
DATABASE_URL="postgresql://..."

# Redis (för köhantering)
REDIS_URL="redis://..."

# OpenAI (valfritt - kan konfigureras via UI)
OPENAI_API_KEY="sk-din-openai-nyckel-här"
OPENAI_MODE="live"
OPENAI_BASE_URL="https://api.openai.com/v1"
```

### 3. Redis för Vercel
**Alternativ A: Upstash Redis (Rekommenderat)**
1. Gå till [Upstash](https://upstash.com)
2. Skapa en Redis-databas
3. Kopiera connection string till `REDIS_URL` i Vercel

**Alternativ B: Redis Cloud**
1. Skapa konto på [Redis Cloud](https://redis.com/redis-enterprise-cloud/)
2. Skapa databas
3. Kopiera connection string

### 4. Deploy
```bash
git push origin main
```

---

## 🔧 KONFIGURATION

### OpenAI-inställningar
Appen stöder två sätt att konfigurera OpenAI:

1. **Via Environment Variables** (för utveckling):
   ```bash
   OPENAI_API_KEY="sk-..."
   OPENAI_MODE="live"
   ```

2. **Via UI** (för produktion):
   - Gå till `/installningar`
   - Lägg till API-nyckel
   - Konfigurera prompts och språk

### Databas
- **Lokal**: SQLite (`file:./dev.db`)
- **Vercel**: PostgreSQL (via Vercel Postgres eller extern provider)

### Köhantering
- **Lokal**: Redis på localhost:6379
- **Vercel**: Upstash Redis eller Redis Cloud

---

## 🚀 TESTA SYSTEMET

### Lokalt
1. Starta appen: `npm run dev`
2. Gå till `http://localhost:3000`
3. Ladda upp en Excel-fil
4. Konfigurera OpenAI-inställningar
5. Testa optimering och översättning

### På Vercel
1. Deploy: `git push origin main`
2. Gå till din Vercel-URL
3. Konfigurera OpenAI-inställningar via UI
4. Testa funktionaliteten

---

## 🐛 FELSÖKNING

### "Prisma Client not generated"
```bash
npx prisma generate
```

### "Database connection failed"
- Kontrollera `DATABASE_URL` i `.env` (lokal) eller Vercel environment variables
- För Vercel: Se till att databasen är skapad och tillgänglig

### "Redis connection failed"
- Kontrollera att Redis körs lokalt: `redis-cli ping`
- För Vercel: Kontrollera `REDIS_URL` environment variable

### "OpenAI API key not configured"
- Lägg till `OPENAI_API_KEY` i environment variables
- Eller konfigurera via UI på `/installningar`

---

## 📝 ANTECKNINGAR

- **Säkerhet**: API-nycklar krypteras i databasen
- **Fallback**: Systemet kan köra i "stub"-läge utan OpenAI
- **Skalbarhet**: Redis + BullMQ för köhantering
- **Flexibilitet**: Konfigurera allt via UI eller environment variables
