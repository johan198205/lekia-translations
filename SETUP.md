# SETUP INSTRUKTIONER

## 1. Databas (PostgreSQL)

Skapa en `.env` fil i projektroten med:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/lekia_translations"

# Redis
REDIS_URL="redis://localhost:6379"
```

## 2. Installera PostgreSQL

```bash
# macOS med Homebrew
brew install postgresql
brew services start postgresql

# Skapa databas
createdb lekia_translations
```

## 3. Installera Redis

```bash
# macOS med Homebrew
brew install redis
brew services start redis
```

## 4. Kör databasmigrationer

```bash
npx prisma generate
npx prisma db push
```

## 5. Starta appen

```bash
npm run dev
```

## 6. Testa

- Ladda upp Excel-fil
- Välj produkter
- Skapa batch
- Optimera och översätt
