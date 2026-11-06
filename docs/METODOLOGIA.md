# Metodologia del simulatore

Le misure descrivono scenari ipotetici. Il servizio non presta consulenza in materia di investimenti, non valuta l’adeguatezza ai sensi MiFID II e non raccomanda operazioni o strumenti. Fiscalità, costi e prezzi sono rappresentazioni semplificate. Gli esiti possono includere perdite anche rilevanti. I rendimenti passati non garantiscono quelli futuri.

## 1. Date, coorti e costo degli studi

La data iniziale predefinita è quella corrente in Europe/Rome. La proiezione usa anni scolastici dal 1° settembre al 31 agosto. I calcoli di capitalizzazione usano giorni effettivi divisi per 365,2425. Il pagamento annuo cade al primo giorno del mese scelto, inizialmente settembre. Per nido e sezione primavera slitta fino al raggiungimento rispettivamente di 3 e 24 mesi, se ciò avviene entro l’anno scolastico. Il costo inserito è il budget annuo per quel servizio. L’iscrizione in corso d’anno può richiedere di adattare il budget.

| Ciclo | Durata o criterio | Costo annuo iniziale |
| --- | --- | --- |
| Nido | Fino alla coorte del secondo compleanno, con anno d’ingresso configurabile | €6.600 |
| Sezione primavera | Alternativa facoltativa nell’anno del secondo compleanno, secondo il servizio locale | €1.000 |
| Infanzia | Dai 3 anni compiuti entro dicembre, oppure ingresso differito | €1.000 |
| Primaria | 5 anni, dai 6 anni compiuti entro dicembre | €1.000 |
| Secondaria I grado | 3 anni | €1.000 |
| Secondaria II grado | 5 anni | €1.000 |
| Università | Primo ciclo 3 anni e secondo ciclo 2 anni. Durate e pausa configurabili | €5.000 per ciclo |

Per anticipare l’infanzia o la primaria, il terzo o il sesto compleanno deve cadere entro il 30 aprile dell’anno solare successivo all’inizio dell’anno scolastico. L’infanzia anticipata è soggetta alle condizioni di ammissione della scuola. I due anticipi sono indipendenti. Dopo l’ingresso in primaria, la coorte effettiva rimane registrabile come dato storico. L’infanzia anticipata ha priorità sulla sezione primavera nello stesso anno. L’anno iniziale del nido e gli accessi effettivi possono dipendere dal regolamento locale. Le spunte scolastiche escludono costi e conservano la durata dei cicli obbligatori.

Per figlio e data, siano $C$ il costo lordo in euro di oggi e $A$ l’agevolazione inserita in euro di oggi. Università include eventuale fuori sede e sovrapprezzo privato. Con $i_c$ tasso di inflazione applicabile, $t$ anni dalla valutazione e $s$ quota ancora dovuta:

$$
G_t=s C(1+i_c)^t,\qquad
A_t=\min(G_t,s A(1+i_c)^t),\qquad L_t=G_t-A_t.
$$

Il tasso $i_c$ è l’inflazione generale più l’eventuale differenziale universitario. Lo stress aggiunge un ulteriore differenziale soltanto all’università. Le quote delle rate già scadute nell’anno scolastico in corso si pagano alla data di inizio e hanno $t=0$. Il default $s=0$ assume che quelle rate siano già pagate. Per ogni pagamento futuro $s=1$.

## 2. Reddito, pensione e perimetro finanziato

Per ciascun genitore, il reddito netto attuale $I_0$ evolve come $I_t=I_0(1+i+g)^t$, con inflazione generale $i$ e crescita aggiuntiva $g$ personalizzabile. L’app usa la somma dei tassi come da specifica. Come esempio, 2% di inflazione e 1% aggiuntivo danno 3% nominale.

