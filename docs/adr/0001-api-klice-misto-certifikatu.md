# 0001 — Čtečka a recepce se ověřují API klíčem, ne certifikátem

**Stav:** přijato 1. 10. 2026 · **Kontext:** bezpečnostní review našlo, že `POST /entries` mohl volat kdokoli v síti.

## Rozhodnutí
Dva klíče v hlavičce `x-api-key`: **klíč čtečky** smí jen zapisovat průchody, **klíč recepce** jen číst výpis.
Porovnání v konstantním čase (`timingSafeEqual`). Každá cesta musí deklarovat `@CallerOnly` nebo `@Public('důvod')` — hlídá test.

## Zvažované možnosti
| možnost | proč ne teď |
|---|---|
| **mTLS** (certifikát pro každou čtečku) | nejsilnější, ale potřebuje certifikační autoritu a výměnu certifikátů na pobočkách — provozní náklad, o kterém nevíme, jestli ho zařízení unesou |
| jeden společný klíč | čtečka by mohla číst jména členů |
| bez ověření, spoléhat na oddělenou síť | jedna chyba v síti = kdokoli otevře turniket |

## Důsledky
Klíč je sdílený tajný údaj — únik klíče čtečky dovolí otevírat turniket z jiného stroje. **Přehodnotit**, až bude známo,
jaká zařízení na pobočkách jsou a jestli umí certifikáty. Klíč pro každou čtečku zvlášť by dovolil i rate limit podle čtečky (0002).
