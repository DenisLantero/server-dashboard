# Server Dashboard

Una dashboard personale in **Next.js, TypeScript e shadcn/ui**, con tema nero/viola, per gestire i server di gioco già configurati con systemd.

- Schede dei server con stato aggiornato ogni quattro secondi.
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

## Verifica

```bash
npm run lint
npm test
npm run build
```

I test di integrazione usano un servizio systemd temporaneo con `sleep`, senza avviare o modificare i server di gioco. Richiedono una sessione systemd utente funzionante. `npm run test:ui` usa Chromium (prima installazione: `npx playwright install chromium`) e un'istanza HTTPS già avviata; legge la password dalla directory dati senza stamparla.

La dashboard deve essere eseguita sul PC che ospita i servizi: non è un'app da pubblicare su hosting serverless. Usa un singolo processo Node, poiché sessioni e coda delle operazioni sono in memoria.
