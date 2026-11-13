import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
const CodeMirror = React.lazy(() => import("./editor"));

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Search,
  Plus,
  BookOpen,
  Tag,
  Trash2,
  Settings,
  Bot,
  ArrowLeft,
  LogOut,
  Shield,
  ChevronRight,
  Check,
  Menu,
  X,
  History,
  FileText,
  Download,
  Sun,
  Moon,
} from "lucide-react";
import { api, all, refreshCsrf, ApiError, operation } from "./api";
import { PasswordField } from "./password-field";
import type { components } from "./generated/web-api";
import "./style.css";
import {
  ImportVault,
  VaultTrash,
  Security,
  AgentGrants,
  Consent,
  AccountActions,
  ProfileOptions,
  AgentTokens,
  TextDiff,
} from "./features";
type Obj = Record<string, any>;
type Profile = components["schemas"]["Profile"];
type Vault = components["schemas"]["WebVault"];
type WebTag = components["schemas"]["WebTag"];
type Memory = components["schemas"]["Memory"];
type SearchHit = components["schemas"]["SearchHit"];
type Draft = Pick<Memory, "title" | "summary" | "markdown"> & {
  tagIds: string[];
};
let initialToken = "";
const initialTokenRoute = [
  "/invite",
  "/reset-password",
  "/recover-account",
].includes(location.pathname)
  ? location.pathname
  : "";
