# Server Dashboard

Una dashboard personale in **Next.js, TypeScript e shadcn/ui**, con tema nero/viola, per gestire i server di gioco già configurati con systemd.

- Panoramica compatta con stato esplicito e controlli separati, aggiornata ogni quattro secondi.
- Pagina dedicata `/servers/<id>` per log, configurazione e avvio al boot.
- Log systemd per ciascun server, con aggiornamento automatico disattivabile.
- Accensione, arresto e riavvio; conferma prima di interrompere un server.
- Interruttore indipendente per l'avvio automatico al boot.
- Editor dei file configurati, disponibile in scrittura a server spento.
- Backup prima di ogni modifica, salvataggio atomico e rilevamento delle modifiche concorrenti.
- Password personale, sessioni HTTPS, protezione delle richieste di modifica e limitazione dei tentativi di accesso.
- Interfaccia responsive in italiano, con componenti shadcn/ui basati su Radix.

## Installazione

Richiede Linux con systemd, Node.js 22 o successivo, npm e OpenSSL. Eseguire come l'utente proprietario dei server.

```bash
npm ci
npm run setup
```

Il comando crea `~/.local/share/server-dashboard/` con password, certificato locale e un elenco server inizialmente vuoto. Non sovrascrive i file esistenti. È possibile cambiare la directory tramite `DASHBOARD_DATA_DIR`.

Copiare e adattare `servers.example.json` nel file `servers.json` della directory dati. I percorsi devono essere assoluti. Sono gestibili soltanto le unità e i file esplicitamente elencati: nessun comando shell viene accettato dal browser. Le modifiche all'elenco vengono lette senza riavvio della dashboard.

```bash
npm run build
npm start
```

Aprire `https://IP-DEL-PC:9080`. Il certificato autogenerato richiede un'eccezione nel browser; è possibile sostituire `cert.pem` e `key.pem` con un certificato attendibile. Leggere la password localmente dal file `password` della directory dati. Per cambiarla, sostituirne il contenuto e riavviare la dashboard, invalidando le sessioni esistenti.

Per lo sviluppo: `npm run dev` avvia lo stesso server HTTPS con Next.js in modalità sviluppo. La porta è configurabile tramite `PORT`; l'indirizzo tramite `LISTEN_HOST` (predefinito `0.0.0.0`).

## Avvio al boot

Adattare `deploy/server-dashboard.service.example` con il percorso della repository e quello assoluto di `node` (`command -v node`). Copiarlo in `~/.config/systemd/user/server-dashboard.service`, poi:

```bash
systemctl --user daemon-reload
systemctl --user enable --now server-dashboard.service
```

Per avviare i servizi utente al boot senza login, un amministratore deve abilitare il linger per l'utente (`sudo loginctl enable-linger "$USER"`).

`scope: "user"` usa `systemctl --user`; `scope: "system"` usa `systemctl`. I servizi di sistema richiedono permessi già predisposti sul computer. L'app non usa sudo e non modifica le policy di autorizzazione. L'interruttore abilita/disabilita l'unità, senza cambiare lo stato corrente del server; altre dipendenze systemd possono comunque avviare unità disabilitate.

## Configurazioni e backup

L'editor modifica testo UTF-8 fino a 200 KB. I file sono leggibili anche a server acceso, ma il backend rifiuta il salvataggio finché l'unità non è inattiva o fallita. I backup si trovano in `backups/<server-id>/` nella directory dati. Per ripristinare, fermare il server e copiare il backup desiderato sul file originale. La conservazione dei backup è manuale.

L'editor non valida la sintassi specifica dei giochi: verificare i valori prima di avviare il server. Evitare di avviare il gioco da un altro terminale mentre si salva un file. Password, certificati, backup e configurazioni reali restano fuori dalla repository.

## Log dei server

