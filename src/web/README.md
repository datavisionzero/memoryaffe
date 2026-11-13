# Webapp

React19.3.1 / TypeScript5.9.3 / Vite8.3.8, gleicher Ursprung wie die API. Bestätigte Basis: React Router8.5.1, Tailwind4.3.5 mit zentralen Designvariablen, Base UI1.9.0 für zugängliche Dialoge, CodeMirror Markdown6.5.2 und react-markdown10.1.0 / remark-gfm4.0.1. Ergänzend kapselt @uiw/react-codemirror4.25.3 den Editor; lucide-react0.468.0 liefert lokale SVG-Symbole. Alle direkten/transitiven Versionen sind gesperrt. Node24.22.3 verwenden.

```powershell
npm ci --prefix src/web
npm run dev --prefix src/web
npm run build --prefix src/web
```

Vite leitet `/api` nach `http://127.0.0.1:5080` weiter. Produktionsdateien entstehen unter `src/web/dist`; Docker kopiert sie in denselben API-Host inklusive SPA-Fallback.

`npm run generate:api --prefix src/web` erzeugt TypeScript aus `docs/contracts/web.openapi.json` mit openapi-typescript7.13.0. `npm run check:contracts --prefix src/web` prüft deterministische Drift und ist Bestandteil des Builds. Coremodelle und Memory-Schreibaufträge verwenden diese generierten Typen mit einem dünnen Fetchadapter.

`npm run check --prefix src/web` prüft TypeScript. `npm run test:e2e --prefix src/web` verwendet das echte Backend, standardmäßig Vite5173→API5080. Mit `WEB_URL` kann der gleichursprüngliche veröffentlichte Host direkt geprüft werden. Auf leerer Testinstallation `SETUP_SECRET`, sonst `E2E_EMAIL` und `E2E_PASSWORD` eines synthetischen Testkontos setzen. Die Tests legen eigene Vaults/Inhalte an; nicht auf Produktionskonten ausführen. OAuth-Prüfungen benötigen die ausdrücklich nur in Development erlaubte kontrollierte CIMD-Konfiguration. Traces sind ausgeschaltet, da sie Passwörter und Inhalte erfassen können.

CSRF, Aktionsnachweise, Einmalgeheimnisse, unklare Idempotenzantworten und Entwürfe bleiben im Arbeitsspeicher. Serverregeln sind für Rechte, Revisionen und Validierung maßgeblich. Externe Markdownbilder laden erst nach bewusster Auswahl; Raw-HTML wird verworfen. Sitzungswiderruf erhält Entwürfe und verlangt eine erneute Anmeldung desselben Kontos sowie bewusstes Wiederholen der Speicherung.
