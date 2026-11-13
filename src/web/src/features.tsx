import React, { useEffect, useState } from "react";
import { api, all } from "./api";
type Obj = Record<string, any>;
type Props = {
  t: (de: string, en: string) => string;
  run: (fn: () => Promise<void>) => Promise<void>;
};
export function ImportVault({
  t,
  run,
  onImported,
}: Props & { onImported: (v: Obj) => Promise<void> }) {
  const [preparation, setPreparation] = useState<Obj | null>(null),
    [name, setName] = useState("");
  return (
    <div className="settings-card">
      <h3>{t("Vault importieren", "Import vault")}</h3>
      <p className="muted">
        {t(
          "ZIP-Export prüfen und als neuen Vault übernehmen. Höchstens 100 MiB.",
          "Validate a ZIP export and import it as a new vault. Maximum 100 MiB.",
        )}
      </p>
      {!preparation ? (
        <label>
          {t("ZIP-Archiv auswählen", "Choose ZIP archive")}
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                void run(async () => {
                  if (f.size > 100 * 1024 * 1024)
                    throw new Error(
                      t(
                        "Archiv ist größer als 100 MiB.",
                        "Archive exceeds 100 MiB.",
                      ),
                    );
                  const data = new FormData();
                  data.set("archive", f);
                  const p = await api("/imports/validate", "POST", data);
                  setPreparation(p);
                  setName(p.suggestedName);
                });
            }}
          />
        </label>
      ) : (
        <>
          <p>
            {preparation.recordCount} {t("Erinnerungen", "memories")} ·{" "}
            {preparation.tagCount} Tags
          </p>
          <p>
            {t("Gültig bis", "Valid until")}:{" "}
            {new Date(preparation.expiresAt).toLocaleString()}
          </p>
          <label>
            {t("Name des neuen Vaults", "New vault name")}
            <input
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="actions">
            <button
              onClick={() =>
                void run(async () => {
                  await api("/imports/" + preparation.id, "DELETE");
                  setPreparation(null);
                })
              }
            >
              {t("Abbrechen", "Cancel")}
            </button>
            <button
              className="primary"
              disabled={!name.trim()}
              onClick={() =>
                void run(async () => {
                  const v = await api("/imports", "POST", {
                    preparationId: preparation.id,
                    targetName: name,
                  });
                  setPreparation(null);
                  await onImported(v);
                })
              }
            >
              {t("Geprüften Import übernehmen", "Confirm validated import")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
export function VaultTrash({
  t,
  run,
  onRestored,
}: Props & { onRestored: () => Promise<void> }) {
  const [items, setItems] = useState<Obj[]>([]);
  const reload = async () => setItems(await all("/trash/vaults"));
  useEffect(() => {
    void run(reload);
  }, []);
  return (
    <div className="settings-card">
      <h3>{t("Gelöschte Vaults", "Deleted vaults")}</h3>
      {!items.length && (
        <p className="muted">
          {t("Keine Vaults im Papierkorb.", "No deleted vaults.")}
        </p>
      )}
      {items.map((v) => (
        <div className="list-row" key={v.id}>
          <strong>{v.name}</strong>
          <small>
            {t("Ablauf", "Expires")}:{" "}
            {new Date(v.expiresAt).toLocaleDateString()}
          </small>
          <button
            onClick={() =>
              void run(async () => {
                await api(`/trash/vaults/${v.id}/restore`, "POST", {
                  expectedRevision: v.revision,
                });
                await reload();
                await onRestored();
              })
            }
          >
            {t("Wiederherstellen", "Restore")}
          </button>
          <button
            className="danger"
            onClick={() => {
              if (
                confirm(
                  t(
                    "Vault und alle Inhalte unwiderruflich löschen?",
                    "Permanently delete this vault and all content?",
                  ),
                )
              )
                void run(async () => {
                  await api(
                    `/trash/vaults/${v.id}?expectedRevision=${v.revision}`,
                    "DELETE",
                  );
                  await reload();
                });
            }}
          >
            {t("Endgültig löschen", "Delete permanently")}
          </button>
        </div>
      ))}
    </div>
  );
}
export function Security({
  t,
  run,
  profile,
  reload,
}: Props & { profile: Obj; reload: () => Promise<void> }) {
  const [password, setPassword] = useState(""),
    [kind, setKind] = useState("totp"),
    [code, setCode] = useState(""),
    [setup, setSetup] = useState<Obj | null>(null),
    [codes, setCodes] = useState<string[]>([]),
    [test, setTest] = useState("");
  async function action(operationId: string, url: string) {
    const body = {};
    const p = await api("/me/reauthenticate", "POST", {
      password,
      ...(profile.totpEnabled ? { factor: { kind, code } } : {}),
      request: { operationId, path: {}, query: {}, body },
    });
    const r = await api(url, "POST", body, { "X-Action-Proof": p.proof });
    setPassword("");
    setCode("");
    if (operationId === "web_setup_totp") setSetup(r);
    if (r.codes) setCodes(r.codes);
    await reload();
  }
  return (
    <div className="settings-card">
      <h3>
        {t(
          "Zwei-Faktor-Authentifizierung (freiwillig)",
          "Two-factor authentication (optional)",
        )}
      </h3>
      <p className="muted">
        {profile.totpEnabled
          ? t(
              "Ein zusätzlicher Faktor schützt dein Konto.",
              "An additional factor protects your account.",
            )
          : t(
              "Optional kannst du dein Konto mit einer Authenticator-App schützen.",
              "Optionally protect your account with an authenticator app.",
            )}
      </p>
      <label>
        {t(
          "Aktuelles Passwort zur Aktionsbestätigung",
          "Current password to confirm this action",
        )}
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {profile.totpEnabled && (
        <>
          <label>
            {t("Aktueller Faktor", "Current factor")}
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="totp">TOTP</option>
              <option value="recoveryCode">Recovery-Code</option>
            </select>
          </label>
          <label>
            Code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
            />
          </label>
        </>
      )}
      <div className="actions">
        <button
          disabled={!password}
          onClick={() =>
            void run(() => action("web_setup_totp", "/me/totp/setup"))
          }
        >
          {profile.totpEnabled
            ? t("Faktor ersetzen", "Replace factor")
            : t("Einrichtung vorbereiten", "Prepare setup")}
        </button>
        {profile.totpEnabled && (
          <>
            <button
              disabled={!password || !code}
              onClick={() =>
                void run(() =>
                  action(
                    "web_replace_recovery_codes",
                    "/me/totp/recovery-codes",
                  ),
                )
              }
            >
              {t("Neue Wiederherstellungscodes", "New recovery codes")}
            </button>
            <button
              className="danger"
              disabled={!password || !code}
              onClick={() =>
                void run(() => action("web_disable_totp", "/me/totp/disable"))
              }
            >
              {t("2FA abschalten", "Disable 2FA")}
            </button>
          </>
        )}
      </div>
      {setup && (
        <div className="security-output">
          <h4>
            {t(
              "In Authenticator-App eintragen",
              "Add to your authenticator app",
            )}
          </h4>
          <p>
            {t(
              "Die Vorbereitung aktiviert 2FA noch nicht.",
              "Preparation does not activate 2FA yet.",
            )}
          </p>
          <label>
            Secret
            <input readOnly value={setup.secret} />
          </label>
          <details>
            <summary>otpauth URI</summary>
            <textarea readOnly value={setup.otpauthUri} />
          </details>
          <label>
            {t("Testcode aus der App", "Test code from the app")}
            <input
              value={test}
              onChange={(e) => setTest(e.target.value)}
              inputMode="numeric"
              maxLength={6}
            />
          </label>
          <button
            className="primary"
            disabled={!/^\d{6}$/.test(test)}
            onClick={() =>
              void run(async () => {
                const r = await api("/me/totp/confirm", "POST", {
                  setupId: setup.setupId,
                  code: test,
                });
                setCodes(r.codes);
                setSetup(null);
                setTest("");
                await reload();
              })
            }
          >
            {t("Faktor testen und aktivieren", "Test and activate factor")}
          </button>
          <p className="muted">
            {t(
              "Jeder Authenticator-Code funktioniert nur einmal. Warte bei erneuter Bestätigung auf den nächsten 30-Sekunden-Code.",
              "Each authenticator code works once. Wait for the next 30-second code before confirming another action.",
            )}
          </p>
        </div>
      )}
      {!!codes.length && (
        <div className="security-output">
          <h4>
            {t(
              "Wiederherstellungscodes sicher aufbewahren",
              "Store recovery codes safely",
            )}
          </h4>
          <p>
            {t(
              "Jeder Code funktioniert genau einmal. Diese Ausgabe ist nur jetzt sichtbar.",
              "Each code works once. These codes are shown only now.",
            )}
          </p>
          <textarea readOnly rows={10} value={codes.join("\n")} />
          <button onClick={() => setCodes([])}>
            {t("Sicher aufbewahrt · Ausblenden", "Stored safely · Hide")}
          </button>
        </div>
      )}
    </div>
  );
}
export function AgentGrants({
  t,
  run,
  agent,
  vaults,
  onChanged,
}: Props & { agent: Obj; vaults: Obj[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false),
    [grants, setGrants] = useState<Obj[]>(agent.grants),
    [password, setPassword] = useState(""),
    [factor, setFactor] = useState(""),
    [kind, setKind] = useState("totp");
  const rank: Obj = { read: 1, write: 2, delete: 3 };
  const expanded = grants.some(
    (g) =>
      rank[g.level] >
      (rank[
        agent.grants.find((old: Obj) => old.vaultId === g.vaultId)?.level || ""
      ] || 0),
  );
  return (
    <>
      <button
        onClick={() => {
          setEditing(!editing);
          setGrants(agent.grants);
        }}
      >
        {t("Vaultrechte bearbeiten", "Edit vault permissions")}
      </button>
      {editing && (
        <div className="security-output">
          {vaults.map((v) => (
            <label key={v.id}>
              {v.name}
              <select
                value={grants.find((g) => g.vaultId === v.id)?.level || ""}
                onChange={(e) =>
                  setGrants([
                    ...grants.filter((g) => g.vaultId !== v.id),
                    ...(e.target.value
                      ? [{ vaultId: v.id, level: e.target.value }]
                      : []),
                  ])
                }
              >
                <option value="">{t("Kein Zugriff", "No access")}</option>
                <option value="read">{t("Lesen", "Read")}</option>
                <option value="write">{t("Schreiben", "Write")}</option>
                <option value="delete">{t("Löschen", "Delete")}</option>
              </select>
            </label>
          ))}
          {expanded && (
            <>
              <p>
                {t(
                  "Erweiterte Rechte erfordern deine Bestätigung.",
                  "Expanding permissions requires your confirmation.",
                )}
              </p>
              <label>
                {t("Passwort", "Password")}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label>
                {t(
                  "Zweiter Faktor, falls eingerichtet",
                  "Second factor, if enabled",
                )}
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="totp">TOTP</option>
                  <option value="recoveryCode">Recovery-Code</option>
                </select>
                <input
                  value={factor}
                  onChange={(e) => setFactor(e.target.value)}
                />
              </label>
            </>
          )}
          <button
            className="primary"
            onClick={() =>
              void run(async () => {
                const body = { expectedRevision: agent.revision, grants };
                let headers = {};
                if (expanded) {
                  const p = await api("/me/reauthenticate", "POST", {
                    password,
                    ...(factor ? { factor: { kind, code: factor } } : {}),
                    request: {
                      operationId: "web_update_agent_access",
                      path: { id: agent.id },
                      query: {},
                      body,
                    },
                  });
                  headers = { "X-Action-Proof": p.proof };
                }
                await api(
                  "/agent-accesses/" + agent.id,
                  "PATCH",
                  body,
                  headers,
                );
                setEditing(false);
                setPassword("");
                setFactor("");
                await onChanged();
              })
            }
          >
            {t("Rechte speichern", "Save permissions")}
          </button>
        </div>
      )}
    </>
  );
}
export function Consent({
  t,
  run,
  id,
  vaults,
}: Props & { id: string; vaults: Obj[] }) {
  const [data, setData] = useState<Obj | null>(null),
    [selected, setSelected] = useState<Obj[]>([]),
    [scopes, setScopes] = useState<string[]>([]),
    [name, setName] = useState("");
  useEffect(() => {
    void run(async () => {
      const r = await api("/oauth/requests/" + id);
      setData(r);
      setName(r.clientName);
      setScopes(r.requestedScopes);
    });
  }, [id]);
  async function decide(approve: boolean) {
    const r = await api(
      `/oauth/requests/${id}/decision`,
      "POST",
      approve
        ? { decision: "approve", name, grants: selected, scopes }
        : { decision: "deny" },
    );
    location.assign(r.redirectUrl);
  }
  return (
    <div className="settings-card">
      <h1>{t("Agent verbinden", "Connect agent")}</h1>
      {data && (
        <>
          <h3>{data.clientName}</h3>
          <p>{data.clientId}</p>
          <p className="muted">
            {t("Anfrage gültig bis", "Request valid until")}:{" "}
            {new Date(data.expiresAt).toLocaleString()}
          </p>
          <p>
            {t(
              "Dieser Agent möchte auf dein Gedächtnis zugreifen. Wähle ausdrücklich die erlaubten Vaults und Rechte.",
              "This agent wants to access your memory. Explicitly select permitted vaults and permissions.",
            )}
          </p>
          <label>
            {t("Name des Zugangs", "Access name")}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {vaults.map((v) => (
            <label key={v.id}>
              {v.name}
              <select
                value={selected.find((g) => g.vaultId === v.id)?.level || ""}
                onChange={(e) =>
                  setSelected([
                    ...selected.filter((g) => g.vaultId !== v.id),
                    ...(e.target.value
                      ? [{ vaultId: v.id, level: e.target.value }]
                      : []),
                  ])
                }
              >
                <option value="">{t("Kein Zugriff", "No access")}</option>
                <option value="read">{t("Lesen", "Read")}</option>
                <option value="write">{t("Schreiben", "Write")}</option>
                <option value="delete">{t("Löschen", "Delete")}</option>
              </select>
            </label>
          ))}
          {data.requestedScopes.map((s: string) => (
            <label className="checkbox" key={s}>
              <input
                type="checkbox"
                checked={scopes.includes(s)}
                onChange={(e) => {
                  const order = [
                    "memory:read",
                    "memory:write",
                    "memory:delete",
                  ];
                  setScopes(
                    e.target.checked
                      ? data.requestedScopes.filter(
                          (x: string) =>
                            scopes.includes(x) ||
                            order.indexOf(x) <= order.indexOf(s),
                        )
                      : scopes.filter(
                          (x) => order.indexOf(x) < order.indexOf(s),
                        ),
                  );
                }}
              />
              {s}
            </label>
          ))}
          <div className="actions">
            <button onClick={() => void run(() => decide(false))}>
              {t("Ablehnen", "Deny")}
            </button>
            <button
              className="primary"
              disabled={!selected.length || !scopes.length || !name.trim()}
              onClick={() => void run(() => decide(true))}
            >
              {t("Zugriff erlauben", "Allow access")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
export function AccountActions({
  t,
  run,
  account,
  reload,
  onLink,
}: Props & {
  account: Obj;
  reload: () => Promise<void>;
  onLink: (url: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [email, setEmail] = useState(account.email),
    [role, setRole] = useState(account.role),
    [password, setPassword] = useState(""),
    [factor, setFactor] = useState(""),
    [kind, setKind] = useState("totp");
  async function execute(
    operationId: string,
    url: string,
    method: string,
    body: Obj | null,
    query: Obj = {},
    proofRequired = true,
  ) {
    let headers = {};
    if (proofRequired) {
      const p = await api("/me/reauthenticate", "POST", {
        password,
        ...(factor ? { factor: { kind, code: factor } } : {}),
        request: { operationId, path: { id: account.id }, query, body },
      });
      headers = { "X-Action-Proof": p.proof };
    }
    const result = await api(
      url,
      method,
      body === null ? undefined : body,
      headers,
    );
    setPassword("");
    setFactor("");
    await reload();
    if (result?.url) onLink(result.url);
  }
  return (
    <div className="account-actions">
      <button onClick={() => setOpen(!open)}>{t("Verwalten", "Manage")}</button>
      {open && (
        <div className="security-output">
          <label>
            {t("E-Mail-Adresse", "Email address")}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            {t("Rolle", "Role")}
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <p>
            {t(
              "Identitäts-, Rollenänderungen, Kontowiederherstellung und Löschen benötigen dein eigenes Passwort und gegebenenfalls deinen Faktor.",
              "Identity and role changes, recovery and deletion require your own password and factor, if enabled.",
            )}
          </p>
          <label>
            {t("Dein Passwort", "Your password")}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            {t(
              "Dein zweiter Faktor, falls eingerichtet",
              "Your second factor, if enabled",
            )}
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="totp">TOTP</option>
              <option value="recoveryCode">Recovery-Code</option>
            </select>
            <input value={factor} onChange={(e) => setFactor(e.target.value)} />
          </label>
          <div className="actions">
            <button
              disabled={!password}
              onClick={() =>
                void run(() =>
                  execute(
                    "admin_update_account",
                    "/admin/accounts/" + account.id,
                    "PATCH",
                    { expectedRevision: account.revision, email, role },
                  ),
                )
              }
            >
              {t("Konto speichern", "Save account")}
            </button>
            <button
              onClick={() =>
                void run(() =>
                  execute(
                    "admin_issue_password_reset",
                    `/admin/accounts/${account.id}/password-reset`,
                    "POST",
                    { expectedRevision: account.revision, sendEmail: false },
                    {},
                    false,
                  ),
                )
              }
            >
              {t("Passwort-Reset-Link", "Password reset link")}
            </button>
            <button
              disabled={!password}
              onClick={() =>
                void run(() =>
                  execute(
                    "admin_issue_recovery",
                    `/admin/accounts/${account.id}/account-recovery`,
                    "POST",
                    { expectedRevision: account.revision, sendEmail: false },
                  ),
                )
              }
            >
              {t("Kontowiederherstellungslink", "Account recovery link")}
            </button>
            <button
              className="danger"
              disabled={!password}
              onClick={() => {
                if (
                  confirm(
                    t(
                      "Konto und sämtliche eigenen Daten unwiderruflich löschen?",
                      "Permanently delete this account and all its data?",
                    ),
                  )
                )
                  void run(() =>
                    execute(
                      "admin_delete_account",
                      `/admin/accounts/${account.id}?expectedRevision=${account.revision}`,
                      "DELETE",
                      null,
                      { expectedRevision: account.revision },
                    ),
                  );
              }}
            >
              {t("Konto löschen", "Delete account")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export function ProfileOptions({
  t,
  run,
  profile,
  reload,
  onDeleted,
}: Props & {
  profile: Obj;
  reload: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [password, setPassword] = useState(""),
    [factor, setFactor] = useState(""),
    [kind, setKind] = useState("totp"),
    [email, setEmail] = useState(""),
    [notice, setNotice] = useState("");
  async function prove(operationId: string, body: Obj | null, query: Obj = {}) {
    return await api("/me/reauthenticate", "POST", {
      password,
      ...(factor ? { factor: { kind, code: factor } } : {}),
      request: { operationId, path: {}, query, body },
    });
  }
  return (
    <>
      <div className="settings-card">
        <h3>
          {t(
            "Kontosicherheit & Agenteneinstellungen",
            "Account security & agent settings",
          )}
        </h3>
        <p>
          {t(
            "Agenten dürfen neue Tags erstellen",
            "Agents may create new tags",
          )}
          : {profile.allowAgentTagCreation ? t("Ja", "Yes") : t("Nein", "No")}
        </p>
        <label>
          {t("Dein Passwort zur Bestätigung", "Your password to confirm")}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {profile.totpEnabled && (
          <label>
            {t("Zweiter Faktor", "Second factor")}
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="totp">TOTP</option>
              <option value="recoveryCode">Recovery-Code</option>
            </select>
            <input value={factor} onChange={(e) => setFactor(e.target.value)} />
          </label>
        )}
        <button
          disabled={!profile.allowAgentTagCreation && !password}
          onClick={() =>
            void run(async () => {
              const body = {
                expectedRevision: profile.revision,
                allowAgentTagCreation: !profile.allowAgentTagCreation,
              };
              const headers: Record<string, string> =
                profile.allowAgentTagCreation
                  ? {}
                  : {
                      "X-Action-Proof": (
                        await prove("web_update_profile", body)
                      ).proof,
                    };
              await api("/me", "PATCH", body, headers);
              setPassword("");
              setFactor("");
              await reload();
            })
          }
        >
          {profile.allowAgentTagCreation
            ? t(
                "Agenten-Tag-Erstellung abschalten",
                "Disable agent tag creation",
              )
            : t("Agenten-Tag-Erstellung erlauben", "Allow agent tag creation")}
        </button>
        {profile.smtpEnabled && (
          <>
            <h4>{t("E-Mail-Adresse ändern", "Change email address")}</h4>
            <label>
              {t("Neue E-Mail-Adresse", "New email address")}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button
              disabled={!email || !password}
              onClick={() =>
                void run(async () => {
                  await api("/me/email-change", "POST", {
                    currentPassword: password,
                    newEmail: email,
                  });
                  setPassword("");
                  setEmail("");
                  setNotice(
                    t(
                      "Bestätigung wurde angefordert. Bitte prüfe deine neue E-Mail-Adresse.",
                      "Confirmation requested. Check your new email address.",
                    ),
                  );
                })
              }
            >
              {t("Bestätigung anfordern", "Request confirmation")}
            </button>
            {notice && <p>{notice}</p>}
          </>
        )}
      </div>
      <div className="settings-card danger-zone">
        <h3>{t("Eigenes Konto löschen", "Delete your account")}</h3>
        <p>
          {t(
            "Löscht dein Konto und alle eigenen Vaults unwiderruflich. Gib zur Bestätigung oben dein Passwort und gegebenenfalls deinen zweiten Faktor ein.",
            "Permanently deletes your account and vaults. Enter your password and factor above to confirm.",
          )}
        </p>
        <button
          className="danger"
          disabled={!password}
          onClick={() => {
            if (
              confirm(
                t(
                  "Alle eigenen Daten und das Konto unwiderruflich löschen?",
                  "Permanently delete your account and all your data?",
                ),
              )
            )
              void run(async () => {
                const query = { expectedRevision: profile.revision };
                const p = await prove("web_delete_account", null, query);
                await api(
                  "/me?expectedRevision=" + profile.revision,
                  "DELETE",
                  undefined,
                  { "X-Action-Proof": p.proof },
                );
                await onDeleted();
              });
          }}
        >
          {t("Konto unwiderruflich löschen", "Permanently delete account")}
        </button>
      </div>
    </>
  );
}
export function AgentTokens({
  t,
  run,
  agent,
  onChanged,
  onIssue,
}: Props & {
  agent: Obj;
  onChanged: () => Promise<void>;
  onIssue: (body: Obj) => void;
}) {
  const [open, setOpen] = useState(false),
    [tokens, setTokens] = useState<Obj[]>([]),
    [days, setDays] = useState("90"),
    [overlap, setOverlap] = useState(0);
  async function load() {
    setTokens(await all(`/agent-accesses/${agent.id}/tokens`));
  }
  useEffect(() => {
    if (open) void run(load);
  }, [open, agent.revision]);
  return (
    <>
      <button onClick={() => setOpen(!open)}>
        {t("Tokens verwalten", "Manage tokens")}
      </button>
      {open && (
        <div className="security-output">
          <label>
            {t("Laufzeit neuer Tokens", "New token lifetime")}
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="30">30 {t("Tage", "days")}</option>
              <option value="90">90 {t("Tage", "days")}</option>
              <option value="365">365 {t("Tage", "days")}</option>
              <option value="">{t("Ohne Ablauf", "No expiry")}</option>
            </select>
          </label>
          <label>
            {t(
              "Überlappung bei Tokenwechsel (Sekunden, 0–86400)",
              "Rotation overlap (seconds, 0–86400)",
            )}
            <input
              type="number"
              value={overlap}
              min={0}
              max={86400}
              onChange={(e) => setOverlap(Number(e.target.value))}
            />
          </label>
          <button
            onClick={() =>
              onIssue({
                expectedRevision: agent.revision,
                lifetimeDays: days ? Number(days) : null,
              })
            }
          >
            {t("Neuen Token ausgeben", "Issue new token")}
          </button>
          {tokens.map((token) => (
            <div className="list-row" key={token.id}>
              <div>
                <strong>{token.id.slice(0, 8)}…</strong>
                <small style={{ display: "block" }}>
                  {t("Erstellt", "Created")}:{" "}
                  {new Date(token.createdAt).toLocaleString()} ·{" "}
                  {token.revokedAt
                    ? t("Widerrufen", "Revoked")
                    : token.expiresAt
                      ? new Date(token.expiresAt).toLocaleDateString()
                      : t("Kein Ablauf", "No expiry")}
                </small>
              </div>
              {!token.revokedAt && (
                <>
                  <button
                    onClick={() =>
                      onIssue({
                        expectedRevision: agent.revision,
                        lifetimeDays: days ? Number(days) : null,
                        replacesTokenId: token.id,
                        overlapSeconds: overlap,
                      })
                    }
                  >
                    {t("Wechseln", "Rotate")}
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      void run(async () => {
                        await api(
                          `/agent-accesses/${agent.id}/tokens/${token.id}?expectedRevision=${agent.revision}`,
                          "DELETE",
                        );
                        await load();
                        await onChanged();
                      })
                    }
                  >
                    {t("Widerrufen", "Revoke")}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
export function TextDiff({
  before,
  after,
  t,
}: {
  before: string;
  after: string;
  t: (de: string, en: string) => string;
}) {
  const old = before.split("\n"),
    next = after.split("\n");
  let start = 0,
    end = 0;
  while (
    start < old.length &&
    start < next.length &&
    old[start] === next[start]
  )
    start++;
  while (
    end < old.length - start &&
    end < next.length - start &&
    old[old.length - 1 - end] === next[next.length - 1 - end]
  )
    end++;
  if (start === old.length && start === next.length)
    return (
      <p className="muted">
        {t("Markdown ist unverändert.", "Markdown is unchanged.")}
      </p>
    );
  return (
    <details className="text-diff" open>
      <summary>
        {t(
          "Markdownänderungen · historische → aktuelle Fassung",
          "Markdown changes · historical → current version",
        )}
      </summary>
      <pre>
        {old.slice(Math.max(0, start - 3), start).map((line, i) => (
          <span key={"c" + i}>
            {" "}
            {line}
            {"\n"}
          </span>
        ))}
        {old.slice(start, old.length - end).map((line, i) => (
          <span className="removed" key={"r" + i}>
            − {line}
            {"\n"}
          </span>
        ))}
        {next.slice(start, next.length - end).map((line, i) => (
          <span className="added" key={"a" + i}>
            + {line}
            {"\n"}
          </span>
        ))}
        {old.slice(old.length - end, old.length - end + 3).map((line, i) => (
          <span key={"e" + i}>
            {" "}
            {line}
            {"\n"}
          </span>
        ))}
      </pre>
    </details>
  );
}