Aprire un server dalla panoramica: la scheda **Log** nella pagina del server è la vista iniziale e vengono letti gli ultimi 200 eventi del journal, con data e ora, dal meno al più recente. Il pannello funziona anche a server spento. Si aggiorna ogni quattro secondi mentre la scheda Log è visibile; l'interruttore mette in pausa gli aggiornamenti e **Aggiorna log** richiede una nuova lettura. Passando a Configurazione o tornando alla panoramica si interrompono le richieste.

La dashboard legge soltanto il journal dell'unità configurata, tramite `journalctl --user-unit` per i servizi utente e `journalctl --unit` per quelli di sistema. Non esegue comandi forniti dal browser e richiede la stessa sessione autenticata degli altri controlli. Ogni lettura ha un timeout di 10 secondi e un limite di 1 MiB; errori o output troppo grande vengono segnalati nel pannello.

Sono visibili solo gli eventi accessibili all'utente che esegue la dashboard. Un journal vuoto può indicare assenza di eventi o permessi insufficienti. I giochi che scrivono esclusivamente su file non compaiono qui: occorre che il servizio invii l'output al journal (per esempio `StandardOutput=journal` e `StandardError=journal`). La dashboard non modifica i permessi o la configurazione dei servizi. Per i dettagli dei filtri consultare la [documentazione di journalctl](https://www.freedesktop.org/software/systemd/man/255/journalctl.html).

## Verifica

Richiede Node.js 22 o successivo. Dopo `npm ci`:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:ui
npm run test:integration
```

- `npm test`: test isolati di validazione, autenticazione API, protezione delle richieste e serializzazione delle operazioni. Usano solo directory temporanee, senza systemd.
- `npm run test:ui`: Playwright avvia la build di produzione su `127.0.0.1:3100` e verifica desktop e mobile con API simulate. Non legge password o configurazioni locali. Copre login, logout, conferme, avvio automatico, editor, conflitti e perdita della connessione. Eseguire prima `npm run build`; chiudere eventuali processi sulla porta 3100.
- `npm run test:integration`: controlli reali con un servizio systemd utente temporaneo (`sleep`), file temporanei e pulizia finale. Richiede Linux e una sessione systemd utente funzionante. Non avvia né modifica server di gioco.

GitHub Actions esegue tutti questi controlli a ogni PR e push su `main`, con un job separato per systemd. In caso di fallimento dei test browser, trace, screenshot e report sono disponibili negli artefatti della CI. I test UI simulano il backend; il job systemd verifica separatamente le operazioni reali e gli handler API, senza sostituire un collaudo HTTPS sul server di destinazione.

Per formattare il codice: `npm run format`. Il contesto di prodotto è in `PRODUCT.md`; i token del tema nero/viola sono definiti una sola volta in `src/app/globals.css`.

La dashboard deve essere eseguita sul PC che ospita i servizi: non è un'app da pubblicare su hosting serverless. Usa un singolo processo Node, poiché sessioni e coda delle operazioni sono in memoria.

## Navigazione e feedback

La panoramica distingue lo stato (**Acceso**, **Spento**, **In errore**, **Non disponibile**) dalle azioni **Avvia** e **Arresta**. Il riavvio si trova nel dettaglio. Arresto e riavvio richiedono conferma.

I comandi mostrano l’avanzamento vicino al server interessato: avvio, arresto e modifica dell’avvio al boot attendono lo stato confermato dal backend. Dopo 20 secondi senza conferma, la dashboard invita a controllare i log. Per il riavvio viene confermata solo la ricezione del comando, perché il ciclo di riavvio può avvenire tra due letture. Le conferme positive spariscono dopo cinque secondi; gli errori restano finché vengono chiusi o viene eseguita una nuova operazione. In assenza di connessione gli stati vengono indicati come non aggiornati e i controlli sono disabilitati.

Nella scheda **Configurazione**, i file si aprono in un editor nella pagina. Prima di cambiare scheda, aprire un altro file, uscire o tornare alla panoramica viene chiesto se abbandonare eventuali modifiche non salvate.
