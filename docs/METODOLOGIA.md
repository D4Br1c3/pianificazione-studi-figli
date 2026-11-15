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

## 2. Reddito, pensione e avvio dei prelievi

Per ciascun genitore, il reddito netto iniziale $I_0$ evolve come $I_t=I_0(1+i+g)^t$, dove $i$ è l’inflazione generale e $g$ la crescita aggiuntiva del reddito. Al compleanno futuro impostato per la pensione si applica la quota di reddito sostitutiva al valore proiettato. Il reddito iniziale rappresenta quello corrente, anche per chi è già in pensione.

La data di riferimento per età e reddito è il giorno di pagamento convenzionale, con un minimo pari all’inizio del piano. Il reddito è annualizzato a quella data. L’indicatore per genitore segnala un’intersezione dell’anno scolastico residuo con il periodo compreso tra il 67° e il 71° compleanno, con 71° escluso. In presenza di spese l’alert è rosso se ci sono costi universitari, se il costo netto è almeno il 25% del reddito annuo oppure se il reddito è zero. Negli altri casi di sovrapposizione con spese è ambra. Il calendario indica anche la data di pensione ipotizzata, che governa la proiezione del reddito. La fascia segnala un periodo da osservare. L’accesso alle prestazioni previdenziali segue i requisiti applicabili alla persona.

| Regola | Prima spesa ammissibile |
| --- | --- |
| Dalla prima spesa residua | Qualsiasi spesa ancora da pagare all’inizio o prevista dopo l’avvio del piano. |
| Da un anno scolastico comune | Spese attribuite all’anno scelto o a un anno scolastico successivo, per tutti i figli. |
| Dall’inizio di un ciclo per ogni figlio | Per ciascun figlio, spese dall’anno di inizio del ciclo scelto. La soglia si sposta con il suo calendario, incluso l’eventuale anticipo e la durata degli studi. |

Le spese dei figli per cui il ciclo scelto è assente e quelle prima della soglia restano a carico della famiglia. Nei servizi educativi facoltativi, il ciclo è presente se la relativa spesa è inclusa e il calendario prevede la frequenza. Nei cicli obbligatori la soglia segue l’anno di ingresso anche quando la relativa spesa è esclusa. L’inizio dell’università coincide con il primo anno degli studi universitari previsti. L’inizio della magistrale segue gli anni del primo corso.

La quota di reddito destinata a pagare direttamente le spese ammonta a $p\sum I_t$ per anno, con $p$ percentuale scelta. Viene assegnata in ordine di scadenza alle sole spese ammissibili. La formula del prelievo richiesto usa la spesa netta $L_{j,t}$ del figlio $j$ e il contributo diretto del reddito $R_{j,t}$.

$$
T_{j,t}=
\begin{cases}
\max(0,L_{j,t}-R_{j,t}) & \text{se la spesa rientra nella regola di avvio},\\
0 & \text{altrimenti}.
\end{cases}
$$

La prima scadenza da finanziare è la prima data con $\sum_j T_{j,t}>0$. I versamenti PAC restano definiti dal loro calendario. La riserva e le scadenze della ladder possono essere predisposte prima del primo prelievo. L’impegno sul reddito somma le spese a carico della famiglia, le rate PAC e lo scoperto P95. Con reddito zero, il rapporto è indicato come N.D.

## 3. Tassi obbligazionari, imposte e bollo

| Durata residua | Tasso annuo lordo |
| --- | --- |
| $[0,1)$ anni | 2,50% |
| $[1,3)$ anni | 3,50% |
| $[3,5)$ anni | 3,75% |
| $[5,7)$ anni | 4,00% |
| $[7,10)$ anni | 4,25% |
| $[10,20)$ anni | 4,50% |
| Da 20 anni | 4,75% |

La curva a gradini associa a ogni durata un tasso effettivo annuo. La modalità a tasso costante usa il tasso scelto per tutte le durate. Con $y_t$ tasso lordo, $\tau_b=12,5\%$ aliquota obbligazionaria modellata, $b$ bollo annuo e $T_t=\sum_j T_{j,t}$:

$$
G=(1+y_t)^t,\qquad
F_b(t)=[G-\tau_b\max(G-1,0)]\,e^{-bt},\qquad
PV_t=\frac{T_t}{F_b(t)}.
$$

