# 0002 — Rate limit 10 požadavků za sekundu podle IP adresy

**Stav:** přijato 1. 10. 2026 jako **dočasné** · **Kontext:** záplava vymyšlených kódů karet by zahltila pool 5 spojení do databáze a skutečné průchody by čekaly.

## Rozhodnutí
`@nestjs/throttler`, 10 požadavků / 1 s, počítáno **podle IP adresy klienta**. Tělo požadavku max. 1 kB.

## Zvažované možnosti
| možnost | proč ne teď |
|---|---|
| limit **podle klíče čtečky** | správnější (viz riziko níže), ale dnes mají všechny čtečky jeden klíč (0001) |
| bez limitu | pool 5 spojení je snadné zahltit |

## Riziko — řešit před nasazením
Čtečky za **jednou NAT** mají navenek jednu IP ⇒ blokovaly by se navzájem. Zátěžový test to ukázal: při 8 požadavcích
za sekundu přišlo občas 429 (posuvné okno). Až bude klíč na čtečku, přepnout limit na klíč.
