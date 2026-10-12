# CLAUDE.md — turniket pro posilovnu (NestJS + MySQL)

Služba rozhoduje, jestli člen projde turniketem, otevře ho a **každý pokus zapíše** — i když zařízení selže.

## Než řekneš „hotovo“

```bash
npm run check        # typy, lint, architektura, testy + pokrytí, 4 časové zóny, integrace s MySQL, bezpečnost
npm run check:full   # + mutační testy (Stryker, ~2 min)
```

Obojí musí být zelené. Bez Dockeru neprojde `test:int` ani `security` — to je chyba prostředí, ne důvod je přeskočit.

## Principy

DRY, KISS, SSOT, SoC. Žádné fallbacky kvůli zpětné kompatibilitě, legacy kód po dokončení hned pryč i s testy.

## Vrstvy (hlídá `npm run arch`, `.dependency-cruiser.cjs`)

```
src/entries/domain/          entity a abstrakce (MemberRepository, EntryRepository, Turnstile, Clock) — NEZÁVISÍ NA NIČEM
src/entries/application/     EntriesService (rozhodování), čtecí strana EntryListQuery — jen domain
src/entries/infrastructure/  MySQL implementace, SystemClock
src/entries/ui/              controller + DTO — jen application
src/device/  src/db/  src/auth/  src/health/   adaptéry a průřezové věci
*.module.ts                  JEDINÉ místo, kde se k abstrakci přiřadí implementace
```

1. **Domain Protection** — doména neimportuje Nest, mysql2 ani jinou vrstvu. Žádné `new Date()` v doméně: datum přichází parametrem nebo přes `Clock`.
2. **Repository Pattern** — abstrakce (abstraktní třída = DI token) v `domain/`, implementace v `infrastructure/`. Repozitář mluví jazykem domény (`findByCardCode`), ne `findWhere(...)`.
3. **No Direct DB Access** — `DbService` a `mysql2` jen v `infrastructure/` a `db/`. SQL vždy s `?` parametry (hlídá i Semgrep).

## Hranice

- **Vstup** kontroluje jen DTO + globální `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`). Žádné ruční `typeof` v controlleru.
- **Konfigurace** se čte z prostředí jen v `*.config.ts` / `config/env.ts` / `main.ts` (hlídá ESLint), **jednou při startu** a kontroluje se. Tajné hodnoty nemají výchozí hodnotu v kódu — bez nich služba nenastartuje.
- **Nová proměnná prostředí** ⇒ řádek v `.env.example` (hlídá test).
- **Čas** jde přes `Clock`. Kalendářní den = den posilovny (`GYM_TIME_ZONE`), ne serveru — server v Dockeru běží v UTC.
- **HTTP nastavení** (helmet, limit těla 1 kB, shutdown hooks) je v `configure-app.ts`, aby ho testy používaly taky.

## Bezpečnost

- **Každá cesta** má `@CallerOnly('reader' | 'staff')` nebo `@Public('důvod')` (hlídá `test/route-access.spec.ts`). Nový controller ⇒ přidat do seznamu v tom testu.
- Klíče a tokeny se porovnávají `timingSafeEqual`, ne `===` (hlídá Semgrep).
- **Kód karty otevírá turniket** — ve výpisu jen maskovaný, v logu vůbec (loguje se `member.id`).
- Do záznamu a odpovědi jde jen pevné slovo důvodu (`timeout`, `network`, `http_500`), surový text chyby jen do logu.
- MySQL publikuje port jen na `127.0.0.1`, hesla jen v `.env` (hlídá test). Uživatel aplikace smí `SELECT members`, `SELECT/INSERT entries` — nic víc (hlídá integrační test).
- ⚠️ Rate limit je **na IP adresu** (10/s). Čtečky za jednou NAT by se blokovaly navzájem — před nasazením řešit limit podle klíče čtečky.
- `npm run security` = `npm audit` (od high) + gitleaks (historie gitu) + Semgrep: sada **p/default** + vlastní pravidla v `.semgrep/rules.yml`.
  ⚠️ Výběr sady rozhoduje: p/nodejs, p/typescript, p/owasp-top-ten, p/javascript, p/sql-injection, p/security-audit, p/expressjs
  na sondě s vloženou SQL injection a `eval` v Nest controlleru našly **0**; **p/default obojí našel** (ověřeno 01.10., viz `docs/adr/0004`).
  Nová sada nebo pravidlo ⇒ ověřit na sondě, že něco najde.