Un capitale $B$ assegnato a una data genera un incasso netto modellato di $B F_b(t)$. Il bollo è rappresentato da una riduzione proporzionale continua. La riserva usa il tasso della fascia breve o il tasso costante. Il modello tassa l’interesse positivo per intervallo e applica il bollo. La sensibilità di ±1 punto percentuale mostra quanto cambia il capitale da accantonare mantenendo fisse le spese.

La ladder rappresenta una serie di incassi sintetici con date e importi prestabiliti. Il costo teorico dipende dalla curva modellata e dalle spese attese. Nella pratica incidono disponibilità delle scadenze, liquidità, costi, rischio di credito ed eventuali differenze tra spese previste e spese effettive.

## 4. PAC, motore stocastico e strategia

La rata a regime è $12$ volte l’equivalente mensile diviso per il numero di rate annue. Il PAC mensile usa il giorno 1 oppure la fine del mese. Il trimestrale usa l’inizio o la fine del trimestre solare. Due rate mensili cadono il 1° e il 16°, oppure il 15° e l’ultimo giorno. Si considerano soltanto le date comprese tra l’inizio e l’ultima rilevazione. La commissione fissa di acquisto è trattenuta da ogni ordine azionario positivo fino al valore dell’ordine, incluso l’investimento azionario iniziale. I versamenti sono nominali e costanti.

Per l’azionario, $a$ è la media aritmetica annua del rendimento semplice lordo. $\sigma$ è la volatilità annualizzata della componente browniana. Per l’intervallo $\Delta t$, con costo annuo $c$, salti medi annui $\lambda$, salto medio semplice $j$, dispersione logaritmica fissa $\delta=0,05$, $N\sim\mathrm{Pois}(\lambda\Delta t)$ e normali indipendenti $Z,Z'$:

$$
\log F =
[\log(1+a)-\lambda j-\tfrac12\sigma^2-c]\Delta t
+\sigma\sqrt{\Delta t}Z
+N[\log(1+j)-\tfrac12\delta^2]
+\delta\sqrt{N}Z'.
$$

Con salti disattivati, $\lambda=0$. Il termine di compensazione mantiene la media semplice annua a $(1+a)e^{-c}-1$ dopo TER. La griglia segue le date effettive di versamenti, prelievi, revisioni e osservazioni. Mulberry32 e Box–Muller producono gli stessi shock per le quattro strategie. I casi Base, Bear, Bull e Stress usano lo stesso seed e le medesime innovazioni per le date comuni. Il ribasso puntuale dello stress si applica all’azionario in essere prima del versamento e della prima retta universitaria residua. Lo Sharpe descrive il processo di mercato ordinario. In Bear e Bull si applicano le variazioni impostate a rendimento e volatilità per tutto l’orizzonte. Nello stress universitario si aggiunge al percorso ordinario il ribasso puntuale, insieme alla maggiore inflazione universitaria. Il ribasso segue il calendario universitario residuo.

Lo Sharpe delle ipotesi vale $(a-r_f)/\sigma$. Per il modello, con $m=(1+a)e^{-c}$ ed $E[(J-1)^2]=(1+j)^2 e^{\delta^2}-2(1+j)+1$, si usa

$$
S=\frac{m-1-r_f}{m\sqrt{\exp(\sigma^2+\lambda E[(J-1)^2])-1}}.
$$

È una metrica nominale dell’asset dopo TER e prima di imposte, bollo e commissioni. Con rischio zero si legge N.D.

### Regole di allocazione

| Strategia | Regola operativa |
| --- | --- |
| PAC azionario | Capitale iniziale e versamenti in azionario, vendite a scadenza. |
| Due Motori | All’avvio e a inizio trimestre trasferisce, se necessario, azionario nella riserva fino alla quota desiderata delle spese da finanziare nel Base nei prossimi $N$ anni, scontati al breve netto. Le eccedenze restano nella riserva. |
| Ladder integrale | Compra oggi le scadenze sul 100% delle spese da finanziare nel Base, in ordine cronologico e fino al capitale iniziale. Il capitale residuo e il PAC vanno in azionario. |
| Ladder ibrida | La stessa logica punta a una quota configurabile di ciascuna spesa da finanziare, inizialmente 50%. |

A ogni data si applicano nell’ordine mercato, costi sul saldo, versamenti, scadenze della ladder, eventuale revisione di Due Motori e pagamento. Si usa prima la riserva, poi l’azionario. Le scadenze future della ladder non sono liquidate per coprire una retta anticipata. Le scadenze della ladder e gli obiettivi di riserva si basano sul calendario Base anche nei casi di stress.