Al compleanno futuro scelto, si applica una quota sostitutiva al livello proiettato. Il reddito immesso all’avvio rappresenta sempre quello corrente, anche se l’età scelta è già stata raggiunta. Il reddito visualizzato è annualizzato al giorno di riferimento, senza ripartizione mensile della transizione. L’alert intercetta l’intersezione dell’anno scolastico residuo con l’intervallo dal 67° compleanno fino al giorno precedente il 71°. È rosso se ci sono costi universitari, se il costo è almeno il 25% del reddito o se il reddito è zero, altrimenti ambra. La fascia è un indicatore di sovrapposizione anagrafica. I requisiti INPS dipendono dal canale e dalla storia contributiva.

Il budget diretto annuale è $p\sum I_t$, dove $p$ è la quota scelta. Viene assegnato in ordine di pagamento alle spese nel mandato fino a esaurimento. I costi esclusi dal mandato restano a carico del bilancio familiare e sono riportati a parte. Per i costi nel mandato:

$$
\text{Target}_t=\max(0,L_t-\text{Quota da reddito}_t).
$$

Il PAC è una risorsa esogena. L’app mostra anche l’impegno combinato di rate, quota da reddito, spese fuori mandato e scoperto P95. Rapporti su reddito zero sono N.D. Il simulatore usa lo scoperto come somma da reperire e lo conserva nel conto del rischio.

## 3. Curva, imposte e bollo

| Durata residua | YTM lordo usato | Riferimenti Last Mid forniti |
| --- | --- | --- |
| $[0,1)$ | 2,50% | Proxy di liquidità |
| $[1,3)$ | 3,50% | 3Y 3,628% |
| $[3,5)$ | 3,75% | 3Y 3,628% e 5Y 3,942% |
| $[5,7)$ | 4,00% | 5Y 3,942% e 7Y 4,150% |
| $[7,10)$ | 4,25% | 7Y 4,150% e 10Y 4,424% |
| $[10,20)$ | 4,50% | 10Y 4,424%, 15Y 4,728% e 20Y 4,83% |
| $[20,+\infty)$ | 4,75% | 30Y 4,996% |

La modalità flat usa il tasso scelto per tutte le durate. I benchmark sono le ipotesi fornite per il progetto. Il modello tratta i YTM come proxy dei tassi zero-coupon. Con $y_t$ tasso lordo, $\tau_b=12,5\%$ e $b$ bollo annuo, il fattore netto modellato è:

$$
G=(1+y_t)^t,\qquad
F_b(t)=[G-\tau_b\max(G-1,0)]\,e^{-bt},\qquad
PV_t=\frac{\text{Target}_t}{F_b(t)}.
$$

Se una scadenza riceve $B$ oggi, consegna $B F_b(t)$ netto alla data. Il bollo, inizialmente 0,20%, è una riduzione proporzionale continua semplificata. Sulla riserva liquida si usa il tasso della fascia breve o il flat, si tassa l’interesse positivo per intervallo e si applica il bollo. I movimenti teorici di ±100 punti base valgono prima dell’acquisto e tengono fissi gli importi delle spese.

La ladder sintetica permette il match temporale nel modello. Per una replica reale occorrono prezzi eseguibili, disponibilità delle scadenze, rateo, tagli negoziabili, costi, imposte sulle componenti e gestione delle cedole o degli strip. La concentrazione sovrana, la liquidità prima della scadenza e le spese superiori alle attese restano rischi sostanziali. I dati del foglio sui singoli titoli sono esclusi dall’app.

## 4. PAC, motore stocastico e strategia

La rata a regime è $12$ volte l’equivalente mensile diviso per il numero di rate annue. Il PAC mensile usa il giorno 1 oppure la fine del mese. Il trimestrale usa l’inizio o la fine del trimestre solare. Due rate mensili cadono il 1° e il 16°, oppure il 15° e l’ultimo giorno. Si considerano soltanto le date comprese tra l’inizio e l’ultima rilevazione. La commissione fissa di acquisto è trattenuta da ogni ordine azionario positivo fino al valore dell’ordine, incluso l’investimento azionario iniziale. I versamenti sono nominali e costanti.

