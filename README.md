# Služba turniketu (NestJS + TypeScript + MySQL)

Malá služba v **NestJS + TypeScript + MySQL**, která obsluhuje turniket v posilovně:
ověří kartu, platnému členovi otevře turniket a **každý pokus zapíše** — i když zařízení neodpoví.

```
čtečka ──POST /entries──► služba ──► MySQL (členové, záznamy)
                              └────► turniket (HTTP, timeout, opakování, pojistka)
recepce ──GET /entries──► služba    (poslední průchody, kód karty zamaskovaný)
```

## Spuštění

```bash
cp .env.example .env     # vyplnit: openssl rand -hex 16 pro každou hodnotu
npm ci
docker compose up -d     # MySQL na 127.0.0.1:3307
npm run device &         # falešný turniket na :4000 (DEVICE_MODE=ok|slow|fail|flaky)
npm start                # služba na :3005
```

**Dokumentace API:** http://localhost:3005/docs *(Swagger, generovaný z kódu; v produkci vypnutý)*

```bash
source .env
curl -X POST localhost:3005/entries -H 'Content-Type: application/json' \
     -H "x-api-key: $READER_API_KEY" -d '{"cardCode":"CARD-001"}'
# {"status":"opened","member":"Jan Platný","detail":null,"deviceMs":28}
```

## Kdo smí co

| volající | klíč (`x-api-key`) | smí |
|---|---|---|
| čtečka u turniketu | `READER_API_KEY` | `POST /entries` |
| recepce | `STAFF_API_KEY` | `GET /entries` |
| orchestrátor (Docker, k8s) | žádný | `GET /health`, `GET /health/ready` |

## Výsledky průchodu

| `status` | kdy | zařízení se volá |
|---|---|---|
| `opened` | platný člen, turniket otevřen | ano |
| `denied_unknown` | karta není v evidenci | ne |
| `denied_expired` | členství skončilo (poslední den ještě platí) | ne |
| `device_failed` | zařízení neodpovědělo ani na 3. pokus, nebo je pojistka rozpojená | ano / ne |

Odmítnutí je **odpověď 200** se stavem, ne chyba — pro čtečku je to běžný výsledek.
Chyba 400 = špatný požadavek (formát karty), 401 = klíč, 429 = příliš mnoho požadavků.

## Nastavení (`.env`)

Tajné hodnoty **nemají výchozí hodnotu v kódu** — bez nich služba nenastartuje. Celý seznam je v `.env.example`.
Ladění zařízení: `DEVICE_TIMEOUT_MS` (700), `DEVICE_ATTEMPTS` (3), `DEVICE_BACKOFF_MS` (100, zdvojnásobuje se),
`DEVICE_BREAKER_FAILS` (5), `DEVICE_BREAKER_COOLDOWN_MS` (10 000). Den posilovny: `GYM_TIME_ZONE` (Europe/Prague).

## Kontroly

```bash
npm run check        # vše kromě mutačních testů — musí být zelené
npm run check:full   # + mutační testy
npm run load         # zátěž proti běžící službě
```

## Kde co najdeš

| | |
|---|---|
| `CLAUDE.md` | pravidla projektu: vrstvy, hranice, bezpečnost, jak testovat, známý stav |
| `docs/adr/` | rozhodnutí, která šla udělat i jinak, a proč padla takhle |
| `src/entries/domain/` | pravidla (kdo projde) — bez frameworku a databáze |
| `test/integration/` | testy proti skutečné MySQL a falešnému turniketu |

## Jak to vzniklo

Kód z větší části psal AI agent (Claude Code) podle mého zadání a pravidel v `CLAUDE.md`; moje práce bylo zadání,
kritéria a kontrola výstupu. Chybu na hranici platnosti členství (poslední den = odmítnutí) jsem našel, pokryl testem
a opravil sám — `test/member.entity.spec.ts`. Bezpečnostní pravidla (Semgrep) jsou ověřená na schválně vložené chybě,
že ji opravdu najdou (`docs/adr/0004`).
