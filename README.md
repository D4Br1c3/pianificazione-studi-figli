# Pianificazione studi figli

Simulatore didattico in italiano per stimare le spese scolastiche, confrontare quattro strategie di finanziamento e misurare il rischio di scoperto. Funziona interamente nel browser con un Web Worker, grafici SVG e JavaScript senza librerie esterne.

**[Apri su GitHub Pages](https://d4br1c3.github.io/pianificazione-studi-figli/)** dopo l’attivazione della pubblicazione del repository.

> **Simulazioni didattiche.** Il servizio non presta consulenza in materia di investimenti ai sensi MiFID II, non valuta l’adeguatezza e non raccomanda strumenti o operazioni. Gli esiti dipendono dalle ipotesi e possono includere perdite anche rilevanti. I rendimenti passati non garantiscono quelli futuri.

## Come usarlo

1. In **Ipotesi** inserisci le date di nascita, i redditi netti e i costi di ciascun figlio. Le spese dei cicli esclusi scompaiono dal budget. Per le rate già scadute nell’anno scolastico in corso, indica la percentuale ancora da pagare.
2. Scegli **tutti i cicli** o **solo università** come mandato del portafoglio. Indica l’eventuale quota di reddito già destinata alle rette. Il PAC e i costi fuori mandato restano voci distinte nel bilancio familiare.
3. Imposta il capitale disponibile oggi e la rata PAC. I profili iniziali hanno un equivalente di **250 €** e **500 €** al mese. A parità di budget, la rata effettiva è mensile, trimestrale o in due parti nel mese. Le strategie usano sempre le stesse risorse.
4. Seleziona la curva **BTP a gradini** del progetto oppure un YTM **flat** modificabile, inizialmente 3,50%. La ladder è sintetica. La tabella distingue capitale teorico, capitale impiegato e incassi alle singole scadenze.
5. Premi **Simula il piano**. Cambia strategia o scenario per esplorare i risultati. Il pannello **Scadenze e flussi** mostra costi, quota da reddito, età, alert pensione, versamenti, scoperti e saldi.

| Indicatore | Come leggerlo |
| --- | --- |
| Successo | Quota dei percorsi in cui il portafoglio paga interamente la propria quota a ogni data. |
| VaR 95 e 99 | Soglia empirica degli scoperti cumulati, riportati in euro di oggi. |
| ES 95 e 99 | Scoperto medio rispettivamente del peggior 5% e 1% dei percorsi. |
| Cono P5–P95 | Distribuzione del saldo dopo le spese a ogni rilevazione. La linea tratteggiata somma il target dei pagamenti fino a quel punto. |
| Scoperto P95 / reddito | Quota del reddito netto annuo che servirebbe a coprire lo scoperto al P95 in quell’anno. Con reddito zero, il rapporto è N.D. |
| Saldo liquidabile | Valore di vendita netto del comparto azionario più la riserva liquida. Il saldo del cono include anche il valore contabile della ladder. |

La sessione iniziale usa anagrafiche di fantasia, inflazione del 2%, rendimento azionario lordo del 6%, volatilità browniana del 15% e 10.000 percorsi per scenario. Con capitale iniziale zero, le due ladder coincidono con il PAC azionario. Il confronto dei tre Sharpe riguarda l’asset. I dettagli sono nella [metodologia](docs/METODOLOGIA.md).

## Sessioni e report

- **JSON** conserva anagrafiche, configurazione, pesi, seed e vista selezionata. Reimportalo dal pulsante o trascinalo nella zona di caricamento per rigenerare i risultati.
- **CSV delle ipotesi** usa separatore punto e virgola, numeri con virgola decimale e intestazione `ambito;campo;valore`. Modifica `valore` mantenendo sezioni, chiavi e versione. Le date sono in formato `AAAA-MM-GG`. Le opzioni logiche accettano `vero` e `falso`. Il CSV rappresenta l’intera sessione.
- **CSV dei flussi** include ogni coppia strategia/scenario, con importi per figlio, genitore, anno e misure di rischio. Percentuali e importi sono numeri. I campi vuoti indicano voci non applicabili. Questa esportazione serve all’analisi tabellare.
- **Stampa / PDF** apre la scheda A4 del browser. Seleziona **Salva come PDF** per conservarla. La scheda include il cono, le misure di coda e gli anni più onerosi dello scenario attivo.

I dati rimangono nella pagina fino alla chiusura. I file esportati possono contenere nomi, date di nascita e redditi. Custodiscili come documenti familiari.

## Pubblicazione

Da **Settings → Pages**, seleziona **Deploy from a branch → main → / (root)** e salva. `index.html` è l’entry point. `.nojekyll` permette a Pages di servire direttamente i file statici. L’app richiede soltanto un browser moderno. Se si apre `index.html` da una copia locale completa, il calcolo usa un fallback a blocchi nella pagina.

Per sviluppo e verifiche, esegui `node --test` dalla radice con Node.js 22 o successivo. I test coprono calendario, flussi, scenari deterministici, fiscalità, rischio e round trip dei file.

## Documentazione

- [Metodologia, formule e fonti](docs/METODOLOGIA.md)
- [Revisione critica del foglio](docs/REVISIONE.md)
- [Checklist di sviluppo e collaudo](https://github.com/D4Br1c3/pianificazione-studi-figli/issues/1)
- [Metodologia del progetto PAC](https://github.com/D4Br1c3/pac-montecarlo-simulator/blob/main/docs/METODOLOGIA.md)