L’azionario usa le convenzioni del progetto PAC. L’input $a$ è la media aritmetica annua del rendimento semplice lordo. $\sigma$ è la volatilità annualizzata della componente browniana. Per l’intervallo $\Delta t$, con costo annuo $c$, salti medi annui $\lambda$, salto medio semplice $j$, dispersione logaritmica fissa $\delta=0,05$, $N\sim\mathrm{Pois}(\lambda\Delta t)$ e normali indipendenti $Z,Z'$:

$$
\log F =
[\log(1+a)-\lambda j-\tfrac12\sigma^2-c]\Delta t
+\sigma\sqrt{\Delta t}Z
+N[\log(1+j)-\tfrac12\delta^2]
+\delta\sqrt{N}Z'.
$$

Con salti disattivati, $\lambda=0$. Il termine di compensazione mantiene la media semplice annua a $(1+a)e^{-c}-1$ dopo TER. La griglia segue le date effettive di versamenti, prelievi, revisioni e osservazioni. Mulberry32 e Box–Muller producono gli stessi shock per le quattro strategie. I casi Base, Bear, Bull e Stress usano lo stesso seed e le medesime innovazioni per le date comuni. Il ribasso puntuale dello stress si applica all’azionario in essere prima del versamento e della prima retta universitaria residua. La sua perdita attesa è separata dallo Sharpe dell’asset.

Lo Sharpe delle ipotesi vale $(a-r_f)/\sigma$. Per il modello, con $m=(1+a)e^{-c}$ ed $E[(J-1)^2]=(1+j)^2 e^{\delta^2}-2(1+j)+1$, si usa

$$
S=\frac{m-1-r_f}{m\sqrt{\exp(\sigma^2+\lambda E[(J-1)^2])-1}}.
$$

È una metrica nominale dell’asset dopo TER e prima di imposte, bollo e commissioni. Con rischio zero si legge N.D.

### Regole di allocazione

| Strategia | Regola operativa |
| --- | --- |
| PAC azionario | Capitale iniziale e versamenti in azionario, vendite a scadenza. |
| Due Motori | All’avvio e a inizio trimestre trasferisce, se necessario, azionario nella riserva fino alla quota desiderata dei target Base nei prossimi $N$ anni, scontati al breve netto. Le eccedenze restano nella riserva. |
| Ladder integrale | Compra oggi le scadenze sul 100% del target Base, in ordine cronologico e fino al capitale iniziale. Il capitale residuo e il PAC vanno in azionario. |
| Ladder ibrida | La stessa logica punta a una quota configurabile di ciascun target, inizialmente 50%. |

A ogni data si applicano nell’ordine mercato, costi sul saldo, versamenti, scadenze della ladder, eventuale revisione di Due Motori e pagamento. Si usa prima la riserva, poi l’azionario. Le scadenze future della ladder non sono liquidate per coprire una retta anticipata. Le scadenze della ladder e gli obiettivi di riserva si basano sul calendario Base anche nei casi di stress.

Con valore azionario $V$ e costo fiscale residuo $K$, una vendita lorda $x$ realizza un’imposta $\tau_e x \max(0,1-K/V)$ con $\tau_e=26\%$. Il costo residuo diventa $K(1-x/V)$. Si vende il lordo necessario per ottenere la cassa netta fino alla capienza. Sono esclusi compensazioni di minusvalenze, regole dei singoli prodotti, distribuzioni e imposte personali. Il bollo sui saldi liquidi è un costo proporzionale con base fiscale azionaria invariata.

