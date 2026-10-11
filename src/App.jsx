import React, { useEffect, useRef, useState } from "react";
import { definitiveResolution } from "../shared/answers.mjs";
import {
  House,
  Files,
  ListChecks,
  CheckCircle,
  SquaresFour,
  UsersThree,
  GearSix,
  Bell,
  MagnifyingGlass,
  Plus,
  ArrowRight,
  ArrowUpRight,
  CaretDown,
  CaretRight,
  X,
  SignOut,
  Sparkle,
  Check,
  Clock,
  PencilSimple,
  ArrowLeft,
  DotsThree,
  FileText,
  DownloadSimple,
  Archive,
  ArrowCounterClockwise,
  PaperPlaneTilt,
  WarningCircle,
  CircleNotch,
  CalendarBlank,
  Laptop,
  ShieldCheck,
  BookOpen,
  GitBranch,
  Tray,
  Copy,
  Trash,
  List,
  Globe,
  Eye,
  UploadSimple,
  LockSimple,
} from "@phosphor-icons/react";

const icons = {
  people: UsersThree,
  laptop: Laptop,
  calendar: CalendarBlank,
  file: FileText,
};
const dates = (
  value,
  options = { day: "numeric", month: "short" },
  timezone,
) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        ...options,
        timeZone: timezone,
      })
    : "Not set";
const dateTime = (value, timezone) =>
  new Date(value).toLocaleString("en-GB", { timeZone: timezone });
const future = (days, timezone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day) + days,
    ),
  )
    .toISOString()
    .slice(0, 10);
};
const initials = (name) =>
  name
    ?.split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("") || "SE";
