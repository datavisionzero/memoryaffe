import { test, expect } from "@playwright/test";
const email = process.env.E2E_EMAIL || "browser-test@example.test";
const password = process.env.E2E_PASSWORD || "Browser-Test-Password-2026!";
test("echter Browserablauf: Setup/Login, Vault, Markdown, Historie, Konflikt, Papierkorb, Themes und Mobilansicht", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/login");
  if (await page.getByLabel("Betreibersecret").isVisible()) {
    if (!process.env.SETUP_SECRET)
      throw new Error("SETUP_SECRET für leere Installation erforderlich");
    await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(email);
    await page.getByLabel("Betreibersecret").fill(process.env.SETUP_SECRET);
    await page.getByLabel("Passwort", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Konto erstellen" }).click();
  } else {
    await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(email);
    await page.getByLabel("Passwort", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Was möchtest du wiederfinden?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Neuer Vault", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const vault = "Browsertest " + Date.now();
  await dialog.getByLabel("Name", { exact: true }).fill(vault);
  await dialog.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page.getByLabel("Vault", { exact: true })).toHaveValue(/.+/);
  await page
    .getByRole("button", { name: "Neue Erinnerung", exact: true })
    .click();
  await page
    .getByLabel("Titel", { exact: true })
    .fill("Gedächtnis aus dem Browser");
  await page
    .getByLabel("Zusammenfassung (optional)")
    .fill("Eine echte PostgreSQL-Erinnerung.");
  await page
    .locator(".cm-content")
    .fill(
      "# Mein Wissen\n\nEine **wichtige** Entscheidung.\n\n<script>window.unsafe=true</script>\n\n[Unsicher](javascript:alert(1))",
    );
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Gedächtnis aus dem Browser" }),
  ).toBeVisible();
  await expect(page.locator(".reading strong")).toHaveText("wichtige");
  await expect(page.locator(".reading script")).toHaveCount(0);
  await expect(page.locator(".reading a")).not.toHaveAttribute(
    "href",
    /javascript/,
  );
  const memoryUrl = page.url();
  await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  await page
    .getByLabel("Titel", { exact: true })
    .fill("Gedächtnis aktualisiert");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Gedächtnis aktualisiert" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Historie", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: /Revision 1/ }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /Revision 1/ }).click();
  await expect(
    dialog.getByRole("heading", { name: "Gedächtnis aus dem Browser" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Diese Version wiederherstellen" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Gedächtnis aus dem Browser" }),
  ).toBeVisible();
  const second = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  const other = await second.newPage();
  const editUrl = new URL(memoryUrl);
  editUrl.pathname += "/edit";
  await other.goto(editUrl.toString());
  await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  await page.getByLabel("Titel", { exact: true }).fill("Mein lokaler Entwurf");
  await other.getByLabel("Titel", { exact: true }).fill("Andere Änderung");
  await other.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    other.getByRole("heading", { name: "Andere Änderung" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Änderungskonflikt · Entwurf erhalten" }),
  ).toBeVisible();
  await expect(page.getByLabel("Titel", { exact: true })).toHaveValue(
    "Mein lokaler Entwurf",
  );
  await page
    .getByRole("button", { name: "Mit dieser Revision weiterarbeiten" })
    .click();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mein lokaler Entwurf" }),
  ).toBeVisible();
  await second.close();
  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await dialog.getByRole("button", { name: "Bestätigen" }).click();
  await page.getByRole("button", { name: "Papierkorb", exact: true }).click();
  await expect(
    page.getByText("Mein lokaler Entwurf", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Wiederherstellen", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Mein lokaler Entwurf", { exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".top-right")
    .getByRole("button", { name: "Profil", exact: true })
    .click();
  await page.getByLabel("Farbschema", { exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Anzeigesprache", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Just the way you like it." }),
  ).toBeVisible();
  await page.getByLabel("Theme", { exact: true }).selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await page.getByLabel("Display language", { exact: true }).selectOption("de");
  await page.getByLabel("Farbschema", { exact: true }).selectOption("dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".mobile-toggle").click();
  await page.getByRole("button", { name: "Suche", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Was möchtest du wiederfinden?" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
import { createHmac, createHash } from "node:crypto";
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/\s/g, "").toUpperCase())
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  const offset = hash[19] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
test("Einladung ohne SMTP, mobile Redaktion, Dialogfokus, externe Bilder und freiwilliges TOTP", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page
    .getByRole("button", { name: "Administration", exact: true })
    .click();
  await page.getByRole("button", { name: "Einladungen", exact: true }).click();
  const invitedEmail = "invite-" + Date.now() + "@example.test";
  await page
    .getByRole("textbox", { name: "E-Mail-Adresse", exact: true })
    .fill(invitedEmail);
  await page
    .getByRole("button", { name: "Einladung erstellen", exact: true })
    .click();
  const link = await page.getByRole("dialog").locator("textarea").inputValue();
  const url = new URL(link);
  url.protocol = new URL(baseURL!).protocol;
  url.host = new URL(baseURL!).host;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const user = await context.newPage();
  let externalRequests = 0;
  user.on("request", (r) => {
    if (r.url().includes("images.invalid")) externalRequests++;
  });
  await user.goto(url.toString());
  await expect(user).not.toHaveURL(/#/);
  await user
    .getByLabel("Neues Passwort (mindestens 15 Zeichen)", { exact: true })
    .fill(password);
  await user
    .getByRole("button", { name: "Einladung annehmen", exact: true })
    .click();
  await expect(
    user.getByRole("heading", { name: "Was möchtest du wiederfinden?" }),
  ).toBeVisible();
  await user.locator(".mobile-toggle").click();
  const trigger = user.getByRole("button", {
    name: "Neuer Vault",
    exact: true,
  });
  await trigger.click();
  await user.keyboard.press("Shift+Tab");
  await expect(
    user.getByRole("dialog").getByRole("button", { name: "Bestätigen" }),
  ).toBeFocused();
  await user.keyboard.press("Tab");
  await expect(
    user.getByRole("dialog").getByRole("button", { name: "Schließen" }),
  ).toBeFocused();
  await user.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await user
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Mein mobiler Vault");
  await user
    .getByRole("dialog")
    .getByRole("button", { name: "Bestätigen" })
    .click();
  await expect(user.getByRole("dialog")).toHaveCount(0);
  await user
    .getByRole("button", { name: "Neue Erinnerung", exact: true })
    .click();
  await user.getByLabel("Titel", { exact: true }).fill("Mobile Erinnerung");
  await user
    .locator(".cm-content")
    .fill(
      "# Mobil\n\n![Fremdes Bild](https://images.invalid/private.png)\n\n```text\n" +
        "langeswort".repeat(80) +
        "\n```",
    );
  await expect(
    user.getByRole("button", { name: "Bild laden: Fremdes Bild" }),
  ).toBeVisible();
  expect(externalRequests).toBe(0);
  expect(
    await user.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await user.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    user.getByRole("heading", { name: "Mobile Erinnerung", exact: true }),
  ).toBeVisible();
  expect(externalRequests).toBe(0);
  await user
    .locator(".top-right")
    .getByRole("button", { name: "Profil", exact: true })
    .click();
  await user
    .getByLabel("Aktuelles Passwort zur Aktionsbestätigung", { exact: true })
    .fill(password);
  await user
    .getByRole("button", { name: "Einrichtung vorbereiten", exact: true })
    .click();
  const secret = await user.getByLabel("Secret", { exact: true }).inputValue();
  await user
    .getByLabel("Testcode aus der App", { exact: true })
    .fill(totp(secret));
  await user
    .getByRole("button", { name: "Faktor testen und aktivieren", exact: true })
    .click();
  await expect(
    user.getByRole("heading", {
      name: "Wiederherstellungscodes sicher aufbewahren",
    }),
  ).toBeVisible();
  const recovery = (
    await user.locator(".security-output textarea").inputValue()
  ).split("\n")[0];
  await user
    .getByRole("button", { name: "Sicher aufbewahrt · Ausblenden" })
    .click();
  await user
    .getByRole("button", { name: "Abmelden", exact: true })
    .first()
    .click();
  await user.getByLabel("E-Mail-Adresse", { exact: true }).fill(invitedEmail);
  await user.getByLabel("Passwort", { exact: true }).fill(password);
  await user.getByRole("button", { name: "Anmelden", exact: true }).click();
  await user.locator('select[name="factorKind"]').selectOption("recoveryCode");
  await user.getByLabel("Code", { exact: true }).fill(recovery);
  await user.getByRole("button", { name: "Bestätigen", exact: true }).click();
  await expect(
    user.getByRole("heading", { name: "Was möchtest du wiederfinden?" }),
  ).toBeVisible();
  await context.close();
});
test("Agentenverwaltung: bestätigter Zugang, einmaliger Token, Rechteerweiterung und sofortige Reduktion", async ({
  page,
  playwright,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.getByRole("button", { name: "Agenten", exact: true }).click();
  await page
    .getByRole("button", { name: "CLI-Zugang anlegen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const agentName = "Browseragent " + Date.now();
  await dialog.getByLabel("Name", { exact: true }).fill(agentName);
  const vaultId = await dialog.locator('select[name="vaultId"]').inputValue();
  await dialog.getByRole("button", { name: "Bestätigen", exact: true }).click();
  await dialog.getByLabel("Dein Passwort", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Bestätigen", exact: true }).click();
  const card = page.locator(".settings-card").filter({
    has: page.getByRole("heading", { name: agentName + " cli", exact: true }),
  });
  await expect(card).toBeVisible();
  await card
    .getByRole("button", { name: "Token ausgeben (90 Tage)", exact: true })
    .click();
  await dialog.getByLabel("Dein Passwort", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Bestätigen", exact: true }).click();
  const token = await dialog.locator("textarea").inputValue();
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  const agent = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:5080",
    extraHTTPHeaders: { Authorization: "Bearer " + token },
  });
  expect((await agent.get("/api/v1/vaults")).status()).toBe(200);
  const body = {
    vaultId,
    title: "Agentenspeicher",
    markdown: "Über echten Browserzugang.",
    tagIds: [],
  };
  expect(
    (
      await agent.post("/api/v1/memories", {
        data: body,
        headers: { "Idempotency-Key": crypto.randomUUID() },
      })
    ).status(),
  ).toBe(403);
  await card
    .getByRole("button", { name: "Vaultrechte bearbeiten", exact: true })
    .click();
  await card.locator("select").first().selectOption("write");
  await card.getByLabel("Passwort", { exact: true }).fill(password);
  await card
    .getByRole("button", { name: "Rechte speichern", exact: true })
    .click();
  await expect(card.locator(".security-output")).toHaveCount(0);
  expect(
    (
      await agent.post("/api/v1/memories", {
        data: body,
        headers: { "Idempotency-Key": crypto.randomUUID() },
      })
    ).status(),
  ).toBe(201);
  await card
    .getByRole("button", { name: "Vaultrechte bearbeiten", exact: true })
    .click();
  await card.locator("select").first().selectOption("read");
  await card
    .getByRole("button", { name: "Rechte speichern", exact: true })
    .click();
  await expect(card.locator(".security-output")).toHaveCount(0);
  expect(
    (
      await agent.post("/api/v1/memories", {
        data: body,
        headers: { "Idempotency-Key": crypto.randomUUID() },
      })
    ).status(),
  ).toBe(403);
  await card
    .getByRole("button", { name: "Tokens verwalten", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Widerrufen", exact: true }),
  ).toHaveCount(2);
  await card
    .locator(".security-output")
    .getByRole("button", { name: "Widerrufen", exact: true })
    .click();
  expect((await agent.get("/api/v1/vaults")).status()).toBe(401);
  await agent.dispose();
});
test("Sitzungswiderruf erhält den Editorentwurf bis zur bewussten Neuanmeldung", async ({
  page,
  baseURL,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Was möchtest du wiederfinden?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Neue Erinnerung", exact: true })
    .click();
  await page
    .getByLabel("Titel", { exact: true })
    .fill("Entwurf nach Sitzungsablauf");
  await page
    .locator(".cm-content")
    .fill("Dieser Text bleibt im Arbeitsspeicher.");
  const csrf = await (await page.request.get("/api/v1/auth/csrf")).json();
  const invitation = await page.request.post("/api/v1/admin/invitations", {
    data: {
      email: "session-other-" + Date.now() + "@example.test",
      role: "user",
      sendEmail: false,
    },
    headers: { "X-CSRF-Token": csrf.requestToken },
  });
  expect(invitation.status()).toBe(201);
  const issued = await invitation.json();
  expect(
    (
      await page.request.post("/api/v1/auth/logout", {
        data: {},
        headers: { "X-CSRF-Token": csrf.requestToken },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "In neuem Tab anmelden" }),
  ).toBeVisible();
  await expect(page.getByLabel("Titel", { exact: true })).toHaveValue(
    "Entwurf nach Sitzungsablauf",
  );
  const login = await page.context().newPage();
  const inviteUrl = new URL(issued.link.url);
  inviteUrl.host = new URL(baseURL!).host;
  inviteUrl.protocol = new URL(baseURL!).protocol;
  await login.goto(inviteUrl.toString());
  await login
    .getByLabel("Neues Passwort (mindestens 15 Zeichen)", { exact: true })
    .fill(password);
  await login
    .getByRole("button", { name: "Einladung annehmen", exact: true })
    .click();
  await expect(
    login.getByRole("heading", { name: "Was möchtest du wiederfinden?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sitzung erneut prüfen", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "Ein anderes Konto ist angemeldet. Melde dich mit dem ursprünglichen Konto an.",
  );
  await expect(page.getByLabel("Titel", { exact: true })).toHaveValue(
    "Entwurf nach Sitzungsablauf",
  );
  const otherCsrf = await (await login.request.get("/api/v1/auth/csrf")).json();
  expect(
    (
      await login.request.post("/api/v1/auth/logout", {
        data: {},
        headers: { "X-CSRF-Token": otherCsrf.requestToken },
      })
    ).status(),
  ).toBe(200);
  await login.goto("/login");
  await login.getByLabel("E-Mail-Adresse", { exact: true }).fill(email);
  await login.getByLabel("Passwort", { exact: true }).fill(password);
  await login.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    login.getByRole("heading", { name: "Was möchtest du wiederfinden?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sitzung erneut prüfen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sitzung erneut prüfen", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Entwurf nach Sitzungsablauf",
      exact: true,
    }),
  ).toBeVisible();
  await login.close();
});

test("OAuth-Consent: ausdrücklicher Vault, kumulative Scope-Reduktion und echter Tokenaustausch", async ({
  page,
  playwright,
  baseURL,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Was möchtest du wiederfinden?" }),
  ).toBeVisible();
  const verifier = "Browser_Pkce_Verifier_".repeat(4);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const client = "https://client.example.test/metadata.json";
  const resource = "http://127.0.0.1:5080/mcp";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: client,
    redirect_uri: "https://client.example.test/callback",
    resource,
    scope: "memory:read memory:write memory:delete",
    state: "browser-consent-state",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  const authorize = await page.request.get(
    "http://127.0.0.1:5080/oauth/authorize?" + params,
    { maxRedirects: 0 },
  );
  expect(authorize.status()).toBe(302);
  const consent = new URL(authorize.headers().location);
  consent.host = new URL(baseURL!).host;
  consent.protocol = new URL(baseURL!).protocol;
  await page.goto(consent.toString());
  await expect(
    page.getByRole("heading", { name: "Agent verbinden", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zugriff erlauben", exact: true }),
  ).toBeDisabled();
  await page.locator(".settings-card select").first().selectOption("read");
  await page.getByLabel("memory:write", { exact: true }).uncheck();
  await expect(page.getByLabel("memory:read", { exact: true })).toBeChecked();
  await expect(
    page.getByLabel("memory:delete", { exact: true }),
  ).not.toBeChecked();
  const callbackRequest = page.waitForEvent(
    "request",
    (r) =>
      r.isNavigationRequest() &&
      r.url().startsWith("https://client.example.test/callback?"),
  );
  await page
    .getByRole("button", { name: "Zugriff erlauben", exact: true })
    .click();
  const callback = new URL((await callbackRequest).url());
  expect(callback.searchParams.get("state")).toBe("browser-consent-state");
  expect(callback.searchParams.get("iss")).toBe("http://127.0.0.1:5080");
  expect(Boolean(callback.searchParams.get("code"))).toBeTruthy();
  const oauth = await playwright.request.newContext();
  const tokens = await oauth.post("http://127.0.0.1:5080/oauth/token", {
    form: {
      grant_type: "authorization_code",
      client_id: client,
      redirect_uri: "https://client.example.test/callback",
      resource,
      code: callback.searchParams.get("code")!,
      code_verifier: verifier,
    },
  });
  expect(tokens.status()).toBe(200);
  const issued = await tokens.json();
  expect(issued.scope).toBe("memory:read");
  const bearer = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:5080",
    extraHTTPHeaders: { Authorization: "Bearer " + issued.access_token },
  });
  const vaults = await bearer.get("/api/v1/vaults");
  expect(vaults.status()).toBe(401); // OAuth resource is /mcp, not the CLI HTTP surface.
  const mcp = await bearer.post("/mcp", {
    headers: {
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "list_vaults", arguments: {} },
    },
  });
  expect(mcp.status()).toBe(200);
  const raw = await mcp.text();
  const response = JSON.parse(
    raw.startsWith("event:") || raw.startsWith("data:")
      ? raw
          .split("\n")
          .find((line) => line.startsWith("data:"))!
          .slice(5)
      : raw,
  );
  expect(response.result.structuredContent.items).toHaveLength(1);
  await bearer.dispose();
  await oauth.dispose();
});
test("ZIP: echter Exportdownload, validierte Importvorschau, Übernahme und ungültiges Archiv", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Was möchtest du wiederfinden?" }),
  ).toBeVisible();
  const csrf = (await (await page.request.get("/api/v1/auth/csrf")).json())
    .requestToken;
  const headers = { "X-CSRF-Token": csrf };
  const source = await page.request.post("/api/v1/vaults", {
    headers,
    data: {
      name: "Browser ZIP " + Date.now(),
      searchLanguage: "de",
      versionLimit: 10,
    },
  });
  expect(source.status()).toBe(201);
  const vault = await source.json();
  const tagResponse = await page.request.post(
    `/api/v1/vaults/${vault.id}/tags`,
    {
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      data: { name: "Exportwissen" },
    },
  );
  expect(tagResponse.status()).toBe(201);
  const tag = await tagResponse.json();
  const memory = await page.request.post("/api/v1/memories", {
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    data: {
      vaultId: vault.id,
      title: "Wissen auf Reisen",
      summary: "Ein vollständiger Roundtrip.",
      markdown: "# Wissen\n\n**Unverändert** wieder da.",
      tagIds: [tag.id],
    },
  });
  expect(memory.status()).toBe(201);
  await page.goto("/app/vault-settings?vault=" + vault.id);
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Vault exportieren", exact: true })
    .click();
  const download = await downloadEvent;
  const path = testInfo.outputPath("roundtrip.zip");
  await download.saveAs(path);
  await page
    .getByLabel("ZIP-Archiv auswählen", { exact: true })
    .setInputFiles(path);
  await expect(
    page.getByLabel("Name des neuen Vaults", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Name des neuen Vaults", { exact: true })
    .fill(vault.name + " importiert");
  await page
    .getByRole("button", { name: "Geprüften Import übernehmen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Was möchtest du wiederfinden?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Wissen auf Reisen/ }).click();
  await expect(
    page.getByRole("heading", { name: "Wissen auf Reisen", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".reading strong")).toHaveText("Unverändert");
  await page
    .getByRole("button", { name: "Vault-Einstellungen", exact: true })
    .click();
  await page
    .getByLabel("ZIP-Archiv auswählen", { exact: true })
    .setInputFiles({
      name: "invalid.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("Das ist kein ZIP-Archiv."),
    });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Geprüften Import übernehmen",
      exact: true,
    }),
  ).toHaveCount(0);
});
test("Verwaltung: Tags zusammenführen, Erinnerung verschieben und gelöschten Vault wiederherstellen", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Was möchtest du wiederfinden?" }),
  ).toBeVisible();
  const nonce = Date.now(),
    source = "A Verwaltung " + nonce,
    target = "B Verwaltung " + nonce;
  for (const name of [source, target]) {
    await page
      .getByRole("button", { name: "Neuer Vault", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Name", { exact: true })
      .fill(name);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Bestätigen", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page
    .getByLabel("Vault", { exact: true })
    .selectOption({ label: source });
  await page.getByRole("button", { name: "Tags", exact: true }).click();
  for (const name of ["Quelltag", "Zieltag"]) {
    await page
      .getByRole("textbox", { name: "Tagname", exact: true })
      .fill(name);
    await page
      .getByRole("button", { name: "Tag anlegen", exact: true })
      .click();
    await expect(
      page.locator(".list-row strong").filter({ hasText: name }),
    ).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Suche", exact: true }).click();
  await page
    .getByRole("button", { name: "Neue Erinnerung", exact: true })
    .click();
  await page
    .getByLabel("Titel", { exact: true })
    .fill("Verwaltung bleibt nachvollziehbar");
  await page
    .locator(".cm-content")
    .fill("Ein vollständiger Verwaltungsablauf.");
  await page.getByRole("button", { name: "# Quelltag", exact: true }).click();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Verwaltung bleibt nachvollziehbar",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tags", exact: true }).click();
  await page
    .locator(".list-row")
    .filter({ has: page.locator("strong", { hasText: "Quelltag" }) })
    .getByRole("button", { name: "Zusammenführen", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .locator('select[name="targetTagId"]')
    .selectOption({ label: "Zieltag" });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bestätigen", exact: true })
    .click();
  await expect(
    page.locator(".list-row strong").filter({ hasText: "Quelltag" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Suche", exact: true }).click();
  await page
    .getByRole("button", { name: /Verwaltung bleibt nachvollziehbar/ })
    .click();
  await expect(page.locator(".filter-row .tag")).toHaveText("# Zieltag");
  await page.getByRole("button", { name: "Verschieben", exact: true }).click();
  await page
    .getByRole("dialog")
    .locator('select[name="targetVaultId"]')
    .selectOption({ label: target });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bestätigen", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Vault", { exact: true })).toHaveValue(
    (await page
      .getByLabel("Vault", { exact: true })
      .locator("option")
      .filter({ hasText: target })
      .getAttribute("value")) as string,
  );
  await page
    .getByRole("button", { name: "Vault-Einstellungen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Vault löschen", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bestätigen", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Papierkorb", exact: true }).click();
  const row = page
    .locator(".list-row")
    .filter({ has: page.locator("strong", { hasText: target }) });
  await expect(row).toBeVisible();
  await row
    .getByRole("button", { name: "Wiederherstellen", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await page
    .getByLabel("Vault", { exact: true })
    .selectOption({ label: target });
  await expect(
    page.getByRole("button", { name: /Verwaltung bleibt nachvollziehbar/ }),
  ).toBeVisible();
});
