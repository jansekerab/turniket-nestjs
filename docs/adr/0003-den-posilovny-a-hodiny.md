# 0003 — „Dnes" je den posilovny, ne serveru; čas jde přes `Clock`

**Stav:** přijato 1. 10. 2026 · **Kontext:** review našlo, že služba počítala dnešní datum v časové zóně serveru.
Server v Dockeru běží v UTC ⇒ první 1–2 hodiny po půlnoci pražského času si myslel, že je včera, a **pustil člena den po konci členství**.

## Rozhodnutí
- Členství platí **do kalendářního dne včetně** (`validUntil` je `'YYYY-MM-DD'`, ne okamžik — nepřevádí se do UTC).
- Dnešní den počítá `SystemClock` v zóně posilovny (`GYM_TIME_ZONE`, výchozí `Europe/Prague`); neplatná zóna zastaví start.
- Služba dostává hodiny jako závislost (`Clock`) ⇒ test zkusí libovolný den bez skutečného času.
- Testy běží ve 4 časových zónách (`npm run test:tz`).

## Zvažované možnosti
| možnost | proč ne |
|---|---|
| `TZ=Europe/Prague` pro celý kontejner | spoléhá na nastavení prostředí; v jiném nasazení se vada vrátí potichu |
| ukládat platnost jako okamžik (`DATETIME`) | „do 30. 9. včetně" je kalendářní pojem; okamžik vnáší otázku, v jaké zóně ta půlnoc je |

## Důsledky
Pobočka v jiné zóně by potřebovala zónu pobočky, ne služby — dnes je jedna zóna pro všechny.
