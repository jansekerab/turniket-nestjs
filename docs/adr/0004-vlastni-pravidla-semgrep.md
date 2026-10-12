# 0004 — Semgrep: sada p/default + vlastní pravidla, každé ověřené na vložené vadě

**Stav:** přijato 1. 10. 2026 · **Kontext:** první sken projektu se sadami p/nodejs, p/typescript, p/owasp-top-ten,
p/secrets a p/docker-compose dal **0 nálezů**. Pozitivní kontrola — soubor se schválně vloženou SQL injection
(řetězec složený s parametrem z `@Query`) a `eval(...)` v Nest controlleru — dal **také 0**. Prázdný výsledek
by tedy vypadal jako čistý kód.

## Co ukázala sonda (ověřeno 1. 10.)
| sada | nálezy na sondě |
|---|---|
| p/nodejs, p/typescript, p/owasp-top-ten, p/javascript, p/sql-injection, p/security-audit, p/expressjs | **0** |
| **p/default** | **2** — `eval-detected`, `node-mysql-sqli` |
| vlastní `.semgrep/rules.yml` | všechny vložené vady (SQL z řetězce i šablony, `eval`, `===` u tajemství) |

⇒ Jména sad slibují víc, než na tomhle kódu dělají. **Rozhoduje výběr sady, a ten se dá ověřit jen sondou.**

## Rozhodnutí
- `npm run security` pouští **p/default** a **vlastní pravidla** (SQL skládané z řetězců, `eval`/`new Function`,
  shellové příkazy, porovnání tajemství přes `===`).
- **Nová sada nebo pravidlo se přidává jen se sondou** — souborem s vloženou vadou, na kterém něco najde.
- Výjimka v kódu (`// nosemgrep: …`) musí nést důvod.

## Důsledky
Pravidla pokrývají jen to, co jsme vyjmenovali — nejsou náhradou review. Proč ostatní sady nezabraly, **neověřeno**
(odhad: hledají vstup z `req` v Expressu, ne z dekorátorů Nestu).