Con valore azionario $V$ e costo fiscale residuo $K$, una vendita lorda $x$ realizza un’imposta $\tau_e x \max(0,1-K/V)$ con $\tau_e=26\%$. Il costo residuo diventa $K(1-x/V)$. Si vende il lordo necessario per ottenere la cassa netta fino alla capienza. Sono esclusi compensazioni di minusvalenze, regole dei singoli prodotti, distribuzioni e imposte personali. Il bollo sui saldi liquidi è un costo proporzionale con base fiscale azionaria invariata.

Il saldo netto dopo pagamento comprende riserva, azionario al valore di liquidazione netto teorico e ladder residua al valore contabile accresciuto. Il saldo liquidabile esclude la ladder. Il risultato di gestione annuale combina rendimento azionario dopo TER, interesse lordo della riserva e accrescimento netto della ladder. Imposte, commissioni e bollo riportati a parte riguardano i comparti liquidi. Le imposte e il bollo della ladder sono già nel suo fattore netto.

## 5. Misure di rischio

Sia $D_{s,t}$ la parte del prelievo richiesto rimasta scoperta alla data $t$ nel percorso $s$. La probabilità di copertura è la quota di percorsi con ogni $D_{s,t}$ entro mezzo centesimo. Un saldo finale esattamente zero è coerente con il successo se tutti i pagamenti sono stati eseguiti. Se il piano non prevede spese a carico del portafoglio, la probabilità di copertura è N.D. e lo scoperto è zero. Si registrano anche il primo anno di scoperto e il capitale residuo.

$$
L_s=\sum_t \frac{D_{s,t}}{(1+i)^t}.
$$

VaR $\alpha$ è il quantile empirico di $L_s$ con rango $\lceil \alpha N\rceil$. ES $\alpha$ è la media della coda peggiore $1-\alpha$, ponderando il dato di confine se serve. La massa a zero è inclusa nella distribuzione. Un VaR nullo può quindi coesistere con ES positivo. Il cono calcola P5, P25, P50, P75 e P95 del saldo dopo i pagamenti, con interpolazione lineare. I P5 e P95 sono soglie di distribuzione, non estremi. In euro di oggi, ogni importo è deflazionato alla sua data. La linea delle spese cumulate somma gli importi assegnati al portafoglio fino a ciascuna data. Il cono rappresenta il capitale residuo alla stessa data.

La probabilità di copertura riporta un intervallo di Wilson al 95% relativo al campione. Con 10.000 percorsi, la coda ES 99 usa circa 100 osservazioni. L’incertezza sulle ipotesi domina il rumore numerico su orizzonti lunghi. Il modello usa parametri costanti all’interno di ciascuno scenario, costi deterministici, tassi obbligazionari deterministici e assenza di insolvenze esplicite. Inflazione, disponibilità dei risparmi e rendimenti non hanno una correlazione stimata. Bear, Bull e Stress sono condizioni ipotetiche, senza probabilità assegnate ai regimi.

## Fonti

- [MIM, nota iscrizioni 2026/2027, sezioni 5.1 e 5.2](https://www.mim.gov.it/documents/20182/0/m_pi.AOODGOSV.REGISTRO%2BUFFICIALE%28U%29.0100847.17-12-2025.pdf/19dee844-d239-8b6d-c007-2389fa7aff5e?t=1766053811062&version=1.0)
- [D.lgs. 65/2017, servizi educativi per l’infanzia](https://www.normattiva.it/eli/id/2017/05/16/17G00073/CONSOLIDATED)
- [INPS, requisiti pensionistici aggiornati per il 2027 e 2028](https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.03.pensioni-requisiti-aggiornati-per-il-2027-e-il-2028.html)
- [Università di Milano-Bicocca, contribuzione studentesca 2026/2027](https://www.unimib.it/studiare/servizi-studenti-e-laureati/segreterie/immatricolazione/contribuzione-studentesca)
- [Decreto-legge 66/2014, art. 3](https://www.normattiva.it/atto/caricaDettaglioAtto?atto.articolo.numero=3&atto.articolo.sottoArticolo=1&atto.codiceRedazionale=14G00079&atto.dataPubblicazioneGazzetta=2014-04-24)
- [Documentazione del Dipartimento delle Finanze, bollo su prodotti finanziari](https://def.finanze.it/DocTribFrontend/getContent.do?id=%7B834FD4B0-0887-4777-997B-74DF83A14A4C%7D)
- [Direttiva 2014/65/UE, MiFID II](https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX%3A02014L0065-20260606)