try {
  if (initialTokenRoute)
    initialToken = decodeURIComponent(
      location.hash.replace(/^#(?:token=)?/, ""),
    );
} catch {
  initialToken = "";
}
if (location.hash)
  history.replaceState(null, "", location.pathname + location.search);
function Preview({ text }: { text: string }) {
  const [images, setImages] = useState(false);
  useEffect(() => setImages(false), [text]);
  return (
    <div className="markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) =>
          /^(https?:|mailto:)/i.test(url) ||
          (!url.includes(":") && !url.startsWith("//"))
            ? url
            : ""
        }
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) =>
            images ? (
              <img src={src} alt={alt} />
            ) : (
              <button onClick={() => setImages(true)}>
                {document.documentElement.lang === "en"
                  ? "Load image"
                  : "Bild laden"}
                :{" "}
                {alt ||
                  (document.documentElement.lang === "en"
                    ? "External image"
                    : "Externes Bild")}
              </button>
            ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
function App() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null),
    [boot, setBoot] = useState(true),
    [route, setRoute] = useState(location.pathname),
    [vaults, setVaults] = useState<Vault[]>([]),
    [vaultId, setVaultId] = useState(
      new URLSearchParams(location.search).get("vault") || "",
    ),
    [tags, setTags] = useState<WebTag[]>([]),
    [hits, setHits] = useState<SearchHit[]>([]),
    [next, setNext] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [tagFilter, setTagFilter] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [memory, setMemory] = useState<Memory | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [dirty, setDirty] = useState(false),
    [conflict, setConflict] = useState<Memory | null>(null),
    [rows, setRows] = useState<Obj[]>([]),
    [version, setVersion] = useState<Obj | null>(null),
    [restore, setRestore] = useState<Obj | null>(null),
    [modal, setModal] = useState<Obj | null>(null),
    [mobile, setMobile] = useState(false),
    [compact, setCompact] = useState(
      () => matchMedia("(max-width: 800px)").matches,
    ),
    [systemLight, setSystemLight] = useState(
      () => matchMedia("(prefers-color-scheme: light)").matches,
    ),
    [authTheme, setAuthTheme] = useState<"dark" | "light">("dark"),
    [editorPanel, setEditorPanel] = useState<"edit" | "preview">("edit"),
    [factor, setFactor] = useState(false),
    [accessNeedsLogin, setAccessNeedsLogin] = useState(false),
    [secret, setSecret] = useState("");
  const en = profile?.language === "en";
  const t = (de: string, eng: string) => (en ? eng : de);
  const current = vaults.find((v) => v.id === vaultId);
  const editing = route.endsWith("/edit") || route.endsWith("/new");
  const flowToken = route === initialTokenRoute ? initialToken : "";
  const passwordFlow =
    route === "/reset-password" || route === "/recover-account";
  const pending = useRef(new Map<symbol, () => boolean>());
  const authGeneration = useRef(0);
  const searchGeneration = useRef(0);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const updateBusy = () =>
    setBusy([...pending.current.values()].some((isCurrent) => isCurrent()));
  function go(path: string, force = false) {
    if (
      dirty &&
      !force &&
      !confirm(
        t(
          "Entwurf verwerfen? Nicht gespeicherte Änderungen gehen verloren.",
          "Discard unsaved changes?",
        ),
      )
    )
      return;
    if (path !== route) {
      authGeneration.current++;
      updateBusy();
      initialToken = "";
      setFactor(false);
    }
    setDirty(false);
    setDraft(null);
    setMemory(null);
    setRows([]);
    setConflict(null);
    setError("");
    setNotice("");
    setVersion(null);
    setRestore(null);
    setMobile(false);
    setEditorPanel("edit");
    navigate(path + (vaultId ? "?vault=" + vaultId : ""));
    setRoute(path);
  }
  async function run(
    fn: () => Promise<void>,
    clearError = true,
    isCurrent = () => true,
  ) {
    if (clearError) setError("");
    const requestId = Symbol();
    pending.current.set(requestId, isCurrent);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (!isCurrent()) return;
      if (e instanceof ApiError && e.code === "flow_expired" && factor)
        setFactor(false);
      if (e instanceof ApiError && e.code === "csrf_failed" && profile) {
        try {
          const currentProfile = await api("/me");
          if (currentProfile.id !== profile.id) setAccessNeedsLogin(true);
        } catch {
          setAccessNeedsLogin(true);
        }
      }
      if (
        e instanceof ApiError &&
        e.code === "authentication_required" &&
        profile
      )
        setAccessNeedsLogin(true);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      pending.current.delete(requestId);
      updateBusy();
    }
  }
  async function loadVaults() {
    const v = await all("/vaults");
    setVaults(v);
    if (!v.some((x) => x.id === vaultId)) setVaultId(v[0]?.id || "");
  }
  async function search(cursor?: string) {
    if (!vaultId) return;
    const generation = ++searchGeneration.current;
    const p = await api("/memories/search", "POST", {
      vaultId,
      query,
      tagIds: tagFilter ? [tagFilter] : [],
      sort: query ? "relevance" : "updatedAt",
      pageSize: 30,
      ...(cursor ? { cursor } : {}),
    });
    if (generation !== searchGeneration.current) return;
    setHits((v) => (cursor ? [...v, ...p.items] : p.items));
    setNext(p.nextCursor);
  }
  useEffect(() => {
    void (async () => {
      try {
        await refreshCsrf();
        const p = await api("/me");
        setProfile(p);
        if (
          !location.pathname.startsWith("/app") &&
          !location.pathname.startsWith("/admin") &&
          !location.pathname.startsWith("/oauth/consent/")
        )
          go("/app/search", true);
        await loadVaults();
      } catch {
        try {
          const s = await api("/setup");
          if (s.setupRequired) {
            history.replaceState(null, "", "/setup");
            setRoute("/setup");
          } else if (location.pathname === "/") {
            history.replaceState(null, "", "/login");
            setRoute("/login");
          }
        } catch {
          setError("Der Server ist nicht erreichbar. Bitte Verbindung prüfen.");
        }
      } finally {
        setBoot(false);
      }
    })();
  }, []);
  useEffect(() => {
    const viewport = matchMedia("(max-width: 800px)");
    const scheme = matchMedia("(prefers-color-scheme: light)");
    const viewportChanged = () => {
      setCompact(viewport.matches);
      setMobile(false);
    };
    const schemeChanged = () => setSystemLight(scheme.matches);
    viewport.addEventListener("change", viewportChanged);
    scheme.addEventListener("change", schemeChanged);
    return () => {
      viewport.removeEventListener("change", viewportChanged);
      scheme.removeEventListener("change", schemeChanged);
    };
  }, []);
  useEffect(() => {
    if (profile) {
      document.documentElement.lang = profile.language;
      document.documentElement.dataset.theme = profile.theme;
    } else document.documentElement.dataset.theme = authTheme;
  }, [profile, authTheme]);
  useEffect(() => {
    searchGeneration.current++;
    setHits([]);
    setTags([]);
    setTagFilter("");
    setNext(null);
    if (vaultId)
      history.replaceState(null, "", location.pathname + "?vault=" + vaultId);
  }, [vaultId]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (route !== "/app/search") go("/app/search");
        setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>(".search-box input")
              ?.focus(),
          0,
        );
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [route, dirty]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", f);
    const p = () => {
      if (dirty && !confirm("Entwurf verwerfen?")) {
        history.go(1);
        return;
      }
      setDirty(false);
      if (location.pathname !== route) {
        authGeneration.current++;
        updateBusy();
        initialToken = "";
        setFactor(false);
      }
      setRoute(location.pathname);
    };
    window.addEventListener("popstate", p);
    return () => {
      window.removeEventListener("beforeunload", f);
      window.removeEventListener("popstate", p);
    };
  }, [dirty, route]);
  useEffect(() => {
    if (!profile) return;
    void run(async () => {
      if (vaultId) setTags(await all(`/vaults/${vaultId}/tags`));
      if (route.includes("/memories/") && !route.endsWith("/new")) {
        const id = route.split("/")[3];
        const m = await api(`/memories/${id}`);
        setMemory(m);
        if (editing) setDraft({ ...m, tagIds: m.tags.map((x: Obj) => x.id) });
      } else if (route.endsWith("/new")) {
        setMemory(null);
        setDraft({ title: "", summary: "", markdown: "", tagIds: [] });
      }
      if (route === "/app/trash" && vaultId)
        setRows(await all(`/vaults/${vaultId}/trash`));
      if (route === "/app/agents") setRows(await all("/agent-accesses"));
      if (route === "/app/profile") setRows(await all("/me/sessions"));
      if (route === "/admin/accounts") setRows(await all("/admin/accounts"));
      if (route === "/admin/invitations")
        setRows(await all("/admin/invitations"));
      if (route === "/admin/diagnostics")
        setRows([await api("/admin/diagnostics")]);
    }, false);
  }, [route, vaultId, !!profile]);
  useEffect(() => {
    if (!profile || route !== "/app/search") return;
    searchGeneration.current++;
    const timer = setTimeout(() => void run(() => search(), false), 220);
    return () => clearTimeout(timer);
  }, [query, tagFilter, route, vaultId, !!profile]);
  async function authenticated(p: Profile, isCurrent = () => true) {
    if (!isCurrent()) return;
    initialToken = "";
    setFactor(false);
    setAccessNeedsLogin(false);
    setProfile(p);
    await refreshCsrf();
    if (!isCurrent()) return;
    go(
      location.pathname.startsWith("/oauth/consent/")
        ? location.pathname
        : "/app/search",
      true,
    );
    await loadVaults();
  }
  async function save() {
    if (!draft) return;
    await run(async () => {
      try {
        const body = {
          title: draft.title,
          summary: draft.summary || null,
          markdown: draft.markdown,
          tagIds: draft.tagIds,
        };
        const r = memory
          ? await operation(
              "web_update_memory",
              `/memories/${memory.id}`,
              "PATCH",
              {
                ...body,
                expectedRevision: memory.revision,
              },
            )
          : await operation("web_create_memory", "/memories", "POST", {
              ...body,
              vaultId,
            });
        setDirty(false);
        go(`/app/memories/${r.id}`, true);
        setNotice(t("Gespeichert.", "Saved."));
      } catch (e) {
        if (e instanceof ApiError && e.code === "revision_conflict") {
          setConflict(await api(`/memories/${memory!.id}`));
          setError(
            t(
              "Diese Erinnerung wurde zwischenzeitlich geändert. Dein Entwurf bleibt erhalten.",
              "This memory changed. Your draft has been preserved.",
            ),
          );
        } else throw e;
      }
    });
  }
  const submit =
    (fn: (data: FormData) => Promise<void>) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      void run(() => fn(data));
    };
  const submitAuth =
    (fn: (data: FormData, isCurrent: () => boolean) => Promise<void>) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      const generation = authGeneration.current;
      const isCurrent = () => generation === authGeneration.current;
      void run(() => fn(data, isCurrent), true, isCurrent);
    };
  function field(label: string, name: string, type = "text", value?: string) {
    if (name === "newPassword")
      return <PasswordField label={label} name={name} isNew en={en} />;
    return (
      <label>
        {label}
        <input name={name} type={type} required defaultValue={value} />
      </label>
    );
  }
  if (boot)
    return (
      <div className="boot">
        <span className="brand-mark">m</span>
        <p>memoryaffe wird geladen …</p>
      </div>
    );
  if (!profile)
    return (
      <div className="auth-layout">
        <aside className="auth-story">
          <a className="brand" href="/">
            <span className="brand-mark">m</span>memoryaffe
          </a>
          <div>
            <span className="eyebrow">DEIN PERSÖNLICHER WISSENSSPEICHER</span>
            <h1>
              Gute Gedanken.
              <br />
              Ein bleibender Ort.
            </h1>
            <p>
              Dein Wissen, deine Agenten, deine Infrastruktur.
              <br />
              Alles Wichtige an einem Ort.
            </p>
            <div className="orbit">
              ✳<span>Erinnern. Verbinden. Weiterdenken.</span>
            </div>
          </div>
          <small>Selbst gehostet. Offen. Unter deiner Kontrolle.</small>
        </aside>
        <main className="auth-main">
          <div className="auth-appearance" aria-label="Darstellung">
            <button
              aria-label="Snow – hell"
              aria-pressed={authTheme === "light"}
              onClick={() => setAuthTheme("light")}
            >
              <Sun size={16} /> Snow
            </button>
            <button
              aria-label="Monokai – dunkel"
              aria-pressed={authTheme === "dark"}
              onClick={() => setAuthTheme("dark")}
            >
              <Moon size={16} /> Monokai
            </button>
          </div>
          <div className="auth-card">
            <span className="eyebrow">WILLKOMMEN BEI MEMORYAFFE</span>
            <h2>
              {route === "/setup"
                ? "Dein Gedächtnis beginnt hier."
                : route === "/invite"
                  ? "Schön, dass du dabei bist."
                  : route.includes("reset") || route.includes("recover")
                    ? "Wieder Zugriff erhalten."
                    : "Gut, dich wiederzusehen."}
            </h2>
            <p className="muted">
              {route === "/setup"
                ? "Lege das erste Administratorkonto an."
                : "Melde dich an und knüpfe an dein Wissen an."}
            </p>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            {notice && (
              <div role="status" className="success">
                {notice}
              </div>
            )}
            <form
              key={route + (factor ? ":factor" : ":password")}
              onSubmit={submitAuth(async (d, isCurrent) => {
                const val = (k: string) => String(d.get(k) || "");
                const acceptProfile = async (p: Profile) => {
                  if (isCurrent()) await authenticated(p, isCurrent);
                };
                if (factor) {
                  await acceptProfile(
                    await api("/auth/login/second-factor", "POST", {
                      factor: { kind: val("factorKind"), code: val("code") },
                    }),
                  );
                  return;
                }
                if (route === "/setup") {
                  await acceptProfile(
                    await api("/setup", "POST", {
                      email: val("email"),
                      password: val("password"),
                      setupSecret: val("setupSecret"),
                    }),
                  );
                  return;
                }
                if (route === "/invite") {
                  await acceptProfile(
                    await api("/auth/invitations/redeem", "POST", {
                      token: flowToken || val("token"),
                      password: val("password"),
                    }),
                  );
                  return;
                }
                if (
                  route === "/reset-password" ||
                  route === "/recover-account"
                ) {
                  if (flowToken) {
                    await api(
                      route === "/recover-account"
                        ? "/auth/account-recovery/redeem"
                        : "/auth/password-reset/redeem",
                      "POST",
                      { token: flowToken, newPassword: val("newPassword") },
                    );
                    if (!isCurrent()) return;
                    initialToken = "";
                    go("/login");
                    setNotice("Passwort gespeichert. Bitte anmelden.");
                  } else {
                    await api("/auth/password-reset/request", "POST", {
                      email: val("email"),
                    });
                    if (!isCurrent()) return;
                    setNotice(
                      "Wenn ein E-Mail-Versand möglich ist, erhältst du weitere Informationen.",
                    );
                  }
                  return;
                }
                const r = await api("/auth/login", "POST", {
                  email: val("email"),
                  password: val("password"),
                  rememberMe: d.get("rememberMe") === "on",
                });
                if (!isCurrent()) return;
                if (r.status === "secondFactorRequired") {
                  setFactor(true);
                  await refreshCsrf();
                } else await acceptProfile(r.profile);
              })}
            >
              {factor ? (
                <>
                  <label>
                    Faktor
                    <select name="factorKind">
                      <option value="totp">Authenticator-Code</option>
                      <option value="recoveryCode">
                        Wiederherstellungscode
                      </option>
                    </select>
                  </label>
                  {field("Code", "code")}
                  <p className="muted">
                    Ein Authenticator-Code kann nur einmal verwendet werden.
                    Warte gegebenenfalls auf den nächsten 30-Sekunden-Code.
                  </p>
                </>
              ) : (
                <>
                  {route !== "/invite" &&
                    !flowToken &&
                    field("E-Mail-Adresse", "email", "email")}
                  {route === "/setup" &&
                    field("Betreibersecret", "setupSecret", "password")}
                  {(!passwordFlow || !!flowToken) && (
                    <PasswordField
                      label={
                        flowToken
                          ? "Neues Passwort (mindestens 15 Zeichen)"
                          : "Passwort"
                      }
                      name={passwordFlow ? "newPassword" : "password"}
                      isNew={
                        route === "/setup" ||
                        route === "/invite" ||
                        passwordFlow
                      }
                    />
                  )}
                  {route === "/invite" &&
                    !flowToken &&
                    field("Einladungstoken", "token")}
                  {route === "/login" && (
                    <label className="checkbox">
                      <input name="rememberMe" type="checkbox" />
                      Angemeldet bleiben
                    </label>
                  )}
                </>
              )}
              <button className="primary full" disabled={busy}>
                {busy
                  ? "Einen Moment …"
                  : factor
                    ? "Bestätigen"
                    : route === "/setup"
                      ? "Konto erstellen"
                      : route === "/invite"
                        ? "Einladung annehmen"
                        : route.includes("reset") || route.includes("recover")
                          ? "Fortfahren"
                          : "Anmelden"}
                <ChevronRight size={16} />
              </button>
            </form>
            {factor && (
              <button
                className="text-button"
                onClick={() => {
                  setFactor(false);
                  authGeneration.current++;
                  updateBusy();
                  setError("");
                  setNotice(
                    "Bitte mit E-Mail-Adresse und Passwort neu anmelden.",
                  );
                }}
              >
                Anmeldung neu beginnen
              </button>
            )}
            <p className="trust">
              <Shield size={16} /> Der Infrastrukturbetreiber kann gespeicherte
              Inhalte lesen. Verwende nur eine Installation, der du vertraust.
            </p>
            <button
              className="text-button"
              onClick={() =>
                go(route === "/login" ? "/reset-password" : "/login")
              }
            >
              {route === "/login" ? "Passwort vergessen?" : "Zur Anmeldung"}
            </button>
          </div>
        </main>
      </div>
    );
  const nav = [
    ["/app/search", Search, t("Suche", "Search")],
    ["/app/tags", Tag, "Tags"],
    ["/app/agents", Bot, t("Agenten", "Agents")],
    ["/app/trash", Trash2, t("Papierkorb", "Trash")],
    [
      "/app/vault-settings",
      Settings,
      t("Vault-Einstellungen", "Vault settings"),
    ],
  ] as const;
  const admin = route.startsWith("/admin");
  const sidebar = (
    <div className="sidebar-inner">
      {compact && (
        <button
          className="drawer-close"
          aria-label={t("Navigation schließen", "Close navigation")}
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
      )}
      <a
        className="brand"
        href="/app/search"
        onClick={(e) => {
          e.preventDefault();
          go("/app/search");
        }}
      >
        <span className="brand-mark">m</span>memoryaffe
        <span className="beta">BETA</span>
      </a>
      {!admin && (
        <button
          className="primary compose"
          onClick={() => go("/app/memories/new")}
          disabled={!vaultId}
        >
          <Plus size={19} />
          {t("Neue Erinnerung", "New memory")}
        </button>
      )}
      <div className="vault-switch">
        <label>{t("AKTUELLER VAULT", "CURRENT VAULT")}</label>
        <select
          aria-label="Vault"
          value={vaultId}
          onChange={(e) => {
            if (dirty && !confirm(t("Entwurf verwerfen?", "Discard draft?")))
              return;
            setDirty(false);
            setVaultId(e.target.value);
            go("/app/search", true);
            history.replaceState(
              null,
              "",
              "/app/search?vault=" + e.target.value,
            );
          }}
        >
          {vaults.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          className="text-button"
          onClick={() => setModal({ kind: "vault" })}
        >
          <Plus size={13} />
          {t("Neuer Vault", "New vault")}
        </button>
      </div>
      <span className="nav-caption">
        {admin ? "ADMINISTRATION" : t("DEIN WISSEN", "YOUR KNOWLEDGE")}
      </span>
      <nav>
        {admin ? (
          <>
            {[
              ["/admin/accounts", t("Konten", "Accounts")],
              ["/admin/invitations", t("Einladungen", "Invitations")],
              ["/admin/diagnostics", t("Diagnose", "Diagnostics")],
            ].map(([p, l]) => (
              <button
                className={route === p ? "active" : ""}
                aria-current={route === p ? "page" : undefined}
                key={p}
                onClick={() => go(p)}
              >
                <Shield size={18} />
                {l}
              </button>
            ))}
            <button onClick={() => go("/app/search")}>
              <ArrowLeft size={18} />
              {t("Zurück zum Wissen", "Back to knowledge")}
            </button>
          </>
        ) : (
          nav.map(([p, Icon, label]) => (
            <button
              key={p}
              className={route === p ? "active" : ""}
              aria-current={route === p ? "page" : undefined}
              onClick={() => go(p)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))
        )}
      </nav>
      <div className="sidebar-bottom">
        <div className="private-note">
          <Shield size={17} />
          <div>
            {t("Dein Wissen gehört dir.", "Your knowledge is yours.")}
            <small>
              {t(
                "Privat in deiner Infrastruktur.",
                "Private on your infrastructure.",
              )}
            </small>
          </div>
        </div>
        {profile.role === "admin" && !admin && (
          <button onClick={() => go("/admin/accounts")}>
            <Shield size={16} />
            {t("Administration", "Administration")}
          </button>
        )}
        <button className="account" onClick={() => go("/app/profile")}>
          <span className="avatar">
            {profile.email.slice(0, 1).toUpperCase()}
          </span>
          <span>
            {profile.email}
            <small>{t("Profil & Einstellungen", "Profile & settings")}</small>
          </span>
          <Settings size={15} />
        </button>
      </div>
    </div>
  );
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        {t("Zum Inhalt", "Skip to content")}
      </a>
      {compact ? (
        <BaseDialog.Root open={mobile} onOpenChange={setMobile}>
          <BaseDialog.Portal>
            <BaseDialog.Backdrop className="drawer-backdrop" />
            <BaseDialog.Popup
              className="sidebar drawer"
              aria-label={t("Navigation", "Navigation")}
              finalFocus={menuTrigger}
            >
              {sidebar}
            </BaseDialog.Popup>
          </BaseDialog.Portal>
        </BaseDialog.Root>
      ) : (
        <aside className="sidebar">{sidebar}</aside>
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            ref={menuTrigger}
            className="mobile-toggle"
            aria-label={t("Navigation öffnen", "Open navigation")}
            aria-expanded={mobile}
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={20} />
          </button>
          <form
            className="search-box"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (route !== "/app/search") go("/app/search");
              searchInput.current?.focus();
            }}
          >
            <Search size={20} />
            <input
              ref={searchInput}
              aria-label={t("Erinnerungen durchsuchen", "Search memories")}
              placeholder={t(
                "Erinnerungen durchsuchen …",
                "Search your memories …",
              )}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label={t("Suche leeren", "Clear search")}
                onClick={() => {
                  setQuery("");
                  searchInput.current?.focus();
                }}
              >
                <X size={17} />
              </button>
            )}
            <kbd>Ctrl K</kbd>
          </form>
          <div className="top-right">
            {!admin && (
              <button
                className="primary mobile-compose"
                aria-label={t("Neue Erinnerung", "New memory")}
                disabled={!vaultId}
                onClick={() => go("/app/memories/new")}
              >
                <Plus size={20} />
              </button>
            )}
            <span className="top-account">
              <strong>{profile.email}</strong>
              <small>
                {admin
                  ? t("Administration", "Administration")
                  : t("Dein privates Gedächtnis", "Your private memory")}
              </small>
            </span>
            <button
              className="avatar"
              aria-label="Profil"
              onClick={() => go("/app/profile")}
            >
              {profile.email[0].toUpperCase()}
            </button>
          </div>
        </header>
        <main
          className={
            "content " + (route === "/app/search" ? "search-content" : "")
          }
          id="main-content"
          tabIndex={-1}
        >
          <div className="breadcrumb">
            <span>
              {admin
                ? t("Administration", "Administration")
                : current?.name || "memoryaffe"}
            </span>
            <ChevronRight size={13} />
            {admin
              ? {
                  accounts: t("Konten", "Accounts"),
                  invitations: t("Einladungen", "Invitations"),
                  diagnostics: t("Diagnose", "Diagnostics"),
                }[route.split("/")[2]]
              : route.includes("/memories")
                ? t("Erinnerungen", "Memories")
                : nav.find((x) => x[0] === route)?.[2] ||
                  t("Profil", "Profile")}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button aria-label="Schließen" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="success" role="status">
              <Check size={16} />
              {notice}
            </div>
          )}
          {accessNeedsLogin && (
            <div className="conflict">
              <p>
                {t(
                  "Falls deine Sitzung abgelaufen ist, melde dich in einem neuen Tab an. Dein Entwurf bleibt hier erhalten.",
                  "If your session expired, sign in in a new tab. Your draft remains here.",
                )}
              </p>
              <div className="actions">
                <a
                  className="button"
                  href="/login"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("In neuem Tab anmelden", "Sign in in a new tab")}
                </a>
                <button
                  onClick={() =>
                    void run(async () => {
                      const p = await api("/me");
                      if (p.id !== profile.id)
                        throw new Error(
                          t(
                            "Ein anderes Konto ist angemeldet. Melde dich mit dem ursprünglichen Konto an.",
                            "A different account is signed in. Sign in with the original account.",
                          ),
                        );
                      await refreshCsrf();
                      setAccessNeedsLogin(false);
                      setNotice(
                        t(
                          "Sitzung aktiv. Prüfe deinen Entwurf und speichere ausdrücklich erneut.",
                          "Session active. Review your draft and explicitly save again.",
                        ),
                      );
                    })
                  }
                >
                  {t("Sitzung erneut prüfen", "Check session again")}
                </button>
              </div>
            </div>
          )}
          {busy && <div className="loading-line" />}
          {route === "/app/search" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    {t(
                      "Was möchtest du wiederfinden?",
                      "What would you like to find?",
                    )}
                  </h1>
                  <p>
                    {t(
                      "Notizen, Entscheidungen und Wissen in deinem Vault.",
                      "Notes, decisions and knowledge in your vault.",
                    )}
                  </p>
                </div>
              </div>
              <div className="filter-row">
                <button
                  className={!tagFilter ? "chip selected" : "chip"}
                  aria-pressed={!tagFilter}
                  onClick={() => setTagFilter("")}
                >
                  {t("Alle Erinnerungen", "All memories")}
                </button>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    aria-pressed={tagFilter === tag.id}
                    className={
                      "chip " + (tagFilter === tag.id ? "selected" : "")
                    }
                    onClick={() =>
                      setTagFilter(tagFilter === tag.id ? "" : tag.id)
                    }
                  >
                    # {tag.name}
                  </button>
                ))}
              </div>
              <div className="section-heading">
                <h2>
                  {query
                    ? t("Suchergebnisse", "Search results")
                    : t("Zuletzt bearbeitet", "Recently updated")}
                </h2>
                <span>
                  {hits.length}
                  {next ? "+" : ""} {t("Erinnerungen", "memories")}
                </span>
              </div>
              {hits.length ? (
                <div className="memory-grid">
                  {hits.map((h) => (
                    <button
                      className="memory-card"
                      key={h.id}
                      onClick={() => go("/app/memories/" + h.id)}
                    >
                      <span className="document-icon">
                        <FileText size={19} />
                      </span>
                      <span className="memory-text">
                        <span className="memory-title">{h.title}</span>
                        <span className="memory-summary">
                          {h.summary ||
                            h.snippet ||
                            t(
                              "Öffnen, um die Erinnerung zu lesen.",
                              "Open to read this memory.",
                            )}
                        </span>
                      </span>
                      <span className="memory-tags">
                        {h.tags.map((tag: Obj) => (
                          <span className="tag" key={tag.id}>
                            # {tag.name}
                          </span>
                        ))}
                      </span>
                      <time className="memory-date" dateTime={h.updatedAt}>
                        {new Date(h.updatedAt).toLocaleDateString(
                          en ? "en-GB" : "de-DE",
                          { day: "numeric", month: "short" },
                        )}
                      </time>
                      <ChevronRight className="memory-chevron" size={16} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <BookOpen size={38} />
                  <h3>
                    {!vaultId
                      ? t(
                          "Dein Wissen beginnt mit einem Vault.",
                          "Your knowledge starts with a vault.",
                        )
                      : query || tagFilter
                        ? t("Noch kein Treffer.", "No results yet.")
                        : t(
                            "Ein guter Ort für deinen ersten Gedanken.",
                            "A good place for your first thought.",
                          )}
                  </h3>
                  <p>
                    {!vaultId
                      ? t(
                          "Lege einen eigenen Bereich für deine Erinnerungen an.",
                          "Create a space for your memories.",
                        )
                      : query || tagFilter
                        ? t(
                            "Versuche einen anderen Suchbegriff oder entferne einen Tagfilter.",
                            "Try another search or remove a tag filter.",
                          )
                        : t(
                            "Speichere Notizen, Entscheidungen und Wissen als Markdown.",
                            "Save notes, decisions and knowledge as Markdown.",
                          )}
                  </p>
                  {!query && !tagFilter && (
                    <button
                      className="primary"
                      onClick={() =>
                        vaultId
                          ? go("/app/memories/new")
                          : setModal({ kind: "vault" })
                      }
                    >
                      <Plus size={16} />
                      {!vaultId
                        ? t("Vault anlegen", "Create vault")
                        : t(
                            "Erste Erinnerung anlegen",
                            "Create your first memory",
                          )}
                    </button>
                  )}
                </div>
              )}
              {next && (
                <button
                  className="load-more"
                  onClick={() => void run(() => search(next))}
                >
                  {t("Mehr laden", "Load more")}
                </button>
              )}
              <footer>
                memoryaffe <span>·</span>{" "}
                {t("Damit gute Gedanken bleiben.", "So good thoughts stay.")}
              </footer>
            </>
          )}
          {route.includes("/memories/") &&
            (editing
              ? draft && (
                  <>
                    <div className="page-heading">
                      <div>
                        <button
                          className="text-button"
                          onClick={() =>
                            go(
                              memory
                                ? "/app/memories/" + memory.id
                                : "/app/search",
                            )
                          }
                        >
                          <ArrowLeft size={15} />
                          {t("Zurück", "Back")}
                        </button>
                        <h1>
                          {memory
                            ? t("Erinnerung bearbeiten", "Edit memory")
                            : t("Neue Erinnerung", "New memory")}
                        </h1>
                      </div>
                      <button
                        className="primary"
                        disabled={busy || !draft.title.trim()}
                        onClick={() => void save()}
                      >
                        <Check size={17} />
                        {t("Speichern", "Save")}
                      </button>
                    </div>
                    <div className="editor-meta">
                      <label>
                        {t("Titel", "Title")}
                        <input
                          value={draft.title}
                          maxLength={200}
                          onChange={(e) => {
                            setDraft({ ...draft, title: e.target.value });
                            setDirty(true);
                          }}
                        />
                      </label>
                      <label>
                        {t("Zusammenfassung (optional)", "Summary (optional)")}
                        <textarea
                          rows={2}
                          maxLength={1000}
                          value={draft.summary || ""}
                          onChange={(e) => {
                            setDraft({ ...draft, summary: e.target.value });
                            setDirty(true);
                          }}
                        />
                      </label>
                    </div>
                    {conflict && (
                      <div className="conflict">
                        <h3>
                          {t(
                            "Änderungskonflikt · Entwurf erhalten",
                            "Conflict · Draft preserved",
                          )}
                        </h3>
                        <p>
                          {t(
                            "Vergleiche die aktuelle Serverfassung. Übernimm deren Revision erst nach bewusster Zusammenführung.",
                            "Compare the current server version before merging.",
                          )}
                        </p>
                        <details>
                          <summary>
                            {t("Serverfassung anzeigen", "Show server version")}{" "}
                            · {conflict.title}
                          </summary>
                          <Preview text={conflict.markdown} />
                        </details>
                        <button
                          onClick={() => {
                            setMemory(conflict);
                            setConflict(null);
                            setError("");
                            setNotice(
                              t(
                                "Serverrevision übernommen. Prüfe deinen Entwurf und speichere erneut.",
                                "Server revision adopted. Review and save your draft.",
                              ),
                            );
                          }}
                        >
                          {t(
                            "Mit dieser Revision weiterarbeiten",
                            "Continue with this revision",
                          )}
                        </button>
                      </div>
                    )}
                    <div
                      className="editor-tabs"
                      aria-label={t("Editoransicht", "Editor view")}
                    >
                      <button
                        aria-pressed={editorPanel === "edit"}
                        onClick={() => setEditorPanel("edit")}
                      >
                        {t("Markdown bearbeiten", "Edit Markdown")}
                      </button>
                      <button
                        aria-pressed={editorPanel === "preview"}
                        onClick={() => setEditorPanel("preview")}
                      >
                        {t("Vorschau", "Preview")}
                      </button>
                    </div>
                    <div className={"editor-split panel-" + editorPanel}>
                      <section className="editor-source">
                        <div className="panel-label">
                          MARKDOWN{" "}
                          {dirty && (
                            <span>● {t("Nicht gespeichert", "Unsaved")}</span>
                          )}
                        </div>
                        <React.Suspense
                          fallback={
                            <p>
                              {t("Editor wird geladen …", "Loading editor …")}
                            </p>
                          }
                        >
                          <CodeMirror
                            value={draft.markdown}
                            theme={
                              profile.theme === "light" ||
                              (profile.theme === "system" && systemLight)
                                ? "light"
                                : "dark"
                            }
                            onChange={(value) => {
                              setDraft({ ...draft, markdown: value });
                              setDirty(true);
                            }}
                          />
                        </React.Suspense>
                      </section>
                      <section className="editor-preview">
                        <div className="panel-label">
                          {t("VORSCHAU", "PREVIEW")}
                        </div>

                        <Preview text={draft.markdown} />
                      </section>
                    </div>
                    <div className="filter-row editor-tags">
                      {tags.map((tag) => (
                        <button
                          className={
                            "chip " +
                            (draft.tagIds.includes(tag.id) ? "selected" : "")
                          }
                          key={tag.id}
                          aria-pressed={draft.tagIds.includes(tag.id)}
                          onClick={() => {
                            setDraft({
                              ...draft,
                              tagIds: draft.tagIds.includes(tag.id)
                                ? draft.tagIds.filter(
                                    (id: string) => id !== tag.id,
                                  )
                                : [...draft.tagIds, tag.id],
                            });
                            setDirty(true);
                          }}
                        >
                          # {tag.name}
                        </button>
                      ))}
                    </div>
                  </>
                )
              : memory && (
                  <>
                    <button
                      className="text-button"
                      onClick={() => go("/app/search")}
                    >
                      <ArrowLeft size={16} />
                      {t("Alle Erinnerungen", "All memories")}
                    </button>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">
                          {t("ERINNERUNG", "MEMORY")} · REVISION{" "}
                          {memory.revision}
                        </span>
                        <h1>{memory.title}</h1>
                        <p>{memory.summary}</p>
                      </div>
                      <div className="actions">
                        {vaults.length > 1 && (
                          <button
                            onClick={() => setModal({ kind: "moveMemory" })}
                          >
                            {t("Verschieben", "Move")}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            void run(async () => {
                              setRows(
                                await all(`/memories/${memory.id}/versions`),
                              );
                              setModal({ kind: "history" });
                            })
                          }
                        >
                          <History size={16} />
                          {t("Historie", "History")}
                        </button>
                        <button
                          className="primary"
                          onClick={() => go(`/app/memories/${memory.id}/edit`)}
                        >
                          {t("Bearbeiten", "Edit")}
                        </button>
                        <button
                          aria-label="Löschen"
                          onClick={() => setModal({ kind: "deleteMemory" })}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                    <div className="filter-row">
                      {memory.tags.map((tag: Obj) => (
                        <span className="tag" key={tag.id}>
                          # {tag.name}
                        </span>
                      ))}
                      <span className="muted">
                        {new Date(memory.updatedAt).toLocaleString(
                          en ? "en-GB" : "de-DE",
                        )}
                      </span>
                    </div>
                    <article className="reading">
                      <Preview text={memory.markdown} />
                    </article>
                  </>
                ))}
          {route === "/app/tags" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">{current?.name}</span>
                  <h1>{t("Gedanken verbinden.", "Connect your thoughts.")}</h1>
                  <p>
                    {t(
                      "Tags geben deinem Wissen Struktur.",
                      "Tags give structure to your knowledge.",
                    )}
                  </p>
                </div>
              </div>
              <form
                className="inline-form"
                onSubmit={submit(async (d) => {
                  await api(`/vaults/${vaultId}/tags`, "POST", {
                    name: d.get("name"),
                  });
                  setTags(await all(`/vaults/${vaultId}/tags`));
                })}
              >
                <input
                  name="name"
                  required
                  maxLength={50}
                  aria-label="Tagname"
                  placeholder={t("Neuer Tagname", "New tag name")}
                />
                <button className="primary">
                  <Plus size={16} />
                  {t("Tag anlegen", "Create tag")}
                </button>
              </form>
              <div className="list">
                {tags.map((tag) => (
                  <div className="list-row" key={tag.id}>
                    <Tag size={17} />
                    <strong>{tag.name}</strong>
                    <button
                      onClick={() => setModal({ kind: "renameTag", tag })}
                    >
                      {t("Umbenennen", "Rename")}
                    </button>
                    <button
                      disabled={tags.length < 2}
                      onClick={() => setModal({ kind: "mergeTag", tag })}
                    >
                      {t("Zusammenführen", "Merge")}
                    </button>
                    <button
                      aria-label="Tag löschen"
                      onClick={() => setModal({ kind: "deleteTag", tag })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {route === "/app/trash" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">{current?.name}</span>
                  <h1>{t("Papierkorb", "Trash")}</h1>
                  <p>
                    {t(
                      "Gelöschte Erinnerungen wiederherstellen oder endgültig entfernen.",
                      "Restore deleted memories or remove them permanently.",
                    )}
                  </p>
                </div>
              </div>
              {!rows.length && (
                <div className="empty">
                  <Trash2 size={35} />
                  <h3>{t("Alles aufgeräumt.", "All clear.")}</h3>
                </div>
              )}
              <div className="list">
                {rows.map((r) => (
                  <div className="list-row" key={r.id}>
                    <FileText size={18} />
                    <strong>{r.title}</strong>
                    <span className="muted">
                      {new Date(r.deletedAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() =>
                        void run(async () => {
                          await api(`/trash/memories/${r.id}/restore`, "POST", {
                            expectedRevision: r.revision,
                          });
                          setRows(await all(`/vaults/${vaultId}/trash`));
                          setNotice(t("Wiederhergestellt.", "Restored."));
                        })
                      }
                    >
                      {t("Wiederherstellen", "Restore")}
                    </button>
                    <button
                      className="danger"
                      onClick={() => setModal({ kind: "purge", item: r })}
                    >
                      {t("Endgültig löschen", "Delete permanently")}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {route === "/app/trash" && (
            <VaultTrash t={t} run={run} onRestored={loadVaults} />
          )}
          {route === "/app/vault-settings" && current && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">VAULT</span>
                  <h1>
                    {t(
                      "Ein Raum für dein Wissen.",
                      "A space for your knowledge.",
                    )}
                  </h1>
                  <p>
                    {t(
                      "Einstellungen gelten nur für diesen Vault.",
                      "Settings apply only to this vault.",
                    )}
                  </p>
                </div>
              </div>
              <form
                className="settings-card"
                key={current.id + current.revision}
                onSubmit={submit(async (d) => {
                  const v = await api(`/vaults/${vaultId}`, "PATCH", {
                    expectedRevision: current.revision,
                    name: d.get("name"),
                    versionLimit: Number(d.get("versionLimit")),
                    searchLanguage: d.get("searchLanguage"),
                  });
                  setVaults(vaults.map((x) => (x.id === v.id ? v : x)));
                  setNotice(t("Vault gespeichert.", "Vault saved."));
                })}
              >
                {field(
                  t("Vaultname", "Vault name"),
                  "name",
                  "text",
                  current.name,
                )}
                <label>
                  {t("Suchsprache", "Search language")}
                  <select
                    name="searchLanguage"
                    defaultValue={current.searchLanguage}
                  >
                    <option value="neutral">Neutral</option>
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  {t(
                    "Historische Versionen je Erinnerung (0–100)",
                    "Historical versions per memory (0–100)",
                  )}
                  <input
                    name="versionLimit"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={current.versionLimit}
                  />
                </label>
                <button className="primary">
                  {t("Einstellungen speichern", "Save settings")}
                </button>
              </form>
              <div className="settings-card">
                <h3>{t("Daten mitnehmen", "Take your data with you")}</h3>
                <p className="muted">
                  {t(
                    "Exportiere deinen Vault als ZIP inklusive Markdown und Metadaten.",
                    "Export your vault as ZIP with Markdown and metadata.",
                  )}
                </p>
                <a
                  className="button"
                  href={`/api/v1/vaults/${vaultId}/export`}
                  download
                >
                  <Download size={16} />
                  {t("Vault exportieren", "Export vault")}
                </a>
              </div>
              <ImportVault
                t={t}
                run={run}
                onImported={async (v) => {
                  await loadVaults();
                  setVaultId(v.id);
                  go("/app/search", true);
                }}
              />
              <div className="settings-card danger-zone">
                <h3>{t("Vault löschen", "Delete vault")}</h3>
                <p>
                  {t(
                    "Der Vault und seine Erinnerungen werden in den Papierkorb verschoben. Agentenzugriffe werden entzogen.",
                    "The vault and memories move to trash. Agent access is revoked.",
                  )}
                </p>
                <button
                  className="danger"
                  onClick={() => setModal({ kind: "deleteVault" })}
                >
                  {t("Vault löschen", "Delete vault")}
                </button>
              </div>
            </>
          )}
          {route === "/app/profile" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {t("DEIN KONTO", "YOUR ACCOUNT")}
                  </span>
                  <h1>
                    {t("Ganz wie du magst.", "Just the way you like it.")}
                  </h1>
                  <p>{profile.email}</p>
                </div>
                <button
                  onClick={() =>
                    void run(async () => {
                      await api("/auth/logout", "POST", {});
                      setProfile(null);
                      await refreshCsrf();
                      go("/login", true);
                    })
                  }
                >
                  <LogOut size={16} />
                  {t("Abmelden", "Sign out")}
                </button>
              </div>
              <div className="settings-card">
                <h3>{t("Darstellung & Sprache", "Appearance & language")}</h3>
                <label>
                  {t("Farbschema", "Theme")}
                  <select
                    value={profile.theme}
                    aria-label={t("Farbschema", "Theme")}
                    onChange={(e) =>
                      void run(async () =>
                        setProfile(
                          await api("/me", "PATCH", { theme: e.target.value }),
                        ),
                      )
                    }
                  >
                    <option value="dark">
                      {t("Monokai · Dunkel", "Monokai · Dark")}
                    </option>
                    <option value="light">
                      {t("Snow · Hell", "Snow · Light")}
                    </option>
                    <option value="system">System</option>
                  </select>
                </label>
                <label>
                  {t("Anzeigesprache", "Display language")}
                  <select
                    value={profile.language}
                    aria-label={t("Anzeigesprache", "Display language")}
                    onChange={(e) =>
                      void run(async () =>
                        setProfile(
                          await api("/me", "PATCH", {
                            language: e.target.value,
                          }),
                        ),
                      )
                    }
                  >
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </div>
              <Security
                t={t}
                run={run}
                profile={profile}
                reload={async () => setProfile(await api("/me"))}
              />
              <ProfileOptions
                t={t}
                run={run}
                profile={profile}
                reload={async () => setProfile(await api("/me"))}
                onDeleted={async () => {
                  setProfile(null);
                  setVaults([]);
                  setHits([]);
                  setTags([]);
                  await refreshCsrf();
                  go("/login", true);
                }}
              />
              <form
                className="settings-card"
                onSubmit={submit(async (d) => {
                  await api("/me/change-password", "POST", {
                    currentPassword: d.get("currentPassword"),
                    newPassword: d.get("newPassword"),
                  });
                  setNotice(t("Passwort geändert.", "Password changed."));
                })}
              >
                <h3>{t("Passwort ändern", "Change password")}</h3>
                {field(
                  t("Aktuelles Passwort", "Current password"),
                  "currentPassword",
                  "password",
                )}
                {field(
                  t(
                    "Neues Passwort (mindestens 15 Zeichen)",
                    "New password (at least 15 characters)",
                  ),
                  "newPassword",
                  "password",
                )}
                <button>{t("Passwort speichern", "Save password")}</button>
              </form>
              <div className="settings-card">
                <h3>{t("Aktive Sitzungen", "Active sessions")}</h3>
                {rows.map((s) => (
                  <div className="list-row" key={s.id}>
                    <span>
                      {[s.browser, s.device].filter(Boolean).join(" · ")}
                      {s.current
                        ? " · " + t("Diese Sitzung", "This session")
                        : ""}
                    </span>
                    {!s.current && (
                      <button
                        onClick={() =>
                          void run(async () => {
                            await api("/me/sessions/" + s.id, "DELETE");
                            setRows(await all("/me/sessions"));
                          })
                        }
                      >
                        {t("Abmelden", "Revoke")}
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() =>
                    void run(async () => {
                      await api("/me/sessions/revoke-others", "POST", {});
                      setRows(await all("/me/sessions"));
                    })
                  }
                >
                  {t("Andere Sitzungen abmelden", "Revoke other sessions")}
                </button>
              </div>
            </>
          )}
          {route === "/app/agents" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {t("KONTROLLIERTER ZUGANG", "CONTROLLED ACCESS")}
                  </span>
                  <h1>
                    {t(
                      "Wissen für deine Agenten.",
                      "Knowledge for your agents.",
                    )}
                  </h1>
                  <p>
                    {t(
                      "Du bestimmst, welcher Agent welche Vaults verwenden darf.",
                      "You decide which vaults each agent may use.",
                    )}
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => setModal({ kind: "agent" })}
                >
                  <Plus size={16} />
                  {t("CLI-Zugang anlegen", "Create CLI access")}
                </button>
              </div>
              {!rows.length && (
                <div className="empty">
                  <Bot size={40} />
                  <h3>
                    {t(
                      "Noch keine Agenten verbunden.",
                      "No agents connected yet.",
                    )}
                  </h3>
                </div>
              )}
              {rows.map((a) => (
                <div className="settings-card" key={a.id}>
                  <div className="section-heading">
                    <h3>
                      {a.name} <span className="tag">{a.kind}</span>
                    </h3>
                    <button
                      className="danger"
                      onClick={() =>
                        setModal({ kind: "revokeAgent", agent: a })
                      }
                    >
                      {t("Widerrufen", "Revoke")}
                    </button>
                  </div>
                  <p className="muted">
                    {a.grants
                      .map(
                        (g: Obj) =>
                          (vaults.find((v) => v.id === g.vaultId)?.name ||
                            g.vaultId) +
                          " · " +
                          g.level,
                      )
                      .join(", ")}
                  </p>
                  <AgentGrants
                    t={t}
                    run={run}
                    agent={a}
                    vaults={vaults}
                    onChanged={async () =>
                      setRows(await all("/agent-accesses"))
                    }
                  />
                  {a.kind === "cli" && (
                    <AgentTokens
                      t={t}
                      run={run}
                      agent={a}
                      onChanged={async () =>
                        setRows(await all("/agent-accesses"))
                      }
                      onIssue={(body) =>
                        setModal({
                          kind: "reauth",
                          operationId: "web_issue_token",
                          path: { id: a.id },
                          body,
                          url: `/agent-accesses/${a.id}/tokens`,
                        })
                      }
                    />
                  )}
                  {a.kind === "cli" && (
                    <button
                      onClick={() =>
                        setModal({
                          kind: "reauth",
                          operationId: "web_issue_token",
                          path: { id: a.id },
                          body: {
                            expectedRevision: a.revision,
                            lifetimeDays: 90,
                          },
                          url: `/agent-accesses/${a.id}/tokens`,
                        })
                      }
                    >
                      {t("Token ausgeben (90 Tage)", "Issue token (90 days)")}
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
          {route === "/admin/accounts" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">ADMINISTRATION</span>
                  <h1>{t("Konten", "Accounts")}</h1>
                  <p>
                    {t(
                      "Konten verwalten. Inhalte anderer Nutzer bleiben privat.",
                      "Manage accounts. Other users’ content stays private.",
                    )}
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => go("/admin/invitations")}
                >
                  {t("Nutzer einladen", "Invite user")}
                </button>
              </div>
              <div className="list">
                {rows.map((a) => (
                  <div className="list-row" key={a.id}>
                    <span className="avatar">{a.email[0].toUpperCase()}</span>
                    <strong>{a.email}</strong>
                    <span className="tag">{a.role}</span>
                    <span className="tag">{a.status}</span>
                    <AccountActions
                      t={t}
                      run={run}
                      account={a}
                      reload={async () => setRows(await all("/admin/accounts"))}
                      onLink={(url) => {
                        setSecret(url);
                        setModal({
                          kind: "secret",
                          title: t("Einmaliger Link", "One-time link"),
                        });
                      }}
                    />
                    {a.id !== profile.id && (
                      <button
                        onClick={() =>
                          void run(async () => {
                            await api("/admin/accounts/" + a.id, "PATCH", {
                              expectedRevision: a.revision,
                              status:
                                a.status === "active" ? "suspended" : "active",
                            });
                            setRows(await all("/admin/accounts"));
                          })
                        }
                      >
                        {a.status === "active"
                          ? t("Sperren", "Suspend")
                          : t("Freigeben", "Activate")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {route === "/admin/invitations" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">ADMINISTRATION</span>
                  <h1>
                    {t("Ein guter Gedanke wird geteilt.", "Invite someone in.")}
                  </h1>
                  <p>
                    {t(
                      "Lade ein Konto ein. Jeder Nutzer erhält ausschließlich eigene Vaults.",
                      "Invite an account. Every user receives private vaults.",
                    )}
                  </p>
                </div>
              </div>
              <form
                className="inline-form"
                onSubmit={submit(async (d) => {
                  const r = await api("/admin/invitations", "POST", {
                    email: d.get("email"),
                    role: "user",
                    sendEmail: false,
                  });
                  setSecret(r.link.url);
                  setModal({
                    kind: "secret",
                    title: t("Einladungslink", "Invitation link"),
                  });
                  setRows(await all("/admin/invitations"));
                })}
              >
                <input
                  name="email"
                  type="email"
                  required
                  aria-label="E-Mail-Adresse"
                  placeholder="name@example.com"
                />
                <button className="primary">
                  <Plus size={16} />
                  {t("Einladung erstellen", "Create invitation")}
                </button>
              </form>
              <div className="list">
                {rows.map((i) => (
                  <div className="list-row" key={i.id}>
                    <strong>{i.email}</strong>
                    <span className="tag">{i.status}</span>
                    <span className="muted">
                      {new Date(i.expiresAt).toLocaleDateString()}
                    </span>
                    {i.status === "pending" && (
                      <button
                        onClick={() =>
                          void run(async () => {
                            await api("/admin/invitations/" + i.id, "DELETE");
                            setRows(await all("/admin/invitations"));
                          })
                        }
                      >
                        {t("Widerrufen", "Revoke")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {route === "/admin/diagnostics" && (
            <>
              <h1>{t("Diagnose", "Diagnostics")}</h1>
              {rows.map((r, i) => (
                <div className="settings-card" key={i}>
                  <p>Version: {r.version}</p>
                  <p>
                    {t("Datenbank bereit", "Database ready")}:{" "}
                    {String(r.databaseReady)}
                  </p>
                  <p>
                    {t("Datenbankgröße", "Database size")}:{" "}
                    {(r.databaseBytes / 1048576).toFixed(1)} MiB
                  </p>
                  <p>
                    {t("Laufzeit", "Uptime")}:{" "}
                    {Math.floor(r.uptimeSeconds / 60)} min
                  </p>
                </div>
              ))}
            </>
          )}
          {route.startsWith("/oauth/consent/") && (
            <Consent t={t} run={run} id={route.split("/")[3]} vaults={vaults} />
          )}
        </main>
      </div>
      {modal && (
        <div
          className="modal-host"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setModal(null);
              setSecret("");
            }
          }}
        >
          <Dialog
            onClose={() => {
              setModal(null);
              setSecret("");
            }}
          >
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <h2>
              {modal.kind === "vault"
                ? t("Neuer Vault", "New vault")
                : modal.kind === "agent"
                  ? t("CLI-Zugang anlegen", "Create CLI access")
                  : modal.kind === "reauth"
                    ? t("Aktion bestätigen", "Confirm action")
                    : modal.kind === "history"
                      ? t("Versionshistorie", "Version history")
                      : modal.kind === "secret"
                        ? modal.title
                        : modal.kind === "renameTag"
                          ? t("Tag umbenennen", "Rename tag")
                          : modal.kind === "moveMemory"
                            ? t("Erinnerung verschieben", "Move memory")
                            : modal.kind === "mergeTag"
                              ? t("Tags zusammenführen", "Merge tags")
                              : t("Bist du sicher?", "Are you sure?")}
            </h2>
            {modal.kind === "secret" ? (
              <>
                <p>
                  {t(
                    "Nur jetzt sichtbar. Bewahre dieses Geheimnis sicher auf.",
                    "Shown only now. Store this secret securely.",
                  )}
                </p>
                <textarea readOnly value={secret} />
                <button
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(secret);
                      setNotice(t("Kopiert.", "Copied."));
                    })
                  }
                >
                  {t("Kopieren", "Copy")}
                </button>
              </>
            ) : modal.kind === "history" ? (
              <>
                <div className="history-list">
                  {rows.map((v) => (
                    <button
                      key={v.revision}
                      onClick={() =>
                        void run(async () => {
                          setVersion(
                            await api(
                              `/memories/${memory!.id}/versions/${v.revision}`,
                            ),
                          );
                          setRestore(
                            await api(
                              `/memories/${memory!.id}/versions/${v.revision}/restore-preview`,
                            ),
                          );
                        })
                      }
                    >
                      {t("Revision", "Revision")} {v.revision}{" "}
                      <small>{new Date(v.savedAt).toLocaleString()}</small>
                    </button>
                  ))}
                  {!rows.length && (
                    <p>
                      {t(
                        "Noch keine historischen Versionen.",
                        "No historical versions yet.",
                      )}
                    </p>
                  )}
                </div>
                {version && (
                  <>
                    <h3>{version.title}</h3>
                    <p>{version.summary}</p>
                    <p>{version.tagNames.join(" · ")}</p>
                    <Preview text={version.markdown} />
                    <TextDiff
                      before={version.markdown}
                      after={memory!.markdown}
                      t={t}
                    />
                    {restore && (
                      <>
                        <p>
                          {t("Neu anzulegende Tags", "Tags to create")}:{" "}
                          {restore.tagsToCreate.join(", ") || "—"}
                        </p>
                        <button
                          className="primary"
                          onClick={() =>
                            void run(async () => {
                              await api(
                                `/memories/${memory!.id}/restore-version`,
                                "POST",
                                {
                                  expectedRevision: memory!.revision,
                                  sourceRevision: version.revision,
                                  restoreToken: restore.restoreToken,
                                },
                              );
                              setMemory(await api("/memories/" + memory!.id));
                              setModal(null);
                              setNotice(
                                t(
                                  "Version wiederhergestellt.",
                                  "Version restored.",
                                ),
                              );
                            })
                          }
                        >
                          {t(
                            "Diese Version wiederherstellen",
                            "Restore this version",
                          )}
                        </button>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <form
                onSubmit={submit(async (d) => {
                  if (modal.kind === "moveMemory") {
                    const target = String(d.get("targetVaultId"));
                    await api(`/memories/${memory!.id}/move`, "POST", {
                      expectedRevision: memory!.revision,
                      targetVaultId: target,
                    });
                    setVaultId(target);
                    setMemory(await api(`/memories/${memory!.id}`));
                    setNotice(t("Erinnerung verschoben.", "Memory moved."));
                  }
                  if (modal.kind === "mergeTag") {
                    const target = tags.find(
                      (tag) => tag.id === d.get("targetTagId"),
                    )!;
                    await api(
                      `/vaults/${vaultId}/tags/${modal.tag.id}/merge`,
                      "POST",
                      {
                        expectedRevision: modal.tag.revision,
                        targetTagId: target.id,
                        expectedTargetRevision: target.revision,
                      },
                    );
                    setTags(await all(`/vaults/${vaultId}/tags`));
                  }
                  if (modal.kind === "vault") {
                    const v = await api("/vaults", "POST", {
                      name: d.get("name"),
                    });
                    await loadVaults();
                    setVaultId(v.id);
                    go("/app/search", true);
                  }
                  if (modal.kind === "renameTag") {
                    await api(
                      `/vaults/${vaultId}/tags/${modal.tag.id}`,
                      "PATCH",
                      {
                        name: d.get("name"),
                        expectedRevision: modal.tag.revision,
                      },
                    );
                    setTags(await all(`/vaults/${vaultId}/tags`));
                  }
                  if (modal.kind === "deleteTag") {
                    await api(
                      `/vaults/${vaultId}/tags/${modal.tag.id}?expectedRevision=${modal.tag.revision}`,
                      "DELETE",
                    );
                    setTags(await all(`/vaults/${vaultId}/tags`));
                  }
                  if (modal.kind === "deleteMemory") {
                    await api(
                      `/memories/${memory!.id}?expectedRevision=${memory!.revision}`,
                      "DELETE",
                    );
                    go("/app/search", true);
                  }
                  if (modal.kind === "purge") {
                    await api(
                      `/trash/memories/${modal.item.id}?expectedRevision=${modal.item.revision}`,
                      "DELETE",
                    );
                    setRows(await all(`/vaults/${vaultId}/trash`));
                  }
                  if (modal.kind === "deleteVault") {
                    await api(
                      `/vaults/${vaultId}?expectedRevision=${current!.revision}`,
                      "DELETE",
                    );
                    await loadVaults();
                    go("/app/search", true);
                  }
                  if (modal.kind === "revokeAgent") {
                    await api(
                      `/agent-accesses/${modal.agent.id}?expectedRevision=${modal.agent.revision}`,
                      "DELETE",
                    );
                    setRows(await all("/agent-accesses"));
                  }
                  if (modal.kind === "agent") {
                    const body = {
                      name: d.get("name"),
                      grants: [
                        { vaultId: d.get("vaultId"), level: d.get("level") },
                      ],
                    };
                    setModal({
                      kind: "reauth",
                      operationId: "web_create_agent_access",
                      path: {},
                      body,
                      url: "/agent-accesses",
                    });
                    return;
                  }
                  if (modal.kind === "reauth") {
                    const f = String(d.get("code") || "");
                    const r = await api("/me/reauthenticate", "POST", {
                      password: d.get("password"),
                      ...(f
                        ? { factor: { kind: d.get("factorKind"), code: f } }
                        : {}),
                      request: {
                        operationId: modal.operationId,
                        path: modal.path,
                        query: {},
                        body: modal.body,
                      },
                    });
                    const result = await api(modal.url, "POST", modal.body, {
                      "X-Action-Proof": r.proof,
                    });
                    setRows(await all("/agent-accesses"));
                    if (result.token) {
                      setSecret(result.token);
                      setModal({
                        kind: "secret",
                        title: t("Dein CLI-Token", "Your CLI token"),
                      });
                      return;
                    }
                  }
                  setModal(null);
                })}
              >
                {modal.kind === "moveMemory" && (
                  <label>
                    {t("Zielvault", "Target vault")}
                    <select name="targetVaultId">
                      {vaults
                        .filter((v) => v.id !== memory!.vaultId)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {modal.kind === "mergeTag" && (
                  <>
                    <p>
                      {t(
                        "Der Quelltag wird entfernt und an allen Erinnerungen durch den gewählten Zieltag ersetzt.",
                        "The source tag is removed and replaced with the selected target on all memories.",
                      )}
                    </p>
                    <label>
                      {t("Zieltag", "Target tag")}
                      <select name="targetTagId">
                        {tags
                          .filter((tag) => tag.id !== modal.tag.id)
                          .map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
                {(modal.kind === "vault" ||
                  modal.kind === "renameTag" ||
                  modal.kind === "agent") &&
                  field(t("Name", "Name"), "name", "text", modal.tag?.name)}
                {modal.kind === "agent" && (
                  <>
                    <label>
                      Vault
                      <select name="vaultId">
                        {vaults.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("Rechte", "Permissions")}
                      <select name="level">
                        <option value="read">{t("Lesen", "Read")}</option>
                        <option value="write">
                          {t("Lesen & Schreiben", "Read & write")}
                        </option>
                        <option value="delete">
                          {t(
                            "Lesen, Schreiben & Löschen",
                            "Read, write & delete",
                          )}
                        </option>
                      </select>
                    </label>
                  </>
                )}
                {modal.kind === "reauth" && (
                  <>
                    {field(
                      t("Dein Passwort", "Your password"),
                      "password",
                      "password",
                    )}
                    {profile.totpEnabled && (
                      <>
                        <label>
                          {t("Faktor", "Factor")}
                          <select name="factorKind">
                            <option value="totp">TOTP</option>
                            <option value="recoveryCode">Recovery-Code</option>
                          </select>
                        </label>
                        {field("Code", "code")}
                      </>
                    )}
                    <p className="muted">
                      {t(
                        "Bestätigung gilt ausschließlich für diese konkrete Aktion.",
                        "Confirmation applies only to this action.",
                      )}
                    </p>
                  </>
                )}
                {[
                  "deleteMemory",
                  "deleteTag",
                  "deleteVault",
                  "purge",
                  "revokeAgent",
                ].includes(modal.kind) && (
                  <p>
                    {modal.kind === "purge"
                      ? t(
                          "Diese Erinnerung wird unwiderruflich gelöscht.",
                          "This memory will be permanently deleted.",
                        )
                      : t(
                          "Die ausgewählte Aktion wird auf dem Server ausgeführt.",
                          "This action will be applied on the server.",
                        )}
                  </p>
                )}
                <div className="actions">
                  <button type="button" onClick={() => setModal(null)}>
                    {t("Abbrechen", "Cancel")}
                  </button>
                  <button className="primary" disabled={busy}>
                    {t("Bestätigen", "Confirm")}
                  </button>
                </div>
              </form>
            )}
          </Dialog>
        </div>
      )}
    </div>
  );
}
function Dialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <BaseDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="modal-backdrop" />
        <BaseDialog.Popup
          className="modal"
          aria-label="Dialog"
          initialFocus={true}
          finalFocus={true}
        >
          <button
            className="modal-close"
            aria-label="Schließen"
            onClick={onClose}
          >
            <X size={19} />
          </button>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
