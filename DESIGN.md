# Serverspace

## Direction

Product interface, restrained color strategy. Preserve the owner's dark violet identity; use violet for navigation and primary actions, never as an indication that a server is running.

Design scenario: the owner checks a game server from a desktop or phone during an evening game session, with low ambient light and a need to identify failures quickly. The explicit preference for a dark interface remains authoritative.

## Structure

- `/`: compact list with separate server, status and action columns. On mobile each row reflows into identity, status and controls.
- `/servers/[id]`: breadcrumb, server identity and actions, explicit state, then Log and Configurazione tabs.
- Logs occupy the main detail area. Configuration and boot settings are secondary; file editing happens inline.
- No marketing headings, decorative banners or permanent success alerts.

## Visual system

Use the existing OKLCH variables in `src/app/globals.css`. Tinted near-black background, slightly elevated neutral surfaces, violet primary controls and focus rings. Body uses Arial/Helvetica with a monospace font for logs and configuration. Main headings are 1.875rem, secondary headings 1.125rem, body 0.875rem.

Status uses text plus an icon: green check for Acceso, muted minus for Spento, rose alert for In errore, amber for transitions or stale information. Unavailable services have disabled controls. Actions use verbs (Avvia, Arresta, Riavvia), never an on/off switch. Switches are reserved for persistent settings such as boot behavior and log polling.

## Interaction

Confirm actions that disconnect players. Keep commands pending until the requested state is observed, with a bounded wait and an explicit warning if unconfirmed. Restart feedback acknowledges the request rather than claiming readiness. Success feedback appears beside the affected server for five seconds. Failures remain dismissible. Logs only poll while their tab is mounted.

Keyboard-visible focus, semantic links, Radix tabs with arrow-key navigation, skip link, reduced motion and layouts without horizontal page overflow are required. Dirty file edits are guarded when using in-app navigation and before unloading the page.
