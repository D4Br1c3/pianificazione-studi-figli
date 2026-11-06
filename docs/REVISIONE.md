# Revisione critica preliminare

Il foglio di riferimento `Pianificazione Studi Figli.xlsx` ha sette schede. La struttura distingue passività educative, parametri di mercato, Due Motori, sinking fund e analisi di rischio. Il simulatore conserva questa separazione e rifà i calcoli sulle date effettive. I dati dimostrativi dell’app sono di fantasia.

| Nel foglio | Conseguenza | Nel simulatore |
| --- | --- | --- |
| Età al 1° settembre e anticipo unico per tutti i cicli. Età dei genitori inserite a mano. | Coorti errate per alcune nascite in autunno e riprogrammazione fragile. | Regola del 31 dicembre e del 30 aprile, anticipi indipendenti e alert dalle date effettive. |
| Totale dall’anno successivo in K14 con formula che restituisce `#ERROR!`. Importi e descrizioni scritti a mano in `Riassunto` e `Guida & Sintesi Modello`. | Alcune cifre di sintesi non seguono gli input o includono anni storici. | Righe, riepiloghi e narrazione leggono gli stessi risultati calcolati. |
| `Opzione 2` attribuisce cedole cumulative e rimborso a un anno target. In un caso la scadenza assegnata è nell’anno successivo alla retta. | Il capitale disponibile alla scadenza della spesa può risultare sovrastimato. | Una scadenza sintetica per data di pagamento, con disponibilità effettiva e risorse iniziali finite. |
| `Opzione 1` investe l’intera rata annua a inizio anno e dimensiona il trasferimento a bond come percentuale dell’azionario. | Anticipazione dei flussi PAC e riserva poco legata al fabbisogno. | Date effettive delle rate e riserva dimensionata sulle prossime passività. |
| `Analisi Rischio & Ibbotson` usa formule FV con rendimenti equivalenti. Il test riscalava il risultato ALM con un moltiplicatore comune al ventesimo anno. | Un saldo aggregato capiente può mascherare pagamenti scoperti prima del recupero. | Percorsi Monte Carlo con vendite e prelievi alle date, gap conservato e VaR/ES sullo scoperto. |
| Le due strategie principali partono da capitali iniziali diversi. | Parte del differenziale finale deriva dal capitale in più. | Confronto con identiche risorse e costo teorico della ladder esplicitato a parte. |

## Scelte aggiuntive

1. **Stress all’ingresso in università.** Cattura il rischio di una perdita concentrata alla prima retta anche quando il rendimento medio di lungo periodo resta invariato.
2. **Costi e agevolazioni per figlio.** Fuori sede, università privata e anni aggiuntivi cambiano importi e orizzonte. I €5.000 di partenza sono un budget, soggetto alle tariffe dell’ateneo e alle spese familiari.
3. **Cambio del reddito a un compleanno.** La quota sostitutiva esplicita l’impatto sul reddito disponibile negli anni più costosi.
4. **Scoperti e saldi distinti.** La prima scadenza scoperta, lo scoperto P95 sul reddito e l’ES mostrano effetti che un solo saldo finale può nascondere.
5. **Ladder parziale e sensibilità dei tassi.** Mostrano quanta copertura acquistare con il capitale effettivo e come varia l’esborso richiesto prima dell’acquisto.

Le specifiche indicano due rate iniziali. L’app propone un profilo standard da €250 equivalenti al mese e uno alternativo da €500. Il campione iniziale di 10.000 percorsi per scenario deriva dalla convenzione del progetto PAC. Gli input restano modificabili. Si parte dalla curva BTP a gradini fornita, con alternativa flat al 3,50%.
