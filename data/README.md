# data/ — källor och licenser

| Fil | Vad | Källa | Licens |
|---|---|---|---|
| `fornamn.txt` | Svenska förnamn (24 979) | SCB via bolddp/swedish-names | se lib/fornamn.mjs |
| `vanliga-ord.txt` | Vanliga svenska ord, härledda ur lagtexterna i `lagar/` | `scripts/vanliga-ord.mjs` | svensk författningstext är fri (1 kap. 9 § upphovsrättslagen) |
| `engelska-ord.txt` | Vanliga engelska ord som inte är namn (45 914) | Moby Word Lists, `common.txt` (Grady Ward), gutenberg.org/ebooks/3201 | Public domain ("Public Domain material by grant from the author, January, 2001") |
| `engelska-namnord.txt` | Vanliga engelska ord som också är för- eller efternamn (944) | Moby `common.txt` ∩ SSA ∪ US Census | Public domain |
| `engelska-fornamn.txt` | Amerikanska förnamn med högsta andel av årets födda 1880–2008 (6 782) | US Social Security Administration, "Popular Baby Names" (de 1 000 vanligaste per år), via spegeln github.com/hadley/data-baby-names | Public domain (verk av amerikanska staten, 17 U.S.C. § 105) |
| `engelska-efternamn.txt` | De 2 000 vanligaste amerikanska efternamnen | US Census Bureau, 2010 Census surnames, www2.census.gov/topics/genealogy/2010surnames/ | Public domain (verk av amerikanska staten) |
| `hjalp.md`, `hjalp.en.md` | Hjälpens underlag, svenska och engelska | egna | — |
| `villkor.md` | Villkoren | egna, bara på svenska tills en granskad översättning finns | — |

De engelska listorna byggs av `scripts/engelska-listor.mjs` (källfilerna som
argument) och ändras inte för hand. De läses av `lib/failclosed.mjs`, och bara
för en text som läses som engelska — en svensk text maskeras som förut.
