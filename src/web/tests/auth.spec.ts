import { test, expect } from "@playwright/test";

test("Setup erklärt Passwortgrenzen vor dem Absenden und zählt Unicodezeichen", async ({ page }) => {
  // Expose the initial-setup screen even when the shared E2E database is initialized.
  await page.route("**/api/v1/me", route => route.fulfill({ status: 401, json: { code: "authentication_required" } }));
  await page.route("**/api/v1/setup", route => route.request().method() === "GET"
    ? route.fulfill({ json: { setupRequired: true } }) : route.continue());
  let writes = 0;
  page.on("request", request => { if (request.method() === "POST") writes++; });
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("invalid-setup@example.test");
  await page.getByLabel("Betreibersecret").fill("synthetic-setup-secret-not-submitted");
  const password = page.getByLabel("Passwort", { exact: true });
  await expect(page.getByText("Verwende 15 bis 128 Zeichen.", { exact: true })).toBeVisible();
  for (const invalid of ["short", "😀".repeat(8), "😀".repeat(14), "😀".repeat(129)]) {
    await password.fill(invalid);
    await page.getByRole("button", { name: "Konto erstellen" }).click();
    await expect(page.getByRole("alert")).toHaveText("Passwort: Verwende 15 bis 128 Zeichen.");
    await expect(password).toHaveAttribute("aria-invalid", "true");
  }
  for (const valid of ["😀".repeat(15), "😀".repeat(128)]) {
    await password.fill(valid);
    expect(await password.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true);
    await expect(password).toHaveValue(valid);
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  expect(writes).toBe(0);
});

for (const path of ["/invite", "/reset-password", "/recover-account"]) {
  test(`${path}: Passwortregeln und Rückweg zur Anmeldung ohne veralteten Token`, async ({ page }) => {
    await page.goto(path + "#token=synthetic-token");
    await expect(page).not.toHaveURL(/#/);
    const password = page.getByLabel("Neues Passwort (mindestens 15 Zeichen)", { exact: true });
    await password.fill("😀".repeat(8));
    await page.getByRole("button", { name: path === "/invite" ? "Einladung annehmen" : "Fortfahren", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Passwort: Verwende 15 bis 128 Zeichen.");
    await page.getByRole("button", { name: "Zur Anmeldung", exact: true }).click();
    await expect(page.getByLabel("E-Mail-Adresse", { exact: true })).toBeVisible();
    const loginPassword = page.getByLabel("Passwort", { exact: true });
    await expect(loginPassword).toHaveValue("");
    await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(`unknown-auth-${crypto.randomUUID()}@example.test`);
    await loginPassword.fill("short");
    const response = page.waitForResponse(r => r.url().endsWith("/api/v1/auth/login"));
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    expect((await response).status()).toBe(401);
    await expect(page.getByRole("alert")).toHaveText("Anmeldung fehlgeschlagen.");
    await page.goBack();
    await expect(page.getByLabel(path === "/invite" ? "Einladungstoken" : "E-Mail-Adresse", { exact: true })).toBeVisible();
  });
}

for (const outcome of ["factor", "error"]) {
  for (const navigation of ["button", "back"]) {
    test(`verspätete Loginantwort (${outcome}) nach Navigation (${navigation}) bleibt wirkungslos`, async ({ page }) => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      await page.route("**/api/v1/auth/login", async route => {
        await gate;
        await route.fulfill(outcome === "factor"
          ? { json: { status: "secondFactorRequired", expiresAt: new Date(Date.now() + 300000).toISOString() } }
          : { status: 401, json: { code: "authentication_required", message: "Verspäteter Anmeldefehler" } });
      });
      await page.goto("/reset-password");
      await page.getByRole("button", { name: "Zur Anmeldung", exact: true }).click();
      await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("pending-auth@example.test");
      await page.getByLabel("Passwort", { exact: true }).fill("Pending-Auth-Test-Password");
      const requested = page.waitForRequest(r => r.url().endsWith("/api/v1/auth/login"));
      await page.getByRole("button", { name: "Anmelden", exact: true }).click();
      await requested;
      if (navigation === "button")
        await page.getByRole("button", { name: "Passwort vergessen?", exact: true }).click();
      else await page.goBack();
      await expect(page).toHaveURL(/\/reset-password$/);
      await expect(page.getByRole("button", { name: "Fortfahren", exact: true })).toBeEnabled();
      const response = page.waitForResponse(r => r.url().endsWith("/api/v1/auth/login"));
      release();
      await response;
      // Completion clears the pending counter, but cannot replace the active form or its message.
      await expect(page.getByRole("button", { name: "Fortfahren", exact: true })).toBeEnabled();
      await expect(page.getByLabel("Code", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("alert")).toHaveCount(0);
      await page.getByRole("button", { name: "Zur Anmeldung", exact: true }).click();
      await expect(page.getByLabel("E-Mail-Adresse", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Passwort", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Anmelden", exact: true })).toBeEnabled();
    });
  }
}

test("Abschluss eines alten Logins gibt eine neuere Anmeldung nicht vorzeitig frei", async ({ page }) => {
  const releases: (() => void)[] = [];
  await page.route("**/api/v1/auth/login", async route => {
    const index = releases.length;
    await new Promise<void>(resolve => { releases.push(resolve); });
    await route.fulfill({ status: 401, json: { code: "authentication_required", message: index ? "Aktueller Anmeldefehler" : "Veralteter Anmeldefehler" } });
  });
  const login = async () => {
    await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("pending-auth@example.test");
    await page.getByLabel("Passwort", { exact: true }).fill("Pending-Auth-Test-Password");
    const requested = page.waitForRequest(r => r.url().endsWith("/api/v1/auth/login"));
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await requested;
  };
  await page.goto("/login");
  await login();
  await page.getByRole("button", { name: "Passwort vergessen?", exact: true }).click();
  await page.getByRole("button", { name: "Zur Anmeldung", exact: true }).click();
  await login();
  let response = page.waitForResponse(r => r.url().endsWith("/api/v1/auth/login"));
  releases[0]();
  await response;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByRole("button", { name: "Einen Moment …", exact: true })).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  response = page.waitForResponse(r => r.url().endsWith("/api/v1/auth/login"));
  releases[1]();
  await response;
  await expect(page.getByRole("button", { name: "Anmelden", exact: true })).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveText("Aktueller Anmeldefehler");
});

test("verzögerte CSRF-Aktualisierung nach Login überschreibt keine neuere Appnavigation", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(process.env.E2E_EMAIL || "browser-test@example.test");
  await page.getByLabel("Passwort", { exact: true }).fill(process.env.E2E_PASSWORD || "Browser-Test-Password-2026!");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v1/auth/csrf", async route => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  const requested = page.waitForRequest(r => r.url().endsWith("/api/v1/auth/csrf"));
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await requested;
  await page.locator(".top-right").getByRole("button", { name: "Profil", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/profile/);
  const response = page.waitForResponse(r => r.url().endsWith("/api/v1/auth/csrf"));
  release();
  await response;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page).toHaveURL(/\/app\/profile/);
});