## Testy

- **Test hlídá požadavek, ne tvar implementace.** Test psaný na míru kódu je zelený i u rozbité funkčnosti.
- **Pozitivní kontrola:** nový test musí před opravou spadnout. U ochrany (guard, validace, pravidlo) ověř, že po jejím vypnutí test spadne. Mutační testy to dělají automaticky — přeživší mutant je místo, kde by si testy chyby nevšimly.
- **Zelená napoprvé není důkaz** — Semgrep i test časové zóny prošly napoprvé, protože nic neviděly.
- Žádné `if (…) expect(…)` — při jiném výsledku se nic neověří. Celý výsledek přes `toMatchObject`.
- Čas v testech přes Jest fake timers, ne `Date.now()` a měření.
- Testy nemění `process.env`; konfigurace se předává objektem. `process.env.TZ` uvnitř testu **nepůsobí** (Jest má kopii) — zóna se nastavuje v `test/global-setup.js` (`TEST_TZ`).
- Autor testu a jeho reviewer = oddělené průchody.

| druh | kde | příkaz |
|---|---|---|
| unit (bez sítě a DB) | `test/*.spec.ts` | `npm test`, `npm run test:cov` (doména a aplikace 100 %) |
| časové zóny | totéž ve 4 zónách | `npm run test:tz` |
| integrace (MySQL 3308, celá sestava, falešný turniket ve všech režimech) | `test/integration/*.int.ts` | `npm run test:int` |
| mutační | `stryker.config.json` | `npm run test:mutation` (práh 75 %) |
| zátěž (běžící služba) | `scripts/load.ts` | `npm run load` |

## Dokumentace

- `README.md` — pro člověka: co služba dělá, spuštění, kdo smí co, výsledky průchodu.
- **API:** Swagger na `/docs` (JSON `/docs-json`), generovaný z týchž dekorátorů, které validují (DTO) ⇒ nemůže se rozejít.
  Odpovědi popisují třídy v `ui/entries.responses.ts`, které `implements` typy aplikace — kompilátor hlídá shodu.
  `test/openapi.spec.ts` hlídá, že dokumentace obsahuje všechny cesty, klíč u chráněných a stejný formát karty.
- **Rozhodnutí** (`docs/adr/`) — u čeho šlo rozhodnout i jinak: zvažované možnosti, proč ne, kdy přehodnotit.
  Nové rozhodnutí tohoto druhu ⇒ nový ADR, ne komentář v kódu.
- Komentáře v kódu říkají **proč**, ne co (LEFT JOIN, abstraktní třída, timingSafeEqual).

## Spuštění

```bash
cp .env.example .env    # a vyplnit (openssl rand -hex 16)
docker compose up -d    # MySQL na 127.0.0.1:3307
npm run device &        # falešný turniket :4000 (DEVICE_MODE=ok|slow|fail|flaky)
npm start               # služba :3005
```

Procesy ukončovat **podle PID** (`ss -ltnp`), ne `pkill -f` — vzor trefí i vlastní shell.

## Známý stav (01.10.2026)

- Mutační skóre **84 %** celkem (132 z 157; 68 mutantů nešlo přeložit), služba průchodu 100 % (8/8; před doplněním testů důvodu 3/8 = 37,5 %).
  Přeživší 20: `device.client.ts` 11, `api-key.guard.ts` 3, `config/env.ts` 3, `auth.config.ts` 1, `device.config.ts` 1, výpis 1.
  Bez pokrytí 5 (MySQL repozitáře — testují je jen integrační testy, které Stryker nespouští).
- Odpověď čtečce obsahuje jméno a datum konce členství — rozhodnutí o produktu, ne oprava.
- Mazání starých záznamů (GDPR) chybí.
- `.gitlab-ci.yml` napsaný, ale v GitLabu zatím neběžel.
- Swagger UI je ověřený jen na HTTP 200 a v prohlížeči (1. 10.), ne testem vykreslení.