async function request(path, body, method) {
  const response = await fetch(path, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", "x-sopeasy-request": "1" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    const e = new Error(data.error || "The request did not finish.");
    e.status = response.status;
    throw e;
  }
  return data;
}
function Logo({ small = false }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <span className="brandmark">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="M7 6h11l7 7v13H7z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M18 6v7h7M11 17h10M11 21h7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </span>
      <span>
        SOP<span className="brand-easy">Easy</span>
        <span className="brand-dot">.</span>
      </span>
    </div>
  );
}
function Avatar({ name, size = 32, index = 0 }) {
  return (
    <span
      className={`avatar avatar-${index % 4}`}
      style={{ width: size, height: size, fontSize: size / 3 }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
function Button({
  children,
  icon: Icon,
  onClick,
  kind = "",
  busy = false,
  ...props
}) {
  return (
    <button
      className={`button ${kind}`}
      onClick={onClick}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? (
        <CircleNotch className="spin" size={17} />
      ) : Icon ? (
        <Icon size={17} weight="regular" />
      ) : null}
      {children}
    </button>
  );
}
function Status({ value }) {
  return (
    <span className={`status ${value?.toLowerCase().replaceAll(" ", "-")}`}>
      <i />
      {value}
    </span>
  );
}
function Empty({ title, detail, action, icon: Icon = Files }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={36} weight="light" />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function Dialog({ title, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const d = ref.current;
    const previousFocus = document.activeElement;
    d.showModal();
    return () => {
      d.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`dialog ${wide ? "wide" : ""}`}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controls = [
          ...e.currentTarget.querySelectorAll(
            "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], summary",
          ),
        ].filter((element) => element.getClientRects().length);
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function ProcessGraphic({ compact = false }) {
  return (
    <div
      className={`process-graphic ${compact ? "compact" : ""}`}
      aria-label="A procedure moves from a draft through review to publication"
    >
      <svg viewBox="0 0 450 225" role="img">
        <title>From knowledge to a published procedure</title>
        <path
          className="process-path"
          d="M72 117H204Q222 117 222 99V65Q222 47 240 47H359M222 99V163Q222 181 240 181H359"
          fill="none"
          stroke="#cdd4c3"
          strokeWidth="1.4"
        />
        <circle className="signal signal-one" r="3" fill="#7c9171">
          <animateMotion
            dur="5s"
            repeatCount="indefinite"
            path="M72 117H204Q222 117 222 99V65Q222 47 240 47H359"
          />
        </circle>
        <circle className="signal signal-two" r="3" fill="#b77b55">
          <animateMotion
            dur="6s"
            repeatCount="indefinite"
            path="M72 117H204Q222 117 222 99V163Q222 181 240 181H359"
          />
        </circle>
        <g className="graphic-source">
          <rect
            x="24"
            y="83"
            width="126"
            height="70"
            rx="10"
            fill="#fffefb"
            stroke="#dfe3d7"
          />
          <rect x="40" y="98" width="25" height="31" rx="3" fill="#edf0e5" />
          <path
            d="M46 107h13M46 112h13M46 117h8"
            stroke="#74856b"
            strokeWidth="1.3"
          />
          <text x="77" y="113">
            A clear draft
          </text>
          <text className="svg-sub" x="77" y="129">
            Your team’s knowledge
          </text>
        </g>
        <g className="graphic-review">
          <rect x="281" y="15" width="144" height="66" rx="10" fill="#edf0e5" />
          <circle cx="305" cy="45" r="13" fill="#dce5d2" />
          <path
            d="m299 45 4 4 8-8"
            fill="none"
            stroke="#5d7650"
            strokeWidth="1.8"
          />
          <text x="328" y="42">
            Human review
          </text>
          <text className="svg-sub" x="328" y="58">
            Checked and approved
          </text>
        </g>
        <g className="graphic-publish">
          <rect
            x="281"
            y="148"
            width="144"
            height="66"
            rx="10"
            fill="#f2e7de"
          />
          <circle cx="305" cy="179" r="13" fill="#ead4c3" />
          <path
            d="M299 179h12m-5-5 5 5-5 5"
            fill="none"
            stroke="#986648"
            strokeWidth="1.6"
          />
          <text x="328" y="175">
            Put into practice
          </text>
          <text className="svg-sub" x="328" y="191">
            One current version
          </text>
        </g>
        <circle cx="222" cy="115" r="7" fill="#f7f7f2" stroke="#96a28a" />
        <circle cx="222" cy="115" r="2" fill="#6f845f" />
      </svg>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [page, setPage] = useState("overview"),
    [detail, setDetail] = useState(null),
    [mode, setMode] = useState("read"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [config, setConfig] = useState({});
  const [activeWorkspace, setActiveWorkspace] = useState(
    new URLSearchParams(location.search).get("workspace") ||
      sessionStorage.getItem("sopeasy_workspace") ||
      "",
  );
  const wid = data?.workspace?.id;
  const member = data?.workspace?.member;
  const isAdmin = ["Owner", "Admin"].includes(member?.role);
  const isAuthor = member?.role !== "Reader";
  const dirtyGuard = useRef(() => true);
  const navigationRef = useRef(null);
  useEffect(() => {
    if (!mobile) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    navigationRef.current?.querySelector("button")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [mobile]);
  useEffect(() => {
    request("/api/config")
      .then(async (settings) => {
        setConfig(settings);
        if (settings.review) {
          // Keep the selected sample role across refreshes; open directly as owner
          // only when this browser has no active review session.
          try {
            await request("/api/bootstrap");
          } catch (e) {
            if (e.status !== 401) throw e;
            const opened = await request("/api/auth/review", {});
            sessionStorage.removeItem("sopeasy_workspace");
            setActiveWorkspace(opened.workspace);
            await refresh(opened.workspace);
            return;
          }
        }
        await refresh();
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);
  useEffect(() => {
    const create = () => setModal({ type: "newWorkspace" });
    document.addEventListener("new-workspace", create);
    return () => document.removeEventListener("new-workspace", create);
  }, []);
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("invite");
    if (!data?.workspace || !token) return;
    request("/api/invitation/" + token)
      .then((i) => setModal({ type: "acceptInvite", token, ...i }))
      .catch((e) => {
        notify(e.message);
        history.replaceState(null, "", "/");
      });
  }, [data?.workspace?.id]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (data?.workspace) setModal({ type: "search" });
      }
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [data]);
  async function refresh(selected = activeWorkspace) {
    try {
      const d = await request(
        `/api/bootstrap${selected ? "?workspace=" + selected : ""}`,
      );
      setData(d);
      setError("");
      setConfig(d.config || config);
      return d;
    } catch (e) {
      if (e.status === 401) setData(null);
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  function notify(message) {
    setToast(message);
  }
  async function run(fn, message) {
    try {
      const result = await fn();
      if (message) notify(message);
      return result;
    } catch (e) {
      notify(e.message);
      throw e;
    }
  }
  async function openDoc(id, nextMode) {
    if (!dirtyGuard.current()) return;
    try {
      const d = await request(`/api/w/${wid}/docs/${id}`);
      setDetail(d);
      setMode(
        nextMode ||
          (d.doc.candidate && (isAdmin || d.doc.owner === member.id)
            ? ["In review", "Approved"].includes(d.doc.candidate.status)
              ? "preview"
              : "edit"
            : "read"),
      );
      setPage("document");
      setMobile(false);
      history.replaceState(null, "", `?workspace=${wid}&document=${id}`);
    } catch (e) {
      notify(e.message);
    }
  }
  function navigate(p) {
    if (!dirtyGuard.current()) return;
    setPage(p);
    setDetail(null);
    setMobile(false);
    history.replaceState(null, "", "/");
  }
  useEffect(() => {
    if (data?.workspace && !detail) {
      const id = new URLSearchParams(location.search).get("document");
      if (id)
        openDoc(
          id,
          data.documents.find((d) => d.id === id)?.current ? "read" : undefined,
        );
    }
  }, [data?.workspace?.id]);
  async function switchWorkspace(id) {
    if (!dirtyGuard.current()) return;
    sessionStorage.setItem("sopeasy_workspace", id);
    setActiveWorkspace(id);
    setDetail(null);
    setPage("overview");
    await refresh(id);
  }
  async function action(docId, body, message) {
    const result = await run(
      () => request(`/api/w/${wid}/docs/${docId}/action`, body),
      message,
    );
    await refresh();
    const d = await request(`/api/w/${wid}/docs/${docId}`);
    setDetail(d);
    return result;
  }
  if (loading)
    return (
      <div className="initial-loader">
        <Logo />
        <CircleNotch className="spin" size={26} />
      </div>
    );
  if (!data && !Object.hasOwn(config, "demo") && error)
    return (
      <div className="recovery">
        <Logo />
        <h1>SOPEasy is waking up.</h1>
        <p>The review server may need a moment to start. Please try again.</p>
        <Button onClick={() => location.reload()}>Try again</Button>
      </div>
    );
  if (!data && config.review)
    return (
      <div className="recovery">
        <Logo />
        <h1>Open your review sandbox.</h1>
        <p>
          Your review session may have expired. You can start again without
          signing in.
        </p>
        {error && <p role="alert">{error}</p>}
        <Button
          onClick={async () => {
            try {
              const opened = await request("/api/auth/review", {});
              sessionStorage.removeItem("sopeasy_workspace");
              setActiveWorkspace(opened.workspace);
              history.replaceState(null, "", "/");
              await refresh(opened.workspace);
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Open sandbox
        </Button>
      </div>
    );
  if (!data)
    return <Auth config={config} onSuccess={() => refresh()} error={error} />;
  if (!data.workspace)
    if (config.review)
      return (
        <div className="recovery">
          <Logo />
          <h1>Your sample workspace needs a fresh start.</h1>
          <p>
            Use a new sandbox to continue the review without creating an
            account.
          </p>
          <Button
            onClick={async () => {
              await request("/api/auth/review-reset", {});
              sessionStorage.removeItem("sopeasy_workspace");
              history.replaceState(null, "", "/");
              location.reload();
            }}
          >
            Open a fresh sandbox
          </Button>
        </div>
      );
  if (!data.workspace)
    return (
      <Onboarding user={data.user} onCreated={(id) => switchWorkspace(id)} />
    );
  if (data.disabled)
    return (
      <div className="recovery">
        <Logo />
        <h1>This workspace is pending deletion.</h1>
        <p>
          Content access is disabled. Recovery is available until{" "}
          {dates(data.workspace.deletion, undefined, data.workspace.timezone)}.
        </p>
        {member.role === "Owner" && (
          <Button
            onClick={() =>
              run(
                () => request(`/api/w/${wid}/recovery`, {}),
                "Workspace restored",
              ).then(() => refresh())
            }
          >
            Cancel deletion
          </Button>
        )}
        <Button
          kind="secondary"
          onClick={() =>
            request("/api/auth/logout", {}).then(() => setData(null))
          }
        >
          Sign out
        </Button>
      </div>
    );
  const nav = [
    ["overview", "Home", House],
    ["library", "Procedures", Files],
    ["tasks", "My tasks", ListChecks],
    ...(isAuthor ? [["reviews", "Reviews", CheckCircle]] : []),
  ];
  const moreNav = [
    ...(isAuthor ? [["templates", "Templates", SquaresFour]] : []),
    ["team", "People", UsersThree],
    ["activity", "Activity", Clock],
    ...(isAdmin ? [["settings", "Settings", GearSix]] : []),
  ];
  const unread = data.notifications.filter((n) => !n.read).length;
  const pending = data.tasks.filter(
    (a) => a.member === member.id && a.status === "Pending",
  ).length;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to workspace content
      </a>
      <aside
        ref={navigationRef}
        className={`sidebar ${mobile ? "open" : ""}`}
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile ? true : undefined}
        aria-label={mobile ? "Workspace navigation" : undefined}
        onKeyDown={(e) => {
          if (!mobile || e.key !== "Tab") return;
          const controls = [
            ...e.currentTarget.querySelectorAll(
              "button:not(:disabled), a[href], summary",
            ),
          ].filter((element) => element.getClientRects().length);
          const first = controls[0],
            last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
          if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button navigation-close"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={21} />
          </button>
        </div>
        <button
          className="workspace-switch"
          onClick={() => setModal({ type: "workspace" })}
        >
          {data.workspace.logo ? (
            <img src={data.workspace.logo} alt="Workspace logo" />
          ) : (
            <span className="workspace-monogram">
              {initials(data.workspace.name)}
            </span>
          )}
          <span>
            {data.workspace.name}
            <small>{member.role} workspace</small>
          </span>
          <CaretDown size={14} />
        </button>
        <nav aria-label="Main navigation">
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              aria-current={page === key ? "page" : undefined}
              onClick={() => navigate(key)}
            >
              <Icon size={20} weight={page === key ? "duotone" : "regular"} />
              <span>{label}</span>
              {key === "tasks" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
              {key === "reviews" &&
                (data.summary?.reviews ??
                  data.documents.filter(
                    (d) => d.reviewer === member.id && d.status === "In review",
                  ).length) > 0 && <i className="nav-dot" />}
            </button>
          ))}
          <details className="nav-more">
            <summary>More</summary>
            {moreNav.map(([key, label, Icon]) => (
              <button
                key={key}
                className={page === key ? "active" : ""}
                aria-current={page === key ? "page" : undefined}
                onClick={() => navigate(key)}
              >
                <Icon size={20} weight={page === key ? "duotone" : "regular"} />
                <span>{label}</span>
              </button>
            ))}
          </details>
        </nav>
        <div className="sidebar-bottom">
          <button
            className="profile"
            onClick={() => setModal({ type: "account" })}
          >
            <Avatar name={data.user.name} />
            <span>
              {data.user.name}
              <small>{member.role}</small>
            </span>
            <DotsThree size={20} />
          </button>
        </div>
      </aside>
      {mobile && (
        <div
          className="nav-scrim"
          aria-hidden="true"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell" inert={mobile ? true : undefined}>
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobile(!mobile)}
            aria-label="Open navigation"
            aria-expanded={mobile}
          >
            <List size={22} />
          </button>
          <div className="breadcrumbs">
            <span>{data.workspace.name}</span>
            <CaretRight size={12} />
            <strong>
              {page === "document"
                ? detail?.doc.title
                : [...nav, ...moreNav].find((x) => x[0] === page)?.[1] ||
                  "Home"}
            </strong>
          </div>
          <div className="top-actions">
            <button
              className="search-trigger"
              aria-label="Search your workspace"
              onClick={() => setModal({ type: "search" })}
            >
              <MagnifyingGlass size={18} />
              <span>Search your workspace</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button notification-button"
              aria-label={`Notifications, ${unread} unread`}
              onClick={() => setModal({ type: "notifications" })}
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </button>
            <Avatar name={data.user.name} size={30} />
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={`main-content ${page === "document" ? "document-main" : ""}`}
        >
          {config.demo &&
            (config.review || data.documents.some((d) => d.demo)) && (
              <div className="demo-strip">
                <span>
                  <i />
                  {config.review
                    ? "Review sandbox · use sample data only · resets after 3 days"
                    : "Demonstration workspace · fictional people and procedures"}
                </span>
                <button onClick={() => setModal({ type: "account" })}>
                  Switch demo role <ArrowRight size={12} />
                </button>
              </div>
            )}
          {page === "overview" && (
            <Overview
              data={data}
              openDoc={openDoc}
              navigate={navigate}
              onCreate={() => setModal({ type: "create" })}
            />
          )}
          {page === "library" && (
            <Library
              data={data}
              openDoc={openDoc}
              onCreate={() => setModal({ type: "create" })}
            />
          )}
          {page === "templates" && (
            <Templates
              templates={data.templates}
              choose={(template) => setModal({ type: "create", template })}
            />
          )}
          {page === "tasks" && <Tasks data={data} openDoc={openDoc} />}
          {page === "reviews" && <Reviews data={data} openDoc={openDoc} />}
          {page === "activity" && <Activity data={data} openDoc={openDoc} />}
          {page === "team" && (
            <Team
              data={data}
              isAdmin={isAdmin}
              invite={() => setModal({ type: "invite" })}
              run={run}
              refresh={refresh}
            />
          )}
          {page === "settings" && (
            <Settings
              data={data}
              run={run}
              refresh={refresh}
              onDelete={() => setModal({ type: "delete" })}
            />
          )}
          {page === "document" && detail && (
            <Document
              key={`${data.workspace.id}:${detail.doc.id}`}
              detail={detail}
              data={data}
              mode={mode}
              setMode={setMode}
              dirtyGuard={dirtyGuard}
              openDoc={openDoc}
              action={action}
              notify={notify}
              refresh={refresh}
              setDetail={setDetail}
              setModal={setModal}
              navigate={navigate}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>SOPEasy</span>
          <span>
            <ShieldCheck size={13} />
            Your team’s knowledge, in good hands.
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modals
          modal={modal}
          close={() => setModal(null)}
          data={data}
          config={config}
          detail={detail}
          action={action}
          run={run}
          refresh={refresh}
          openDoc={openDoc}
          notify={notify}
          switchWorkspace={switchWorkspace}
          setData={setData}
        />
      )}
    </div>
  );
}

function Auth({ config, onSuccess, error: outerError }) {
  const query = new URLSearchParams(location.search);
  const [tab, setTab] = useState(query.has("reset") ? "reset" : "login"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(outerError),
    [result, setResult] = useState(null);
  const verify = query.get("verify");
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = Object.fromEntries(new FormData(e.currentTarget));
      if (query.has("invite")) form.invite = query.get("invite");
      let result;
      if (tab === "verify")
        result = await request("/api/auth/verify", { token: verify });
      else if (tab === "reset")
        result = await request("/api/auth/reset", {
          token: query.get("reset"),
          password: form.password,
        });
      else result = await request(`/api/auth/${tab}`, form);
      if (tab === "login" || tab === "verify") {
        query.delete("verify");
        query.delete("reset");
        history.replaceState(
          null,
          "",
          query.size ? "?" + query.toString() : "/",
        );
        onSuccess();
      } else {
        setResult(result);
        if (tab === "reset") setTab("login");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function demo(email) {
    setBusy(true);
    try {
      await request("/api/auth/demo", { email });
      onSuccess();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (verify) setTab("verify");
  }, []);
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Logo />
        <div className="auth-story-content">
          <h1>
            Your team’s knowledge.
            <br />
            <em>Put into practice.</em>
          </h1>
          <p>
            Turn the way you work into clear procedures.
            <br />
            Reviewed by people. Ready for your team.
          </p>
          <ProcessGraphic />
          <div className="auth-features">
            <span>
              <PencilSimple size={17} />
              Thoughtful drafts
            </span>
            <span>
              <CheckCircle size={17} />
              Human approval
            </span>
            <span>
              <GitBranch size={17} />A living library
            </span>
          </div>
        </div>
      </section>
      <section className="auth-form-section">
        <div className="auth-form">
          <span className="auth-logo-mobile">
            <Logo />
          </span>
          <h2>
            {tab === "login"
              ? "Welcome back."
              : tab === "register"
                ? "Make room for clarity."
                : tab === "verify"
                  ? "Verify your email."
                  : tab === "reset"
                    ? "Choose a new password."
                    : "Let’s get you back in."}
          </h2>
          <p>
            {tab === "login"
              ? "Sign in to your team’s workspace."
              : tab === "register"
                ? "Create your account, then set up your workspace."
                : tab === "verify"
                  ? "Confirm the email link to finish creating your account."
                  : "Recover access to your SOPEasy account."}
          </p>
          <form onSubmit={send}>
            {tab === "register" && (
              <Field label="Full name">
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </Field>
            )}
            {!["verify", "reset"].includes(tab) && (
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                />
              </Field>
            )}
            {["login", "register", "reset"].includes(tab) && (
              <Field
                label="Password"
                hint={
                  tab !== "login" ? "Use at least 12 characters." : undefined
                }
              >
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    tab === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={tab === "login" ? 1 : 12}
                />
              </Field>
            )}
            {error && (
              <div className="inline-error" role="alert">
                <WarningCircle size={18} />
                {error}
              </div>
            )}
            {result && (
              <div className="notice">
                {result.message || "Password updated. Sign in to continue."}
                {result.developmentLink && (
                  <a href={result.developmentLink}>
                    Open local verification link <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
            )}
            <Button
              busy={busy}
              type="submit"
              kind="full"
              icon={tab === "verify" ? ShieldCheck : ArrowRight}
            >
              {tab === "login"
                ? "Sign in"
                : tab === "register"
                  ? "Create account"
                  : tab === "verify"
                    ? "Verify and continue"
                    : tab === "reset"
                      ? "Update password"
                      : "Send recovery link"}
            </Button>
          </form>
          <div className="auth-switch">
            {tab === "verify" && error && (
              <button
                onClick={() => {
                  setTab("forgot");
                  setError("");
                  setResult(null);
                }}
              >
                Recover account
              </button>
            )}
            {tab === "login" ? (
              <>
                <button
                  onClick={() => {
                    setTab("register");
                    setResult(null);
                  }}
                >
                  Create an account
                </button>
                <button
                  onClick={() => {
                    setTab("forgot");
                    setResult(null);
                  }}
                >
                  Forgot password?
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setTab("login");
                  setResult(null);
                }}
              >
                Back to sign in
              </button>
            )}
          </div>
          {config.demo && (
            <div className="demo-entry">
              <span>Try the complete workflow</span>
              <p>
                A saved workspace with fictional examples. Explore as an owner,
                reviewer, or reader.
              </p>
              <Button
                kind="secondary full"
                onClick={() => demo("maya@sopeasy.example")}
                busy={busy}
                icon={ArrowRight}
              >
                Explore the workspace
              </Button>
              <div className="demo-roles">
                <button onClick={() => demo("arjun@sopeasy.example")}>
                  Enter as reviewer
                </button>
                <button onClick={() => demo("leena@sopeasy.example")}>
                  Enter as reader
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
function Onboarding({ user, onCreated }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const invite = new URLSearchParams(location.search).get("invite");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (invite) {
        const r = await request(`/api/invitation/${invite}`, {});
        history.replaceState(null, "", "/");
        onCreated(r.workspace);
      } else {
        const r = await request(
          "/api/workspaces",
          Object.fromEntries(new FormData(e.currentTarget)),
        );
        onCreated(r.id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="onboarding">
      <Logo />
      <div className="onboarding-panel">
        <h1>
          A home for how
          <br />
          <em>your team works.</em>
        </h1>
        <p>
          Welcome, {user.name.split(" ")[0]}.{" "}
          {invite
            ? "Accept your workspace invitation."
            : "Create a workspace to start documenting your processes."}
        </p>
        <form onSubmit={submit}>
          {!invite && (
            <>
              <Field label="Workspace name">
                <input
                  name="name"
                  placeholder="Your team or organization"
                  required
                  maxLength={100}
                />
              </Field>
              <Field label="Workspace timezone">
                <select name="timezone">
                  <option>Asia/Calcutta</option>
                  <option>UTC</option>
                  <option>Europe/London</option>
                  <option>America/New_York</option>
                </select>
              </Field>
            </>
          )}
          {error && <p className="inline-error">{error}</p>}
          <Button busy={busy} type="submit" icon={ArrowRight}>
            {invite ? "Accept invitation" : "Create workspace"}
          </Button>
        </form>
        <button
          className="text-button onboarding-signout"
          onClick={() =>
            request("/api/auth/logout", {}).then(() => location.reload())
          }
        >
          Sign out and use a different account
        </button>
        <ProcessGraphic compact />
      </div>
    </div>
  );
}

function Overview({ data, openDoc, navigate, onCreate }) {
  const { documents: docs, workspace, members, tasks } = data;
  const m = workspace.member;
  const published = docs.filter((d) => d.current && !d.archived);
  const attention = docs.filter(
    (d) =>
      (d.reviewer === m.id && d.status === "In review") ||
      (d.owner === m.id &&
        ["Draft", "Changes requested", "Approved"].includes(d.status)) ||
      (d.current && d.owner === m.id && d.reviewDue < new Date().toISOString()),
  );
  const myTasks = tasks.filter(
    (a) => a.member === m.id && a.status === "Pending",
  );
  const openItems = attention.length + myTasks.length;
  return (
    <div className="page-enter simple-home">
      <div className="overview-hero">
        <div>
          <div className="greeting">
            <span className="greeting-dot" />
            Welcome back, {data.user.name.split(" ")[0]}
          </div>
          <h1>Keep your team on the same page.</h1>
          <p>
            Create a procedure, get it reviewed, and share the current version.
          </p>
          {m.role !== "Reader" ? (
            <Button icon={Plus} onClick={onCreate}>
              Create a procedure
            </Button>
          ) : (
            <Button
              icon={ListChecks}
              onClick={() => navigate(myTasks.length ? "tasks" : "library")}
            >
              {myTasks.length ? "Open my tasks" : "Browse procedures"}
            </Button>
          )}
        </div>
        <ProcessGraphic />
      </div>
      <div className="overview-grid">
        <section className="attention-panel">
          <div className="section-title">
            <h2>Continue where you left off</h2>
            <span className="small-label">{openItems} items</span>
          </div>
          {openItems === 0 ? (
            <div className="all-clear">
              <CheckCircle size={28} weight="light" />
              <div>
                <strong>You’re all caught up.</strong>
                <p>Browse your procedures or start a new one.</p>
              </div>
            </div>
          ) : (
            <div>
              {attention.slice(0, 4).map((d) => (
                <button
                  className="attention-row"
                  key={d.id}
                  onClick={() =>
                    openDoc(
                      d.id,
                      d.reviewer === m.id
                        ? "review"
                        : d.status === "Approved"
                          ? "preview"
                          : "edit",
                    )
                  }
                >
                  <span
                    className={`task-symbol ${d.status === "In review" ? "sage" : "clay"}`}
                  >
                    {d.status === "In review" ? (
                      <ShieldCheck size={20} />
                    ) : (
                      <PencilSimple size={20} />
                    )}
                  </span>
                  <span>
                    <strong>{d.title}</strong>
                    <small>
                      {d.status === "In review"
                        ? "Review this procedure"
                        : d.status === "Changes requested"
                          ? "Make requested changes"
                          : d.status === "Approved"
                            ? "Ready to publish"
                            : d.status === "Draft"
                              ? "Continue draft"
                              : "Maintenance review due"}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
              {myTasks.slice(0, 2).map((t) => {
                const d = docs.find((d) => d.id === t.doc);
                return (
                  <button
                    className="attention-row"
                    key={t.id}
                    onClick={() => openDoc(t.doc, "read")}
                  >
                    <span className="task-symbol sage">
                      <BookOpen size={20} />
                    </span>
                    <span>
                      <strong>
                        {t.title || d?.title || "Assigned procedure"}
                      </strong>
                      <small>
                        Read and acknowledge · due{" "}
                        {dates(t.deadline, undefined, workspace.timezone)}
                      </small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <section className="recent-section">
        <div className="section-title">
          <div>
            <h2>Current procedures</h2>
          </div>
          <button className="text-button" onClick={() => navigate("library")}>
            View all procedures <ArrowRight size={16} />
          </button>
        </div>
        {published.length ? (
          <div className="procedure-grid">
            {published.slice(0, 4).map((doc, i) => (
              <ProcedureCard
                key={doc.id}
                doc={doc}
                owner={members.find((m) => m.id === doc.owner)}
                index={i}
                onClick={() => openDoc(doc.id, "read")}
              />
            ))}
          </div>
        ) : (
          <Empty
            title="Make your first procedure."
            detail="Start with what you know. A reviewed draft becomes your team’s shared reference."
            action={
              m.role !== "Reader" && (
                <Button onClick={onCreate}>Create a procedure</Button>
              )
            }
          />
        )}
      </section>
    </div>
  );
}
function ProcedureCard({ doc, owner, onClick, index = 0 }) {
  return (
    <button
      className="procedure-card"
      style={{ "--index": index }}
      onClick={onClick}
    >
      <div className="card-top">
        <span className={`document-symbol color-${index % 4}`}>
          <FileText size={24} weight="light" />
        </span>
        <ArrowUpRight size={16} />
      </div>
      <div className="card-content">
        <small>{doc.category}</small>
        <h3>{doc.title}</h3>
        <p>
          {doc.stepCount} steps · Version {doc.current || "draft"}
        </p>
      </div>
      <div className="card-footer">
        <span>
          <Avatar name={owner?.name} size={23} />
          {owner?.name?.split(" ")[0] || "Owner needed"}
        </span>
        <Status value={doc.current ? "Published" : doc.status} />
      </div>
    </button>
  );
}
function PageTitle({ title, description, action }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function useDocumentPage(data, params, enabled = true, endpoint = "docs") {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const query = new URLSearchParams(params).toString();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(
      () => {
        request(`/api/w/${data.workspace.id}/${endpoint}?${query}`)
          .then((response) => {
            if (active) setResult(response);
          })
          .catch((failure) => {
            if (active) setError(failure.message);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      params.q ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [data, query, enabled, endpoint, retry]);
  return { result, loading, error, retry: () => setRetry((n) => n + 1) };
}
function CollectionState({ loading, error, retry }) {
  if (error)
    return (
      <div className="collection-state" role="alert">
        <WarningCircle size={20} />
        <p>{error}</p>
        <Button kind="secondary" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  if (loading)
    return (
      <div className="collection-state" role="status">
        <CircleNotch className="spin" size={20} />
        <p>Loading procedures…</p>
      </div>
    );
  return null;
}
function Pagination({ result, onPage, loading }) {
  if (!result || result.pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Procedure pages">
      <Button
        kind="secondary"
        icon={ArrowLeft}
        disabled={loading || result.page <= 1}
        onClick={() => onPage(result.page - 1)}
      >
        Previous
      </Button>
      <span role="status">
        Page {result.page} of {result.pages}
      </span>
      <Button
        kind="secondary"
        disabled={loading || result.page >= result.pages}
        onClick={() => onPage(result.page + 1)}
      >
        Next <ArrowRight size={16} />
      </Button>
    </nav>
  );
}
function Library({ data, openDoc, onCreate }) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("All procedures"),
    [category, setCategory] = useState("All categories"),
    [department, setDepartment] = useState("all"),
    [view, setView] = useState("grid"),
    [owner, setOwner] = useState("all"),
    [reviewDue, setReviewDue] = useState("all"),
    [page, setPage] = useState(1);
  const author = data.workspace.member.role !== "Reader";
  const collection = useDocumentPage(data, {
    q: query,
    status,
    category,
    department,
    owner,
    reviewDue,
    page,
    pageSize: 24,
  });
  const docs = collection.result?.documents || [];
  const changeFilter = (setter, value) => {
    setter(value);
    setPage(1);
  };
  return (
    <div className="page-enter">
      <PageTitle
        title="The procedure library."
        description="A shared reference for the way your team works."
        action={
          author && (
            <Button icon={Plus} onClick={onCreate}>
              Create procedure
            </Button>
          )
        }
      />
      <div className="library-tabs">
        {[
          "All procedures",
          "Published",
          ...(author ? ["My drafts", "In review", "Archived"] : []),
        ].map((x) => (
          <button
            className={status === x ? "active" : ""}
            aria-pressed={status === x}
            key={x}
            onClick={() => changeFilter(setStatus, x)}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="library-toolbar">
        <div className="search-field">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Search procedures and content"
            value={query}
            onChange={(e) => changeFilter(setQuery, e.target.value)}
            placeholder="Search procedures and their content…"
          />
        </div>
        <details className="library-options">
          <summary>Filters and view</summary>
          <div className="library-options-fields">
            <select
              aria-label="Category filter"
              value={category}
              onChange={(e) => changeFilter(setCategory, e.target.value)}
            >
              <option>All categories</option>
              {(collection.result?.categories || data.categories || []).map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
            <select
              aria-label="Department filter"
              value={department}
              onChange={(e) => changeFilter(setDepartment, e.target.value)}
            >
              <option value="all">All departments</option>
              {(collection.result?.departments || data.departments || []).map(
                (label) => (
                  <option key={label}>{label}</option>
                ),
              )}
            </select>
            <select
              aria-label="Process owner filter"
              value={owner}
              onChange={(e) => changeFilter(setOwner, e.target.value)}
            >
              <option value="all">All owners</option>
              {(collection.result?.owners || []).map((id) => (
                <option key={id} value={id}>
                  {data.members.find((m) => m.id === id)?.name ||
                    "Owner needed"}
                </option>
              ))}
            </select>
            <select
              aria-label="Maintenance review filter"
              value={reviewDue}
              onChange={(e) => changeFilter(setReviewDue, e.target.value)}
            >
              <option value="all">Any review date</option>
              <option value="due">Maintenance due</option>
            </select>
            <div className="view-toggle">
              <button
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                className={view === "grid" ? "active" : ""}
                onClick={() => setView("grid")}
              >
                <SquaresFour size={18} />
              </button>
              <button
                aria-label="List view"
                aria-pressed={view === "list"}
                className={view === "list" ? "active" : ""}
                onClick={() => setView("list")}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </details>
      </div>
      <div className="results-caption">
        {collection.result?.total || 0} procedure
        {collection.result?.total !== 1 ? "s" : ""}
      </div>
      <CollectionState {...collection} />
      {!collection.loading &&
        !collection.error &&
        (!docs.length ? (
          <Empty
            title="No procedures here yet."
            detail={
              query ||
              category !== "All categories" ||
              department !== "all" ||
              owner !== "all" ||
              reviewDue !== "all"
                ? "Try a different search or filter."
                : author
                  ? "Create a draft and invite someone to review it."
                  : "Your team’s published procedures will appear here."
            }
            action={
              author && <Button onClick={onCreate}>Start a procedure</Button>
            }
          />
        ) : view === "grid" ? (
          <div className="procedure-grid library-grid">
            {docs.map((d, i) => (
              <ProcedureCard
                key={d.id}
                doc={d}
                owner={data.members.find((m) => m.id === d.owner)}
                index={i}
                onClick={() => openDoc(d.id)}
              />
            ))}
          </div>
        ) : (
          <div className="document-list">
            {docs.map((d) => (
              <button
                key={d.id}
                className="document-row"
                onClick={() => openDoc(d.id)}
              >
                <FileText size={23} weight="light" />
                <span>
                  <strong>{d.title}</strong>
                  <small>
                    {d.category} ·{" "}
                    {data.members.find((m) => m.id === d.owner)?.name}
                  </small>
                </span>
                <Status value={d.status} />
                <span className="row-date">
                  {dates(d.updated, undefined, data.workspace.timezone)}
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        ))}
      <Pagination
        result={collection.result}
        onPage={setPage}
        loading={collection.loading}
      />
    </div>
  );
}
function Templates({ templates, choose }) {
  return (
    <div className="page-enter">
      <PageTitle
        title="A thoughtful starting point."
        description="Bring your own process. We’ll help with the structure."
      />
      <div className="templates-grid">
        {templates.map((t, i) => {
          const Icon = icons[t.icon];
          return (
            <button
              className={`template-card ${t.color}`}
              key={t.id}
              onClick={() => choose(t)}
            >
              <div className="template-art">
                <Icon size={65} weight="thin" />
                <svg viewBox="0 0 120 70" aria-hidden="true">
                  <path
                    d="M15 20h65m-65 12h90m-90 12h73m-73 12h54"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                </svg>
              </div>
              <div>
                <small>{t.category}</small>
                <h2>{t.name}</h2>
                <p>{t.description}</p>
                <span>
                  Use this template <ArrowUpRight size={17} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="templates-footnote">
        <ShieldCheck size={17} />
        Templates provide a structure. Your team supplies and approves the
        instructions.
      </p>
    </div>
  );
}
function Tasks({ data, openDoc }) {
  const [tab, setTab] = useState("Pending");
  const mine = data.tasks.filter((a) => a.member === data.workspace.member.id);
  const tasks = mine.filter((a) =>
    tab === "Pending" ? a.status === "Pending" : a.status === "Acknowledged",
  );
  return (
    <div className="page-enter">
      <PageTitle
        title="A clear next step."
        description="Read the current procedures and record your acknowledgement."
      />
      <div className="library-tabs">
        {["Pending", "Acknowledged"].map((x) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x}
            <span>
              {
                mine.filter(
                  (a) =>
                    a.status === (x === "Pending" ? "Pending" : "Acknowledged"),
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      {tasks.length ? (
        <div className="document-list">
          {tasks.map((t) => {
            const d = data.documents.find((d) => d.id === t.doc);
            const overdue =
              t.status === "Pending" && Date.parse(t.deadline) < Date.now();
            return (
              <button
                className="document-row"
                key={t.id}
                onClick={() => openDoc(t.doc, "read")}
              >
                <span className={`task-symbol ${overdue ? "clay" : "sage"}`}>
                  <BookOpen size={23} />
                </span>
                <span>
                  <strong>
                    {t.title || d?.title || "Procedure unavailable"}
                  </strong>
                  <small>
                    Version {t.version} ·{" "}
                    {t.receipt
                      ? `Acknowledged ${dates(t.receipt.time, undefined, data.workspace.timezone)}`
                      : `Due ${dates(t.deadline, undefined, data.workspace.timezone)}`}
                  </small>
                </span>
                <Status value={overdue ? "Overdue" : t.status} />
                <ArrowUpRight size={17} />
              </button>
            );
          })}
        </div>
      ) : (
        <Empty
          title={
            tab === "Pending"
              ? "You’re all caught up."
              : "Your receipts will appear here."
          }
          detail={
            tab === "Pending"
              ? "New reading tasks will appear when your team assigns them."
              : "Acknowledge a current procedure to record your first receipt."
          }
          icon={CheckCircle}
        />
      )}
    </div>
  );
}
function Reviews({ data, openDoc }) {
  const [page, setPage] = useState(1);
  const collection = useDocumentPage(data, {
    view: "reviews",
    page,
    pageSize: 20,
  });
  const docs = collection.result?.documents || [];
  return (
    <div className="page-enter">
      <PageTitle
        title="Good work deserves a second look."
        description="Check the instructions against the source notes before approving."
      />
      <CollectionState {...collection} />
      {!collection.loading &&
        !collection.error &&
        (docs.length ? (
          <div className="document-list">
            {docs.map((d) => (
              <button
                className="document-row"
                key={d.id}
                onClick={() => openDoc(d.id, "review")}
              >
                <span className="task-symbol sage">
                  <ShieldCheck size={24} />
                </span>
                <span>
                  <strong>{d.title}</strong>
                  <small>
                    {data.members.find((m) => m.id === d.owner)?.name} ·{" "}
                    {d.category}
                  </small>
                </span>
                <Status value="In review" />
                <span className="text-link">
                  Review procedure <ArrowRight size={15} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title="No reviews waiting."
            detail="Procedures assigned to you for review will appear here."
            icon={ShieldCheck}
          />
        ))}
      <Pagination
        result={collection.result}
        onPage={setPage}
        loading={collection.loading}
      />
    </div>
  );
}
function Activity({ data, openDoc }) {
  return (
    <div className="page-enter">
      <PageTitle
        title="The story of your workspace."
        description="A record of decisions, publications, and people putting knowledge to work."
      />
      <div className="activity-list">
        {data.audit.map((e, i) => (
          <div className="activity-item" key={e.id}>
            <Avatar name={e.actor} index={i} />
            <div>
              <p>
                <strong>{e.actor}</strong> {e.action.toLowerCase()}
                {e.version ? ` · version ${e.version}` : ""}
              </p>
              {(e.documentTarget ||
                data.documents.find((d) => d.id === e.target)) && (
                <button onClick={() => openDoc(e.target)}>
                  {e.targetTitle ||
                    data.documents.find((d) => d.id === e.target)?.title}
                  <ArrowUpRight size={13} />
                </button>
              )}
              <small>
                {new Date(e.time).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: data.workspace.timezone,
                })}
              </small>
            </div>
          </div>
        ))}
      </div>
      {!data.audit.length && (
        <Empty
          title="Your workspace story starts here."
          detail="New actions will appear as you work."
          icon={Clock}
        />
      )}
    </div>
  );
}

function Team({ data, isAdmin, invite, run, refresh }) {
  const [invites, setInvites] = useState([]),
    [busy, setBusy] = useState("");
  const base = `/api/w/${data.workspace.id}`;
  function load() {
    if (isAdmin)
      request(base + "/invites")
        .then(setInvites)
        .catch(() => {});
  }
  useEffect(load, [data.workspace.id]);
  async function update(m, body) {
    if (
      body.active === false &&
      !confirm(
        `Deactivate ${m.name}? Pending reading tasks will be cancelled and review approvals invalidated.`,
      )
    )
      return;
    setBusy(m.id);
    try {
      await run(
        () => request(base + "/members/" + m.id, body),
        "Member updated",
      );
      await refresh();
    } catch {
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="page-enter">
      <PageTitle
        title="Clarity is a team effort."
        description="The people who write, review, and put your procedures into practice."
        action={
          isAdmin && (
            <Button icon={Plus} onClick={invite}>
              Invite a teammate
            </Button>
          )
        }
      />
      <div className="people-list">
        <div className="people-header">
          <span>Person</span>
          <span>Workspace role</span>
          <span>Status</span>
        </div>
        {data.members.map((m, i) => (
          <div className="person-row" key={m.id}>
            <div className="person-identity">
              <Avatar name={m.name} size={40} index={i} />
              <div>
                <strong>
                  {m.name}
                  {m.id === data.workspace.member.id && <small> · you</small>}
                </strong>
                {m.email && <p>{m.email}</p>}
              </div>
            </div>
            <div>
              {isAdmin &&
              m.role !== "Owner" &&
              (m.role !== "Admin" || data.workspace.member.role === "Owner") ? (
                <select
                  aria-label={`Role for ${m.name}`}
                  value={m.role}
                  disabled={busy === m.id}
                  onChange={(e) => update(m, { role: e.target.value })}
                >
                  <option>Reader</option>
                  <option>Author</option>
                  {data.workspace.member.role === "Owner" && (
                    <option>Admin</option>
                  )}
                </select>
              ) : (
                <span>{m.role}</span>
              )}
            </div>
            <div>
              <Status value={m.active ? "Active" : "Inactive"} />
              {isAdmin &&
                m.role !== "Owner" &&
                (m.role !== "Admin" ||
                  data.workspace.member.role === "Owner") && (
                  <button
                    className="text-button"
                    disabled={busy === m.id}
                    onClick={() => update(m, { active: !m.active })}
                  >
                    {m.active ? "Deactivate" : "Reactivate"}
                  </button>
                )}
            </div>
          </div>
        ))}
      </div>
      <div className="role-explainer">
        <h2>A place for every contribution.</h2>
        <div>
          <p>
            <strong>Authors</strong> write procedures and review work they
            haven’t edited.
          </p>
          <p>
            <strong>Readers</strong> use the published library and acknowledge
            assigned versions.
          </p>
          <p>
            <strong>Administrators</strong> manage people, ownership, and
            workspace settings.
          </p>
        </div>
      </div>
      {isAdmin &&
        invites.filter((i) => !i.revoked && !i.accepted).length > 0 && (
          <section className="pending-invites">
            <h2>Pending invitations</h2>
            {invites
              .filter((i) => !i.revoked && !i.accepted)
              .map((i) => (
                <div className="invite-row" key={i.id}>
                  <span>
                    <strong>{i.email}</strong>
                    <small>
                      {i.role} ·{" "}
                      {Date.parse(i.expires) < Date.now()
                        ? "Expired"
                        : "Expires " +
                          dates(i.expires, undefined, data.workspace.timezone)}
                    </small>
                  </span>
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await run(
                          () =>
                            request(base + "/invites/" + i.id + "/revoke", {}),
                          "Invitation revoked",
                        );
                        load();
                      } catch {}
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
          </section>
        )}
    </div>
  );
}
function Settings({ data, run, refresh, onDelete }) {
  const w = data.workspace,
    base = `/api/w/${w.id}`;
  const [logo, setLogo] = useState(w.logo),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await run(
        () =>
          request(base + "/settings", {
            ...Object.fromEntries(new FormData(e.currentTarget)),
            logo,
          }),
        "Workspace settings saved",
      );
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function upload(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2097152 || !["image/png", "image/jpeg"].includes(f.type)) {
      setError("Choose a PNG or JPEG up to 2 MB.");
      return;
    }
    const r = new FileReader();
    r.onload = () => setLogo(r.result);
    r.readAsDataURL(f);
  }
  return (
    <div className="page-enter settings-page">
      <PageTitle
        title="Make this space yours."
        description="Workspace identity, preferences, and the controls that keep it running."
      />
      <form className="settings-section" onSubmit={submit}>
        <div>
          <h2>Workspace identity</h2>
          <p>A familiar home for your team’s knowledge.</p>
        </div>
        <div>
          <div className="logo-upload">
            {logo ? (
              <img src={logo} alt="Workspace logo preview" />
            ) : (
              <span className="workspace-monogram">{initials(w.name)}</span>
            )}
            <label className="button secondary">
              <UploadSimple size={17} />
              Upload logo
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={upload}
              />
            </label>
            {logo && (
              <button
                className="text-button"
                type="button"
                onClick={() => setLogo(null)}
              >
                Remove
              </button>
            )}
          </div>
          <Field label="Workspace name">
            <input name="name" defaultValue={w.name} required maxLength={100} />
          </Field>
          <Field
            label="Workspace timezone"
            hint="Acknowledgement deadlines end at 23:59 in this timezone."
          >
            <input
              name="timezone"
              defaultValue={w.timezone}
              required
              list="timezones"
            />
            <datalist id="timezones">
              <option>Asia/Calcutta</option>
              <option>UTC</option>
              <option>Europe/London</option>
              <option>America/New_York</option>
            </datalist>
          </Field>
          {error && <p className="inline-error">{error}</p>}
          <Button busy={busy} icon={Check} type="submit">
            Save preferences
          </Button>
        </div>
      </form>
      <section className="settings-section">
        <div>
          <h2>Your workspace data</h2>
          <p>Take a copy of your procedures and reading records.</p>
        </div>
        <div className="export-actions">
          <a className="button secondary" href={base + "/export.json"} download>
            <DownloadSimple size={17} />
            Export workspace data
          </a>
          <a className="button secondary" href={base + "/reports.csv"} download>
            <DownloadSimple size={17} />
            Acknowledgement report
          </a>
          <p>
            Workspace exports include procedures, sources, version history,
            receipts, and audit records. Keep these files with your
            organization’s internal documents.
          </p>
        </div>
      </section>
      {w.member.role === "Owner" && (
        <>
          <section className="settings-section">
            <div>
              <h2>Workspace ownership</h2>
              <p>Transfer the owner role to another active teammate.</p>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const owner = new FormData(e.currentTarget).get("owner");
                if (
                  !confirm(
                    "Transfer workspace ownership? You will become an administrator.",
                  )
                )
                  return;
                try {
                  await run(
                    () => request(base + "/settings", { owner }),
                    "Ownership transferred",
                  );
                  await refresh();
                } catch {}
              }}
            >
              <Field label="New workspace owner">
                <select name="owner" required defaultValue="">
                  <option value="" disabled>
                    Select a teammate
                  </option>
                  {data.members
                    .filter((m) => m.active && m.id !== w.member.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Button kind="secondary" type="submit">
                Transfer ownership
              </Button>
            </form>
          </section>
          <section className="settings-section danger-section">
            <div>
              <h2>Delete workspace</h2>
              <p>
                Disable this workspace, then permanently remove it after seven
                days.
              </p>
            </div>
            <div>
              <p>
                The owner can cancel deletion during the seven-day recovery
                window. Backups expire within 30 days.
              </p>
              <Button kind="danger secondary" icon={Trash} onClick={onDelete}>
                Request deletion
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const contentFields = [
  ["purpose", "Purpose"],
  ["scope", "Scope"],
  ["responsibilities", "Responsibilities"],
  ["prerequisites", "Before you begin"],
  ["exceptions", "Exceptions & escalation"],
  ["completion", "Completion checks"],
];
function RichText({ text }) {
  const lines = String(text || "").split("\n"),
    nodes = [];
  const inline = (line) =>
    line
      .split(/(\*\*.*?\*\*|\*[^*]+\*)/g)
      .map((p, j) =>
        p.startsWith("**") ? (
          <strong key={j}>{p.slice(2, -2)}</strong>
        ) : p.startsWith("*") ? (
          <em key={j}>{p.slice(1, -1)}</em>
        ) : (
          p
        ),
      );
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.includes("|") &&
      /^[\s|:\-]+$/.test(lines[i + 1] || "") &&
      (lines[i + 1] || "").includes("-")
    ) {
      const cells = (s) =>
        s
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(line),
        rows = [];
      i += 2;
      for (; i < lines.length && lines[i].includes("|"); i++)
        rows.push(cells(lines[i]));
      i--;
      nodes.push(
        <div
          className="simple-table-wrap"
          key={i}
          tabIndex={0}
          role="region"
          aria-label="Procedure table"
        >
          <table>
            <thead>
              <tr>
                {head.map((c, j) => (
                  <th key={j}>{inline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, k) => (
                <tr key={k}>
                  {head.map((_, j) => (
                    <td key={j}>{inline(r[j] || "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (/^\s*[-•]\s/.test(line)) {
      const items = [];
      for (; i < lines.length && /^\s*[-•]\s/.test(lines[i]); i++)
        items.push(lines[i].replace(/^\s*[-•]\s/, ""));
      i--;
      nodes.push(
        <ul key={i}>
          {items.map((s, j) => (
            <li key={j}>{inline(s)}</li>
          ))}
        </ul>,
      );
    } else nodes.push(<p key={i}>{inline(line)}</p>);
  }
  return <div className="rich-text">{nodes}</div>;
}
function sectionLabel(field = "") {
  const [group, index, part] = String(field)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".");
  const label =
    contentFields.find(([key]) => key === group)?.[1] ||
    { steps: "The procedure", checklist: "At a glance", gaps: "Open question" }[
      group
    ] ||
    field;
  if (index === undefined) return label;
  return `${group === "steps" ? "Step" : group === "checklist" ? "Checklist item" : "Question"} ${Number(index) + 1}${part ? ` · ${part}` : ""}`;
}
function SourceMap({ sources, refs = [], summary = "Source reference map" }) {
  const blocks = String(sources || "")
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
  return (
    <details className="source-map">
      <summary>{summary}</summary>
      {blocks.map((s, i) => (
        <p key={i}>
          <strong>S{i + 1}</strong>
          {s}
        </p>
      ))}
      {refs.length > 0 && (
        <div className="reference-links">
          {refs.map((r, i) => (
            <p key={i}>
              {sectionLabel(r.field)}: {r.sourceIds?.join(", ")}
            </p>
          ))}
        </div>
      )}
    </details>
  );
}
function CapturePrompts({ template }) {
  const hints = {
    onboarding: [
      "Who is joining, and which teams are involved?",
      "What happens before arrival, on day one, and during the first week?",
      "Who confirms that onboarding is complete?",
    ],
    equipment: [
      "Who can request equipment, and which details are needed?",
      "Who approves, issues, and records the equipment?",
      "How are missing equipment or access issues handled?",
    ],
    leave: [
      "Which employees and leave requests are covered?",
      "How does a request reach the approving manager?",
      "How is the decision recorded and communicated?",
    ],
    general: [
      "Who uses this process, and when?",
      "What happens first, next, and last?",
      "How does the team know the work is complete?",
    ],
  };
  const prompts = hints[template] || hints.general;
  return (
    <details className="capture-prompts">
      <summary>Prefer a little guidance?</summary>
      <p>
        Fill in what you know. Your answers become source notes; leave unknown
        details blank.
      </p>
      {[
        ["audience", "Intended audience", prompts[0]],
        ["purpose", "Purpose", "Why does this process exist?"],
        ["scope", "Scope", "What is included, and where does it stop?"],
        [
          "prerequisites",
          "Prerequisites",
          "What information or tools must be ready?",
        ],
        ["steps", "Known steps", prompts[1]],
        ["roles", "Responsible roles", "Who does each part of the work?"],
        [
          "exceptions",
          "Exceptions",
          "What happens if the normal process cannot be followed?",
        ],
        ["completion", "Completion checks", prompts[2]],
      ].map(([k, label, hint]) => (
        <Field key={k} label={label}>
          <textarea name={"capture_" + k} rows={2} placeholder={hint} />
        </Field>
      ))}
    </details>
  );
}
function DocumentContent({
  content,
  title,
  version,
  owner,
  category,
  approval,
  section,
}) {
  return (
    <article className="reading-sheet">
      <div className="reading-eyebrow">
        <span>{category}</span>
        <span>
          {version === "Draft" ? "Working draft" : `Version ${version}`}
        </span>
      </div>
      <h1>{title}</h1>
      <div className="document-byline">
        <Avatar name={owner} size={24} />
        <span>Owned by {owner || "Reassignment needed"}</span>
        {approval && (
          <span>
            <ShieldCheck size={14} />
            Reviewed by {approval.name}
          </span>
        )}
      </div>
      {contentFields.slice(0, 4).map(
        ([key, label]) =>
          (!section || section === key) &&
          content[key] && (
            <section key={key} id={`section-${key}`}>
              <span className="section-number">
                {String(
                  contentFields.findIndex((x) => x[0] === key) + 1,
                ).padStart(2, "0")}
              </span>
              <h2>{label}</h2>
              <RichText text={content[key]} />
            </section>
          ),
      )}
      {(!section || section === "steps") && (
        <section id="section-steps">
          <span className="section-number">05</span>
          <h2>The procedure</h2>
          <div className="reading-steps">
            {content.steps.map((s, i) => (
              <div className="reading-step" key={s.id || i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{s.title || "Untitled step"}</h3>
                  {s.responsible && <small>{s.responsible}</small>}
                  <RichText text={s.body} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {contentFields.slice(4).map(
        ([key, label], i) =>
          (!section || section === key) &&
          content[key] && (
            <section key={key} id={`section-${key}`}>
              <span className="section-number">0{i + 6}</span>
              <h2>{label}</h2>
              <RichText text={content[key]} />
            </section>
          ),
      )}
      {(!section || section === "checklist") &&
        content.checklist.length > 0 && (
          <section id="section-checklist">
            <span className="section-number">08</span>
            <h2>At a glance</h2>
            <ul className="reading-checklist">
              {content.checklist.map((x, i) => (
                <li key={i}>
                  <CheckCircle size={17} />
                  {x}
                </li>
              ))}
            </ul>
          </section>
        )}
    </article>
  );
}

function Document({
  detail,
  data,
  mode,
  setMode,
  dirtyGuard,
  openDoc,
  action,
  notify,
  refresh,
  setDetail,
  navigate,
}) {
  const { doc, assignments } = detail,
    c = doc.candidate,
    m = data.workspace.member,
    manager =
      ["Owner", "Admin"].includes(m.role) ||
      (m.role === "Author" && doc.owner === m.id);
  const base = `/api/w/${data.workspace.id}/docs/${doc.id}`;
  const [form, setForm] = useState(null),
    [saveStatus, setSaveStatus] = useState("Saved"),
    [error, setError] = useState(""),
    [panel, setPanel] = useState("source"),
    [dialog, setDialog] = useState(null),
    [busy, setBusy] = useState(false),
    [restoring, setRestoring] = useState(false),
    [historical, setHistorical] = useState(null),
    [ack, setAck] = useState(false);
  const revision = useRef(c?.revision),
    baseline = useRef(""),
    local = useRef(null),
    pending = useRef(null),
    candidateId = useRef(c?.id),
    mounted = useRef(true),
    generationAttempt = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const draftRecord = (document) =>
    document.candidate
      ? {
          title: document.title,
          category: document.category,
          department: document.department || "",
          content: structuredClone(document.candidate.content),
          sources: document.candidate.sources,
          gaps: structuredClone(document.candidate.gaps),
        }
      : null;
  function reconcileSaved(current, submitted, saved) {
    const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
    const next = structuredClone(saved);
    for (const key of ["title", "category", "department", "sources"])
      if (changed(current[key], submitted[key])) next[key] = current[key];
    for (const key of Object.keys(current.content))
      if (changed(current.content[key], submitted.content[key]))
        next.content[key] = structuredClone(current.content[key]);
    // Keep new typing, while adopting linked answers and evidence returned by the server.
    next.gaps = saved.gaps.map((gap) => {
      const live = current.gaps.find((item) => item.id === gap.id);
      const sent = submitted.gaps.find((item) => item.id === gap.id);
      return live && sent && changed(live.resolution, sent.resolution)
        ? { ...gap, resolution: live.resolution }
        : gap;
    });
    return next;
  }
  useEffect(() => {
    if (local.current && candidateId.current === c?.id) {
      // A job refresh may arrive after our own save or while newer text is being typed.
      if (c.revision <= revision.current) return;
      if (JSON.stringify(local.current) !== baseline.current) {
        setSaveStatus("Save conflict");
        setError(
          "A newer revision is available. Your unsaved text is still here. Copy it before reloading.",
        );
        return;
      }
    }
    const f = draftRecord(doc);
    setForm(f);
    local.current = f;
    candidateId.current = c?.id;
    revision.current = c?.revision;
    baseline.current = JSON.stringify(f);
    setSaveStatus("Saved");
    setError("");
  }, [doc.id, c?.id, c?.revision]);
  function update(fn) {
    const f =
      typeof fn === "function"
        ? fn(local.current)
        : { ...local.current, ...fn };
    local.current = f;
    setForm(f);
    setSaveStatus(
      JSON.stringify(f) === baseline.current ? "Saved" : "Unsaved changes",
    );
    setError("");
  }
  const locked = c && ["In review", "Approved"].includes(c.status);
  const editing = mode === "edit" && manager && c && !locked && !restoring;
  async function save(checkpoint = false) {
    if (pending.current) {
      await pending.current;
      return save(checkpoint);
    }
    if (!local.current) return revision.current;
    const snapshot = structuredClone(local.current);
    if (!checkpoint && JSON.stringify(snapshot) === baseline.current)
      return revision.current;
    setSaveStatus("Saving…");
    setError("");
    const promise = request(
      base,
      { ...snapshot, revision: revision.current, checkpoint },
      "PUT",
    );
    pending.current = promise;
    try {
      const r = await promise;
      if (!mounted.current || candidateId.current !== r.doc.candidate?.id)
        return r.doc.candidate?.revision;
      revision.current = r.doc.candidate.revision;
      const saved = draftRecord(r.doc);
      const reconciled = reconcileSaved(local.current, snapshot, saved);
      local.current = reconciled;
      setForm(reconciled);
      baseline.current = JSON.stringify(saved);
      setSaveStatus(
        JSON.stringify(local.current) === baseline.current
          ? "Saved just now"
          : "Unsaved changes",
      );
      setDetail((current) =>
        current?.doc.id === doc.id ? { ...current, doc: r.doc } : current,
      );
      if (checkpoint) notify("Checkpoint saved");
      return revision.current;
    } catch (e) {
      if (mounted.current) {
        setError(e.message);
        setSaveStatus(e.status === 409 ? "Save conflict" : "Not saved");
      }
      throw e;
    } finally {
      pending.current = null;
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!editing || !form || JSON.stringify(form) === baseline.current) return;
    const t = setTimeout(() => saveRef.current().catch(() => {}), 2000);
    return () => clearTimeout(t);
  }, [form, editing]);
  useEffect(() => {
    const guard = () =>
      JSON.stringify(local.current) === baseline.current ||
      confirm(
        "There are unsaved changes. Leave this procedure? Copy your text if a save failed.",
      );
    dirtyGuard.current = guard;
    const before = (e) => {
      if (JSON.stringify(local.current) !== baseline.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => {
      dirtyGuard.current = () => true;
      window.removeEventListener("beforeunload", before);
    };
  }, [doc.id]);
  const jobs = doc.proposals.filter((p) => p.status === "Generating");
  useEffect(() => {
    if (!jobs.length) return;
    let active = true,
      polling = false;
    const t = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const d = await request(base);
        if (active) {
          setDetail((current) =>
            current?.doc.id === doc.id &&
            !(
              d.doc.candidate?.id === candidateId.current &&
              d.doc.candidate?.revision < revision.current
            )
              ? d
              : current,
          );
          setError((previous) =>
            previous.startsWith("Proposal status could not refresh.")
              ? ""
              : previous,
          );
        }
      } catch (e) {
        if (active) setError(`Proposal status could not refresh. ${e.message}`);
      } finally {
        polling = false;
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [doc.id, c?.id, jobs.length]);
  async function doAction(body, message) {
    setBusy(true);
    setError("");
    try {
      const r = await action(doc.id, body, message);
      setDialog(null);
      return r;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function generate(section) {
    const consentKey = `sopeasy-ai-consent:${data.workspace.id}:${data.user.id}:sarvam`;
    if (!sessionStorage.getItem(consentKey)) {
      if (
        !confirm(
          "Prepare a proposal with Sarvam AI? This procedure’s saved source notes, resolved question answers, title, and working content will be sent to Sarvam. Check your organization’s provider privacy requirements before sending employee information.",
        )
      )
        return;
      sessionStorage.setItem(consentKey, "1");
    }
    setBusy(true);
    try {
      const savedRevision = await save();
      if (!mounted.current) return;
      const input = {
        section: section || null,
        consent: true,
        revision: savedRevision,
        candidate: candidateId.current,
      };
      const identity = JSON.stringify(input);
      if (generationAttempt.current?.identity !== identity)
        generationAttempt.current = { identity, key: crypto.randomUUID() };
      const queued = await request(base + "/generate", {
        ...input,
        key: generationAttempt.current.key,
      });
      if (!mounted.current) return;
      setDetail((current) =>
        current?.doc.id === doc.id &&
        !current.doc.proposals.some((p) => p.id === queued.job)
          ? {
              ...current,
              doc: {
                ...current.doc,
                proposals: [
                  ...current.doc.proposals,
                  {
                    id: queued.job,
                    status: "Generating",
                    revision: savedRevision,
                    candidate: input.candidate,
                    section: input.section,
                  },
                ],
              },
            }
          : current,
      );
      setPanel("ai");
      const d = await request(base);
      if (!mounted.current) return;
      setDetail((current) => (current?.doc.id === doc.id ? d : current));
      generationAttempt.current = null;
      setPanel("ai");
      const status = d.doc.proposals.find((p) => p.id === queued.job)?.status;
      if (status === "Ready") notify("Your proposal is ready to review.");
      else if (status === "Generating")
        notify("Your proposal is being prepared. Your draft stays editable.");
    } catch (e) {
      if (e.status) generationAttempt.current = null;
      if (mounted.current) setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const v = doc.versions.find((x) => x.number === (historical || doc.current));
  const content =
    mode === "review" && c?.submission
      ? c.submission.content
      : mode === "preview" && form
        ? form.content
        : v?.content || c?.content;
  const readDraft = !v || mode === "preview" || mode === "review";
  const mine = assignments.find(
    (a) => a.member === m.id && a.version === doc.current,
  );
  const ready = doc.proposals
    .filter((p) => ["Ready", "Generating", "Failed"].includes(p.status))
    .slice(-3)
    .reverse();
  const proposalStale = (p) =>
    !c ||
    locked ||
    (data.config.aiValidatorVersion &&
      (p.output?.validatorVersion !== data.config.aiValidatorVersion ||
        p.output?.grounding?.version !== data.config.aiValidatorVersion)) ||
    p.candidate !== c.id ||
    p.revision !== revision.current ||
    JSON.stringify(local.current) !== baseline.current;
  const generationDisabled =
    busy || !!jobs.length || !data.config.ai || !form?.sources.trim();
  const sourceNotesChanged = !!c && (form?.sources ?? c.sources) !== c.sources;
  const visibleSourceRefs = c
    ? sourceNotesChanged
      ? []
      : c.sourceRefs.filter((ref) => {
          const group = ref.field.split(".")[0];
          return (
            group === "gaps" ||
            JSON.stringify(form?.content[group] ?? c.content[group]) ===
              JSON.stringify(c.content[group])
          );
        })
    : v?.sourceRefs || [];
  const inspectingCandidate = mode !== "read" && !!c;
  const inspectedSources = inspectingCandidate
    ? (form?.sources ?? c.sources)
    : v?.sources || "";
  const inspectedRefs = inspectingCandidate
    ? visibleSourceRefs
    : v?.sourceRefs || [];
  const inspectedGaps = inspectingCandidate ? c.gaps : v?.gaps || [];
  const inspectedAnswer = (gap) =>
    (inspectingCandidate
      ? form?.gaps.find((g) => g.id === gap.id)?.resolution
      : gap.resolution) || "";
  const unresolvedQuestions = (form?.gaps || c?.gaps || []).filter(
    (g) => g.blocking && !definitiveResolution(g.resolution),
  );
  const suggestSection = (section, label) =>
    editing &&
    form?.sources.trim() && (
      <button
        className="icon-button"
        aria-label={`Suggest ${label.toLowerCase()}`}
        title={
          data.config.ai
            ? `Prepare a proposal for ${label.toLowerCase()}`
            : "AI assistance is unavailable"
        }
        disabled={generationDisabled}
        onClick={() => generate(section)}
      >
        <Sparkle size={16} />
      </button>
    );
  const eligible = data.members.filter(
    (x) => x.active && x.role !== "Reader" && !c?.editors.includes(x.id),
  );
  if (!content && !form)
    return (
      <Empty
        title="This procedure is archived."
        detail="An administrator can restore it through a new reviewed revision."
        icon={Archive}
      />
    );
  return (
    <div className="document-page page-enter">
      <div className="document-toolbar">
        <div>
          <button className="document-back" onClick={() => navigate("library")}>
            <ArrowLeft size={17} />
            All procedures
          </button>
          <span>{doc.category}</span>
          <Status
            value={doc.archived ? "Archived" : c?.status || "Published"}
          />
          <span className="save-indicator" role="status" aria-live="polite">
            {editing &&
              (saveStatus === "Saved" || saveStatus === "Saved just now" ? (
                <Check size={13} />
              ) : (
                <CircleNotch
                  size={13}
                  className={saveStatus === "Saving…" ? "spin" : ""}
                />
              ))}
            {editing
              ? saveStatus
              : doc.current
                ? `Version ${doc.current}`
                : "Unpublished"}
          </span>
        </div>
        <div className="document-actions">
          {manager && c && (
            <div className="segmented">
              {["edit", "preview", ...(doc.current ? ["read"] : [])].map(
                (x) => (
                  <button
                    className={mode === x ? "active" : ""}
                    aria-pressed={mode === x}
                    key={x}
                    onClick={() => setMode(x)}
                  >
                    {x === "edit"
                      ? "Draft"
                      : x === "preview"
                        ? "Preview"
                        : "Published"}
                  </button>
                ),
              )}
            </div>
          )}
          {c?.status === "In review" && manager && (
            <Button
              kind="secondary"
              busy={busy}
              onClick={() =>
                doAction({ action: "withdraw" }, "Submission withdrawn")
                  .then(() => setMode("edit"))
                  .catch(() => {})
              }
            >
              Withdraw
            </Button>
          )}
          {manager &&
            c &&
            ["Draft", "Changes requested"].includes(c.status) && (
              <Button
                busy={busy}
                disabled={!!unresolvedQuestions.length}
                icon={PaperPlaneTilt}
                onClick={async () => {
                  try {
                    await save();
                    setDialog("submit");
                  } catch {}
                }}
              >
                Send for review
              </Button>
            )}
          {manager && c?.status === "Approved" && (
            <Button icon={ArrowUpRight} onClick={() => setDialog("publish")}>
              Publish procedure
            </Button>
          )}
          {manager && !c && !doc.archived && (
            <Button
              icon={PencilSimple}
              busy={busy}
              onClick={() =>
                doAction({ action: "revise" }, "Working revision created")
                  .then(() => setMode("edit"))
                  .catch(() => {})
              }
            >
              Create revision
            </Button>
          )}
          <button
            className="icon-button"
            aria-label="Procedure actions"
            onClick={() => setDialog("options")}
          >
            <DotsThree size={24} />
          </button>
        </div>
      </div>
      {error && (
        <div className="inline-error document-error" role="alert">
          <WarningCircle size={19} />
          {error}
          {saveStatus === "Save conflict" && (
            <Button
              kind="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(
                  JSON.stringify(local.current, null, 2),
                );
                notify(
                  "Your unsaved draft was copied. Reload to get the latest version.",
                );
              }}
            >
              Copy unsaved draft
            </Button>
          )}
          {saveStatus === "Save conflict" && (
            <Button
              kind="secondary"
              onClick={async () => {
                if (
                  confirm(
                    "Reload the latest revision? Copy your unsaved text first.",
                  )
                ) {
                  baseline.current = JSON.stringify(local.current);
                  const latest = await request(base);
                  setDetail(latest);
                }
              }}
            >
              Reload latest
            </Button>
          )}
        </div>
      )}
      {c?.status === "Changes requested" && (
        <div className="workflow-banner clay">
          <PencilSimple size={20} />
          <div>
            <strong>Your reviewer requested a few changes.</strong>
            <p>{c.feedback}</p>
          </div>
        </div>
      )}
      {c?.status === "Approved" && manager && (
        <div className="workflow-banner sage">
          <ShieldCheck size={22} />
          <div>
            <strong>
              Reviewed by {c.approval?.name}. Ready for publication.
            </strong>
            <p>
              The approved content is locked. Reopening it will require another
              review.
            </p>
          </div>
          <Button
            kind="secondary"
            onClick={() =>
              doAction(
                { action: "editApproved" },
                "Approval cleared; draft reopened",
              )
                .then(() => setMode("edit"))
                .catch(() => {})
            }
          >
            Reopen draft
          </Button>
        </div>
      )}
      {doc.archived && (
        <div className="workflow-banner clay">
          <Archive size={20} />
          <div>
            <strong>Archived procedure</strong>
            <p>
              {doc.archiveReason}. It is unavailable in the active reading
              library.
            </p>
          </div>
        </div>
      )}
      <div
        className={`document-layout ${mode === "edit" ? "editor-layout" : ""} ${!c && !manager ? "reader-layout" : ""}`}
      >
        <aside className="document-outline">
          <span className="small-label">In this procedure</span>
          {[
            ...contentFields.slice(0, 4),
            ["steps", "The procedure"],
            ...contentFields.slice(4),
            ["checklist", "At a glance"],
          ].map(
            ([key, label], i) =>
              (editing ||
                key === "steps" ||
                (Array.isArray(content[key])
                  ? content[key].length > 0
                  : !!content[key])) && (
                <a href={`#section-${key}`} key={key}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {label}
                </a>
              ),
          )}
          <div className="outline-metadata">
            <span className="small-label">Procedure owner</span>
            <div>
              <Avatar
                name={data.members.find((x) => x.id === doc.owner)?.name}
                size={26}
              />
              {data.members.find((x) => x.id === doc.owner)?.name ||
                "Reassignment needed"}
            </div>
            {doc.reviewDue && (
              <p>
                <CalendarBlank size={14} />
                Next review{" "}
                {dates(doc.reviewDue, undefined, data.workspace.timezone)}
              </p>
            )}
          </div>
          {v && (
            <a
              className="text-button"
              href={base + `/pdf?version=${v.number}`}
              target="_blank"
              rel="noreferrer"
            >
              <DownloadSimple size={16} />
              Download PDF
            </a>
          )}
          {readDraft && c && (
            <a
              className="text-button"
              href={base + "/pdf?draft=1"}
              target="_blank"
              rel="noreferrer"
            >
              <DownloadSimple size={16} />
              Draft PDF
            </a>
          )}
        </aside>
        <div className="document-center">
          {mode === "edit" && form ? (
            <article className="editing-sheet">
              <h1 className="sr-only">
                {form.title || "Untitled procedure"}: working draft
              </h1>
              <span className="small-label">
                Working draft · revision {revision.current}
              </span>
              <input
                className="document-title-input"
                aria-label="Procedure title"
                value={form.title}
                disabled={!editing}
                maxLength={160}
                onChange={(e) => update({ title: e.target.value })}
              />
              <div className="editing-intro">
                Clear instructions, written for the people doing the work.
              </div>
              {contentFields.slice(0, 4).map(([key, label], i) => (
                <section
                  className="editor-section"
                  id={`section-${key}`}
                  key={key}
                >
                  <div className="editor-section-head">
                    <span className="section-number">0{i + 1}</span>
                    <h2>{label}</h2>
                    {suggestSection(key, label)}
                  </div>
                  <textarea
                    aria-label={label}
                    value={form.content[key]}
                    disabled={!editing}
                    rows={key === "purpose" ? 3 : 4}
                    placeholder={
                      key === "purpose"
                        ? "Why does this procedure exist?"
                        : key === "scope"
                          ? "Who and what does this apply to?"
                          : "Write the information your team needs…"
                    }
                    onChange={(e) =>
                      update((f) => ({
                        ...f,
                        content: { ...f.content, [key]: e.target.value },
                      }))
                    }
                  />
                </section>
              ))}
              <section className="editor-section" id="section-steps">
                <div className="editor-section-head">
                  <span className="section-number">05</span>
                  <h2>The procedure</h2>
                  {editing && (
                    <span className="small-label">
                      {form.content.steps.length} steps
                    </span>
                  )}
                  {suggestSection("steps", "The procedure")}
                </div>
                {form.content.steps.map((s, i) => (
                  <div className="editing-step" key={s.id}>
                    <div className="step-number">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <input
                        aria-label={`Step ${i + 1} title`}
                        value={s.title}
                        placeholder="Give this step a clear title"
                        disabled={!editing}
                        onChange={(e) =>
                          update((f) => ({
                            ...f,
                            content: {
                              ...f.content,
                              steps: f.content.steps.map((x) =>
                                x.id === s.id
                                  ? { ...x, title: e.target.value }
                                  : x,
                              ),
                            },
                          }))
                        }
                      />
                      <input
                        className="responsible-input"
                        aria-label={`Step ${i + 1} responsible person`}
                        value={s.responsible}
                        placeholder="Responsible team or role"
                        disabled={!editing}
                        onChange={(e) =>
                          update((f) => ({
                            ...f,
                            content: {
                              ...f.content,
                              steps: f.content.steps.map((x) =>
                                x.id === s.id
                                  ? { ...x, responsible: e.target.value }
                                  : x,
                              ),
                            },
                          }))
                        }
                      />
                      <textarea
                        rows={4}
                        aria-label={`Step ${i + 1} instructions`}
                        disabled={!editing}
                        value={s.body}
                        placeholder="Describe what to do, in the order it happens…"
                        onChange={(e) =>
                          update((f) => ({
                            ...f,
                            content: {
                              ...f.content,
                              steps: f.content.steps.map((x) =>
                                x.id === s.id
                                  ? { ...x, body: e.target.value }
                                  : x,
                              ),
                            },
                          }))
                        }
                      />
                      {editing && (
                        <div className="step-controls">
                          <button
                            disabled={i === 0}
                            onClick={() =>
                              update((f) => {
                                const steps = [...f.content.steps];
                                [steps[i - 1], steps[i]] = [
                                  steps[i],
                                  steps[i - 1],
                                ];
                                return {
                                  ...f,
                                  content: { ...f.content, steps },
                                };
                              })
                            }
                          >
                            Move up
                          </button>
                          <button
                            disabled={i === form.content.steps.length - 1}
                            onClick={() =>
                              update((f) => {
                                const steps = [...f.content.steps];
                                [steps[i + 1], steps[i]] = [
                                  steps[i],
                                  steps[i + 1],
                                ];
                                return {
                                  ...f,
                                  content: { ...f.content, steps },
                                };
                              })
                            }
                          >
                            Move down
                          </button>
                          <button
                            aria-label={`Remove step ${i + 1}`}
                            onClick={() =>
                              update((f) => ({
                                ...f,
                                content: {
                                  ...f.content,
                                  steps: f.content.steps.filter(
                                    (x) => x.id !== s.id,
                                  ),
                                },
                              }))
                            }
                          >
                            <Trash size={13} />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {editing && (
                  <Button
                    kind="secondary full add-step"
                    icon={Plus}
                    onClick={() =>
                      update((f) => ({
                        ...f,
                        content: {
                          ...f.content,
                          steps: [
                            ...f.content.steps,
                            {
                              id: crypto.randomUUID(),
                              title: "",
                              body: "",
                              responsible: "",
                            },
                          ],
                        },
                      }))
                    }
                  >
                    Add a step
                  </Button>
                )}
              </section>
              {contentFields.slice(4).map(([key, label], i) => (
                <section
                  className="editor-section"
                  id={`section-${key}`}
                  key={key}
                >
                  <div className="editor-section-head">
                    <span className="section-number">0{i + 6}</span>
                    <h2>{label}</h2>
                    {suggestSection(key, label)}
                  </div>
                  <textarea
                    aria-label={label}
                    rows={3}
                    disabled={!editing}
                    value={form.content[key]}
                    placeholder="Add the details that make this process complete…"
                    onChange={(e) =>
                      update((f) => ({
                        ...f,
                        content: { ...f.content, [key]: e.target.value },
                      }))
                    }
                  />
                </section>
              ))}
              <section className="editor-section" id="section-checklist">
                <div className="editor-section-head">
                  <span className="section-number">08</span>
                  <h2>At a glance</h2>
                  {suggestSection("checklist", "At a glance")}
                </div>
                <textarea
                  aria-label="Checklist items"
                  rows={4}
                  disabled={!editing}
                  value={form.content.checklist.join("\n")}
                  placeholder="One completion checklist item per line"
                  onChange={(e) =>
                    update((f) => ({
                      ...f,
                      content: {
                        ...f.content,
                        checklist: e.target.value.split("\n"),
                      },
                    }))
                  }
                />
              </section>
              <div className="editor-sheet-footer">
                <span>
                  Use **bold**, *italic*, - bullets, or pipe-separated tables.
                </span>
                {editing && (
                  <Button
                    kind="secondary"
                    icon={Check}
                    onClick={() => save(true).catch(() => {})}
                  >
                    Save checkpoint
                  </Button>
                )}
              </div>
            </article>
          ) : (
            content && (
              <DocumentContent
                content={content}
                title={
                  mode === "preview" && form
                    ? form.title
                    : mode === "review"
                      ? c?.submission?.title
                      : v?.title || doc.title
                }
                version={readDraft ? "Draft" : v?.number}
                category={doc.category}
                owner={data.members.find((x) => x.id === doc.owner)?.name}
                approval={!readDraft && v?.approval}
              />
            )
          )}
          {mode === "read" && v && !doc.archived && mine && !historical && (
            <div className="acknowledgement-panel">
              {mine.receipt ? (
                <>
                  <CheckCircle size={27} weight="light" />
                  <div>
                    <h3>You acknowledged version {mine.receipt.version}.</h3>
                    <p>
                      Recorded{" "}
                      {dateTime(mine.receipt.time, data.workspace.timezone)} ·
                      Receipt {mine.receipt.id.slice(0, 8)}
                    </p>
                  </div>
                </>
              ) : mine.status === "Pending" ? (
                <>
                  <div>
                    <h3>Read it. Understand it. Put it into practice.</h3>
                    <p>Your acknowledgement records this specific version.</p>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={ack}
                        onChange={(e) => setAck(e.target.checked)}
                      />
                      I have read and understood version {v.number}.
                    </label>
                  </div>
                  <Button
                    disabled={!ack}
                    busy={busy}
                    icon={Check}
                    onClick={() =>
                      doAction(
                        {
                          action: "acknowledge",
                          version: v.number,
                          confirmed: ack,
                        },
                        "Acknowledgement recorded",
                      ).catch(() => {})
                    }
                  >
                    Acknowledge version
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </div>
        {(c || manager) && (
          <aside className="document-inspector">
            <div className="inspector-tabs">
              {[
                ["source", "Source notes"],
                ["ai", "AI proposals"],
                ["history", "History"],
              ]
                .filter(([k]) => k !== "ai" || (manager && c))
                .map(([k, t]) => (
                  <button
                    key={k}
                    className={panel === k ? "active" : ""}
                    aria-pressed={panel === k}
                    onClick={() => setPanel(k)}
                  >
                    {t}
                    {k === "ai" &&
                      ready.filter((p) => p.status === "Ready").length > 0 && (
                        <i />
                      )}
                  </button>
                ))}
            </div>
            {panel === "source" && (
              <>
                {editing && (
                  <div className="document-metadata">
                    <Field label="Category">
                      <select
                        value={form?.category || doc.category}
                        onChange={(e) => update({ category: e.target.value })}
                      >
                        {[
                          ...new Set([
                            ...data.templates.map((t) => t.category),
                            form?.category || doc.category,
                          ]),
                        ].map((label) => (
                          <option key={label}>{label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Department (optional)">
                      <input
                        maxLength={80}
                        value={form?.department || ""}
                        onChange={(e) => update({ department: e.target.value })}
                        placeholder="For example, People operations"
                      />
                    </Field>
                  </div>
                )}
                <div className="inspector-heading">
                  <FileText size={21} weight="light" />
                  <h3>The knowledge behind it.</h3>
                </div>
                <p className="inspector-description">
                  Capture your actual process. Keep facts, limits, and
                  responsibilities specific.
                </p>
                {inspectingCandidate ? (
                  <textarea
                    className="source-textarea"
                    aria-label="Source notes"
                    maxLength={40000}
                    value={form?.sources ?? c.sources}
                    disabled={!editing}
                    placeholder="Paste your process notes here. Include roles, deadlines, tools, and exceptions…"
                    onChange={(e) => update({ sources: e.target.value })}
                  />
                ) : (
                  <RichText
                    text={inspectedSources || "No source notes recorded."}
                  />
                )}
                <SourceMap sources={inspectedSources} refs={inspectedRefs} />
                {inspectingCandidate && sourceNotesChanged && (
                  <p className="ai-disclosure">
                    Source notes changed. Earlier reference links are hidden
                    until you save and prepare a new proposal.
                  </p>
                )}
                {inspectingCandidate &&
                  !sourceNotesChanged &&
                  c.sourceRefs.length > visibleSourceRefs.length && (
                    <p className="ai-disclosure">
                      Earlier reference links for edited sections are hidden.
                      Prepare a new proposal to record updated references.
                    </p>
                  )}
                <div className="source-count">
                  {inspectedSources.length.toLocaleString()} / 40,000 characters
                </div>
                {editing && (
                  <Button
                    kind="secondary full"
                    busy={busy}
                    icon={Sparkle}
                    disabled={generationDisabled}
                    onClick={() => generate()}
                  >
                    Prepare an AI draft
                  </Button>
                )}
                <p className="ai-disclosure">
                  {data.config.ai
                    ? "AI organizes your source wording into a draft. Review every instruction before accepting it. Nothing is published automatically."
                    : "AI assistance is unavailable. You can write, review, and publish your procedure manually."}
                </p>
                {inspectedGaps.length > 0 && (
                  <div className="gap-list">
                    <h3>Questions to resolve</h3>
                    {inspectingCandidate && (
                      <p className="gap-guidance">
                        Choose the confirmed alternative or state the full
                        replacement rule. Answers become author-provided source
                        clarifications in your next proposal. Check the final
                        instructions before review.
                      </p>
                    )}
                    {inspectedGaps.map((g) => (
                      <div className="gap-item" key={g.id}>
                        <span className="small-label">
                          {definitiveResolution(inspectedAnswer(g))
                            ? "Answer recorded"
                            : g.blocking
                              ? "Resolve before review"
                              : "Suggested clarification"}
                        </span>
                        <span className="gap-field">
                          {sectionLabel(g.field)}
                        </span>
                        <p>{g.question || g.message}</p>
                        <textarea
                          aria-label={`Resolution: ${g.question || g.message}`}
                          rows={2}
                          maxLength={2000}
                          disabled={!editing}
                          value={inspectedAnswer(g)}
                          placeholder="Record a confirmed instruction from your actual process…"
                          onChange={(e) =>
                            update((f) => ({
                              ...f,
                              gaps: f.gaps.map((x) =>
                                x.id === g.id
                                  ? { ...x, resolution: e.target.value }
                                  : x,
                              ),
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                {mode === "review" &&
                  c?.reviewer === m.id &&
                  c?.status === "In review" && (
                    <div className="review-decision">
                      <h3>Your second look matters.</h3>
                      <p>
                        Check the source notes, instructions, and resolved
                        questions before deciding.
                      </p>
                      <Button
                        kind="full"
                        icon={ShieldCheck}
                        onClick={() => setDialog("approve")}
                      >
                        Approve this revision
                      </Button>
                      <Button
                        kind="secondary full"
                        onClick={() => setDialog("changes")}
                      >
                        Request changes
                      </Button>
                    </div>
                  )}
              </>
            )}
            {panel === "ai" && (
              <>
                <div className="inspector-heading">
                  <Sparkle size={22} />
                  <h3>A thoughtful starting point.</h3>
                </div>
                <p className="inspector-description">
                  AI organizes your source wording. Preview proposals before
                  replacing your draft. Accepted proposals create a recoverable
                  checkpoint.
                </p>
                {ready.map((p) => (
                  <div className="proposal-item" key={p.id}>
                    <Status
                      value={
                        p.status === "Ready" && proposalStale(p)
                          ? "Outdated"
                          : p.status
                      }
                    />
                    <h4>
                      {p.section
                        ? `Suggested ${sectionLabel(p.section).toLowerCase()}`
                        : "Suggested procedure"}
                    </h4>
                    {p.status === "Generating" ? (
                      <>
                        <div className="generation-progress">
                          <span />
                        </div>
                        <p>Working from your saved source notes…</p>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            doAction(
                              { action: "cancelProposal", proposal: p.id },
                              "Generation cancelled",
                            ).catch(() => {})
                          }
                        >
                          Cancel generation
                        </button>
                      </>
                    ) : p.status === "Ready" ? (
                      <>
                        <p>
                          {proposalStale(p)
                            ? "This proposal is no longer current. Prepare a new proposal from your saved notes before accepting a replacement."
                            : `${p.output?.gaps.length || 0} questions identified · Based on revision ${p.revision}`}
                        </p>
                        <Button
                          kind="secondary full"
                          onClick={() => setDialog({ type: "proposal", p })}
                        >
                          Preview proposal <ArrowRight size={15} />
                        </Button>
                        <button
                          className="text-button proposal-dismiss"
                          disabled={busy}
                          onClick={() =>
                            doAction(
                              { action: "cancelProposal", proposal: p.id },
                              "Proposal dismissed",
                            ).catch(() => {})
                          }
                        >
                          Dismiss proposal
                        </button>
                      </>
                    ) : (
                      <p role="alert">{p.error}</p>
                    )}
                  </div>
                ))}
                {!ready.length && (
                  <p className="quiet">
                    Add source notes and prepare a draft to see suggestions
                    here.
                  </p>
                )}
                {editing && (
                  <Button
                    kind="secondary full"
                    icon={Sparkle}
                    busy={busy}
                    disabled={generationDisabled}
                    onClick={() => generate()}
                  >
                    Prepare a new proposal
                  </Button>
                )}
              </>
            )}
            {panel === "history" && (
              <>
                <h3>Every version has a story.</h3>
                {doc.versions
                  .slice()
                  .reverse()
                  .map((x) => (
                    <button
                      className="history-version"
                      key={x.id}
                      onClick={() => {
                        setHistorical(
                          x.number === doc.current ? null : x.number,
                        );
                        setMode("read");
                      }}
                    >
                      <span>
                        <strong>
                          Version {x.number}
                          {x.number === doc.current ? " · current" : ""}
                        </strong>
                        <small>
                          {dates(
                            x.published,
                            undefined,
                            data.workspace.timezone,
                          )}{" "}
                          · {x.publisher}
                        </small>
                        <p>{x.summary}</p>
                      </span>
                      <CaretRight size={16} />
                    </button>
                  ))}
                {manager && doc.checkpoints.length > 0 && (
                  <>
                    <h4>Saved checkpoints</h4>
                    {doc.checkpoints.slice(0, 10).map((x) => (
                      <div className="checkpoint" key={x.id}>
                        <span>
                          Revision {x.revision}
                          <small>
                            {dateTime(x.time, data.workspace.timezone)}
                          </small>
                        </span>
                        {editing && (
                          <button
                            className="text-button"
                            onClick={async () => {
                              if (
                                confirm(
                                  "Restore this checkpoint? Your current draft will be checkpointed first.",
                                )
                              ) {
                                setRestoring(true);
                                try {
                                  await save();
                                  while (
                                    mounted.current &&
                                    JSON.stringify(local.current) !==
                                      baseline.current
                                  )
                                    await save();
                                  await doAction(
                                    { action: "checkpoint", checkpoint: x.id },
                                    "Checkpoint restored",
                                  );
                                } catch {
                                } finally {
                                  setRestoring(false);
                                }
                              }
                            }}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    ))}
                  </>
                )}
                {!doc.versions.length && !doc.checkpoints.length && (
                  <p className="quiet">
                    Published versions and saved checkpoints will appear here.
                  </p>
                )}
              </>
            )}
          </aside>
        )}
      </div>
      {dialog && (
        <DocumentDialog
          key={typeof dialog === "string" ? dialog : dialog.type}
          dialog={dialog}
          setDialog={setDialog}
          doc={doc}
          form={form}
          draftDirty={JSON.stringify(local.current) !== baseline.current}
          data={data}
          assignments={assignments}
          base={base}
          revision={revision}
          eligible={eligible}
          doAction={doAction}
          save={save}
          notify={notify}
          openDoc={openDoc}
          setMode={setMode}
          busy={busy}
          error={error}
          manager={manager}
        />
      )}
    </div>
  );
}

function DocumentDialog({
  dialog,
  setDialog,
  doc,
  form,
  draftDirty,
  data,
  assignments,
  base,
  revision,
  eligible,
  doAction,
  save,
  notify,
  openDoc,
  setMode,
  busy,
  error,
  manager,
}) {
  const publicationKey = useRef(crypto.randomUUID());
  const type = typeof dialog === "string" ? dialog : dialog.type,
    c = doc.candidate,
    close = () => setDialog(null);
  const [confirmed, setConfirmed] = useState(false),
    [requireAck, setRequireAck] = useState(false),
    [recipients, setRecipients] = useState("all");
  const unresolvedQuestions = (form?.gaps || c?.gaps || []).filter(
    (g) => g.blocking && !definitiveResolution(g.resolution),
  );
  const proposalOutdated =
    type === "proposal" &&
    (!c ||
      !manager ||
      ["In review", "Approved"].includes(c.status) ||
      (data.config.aiValidatorVersion &&
        (dialog.p.output?.validatorVersion !== data.config.aiValidatorVersion ||
          dialog.p.output?.grounding?.version !==
            data.config.aiValidatorVersion)) ||
      !doc.proposals.some(
        (p) => p.id === dialog.p.id && p.status === "Ready",
      ) ||
      dialog.p.candidate !== c.id ||
      dialog.p.revision !== revision.current ||
      draftDirty);
  const currentReading = assignments.filter(
    (assignment) =>
      assignment.version === doc.current &&
      ["Pending", "Acknowledged"].includes(assignment.status) &&
      data.members.some(
        (member) => member.id === assignment.member && member.active,
      ),
  );
  const acknowledgedReading = currentReading.filter(
    (assignment) => assignment.receipt,
  ).length;
  const overdueReading = currentReading.filter(
    (assignment) =>
      assignment.status === "Pending" &&
      Date.parse(assignment.deadline) < Date.now(),
  ).length;
  async function submit(e) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      let body;
      if (type === "submit")
        body = {
          action: "submit",
          reviewer: values.reviewer,
          revision: await save(),
        };
      if (type === "publish")
        body = {
          action: "publish",
          key: publicationKey.current,
          revision: revision.current,
          current: doc.current,
          confirmed,
          summary: values.summary,
          reviewDue: values.reviewDue,
          requireAcknowledgement: requireAck,
          recipients:
            recipients === "all"
              ? "all"
              : new FormData(e.currentTarget).getAll("recipients"),
          deadline: values.deadline,
        };
      if (["approve", "changes"].includes(type))
        body = {
          action: "review",
          decision: type === "approve" ? "approve" : "changes",
          submission: c.submission.id,
          note: values.note,
        };
      if (type === "archive")
        body = {
          action: "archive",
          key: publicationKey.current,
          reason: values.reason,
        };
      if (type === "maintenance")
        body = { action: "maintenance", date: values.date, note: values.note };
      if (type === "assign")
        body = {
          action: "assign",
          recipients:
            recipients === "all"
              ? data.members.filter((m) => m.active).map((m) => m.id)
              : new FormData(e.currentTarget).getAll("recipients"),
          deadline: values.deadline,
        };
      if (type === "transfer")
        body = { action: "transfer", owner: values.owner };
      if (type === "proposal") {
        if (proposalOutdated) return;
        await save();
        body = { action: "applyProposal", proposal: dialog.p.id, confirmed };
      }
      await doAction(
        body,
        type === "publish"
          ? "Procedure published"
          : type === "submit"
            ? "Sent for review"
            : type === "approve"
              ? "Revision approved"
              : type === "changes"
                ? "Changes requested"
                : type === "proposal"
                  ? "AI proposal accepted"
                  : "Procedure updated",
      );
      if (type === "publish") setMode("read");
    } catch {}
  }
  if (type === "options")
    return (
      <Dialog title="Procedure actions" onClose={close}>
        {data.config?.review && (
          <p>
            Procedure links work within your browser’s sandbox. To invite
            someone to try SOPEasy, share the review home link or send an
            exported PDF.
          </p>
        )}
        <div className="action-menu">
          {doc.current && !doc.archived && (
            <button
              onClick={() =>
                navigator.clipboard
                  .writeText(
                    `${location.origin}/?workspace=${data.workspace.id}&document=${doc.id}`,
                  )
                  .then(() => notify("Internal procedure link copied"))
              }
            >
              <Copy size={19} />
              Copy internal procedure link
            </button>
          )}
          {doc.current && !doc.archived && (
            <a href={base + "/pdf"} target="_blank" rel="noreferrer">
              <DownloadSimple size={19} />
              Download published PDF
            </a>
          )}
          {c && (
            <a href={base + "/pdf?draft=1"} target="_blank" rel="noreferrer">
              <DownloadSimple size={19} />
              Download draft PDF
            </a>
          )}
          {data.workspace.member.role !== "Reader" && (
            <button
              onClick={async () => {
                try {
                  const r = await doAction(
                    { action: "duplicate" },
                    "Procedure duplicated",
                  );
                  await openDoc(r.result.id, "edit");
                } catch {}
              }}
            >
              <Copy size={19} />
              Duplicate as a new draft
            </button>
          )}
          {manager && doc.current && !doc.archived && (
            <>
              <button onClick={() => setDialog("assign")}>
                <UsersThree size={19} />
                Assign reading
              </button>
              <button onClick={() => setDialog("report")}>
                <ListChecks size={19} />
                Reading report
              </button>
              <button onClick={() => setDialog("maintenance")}>
                <CalendarBlank size={19} />
                Record a maintenance review
              </button>
            </>
          )}
          {["Owner", "Admin"].includes(data.workspace.member.role) && (
            <>
              <button onClick={() => setDialog("transfer")}>
                <ArrowRight size={19} />
                Transfer procedure ownership
              </button>
              {!doc.archived ? (
                <button
                  className="danger-text"
                  onClick={() => setDialog("archive")}
                >
                  <Archive size={19} />
                  Archive procedure
                </button>
              ) : (
                !c && (
                  <button
                    onClick={() =>
                      doAction(
                        { action: "restore" },
                        "Restoration draft created",
                      )
                        .then(() => setMode("edit"))
                        .catch(() => {})
                    }
                  >
                    <ArrowCounterClockwise size={19} />
                    Start restoration draft
                  </button>
                )
              )}
            </>
          )}
          {manager && c && doc.current > 0 && (
            <button
              className="danger-text"
              onClick={() => {
                if (
                  confirm(
                    "Discard the working revision? The current published version stays in the library.",
                  )
                )
                  doAction({ action: "discard" }, "Working revision discarded")
                    .then(() => setMode("read"))
                    .catch(() => {});
              }}
            >
              <Trash size={19} />
              Discard working revision
            </button>
          )}
        </div>
      </Dialog>
    );
  if (type === "report")
    return (
      <Dialog title="Version-specific reading report" onClose={close} wide>
        <p className="dialog-description">
          Receipts stay attached to the version that was read.
        </p>
        <div className="reading-report-summary">
          <strong>
            Version {doc.current}: {acknowledgedReading} of{" "}
            {currentReading.length} active assigned people acknowledged
            {currentReading.length
              ? ` (${Math.round((acknowledgedReading / currentReading.length) * 100)}%)`
              : ""}
            .
          </strong>
          <p>
            {currentReading.length - acknowledgedReading} pending ·{" "}
            {overdueReading} overdue. The table retains earlier versions and
            inactive teammates’ receipts.
          </p>
        </div>
        <div
          className="report-table"
          tabIndex={0}
          role="table"
          aria-label="Version-specific reading report"
        >
          <div className="report-row heading" role="row">
            <span role="columnheader">Person</span>
            <span role="columnheader">Version</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Receipt date</span>
          </div>
          {assignments.map((a) => (
            <div className="report-row" key={a.id} role="row">
              <span role="cell">
                {data.members.find((m) => m.id === a.member)?.name ||
                  "Inactive member"}
              </span>
              <span role="cell">{a.version}</span>
              <span role="cell">
                <Status
                  value={
                    a.status === "Pending" &&
                    Date.parse(a.deadline) < Date.now()
                      ? "Overdue"
                      : a.status
                  }
                />
              </span>
              <span role="cell">
                {a.receipt
                  ? dates(a.receipt.time, undefined, data.workspace.timezone)
                  : "—"}
              </span>
            </div>
          ))}
        </div>
        {!assignments.length && <p>No reading tasks assigned.</p>}
        <a
          className="button secondary"
          href={`/api/w/${data.workspace.id}/reports.csv`}
          download
        >
          <DownloadSimple size={17} />
          Download report CSV
        </a>
      </Dialog>
    );
  const titles = {
    submit: "A second pair of eyes.",
    publish: "Put your procedure into practice.",
    approve: "Approve this revision.",
    changes: "Help make this procedure clearer.",
    archive: "Archive this procedure.",
    maintenance: "Keep this knowledge current.",
    assign: "Share the current version.",
    transfer: "Transfer procedure ownership.",
    proposal: "Preview your proposed draft.",
  };
  const proposal = type === "proposal" ? dialog.p : null;
  const proposedGaps =
    proposal?.output.gaps.filter(
      (g) =>
        !proposal.section ||
        g.field === proposal.section ||
        g.field.startsWith(proposal.section + "."),
    ) || [];
  const proposedRefs =
    proposal?.output.sourceRefs?.filter(
      (r) =>
        !proposal.section ||
        r.field === proposal.section ||
        r.field.startsWith(proposal.section + ".") ||
        (r.field.startsWith("gaps.") &&
          proposedGaps.includes(
            proposal.output.gaps[Number(r.field.split(".")[1])],
          )),
    ) || [];
  return (
    <Dialog title={titles[type]} onClose={close} wide={type === "proposal"}>
      <form onSubmit={submit}>
        {type === "submit" && (
          <>
            <p className="dialog-description">
              Your draft will be locked during review. Choose an author who
              hasn’t edited this candidate.
            </p>
            <Field label="Reviewer">
              <select name="reviewer" required defaultValue="">
                <option value="" disabled>
                  Select a reviewer
                </option>
                {eligible.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.name} · {m.role}
                  </option>
                ))}
              </select>
            </Field>
            {!eligible.length && (
              <p className="notice">
                Invite another author or administrator to review this procedure.
              </p>
            )}
            {!!unresolvedQuestions.length && (
              <p className="notice">
                Resolve {unresolvedQuestions.length} required{" "}
                {unresolvedQuestions.length === 1 ? "question" : "questions"}{" "}
                with a confirmed instruction before review.
              </p>
            )}
          </>
        )}
        {type === "publish" && (
          <>
            <p className="dialog-description">
              Publish the exact revision approved by {c.approval?.name}. The
              previous version and receipts stay in history.
            </p>
            <Field
              label="What changed?"
              hint={
                doc.current
                  ? "Required for a new version."
                  : "Describe this first publication."
              }
            >
              <textarea
                name="summary"
                required={!!doc.current}
                rows={3}
                placeholder="Explain the changes your team should know about…"
              />
            </Field>
            <Field label="Next maintenance review">
              <input
                type="date"
                name="reviewDue"
                required
                defaultValue={future(90, data.workspace.timezone)}
                min={future(7, data.workspace.timezone)}
                max={future(365, data.workspace.timezone)}
              />
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={requireAck}
                onChange={(e) => setRequireAck(e.target.checked)}
              />
              Require a new acknowledgement
            </label>
          </>
        )}
        {(type === "assign" || (type === "publish" && requireAck)) && (
          <>
            {type === "assign" && (
              <p className="dialog-description">
                Selecting someone with pending reading updates their deadline.
                Existing receipts stay unchanged.
              </p>
            )}
            <Field label="Assign reading to">
              <select
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              >
                <option value="all">Everyone active in the workspace</option>
                <option value="selected">Selected teammates</option>
              </select>
            </Field>
            {recipients === "selected" && (
              <div className="recipient-list">
                {data.members
                  .filter((m) => m.active)
                  .map((m) => (
                    <label className="checkbox" key={m.id}>
                      <input type="checkbox" name="recipients" value={m.id} />
                      {m.name}
                    </label>
                  ))}
              </div>
            )}
            <Field
              label={`Acknowledgement deadline (${data.workspace.timezone})`}
            >
              <input
                name="deadline"
                type="date"
                defaultValue={future(7, data.workspace.timezone)}
                required
                min={future(1, data.workspace.timezone)}
                max={future(30, data.workspace.timezone)}
              />
            </Field>
          </>
        )}
        {["approve", "changes"].includes(type) && (
          <>
            <p className="dialog-description">
              Your decision applies to submitted revision{" "}
              {c.submission.revision}.
            </p>
            <Field
              label={
                type === "changes"
                  ? "What needs to change?"
                  : "Review note (optional)"
              }
            >
              <textarea
                name="note"
                required={type === "changes"}
                rows={5}
                placeholder={
                  type === "changes"
                    ? "Explain the specific updates needed…"
                    : "Record any context for this approval…"
                }
              />
            </Field>
            {type === "approve" && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I checked the instructions and source notes.
              </label>
            )}
          </>
        )}
        {type === "archive" && (
          <>
            <p className="dialog-description">
              This removes the procedure from the active library and cancels
              pending reading tasks. History and receipts remain available to
              its owner and administrators.
            </p>
            <Field label="Reason for archiving">
              <textarea name="reason" required rows={3} />
            </Field>
          </>
        )}
        {type === "maintenance" && (
          <>
            <p className="dialog-description">
              Confirm that the published instructions remain accurate. Content
              changes need a new reviewed version.
            </p>
            <Field label="Review note">
              <textarea
                name="note"
                required
                rows={3}
                placeholder="Why does the current version remain accurate?"
              />
            </Field>
            <Field label="Next review date">
              <input
                name="date"
                type="date"
                required
                min={future(7, data.workspace.timezone)}
                max={future(365, data.workspace.timezone)}
                defaultValue={future(90, data.workspace.timezone)}
              />
            </Field>
          </>
        )}
        {type === "transfer" && (
          <Field label="New procedure owner">
            <select name="owner" required defaultValue="">
              <option value="" disabled>
                Select an active author
              </option>
              {data.members
                .filter((m) => m.active && m.role !== "Reader")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {type === "proposal" && (
          <>
            <div className="notice">
              {proposalOutdated
                ? "This proposal is no longer current. You can inspect it here, then prepare a new proposal from the latest saved notes."
                : "Your saved draft will be checkpointed before replacement. Check every instruction against your source notes."}
            </div>
            {proposal.section && (
              <p className="dialog-description">
                Only {sectionLabel(proposal.section).toLowerCase()} will be
                replaced. Other sections keep their current text.
              </p>
            )}
            <div
              className="proposal-preview"
              tabIndex={0}
              role="region"
              aria-label="Suggested procedure preview"
            >
              <DocumentContent
                content={dialog.p.output.content}
                title={doc.title}
                version="Draft"
                category={doc.category}
                owner={data.user.name}
                section={proposal.section}
              />
            </div>
            {proposedGaps.length > 0 && (
              <div className="proposal-questions">
                <h3>Questions the proposal leaves open</h3>
                {proposedGaps.map((g, i) => (
                  <p key={i}>
                    <WarningCircle size={16} />
                    <span>
                      <strong>
                        {sectionLabel(g.field)} ·{" "}
                        {g.blocking ? "Resolve before review" : "Clarification"}
                      </strong>
                      {g.question || g.message}
                    </span>
                  </p>
                ))}
              </div>
            )}
            <SourceMap
              sources={proposal.request?.sourceSnapshot || ""}
              refs={proposedRefs}
              summary="Source notes used for this proposal"
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                required
                disabled={proposalOutdated}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I reviewed this replacement and its open questions.
            </label>
          </>
        )}
        {type === "publish" && (
          <label className="checkbox confirmation">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I checked the approved content and publication settings.
          </label>
        )}
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <div className="dialog-footer">
          <Button kind="secondary" type="button" onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            busy={busy}
            disabled={
              (type === "submit" &&
                (!eligible.length || !!unresolvedQuestions.length)) ||
              proposalOutdated
            }
            icon={type === "approve" ? ShieldCheck : Check}
          >
            {type === "publish"
              ? "Publish version " + (doc.current + 1)
              : type === "submit"
                ? "Send for review"
                : type === "proposal"
                  ? "Accept replacement"
                  : type === "approve"
                    ? "Approve revision"
                    : type === "changes"
                      ? "Request changes"
                      : type === "archive"
                        ? "Archive procedure"
                        : type === "assign"
                          ? "Assign reading"
                          : "Confirm"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Modals({
  modal,
  close,
  data,
  config,
  run,
  refresh,
  openDoc,
  notify,
  switchWorkspace,
  setData,
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [query, setQuery] = useState(""),
    [searchPage, setSearchPage] = useState(1);
  const [captureTemplate, setCaptureTemplate] = useState(
    modal.template?.id || "general",
  );
  const base = `/api/w/${data.workspace.id}`;
  const type = modal.type;
  const search = useDocumentPage(
    data,
    { q: query, page: searchPage, pageSize: 10 },
    type === "search",
    "search",
  );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    if (type === "create") {
      const known = Object.entries(body)
        .filter(([k, v]) => k.startsWith("capture_") && v.trim())
        .map(([k, v]) => k.slice(8) + ": " + v);
      body.sources = [body.sources, ...known].filter(Boolean).join("\n");
    }
    try {
      if (type === "create") {
        const r = await request(base + "/docs", body);
        await refresh();
        close();
        await openDoc(r.doc.id, "edit");
        notify("Your draft is ready.");
      }
      if (type === "invite") {
        const r = await request(base + "/invites", body);
        setResult(r);
        notify("Invitation prepared");
      }
      if (type === "delete") {
        await request(base + "/delete", body);
        close();
        await refresh();
      }
      if (type === "newWorkspace") {
        const r = await request("/api/workspaces", body);
        close();
        await switchWorkspace(r.id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (type === "acceptInvite")
    return (
      <Dialog title={`Join ${modal.name}`} onClose={close}>
        <p className="dialog-description">
          Accept your invitation as a {modal.role}.
        </p>
        {error && <p className="inline-error">{error}</p>}
        <Button
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await request("/api/invitation/" + modal.token, {});
              history.replaceState(null, "", "/");
              close();
              await switchWorkspace(r.workspace);
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Accept invitation
        </Button>
      </Dialog>
    );
  if (type === "account")
    return (
      <Dialog title="Your account" onClose={close}>
        <div className="account-summary">
          <Avatar name={data.user.name} size={50} />
          <div>
            <h3>{data.user.name}</h3>
            <p>{data.user.email}</p>
          </div>
        </div>
        {config.demo && (
          <div className="demo-switch">
            <p>Explore each role in the fictional demonstration workspace.</p>
            {[
              ["maya", "Maya Kapoor", "Owner"],
              ["arjun", "Arjun Mehta", "Reviewer / Author"],
              ["leena", "Leena Rao", "Reader"],
            ].map(([email, name, role]) => (
              <button
                key={email}
                onClick={async () => {
                  if (
                    !confirm(
                      "Switch demo account? Save your current work first.",
                    )
                  )
                    return;
                  await request("/api/auth/demo", {
                    email: email + "@sopeasy.example",
                  });
                  sessionStorage.removeItem("sopeasy_workspace");
                  close();
                  history.replaceState(null, "", "/");
                  location.reload();
                }}
              >
                <Avatar name={name} />
                <span>
                  {name}
                  <small>{role}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        )}
        {config.review && (
          <Button
            kind="secondary full"
            onClick={async () => {
              if (
                !confirm(
                  "Reset your review sandbox? This permanently removes only your sample workspace and starts a fresh one.",
                )
              )
                return;
              await request("/api/auth/review-reset", {});
              sessionStorage.removeItem("sopeasy_workspace");
              history.replaceState(null, "", "/");
              location.reload();
            }}
          >
            Start a fresh sandbox
          </Button>
        )}
        <Button
          kind="secondary full"
          icon={SignOut}
          onClick={async () => {
            await request("/api/auth/logout", {});
            close();
            setData(null);
            history.replaceState(null, "", "/");
            location.reload();
          }}
        >
          {config.review ? "Return to owner role" : "Sign out"}
        </Button>
      </Dialog>
    );
  if (type === "workspace")
    return (
      <Dialog title="Your workspaces" onClose={close}>
        <div className="workspace-options">
          {data.workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                close();
                switchWorkspace(w.id);
              }}
            >
              <span className="workspace-monogram">{initials(w.name)}</span>
              <span>
                <strong>{w.name}</strong>
                <small>{w.role}</small>
              </span>
              {w.id === data.workspace.id ? (
                <Check size={19} />
              ) : (
                <CaretRight size={19} />
              )}
            </button>
          ))}
        </div>
        <Button
          icon={Plus}
          kind="secondary full"
          onClick={() => {
            close();
            setTimeout(
              () => document.dispatchEvent(new CustomEvent("new-workspace")),
              0,
            );
          }}
        >
          Create another workspace
        </Button>
      </Dialog>
    );
  if (type === "notifications")
    return (
      <Dialog title="Your workspace, in the loop." onClose={close}>
        <div className="notification-list">
          {data.notifications.map((n) => (
            <button
              key={n.id}
              className={n.read ? "" : "unread"}
              onClick={async () => {
                await request(base + "/notifications/read", { id: n.id });
                await refresh();
                close();
                if (
                  n.documentTarget ||
                  data.documents.some((d) => d.id === n.target)
                )
                  openDoc(n.target);
              }}
            >
              <span className="task-symbol sage">
                <Bell size={19} />
              </span>
              <span>
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                <small>
                  {dates(n.time, undefined, data.workspace.timezone)}
                </small>
              </span>
              {!n.read && <i />}
            </button>
          ))}
        </div>
        {!data.notifications.length && (
          <Empty
            title="All quiet here."
            detail="Reviews, reading tasks, and reminders appear here."
            icon={Bell}
          />
        )}
        <Button
          kind="secondary full"
          onClick={async () => {
            await request(base + "/notifications/read", {});
            refresh();
            close();
          }}
        >
          Mark all as read
        </Button>
      </Dialog>
    );
  if (type === "search")
    return (
      <Dialog title="Find a little clarity." onClose={close} wide>
        <div className="search-field large">
          <MagnifyingGlass size={21} />
          <input
            autoFocus
            placeholder="Search titles and procedure content…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchPage(1);
            }}
            aria-label="Search the workspace"
          />
        </div>
        <CollectionState {...search} />
        <div className="global-search-results">
          {!search.loading &&
            !search.error &&
            (search.result?.documents || []).map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  close();
                  openDoc(d.id);
                }}
              >
                <FileText size={21} />
                <span>
                  <strong>{d.title}</strong>
                  <small>
                    {d.category} ·{" "}
                    {d.current ? "Version " + d.current : d.status}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
        </div>
        {!search.loading && !search.error && search.result?.total === 0 && (
          <p className="quiet">No procedures match your search.</p>
        )}
        <Pagination
          result={search.result}
          onPage={setSearchPage}
          loading={search.loading}
        />
      </Dialog>
    );
  const title =
    type === "create"
      ? "Start with what your team knows."
      : type === "invite"
        ? "Make space for a teammate."
        : type === "newWorkspace"
          ? "Create a new workspace."
          : "Request workspace deletion.";
  return (
    <Dialog title={title} onClose={close}>
      <form onSubmit={submit}>
        {type === "create" && (
          <>
            <p className="dialog-description">
              Give it a name and paste what your team already knows.
            </p>
            <Field label="Procedure title">
              <input
                name="title"
                required
                autoFocus
                maxLength={160}
                placeholder="e.g. New employee onboarding"
              />
            </Field>
            <Field label="Source notes (optional)">
              <textarea
                name="sources"
                rows={5}
                maxLength={40000}
                placeholder="Paste the steps, people, and deadlines you know…"
              />
            </Field>
            <details className="create-options">
              <summary>Template and other options</summary>
              <div className="create-options-fields">
                <Field label="Template">
                  <select
                    name="template"
                    defaultValue={modal.template?.id || "general"}
                    onChange={(e) => setCaptureTemplate(e.target.value)}
                  >
                    <option value="blank">Blank document</option>
                    {data.templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Category">
                  <input
                    name="category"
                    defaultValue={modal.template?.category || "Operations"}
                    required
                    maxLength={80}
                    list="categories"
                  />
                  <datalist id="categories">
                    <option>Operations</option>
                    <option>People & culture</option>
                    <option>IT & equipment</option>
                    <option>Finance</option>
                  </datalist>
                </Field>
                <Field label="Department (optional)">
                  <input
                    name="department"
                    maxLength={80}
                    placeholder="For example, People operations"
                  />
                </Field>
                <CapturePrompts template={captureTemplate} />
              </div>
            </details>
          </>
        )}
        {type === "invite" && (
          <>
            <p className="dialog-description">
              Invitations last seven days and can only be accepted by the
              invited email address.
            </p>
            <Field label="Email address">
              <input
                name="email"
                type="email"
                required
                autoFocus
                placeholder="teammate@company.com"
              />
            </Field>
            <Field label="Workspace role">
              <select name="role">
                <option>Reader</option>
                <option>Author</option>
                {data.workspace.member.role === "Owner" && (
                  <option>Admin</option>
                )}
              </select>
            </Field>
            {result && (
              <div className="notice">
                Invitation sent.
                {result.developmentLink && (
                  <>
                    <p>
                      Local development email delivery: share this invitation
                      link with the teammate.
                    </p>
                    <a href={result.developmentLink}>
                      {result.developmentLink}
                    </a>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(result.developmentLink)
                          .then(() => notify("Invitation link copied"))
                      }
                    >
                      <Copy size={15} />
                      Copy invitation link
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
        {type === "newWorkspace" && (
          <>
            <Field label="Workspace name">
              <input name="name" required maxLength={100} />
            </Field>
            <Field label="Timezone">
              <input
                name="timezone"
                defaultValue={data.workspace.timezone}
                required
              />
            </Field>
          </>
        )}
        {type === "delete" && (
          <>
            <div className="notice danger">
              This immediately disables workspace access. The owner has seven
              days to cancel deletion before data is permanently removed.
            </div>
            <Field label={`Type “${data.workspace.name}” to confirm`}>
              <input name="confirmation" required autoComplete="off" />
            </Field>
          </>
        )}
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <div className="dialog-footer">
          <Button type="button" kind="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            busy={busy}
            icon={
              type === "invite"
                ? PaperPlaneTilt
                : type === "delete"
                  ? Trash
                  : Plus
            }
            kind={type === "delete" ? "danger" : ""}
          >
            {type === "create"
              ? "Create draft"
              : type === "invite"
                ? "Send invitation"
                : type === "newWorkspace"
                  ? "Create workspace"
                  : "Request deletion"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
