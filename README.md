# Lekia Translations

Excel import och normalisering för produktdata.

## Installation

```bash
npm install
```

## Tester

Kör alla tester:

```bash
npm test
```

Kör tester i watch-läge:

```bash
npm test -- --watch
```

## API

### POST /api/upload

Laddar upp och normaliserar Excel-filer (.xlsx).

**Request:**
- `Content-Type: multipart/form-data`
- Field: `file` (.xlsx-fil, max 16 MB)

**Response:**
```json
{
  "products": [
    {
      "name_sv": "Produktnamn",
      "description_sv": "Beskrivning",
      "attributes": "Specifikationer (valfritt)",
      "tone_hint": "Ton (valfritt)"
    }
  ],
  "meta": {
    "rows": 1,
    "skipped": 0
  }
}
```

**Felkoder:**
- `400 Invalid file type` - Fel filtyp
- `413 File too large` - Fil för stor (>16 MB)
- `400 Missing required columns: name_sv, description_sv` - Saknade kolumner
- `400 Invalid workbook` - Ogiltig Excel-fil

## Kolumnmappning

Systemet mappar automatiskt följande kolumnnamn:

- **name_sv**: `product_name_sv`, `name_sv`, `product_name`, `name`
- **description_sv**: `description_sv`, `description`, `product_description`
- **attributes**: `attributes`, `spec`, `specification`, `specs`
- **tone_hint**: `tone_hint`, `tone`, `style`

## Begränsningar

- Max filstorlek: 16 MB
- Endast .xlsx-format
- Beskrivningar trunkeras till ~4000 tecken
- Tomma rader hoppas över
- Kräver minst `name_sv` och `description_sv` kolumner

## TODO

- Litium-specifika kolumnalias
- Strukturerade attribut (parsa till objekt)
- Smartare beskrivningstrunkering
# Deployment trigger Sun Sep  7 23:03:52 CEST 2025
