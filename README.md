# Pianificazione studi figli

Simulatore didattico per stimare le spese scolastiche di ogni figlio, valutare quanto pesano sul reddito familiare e confrontare quattro strategie di finanziamento. Si usa nel browser. Il calcolo avviene sul dispositivo.

**[Apri il simulatore](https://d4br1c3.github.io/pianificazione-studi-figli/)**

## Imposta il piano

1. Indica date di nascita, redditi netti, costi e agevolazioni. Il calendario applica l’inflazione e segnala gli anni in cui le spese coincidono con la fascia pensionistica di ciascun genitore.
2. Scegli quando il portafoglio inizia a finanziare le spese. Puoi partire dalla prima spesa residua, da un anno scolastico comune o dall’ingresso di ciascun figlio in un determinato ciclo.
3. Imposta capitale iniziale, rate del piano di accumulo (PAC), mercato e scenari. I box delle strategie spiegano come il capitale viene investito e utilizzato alle scadenze.
4. Controlla il riepilogo e seleziona **Simula il piano**. Puoi esplorare gli esiti Base, Bear, Bull e stress universitario con le stesse risorse iniziali per tutte le strategie.

## Leggi i risultati

| Indicatore | Interpretazione |
| --- | --- |
| Probabilità di copertura | Quota dei percorsi in cui tutte le spese affidate al portafoglio sono pagate alla data prevista. |
| Scoperto | Quota della spesa assegnata al portafoglio rimasta da pagare alla scadenza. |
| VaR 95% e 99% | Soglia dello scoperto cumulato che separa il 5% e l’1% dei percorsi peggiori, in euro di oggi. |
| ES 95% e 99% | Scoperto medio nel peggior 5% e 1% dei percorsi, in euro di oggi. |
| Saldo dopo i pagamenti | Distribuzione del capitale residuo a ogni data. P50 è la mediana. La fascia P5–P95 contiene il 90% centrale. |
| Scoperto P95 / reddito | Risorse aggiuntive necessarie al livello P95 in un anno, come quota del reddito netto familiare. Con reddito zero il rapporto è N.D. |
| Capitale liquidabile | Riserva disponibile e valore netto di liquidazione del comparto azionario. Il saldo complessivo include anche il valore contabile della ladder. |

## File e stampa

- **JSON e CSV di ipotesi** conservano le informazioni del piano, la regola dei prelievi e il campione. L’importazione ripristina le ipotesi. La simulazione si avvia dal pulsante.
- **CSV dei flussi** contiene le righe per anno, strategia e scenario, le spese per figlio, le età, i redditi e gli esiti simulati.
- **Stampa / PDF** apre una scheda A4 con il grafico del saldo, il confronto delle strategie e gli anni di maggiore spesa.

Il CSV delle ipotesi usa la virgola decimale, il punto e virgola come separatore e le date `AAAA-MM-GG`. La sessione è salvabile tramite esportazione. I file scaricati possono contenere nomi, date di nascita e redditi.

## Modello e codice

La [metodologia](docs/METODOLOGIA.md) descrive il calendario, le regole di prelievo, la curva dei tassi, il processo dei rendimenti, l’allocazione e le misure di rischio. Discuti eventuali problemi nel [tracker del progetto](https://github.com/D4Br1c3/pianificazione-studi-figli/issues).

Applicazione statica con entry point `index.html`, codice JavaScript e un Web Worker per la simulazione. Per eseguire i test del motore si usa `node --test` con Node.js 22 o successivo.

> **Simulazioni didattiche.** Il servizio non presta consulenza in materia di investimenti ai sensi MiFID II. Gli esiti dipendono dalle ipotesi e possono includere perdite. I rendimenti passati non garantiscono quelli futuri.