Il saldo netto dopo pagamento comprende riserva, azionario al valore di liquidazione netto teorico e ladder residua al valore contabile accresciuto. Il saldo liquidabile esclude la ladder. Il risultato di gestione annuale combina rendimento azionario dopo TER, interesse lordo della riserva e accrescimento netto della ladder. Imposte, commissioni e bollo riportati a parte riguardano i comparti liquidi. Le imposte e il bollo della ladder sono già nel suo fattore netto.

## 5. Misure di rischio

Sia $D_{s,t}$ lo scoperto alla data $t$ nel percorso $s$. Il successo è la quota di percorsi con ogni $D_{s,t}$ entro mezzo centesimo. La misura registra anche il primo anno di mancata copertura. Un saldo finale esattamente zero è coerente con il successo se tutti i pagamenti sono stati eseguiti. Il saldo finale e gli scoperti sono misure separate.

$$
L_s=\sum_t \frac{D_{s,t}}{(1+i)^t}.
$$

VaR $\alpha$ è il quantile empirico di $L_s$ con rango $\lceil \alpha N\rceil$. ES $\alpha$ è la media della coda peggiore $1-\alpha$, ponderando il dato di confine se serve. La massa a zero è inclusa nella distribuzione. Un VaR nullo può quindi coesistere con ES positivo. Il cono calcola P5, P25, P50, P75 e P95 del saldo dopo i pagamenti, con interpolazione lineare. I P5 e P95 sono soglie di distribuzione, non estremi. In euro di oggi, ogni importo è deflazionato alla sua data. Il target cumulato somma flussi e il cono rappresenta uno stock.

Il successo riporta un intervallo di Wilson al 95% relativo al campione. Con 10.000 percorsi, la coda ES 99 usa circa 100 osservazioni. L’incertezza sulle ipotesi domina il rumore numerico su orizzonti lunghi. Il modello usa parametri costanti all’interno di ciascuno scenario, costi deterministici, spread sovrano fisso e assenza di insolvenze esplicite. Inflazione, disponibilità dei risparmi e rendimenti non hanno una correlazione stimata. Bear, Bull e Stress sono condizioni ipotetiche, senza probabilità assegnate ai regimi.

## Fonti

- [MIM, nota iscrizioni 2026/2027, sezioni 5.1 e 5.2](https://www.mim.gov.it/documents/20182/0/m_pi.AOODGOSV.REGISTRO%2BUFFICIALE%28U%29.0100847.17-12-2025.pdf/19dee844-d239-8b6d-c007-2389fa7aff5e?t=1766053811062&version=1.0)
- [D.lgs. 65/2017, servizi educativi per l’infanzia](https://www.normattiva.it/eli/id/2017/05/16/17G00073/CONSOLIDATED)
- [INPS, requisiti pensionistici aggiornati per il 2027 e 2028](https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.03.pensioni-requisiti-aggiornati-per-il-2027-e-il-2028.html)
- [Università di Milano-Bicocca, contribuzione studentesca 2026/2027](https://www.unimib.it/studiare/servizi-studenti-e-laureati/segreterie/immatricolazione/contribuzione-studentesca)
- [Decreto-legge 66/2014, art. 3](https://www.normattiva.it/atto/caricaDettaglioAtto?atto.articolo.numero=3&atto.articolo.sottoArticolo=1&atto.codiceRedazionale=14G00079&atto.dataPubblicazioneGazzetta=2014-04-24)
- [Documentazione del Dipartimento delle Finanze, bollo su prodotti finanziari](https://def.finanze.it/DocTribFrontend/getContent.do?id=%7B834FD4B0-0887-4777-997B-74DF83A14A4C%7D)
- [MEF, decreto sullo stripping dei titoli di Stato](https://www.gazzettaufficiale.it/eli/id/2012/12/17/12A13163/sg)
- [Direttiva 2014/65/UE, MiFID II](https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX%3A02014L0065-20260606)
- [Progetto PAC, metodologia](https://github.com/D4Br1c3/pac-montecarlo-simulator/blob/main/docs/METODOLOGIA.md)
