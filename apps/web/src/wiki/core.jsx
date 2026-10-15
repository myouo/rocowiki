import React, { useState, useEffect, useRef } from "react";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import useBrokenLinks from "@docusaurus/useBrokenLinks";
import { petMetadata } from "./content/bundled.js";
import { useHistory, useLocation } from "@docusaurus/router";
import EditEntry, { PublishedSection } from "./editing/EditEntry";
import { editingContext, isReaderPath, isEditableArticlePath, canAutoEditSection } from "./editingContext";
import { ColorIcon, pageVisual } from "./visuals";
import { HeaderProfileAvatar } from "./AccountIdentity";
import PageCommunityFooter from "./PageCommunityFooter";
import {useWikiRuntime} from "./runtime/useWikiRuntime";
import { useInputComposition } from './inputComposition';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  Search,
  X,
  ExternalLink,
  History,
  Pencil,
  CircleHelp,
  SlidersHorizontal,
  Menu,
  ShieldCheck,
  Clock,
  Info,
  UserRound,
  NotebookPen,
  MessageSquareText,
} from "lucide-react";

export { Link };
// Explicit typed editors take precedence over the shared page/section shortcut.
function hasEditAction(children) {
  return React.Children.toArray(children).some((child) => {
    if (!React.isValidElement(child)) return false;
    if (child.type === EditEntry) return child.props.intent !== "add";
    return hasEditAction(child.props.children);
  });
}
function canEditReaderEntry(path) {
  return isReaderPath(path) && (isEditableArticlePath(path) ||
    /^\/(pets|skills|bloodlines|events|npcs|places|items|tasks)\/[^/]+\//.test(path));
}
export const normalizePath = (path) =>
  (
    "/" +
    String(path || "/")
      .split("?")[0]
      .replace(/^\/+|\/+$/g, "") +
    "/"
  ).replace(/^\/\/$/, "/");
export function useQuery() {
  const l = useLocation();
  return new URLSearchParams(l.search || "");
}
export function setQuery(history, location, changes) {
  const q = new URLSearchParams(location.search);
  Object.entries(changes).forEach(([k, v]) =>
    v === null || v === "" ? q.delete(k) : q.set(k, String(v)),
  );
  history.replace(location.pathname + (q.size ? "?" + q.toString() : ""));
}
export function Badge({ children, tone = "", className = "" }) {
  return (
    <span className={"rw-badge " + tone + " " + className}>{children}</span>
  );
}
export function TypeBadge({ type }) {
  const rawName = type?.replace("系", "") || "未知";
  const name = rawName === "幽" ? "幽灵" : rawName;
  const icon = petMetadata.typeIcons[name];
  const src = useBaseUrl(icon?.path || "/");
  return icon ? (
    <span className="rw-type rw-type-icon" title={name + "系"}>
      <img
        src={src}
        width="25"
        height="28"
        alt={name + "系"}
        loading="lazy"
        decoding="async"
      />
    </span>
  ) : (
    <span className="rw-type">{name}系</span>
  );
}
export function PageHeader({
  title,
  description,
  eyebrow,
  back,
  crumbs = [],
  actions,
  children,
  edit,
}) {
  const location = useLocation();
  const visual = pageVisual(location.pathname);
  const illustrated = /^\/(pets|skills|bloodlines|mechanics|events|battle|pve|adventure|tools)\/$/.test(location.pathname) && !new URLSearchParams(location.search).has("entry");
  const editInfo = editingContext(location.pathname, "条目正文", title, {
    returnTo: location.pathname + location.search,
    ...(typeof edit === "object" ? edit : {}),
  });
  const canEditEntry = edit !== false && isReaderPath(location.pathname) &&
    editInfo.mode !== "index" && (typeof edit === "object" || canEditReaderEntry(location.pathname));
  return (
    <header
      className={`rw-pagehead rw-tone-${visual.tone}${illustrated ? " rw-pagehead-illustrated-v72" : ""}`}
      data-header-kind={illustrated ? location.pathname.split("/")[1] : undefined}
      data-wiki-entity={typeof title === "string" ? title : undefined}
    >
      <div className="rw-crumbs">
        {back && (
          <Link
            to={back}
            className="rw-back"
            aria-label="返回上级页面"
            title="返回上级页面"
          >
            <ArrowLeft size={18} />
          </Link>
        )}
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={12} />}{" "}
            {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="rw-title-row">
        <div className="rw-title-identity">
          <ColorIcon
            Icon={visual.Icon}
            tone={visual.tone}
            size={27}
            className="rw-page-icon"
          />
          <div>
            {eyebrow && <div className="rw-eyebrow">{eyebrow}</div>}
            <h1>{title}</h1>
            {description && <p className="rw-lead">{description}</p>}
          </div>
        </div>
        <div className="rw-actions">
          {actions}
          {canEditEntry &&
            !hasEditAction(actions) &&
            (
              <EditEntry
                {...editInfo}
                label="编辑条目"
              />
            )}
        </div>
      </div>
      {children}
    </header>
  );
}
export function Section({
  title,
  id,
  aside,
  children,
  className = "",
  edit,
  entity,
}) {
  // Custom <section> elements are not collected by Docusaurus's Heading theme.
  // Register the same real DOM id during SSR so query+anchor links can be checked.
  const brokenLinks = useBrokenLinks();
  if (id) brokenLinks.collectAnchor(id);
  const location = useLocation();
  const info = editingContext(
    location.pathname,
    typeof title === "string" ? title : "本节",
    entity,
    {
      returnTo: location.pathname + location.search + (id ? "#" + id : ""),
      ...(typeof edit === "object" ? edit : {}),
    },
  );
  const canEdit = edit !== false && canAutoEditSection(location.pathname, {
    title: typeof title === "string" ? title : "",
    explicit: typeof edit === "object" || edit === true,
  });
  return (
    <section
      id={id}
      className={"rw-section " + className}
      data-wiki-section={typeof title === "string" ? title : undefined}
      data-editable-section={canEdit ? "true" : undefined}
      data-no-editor={!canEdit ? "true" : undefined}
    >
      <div className="rw-section-head">
        <h2 data-has-editor={canEdit ? "true" : undefined}>{title}</h2>
        <div className="rw-section-actions">
          {aside}
          {canEdit && !hasEditAction(aside) && <EditEntry {...info} />}
        </div>
      </div>
      {canEdit ? (
        <PublishedSection {...info}>{children}</PublishedSection>
      ) : (
        children
      )}
    </section>
  );
}
export function Notice({ title, children, tone = "", icon: Icon = Info }) {
  return (
    <div className={"rw-notice " + tone}>
      <Icon size={18} />
      <div>
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
export function EmptyState({
  title = "没有找到符合条件的资料",
  children,
  action,
}) {
  return (
    <div className="rw-empty">
      <Search size={28} />
      <h3>{title}</h3>
      <p>{children || "试试正式名称、别名，或者减少一个筛选条件。"}</p>
      {action}
    </div>
  );
}
export function Contribution({ entity, source, verified = "2026-10-10" }) {
  const location = useLocation();
  const editInfo = editingContext(location.pathname, "条目正文", entity, {
    returnTo: location.pathname + location.search,
  });
  const q = "?" + new URLSearchParams({entity,page:location.pathname+location.search});
  return (
    <div className="rw-contribution">
      <div className="rw-contribution-label">
        <ShieldCheck size={18} />
        <div>
          <strong>这份资料，由玩家一起完善</strong>
          <small>
            {source ? "资料来源已列出 · " : "内容样本 · "}页面整理于 {verified}
          </small>
        </div>
      </div>
      <div className="rw-contribution-links">
        {source && (
          <a href={source} target="_blank" rel="noreferrer">
            资料来源 <ExternalLink size={12} />
          </a>
        )}
        <Link to={"/history/" + q}>
          <History size={14} />
          修订记录
        </Link>
        {!canEditReaderEntry(location.pathname) ? (
          <button type="button" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new CustomEvent("roco:open-feedback", { detail: { title: entity, path: location.pathname + location.search } }))}>
            <CircleHelp size={14} />反馈此页问题
          </button>
        ) : <EditEntry {...editInfo} label="纠错与补充" />}
      </div>
    </div>
  );
}
export function BookmarkButton({ id, title, href, kind = "宠物" }) {
  const [saved, setSaved] = useState(false),
    [storageError, setStorageError] = useState(false);
  const key = "roco-wiki-v4:bookmarks";
  function read() {
    try {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(list)
        ? list.filter((x) => x && typeof x.id === "string")
        : [];
    } catch {
      return [];
    }
  }
  useEffect(() => {
    const sync = () => setSaved(read().some((v) => v.id === id));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("roco-wiki-bookmarks", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("roco-wiki-bookmarks", sync);
    };
  }, [id]);
  const toggle = () => {
    try {
      let list = read();
      const exists = list.some((x) => x.id === id);
      list = list.filter((x) => x.id !== id);
      if (!exists) list.push({ id, title, href, kind });
      localStorage.setItem(key, JSON.stringify(list));
      setSaved(!exists);
      setStorageError(false);
      window.dispatchEvent(new Event("roco-wiki-bookmarks"));
    } catch {
      setStorageError(true);
    }
  };
  return (
    <button
      className={"rw-button " + (saved ? "selected" : "")}
      onClick={toggle}
      aria-pressed={saved}
      title={
        storageError ? "当前浏览器无法保存收藏，请检查本地存储权限" : undefined
      }
    >
      <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
      {storageError ? "保存失败，请重试" : saved ? "已收藏" : "收藏"}
    </button>
  );
}
export function LocalToc({ items }) {
  return (
    <aside className="rw-toc">
      <span className="rw-small-label">本页内容</span>
      <nav>
        {items.map(([id, label]) => (
          <a
            key={id}
            href={"#" + id}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
                block: "start",
              });
            }}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="rw-toc-note">
        <BookOpen size={16} />
        <p>
          内容有疑问？
          <br />
          可以在本页提交补充或纠错。
        </p>
      </div>
    </aside>
  );
}
export function DocGrid({ children, toc }) {
  return (
    <div className="rw-docgrid">
      <div className="rw-docbody">{children}</div>
      {toc && <LocalToc items={toc} />}
    </div>
  );
}
export function DataPair({ label, value }) {
  return (
    <div className="rw-pair">
      <dt>{label}</dt>
      <dd>{value ?? "待核实"}</dd>
    </div>
  );
}
export function TextLink({ to, children }) {
  return (
    <Link className="rw-textlink" to={to}>
      {children}
      <ArrowRight size={14} />
    </Link>
  );
}
export function Subnav({ items, current }) {
  return (
    <nav className="rw-subnav" aria-label="栏目导航">
      {items.map(([to, label]) => (
        <Link key={to} to={to} className={current === to ? "active" : ""}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function SearchLauncher() {
  const ime = useInputComposition();
  const searchRoute = useBaseUrl("/search/");
  const [open, setOpen] = useState(false),
    [value, setValue] = useState("");
  const history = useHistory();
  const dialog = useRef(null);
  useEffect(() => {
    function hotkey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", hotkey);
    return () => document.removeEventListener("keydown", hotkey);
  }, []);
  useEffect(() => {
    const el = dialog.current;
    if (!el?.isConnected) return;
    if (open && !el.open) {
      try { typeof el.showModal === "function" ? el.showModal() : el.setAttribute("open", ""); }
      catch { setOpen(false); }
    } else if (!open && el.open) {
      typeof el.close === "function" ? el.close() : el.removeAttribute("open");
    }
  }, [open]);
  function submit(e) {
    e.preventDefault();
    if (ime.composing.current) return;
    setOpen(false);
    history.push(searchRoute + "?q=" + encodeURIComponent(value));
  }
  return (
    <>
      <button
        className="rw-search-launcher"
        onClick={() => setOpen(true)}
        aria-label="搜索全站"
      >
        <Search size={16} />
        <span>搜索资料</span>
        <kbd>Ctrl K</kbd>
      </button>
      <dialog
        className="rw-search-dialog"
        ref={dialog}
        onCancel={event => { if (ime.composing.current) event.preventDefault(); else setOpen(false); }}
        onClose={() => { if (!dialog.current?.open) setOpen(false); }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        aria-labelledby="rw-search-title"
      >
        <div className="rw-dialog-top">
          <strong id="rw-search-title">查一只宠物，或一种机制</strong>
          <button
            className="rw-icon-button"
            onClick={() => setOpen(false)}
            aria-label="关闭搜索"
          >
            <X size={19} />
          </button>
        </div>
        <form onSubmit={submit} className="rw-searchform">
          <Search size={20} />
          <input
            {...ime.handlers}
            aria-label="搜索词"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="宠物、技能、血脉、活动、地图…"
          />
          <button className="rw-button primary" type="submit">
            搜索
          </button>
        </form>
        <div className="rw-search-hints">
          <span>常用查阅</span>
          {[
            ["海芙约忒", "/pets/haifu/"],
            ["技能先手", "/mechanics/priority/"],
            ["回归指南", "/guides/returning/"],
            ["活动获取", "/events/"],
          ].map(([label, to]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)}>
              {label}
              <ArrowRight size={13} />
            </Link>
          ))}
        </div>
        <small className="rw-muted">
          支持正式名称与已收录别名；按 Enter 查看全部结果。
        </small>
      </dialog>
    </>
  );
}

export function PreviewHeader({ className = "" }) {
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenu(false), [loc.pathname, loc.search]);
  const links = [
    ["/", "首页"],
    ["/pets/", "宠物图鉴"],
    ["/skills/", "技能与血脉"],
    ["/mechanics/", "战斗机制"],
    ["/events/", "活动与获取"],
    ["/battle/", "PVP 对战"],
    ["/pve/", "PVE 指南"],
    ["/adventure/", "冒险资料"],
    ["/tools/", "工具"],
  ];
  const base = useBaseUrl("/");
  const current = "/" + loc.pathname.slice(base.length).replace(/^\/+/, "");
  return (
    <header className={["rw-site-header", className].filter(Boolean).join(" ")}>
      <div className="rw-masthead">
        <Link to="/" className="rw-wordmark" aria-label="RocoWiki 首页">
          <BookOpen size={29} strokeWidth={1.45} />
          <span>
            <b>RocoWiki</b>
            <small>洛克王国页游 · 玩家共建百科</small>
          </span>
        </Link>
        <SearchLauncher />
        <div className="rw-member-nav">
          <Link to="/help/contributing/" className="rw-contribute-link">
            <NotebookPen size={17} />
            贡献指南
          </Link>
          <Link to="/account/" className="rw-account-link">
            <HeaderProfileAvatar />
            <span>个人中心</span>
          </Link>
          <button
            className="rw-nav-toggle"
            aria-label={menu ? "收起导航" : "展开导航"}
            aria-expanded={menu}
            aria-controls="rw-primary-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      <nav
        id="rw-primary-navigation"
        className={"rw-primary-navigation " + (menu ? "is-open" : "")}
        aria-label="主导航"
        onClick={(event) => { if (event.target.closest("a")) setMenu(false); }}
      >
        <div>
          {links.map(([to, label]) => {
            const active =
              to === "/"
                ? current === "/"
                : current.startsWith(to) ||
                  (to === "/skills/" && current.startsWith("/bloodlines/"));
            const selected =
              active || (to === "/pve/" && current.startsWith("/challenges/")) ||
              (to === "/adventure/" && /^\/(places|npcs|items|tasks)\//.test(current));
            return (
              <Link
                to={to}
                key={to}
                className={selected ? "active" : ""}
                aria-current={selected ? "page" : undefined}
              >
                <ColorIcon
                  kind={to === "/" ? "home" : to.split("/")[1]}
                  size={16}
                />
                {label}
              </Link>
            );
          })}
          <Link to="/guides/returning/" className={"rw-nav-guide" + (current === "/guides/returning/" ? " active" : "")} aria-current={current === "/guides/returning/" ? "page" : undefined}>
            回归指南 <ArrowRight size={13} />
          </Link>
        </div>
      </nav>
    </header>
  );
}
export function PreviewFooter() {
  const {demo} = useWikiRuntime();
  return (
    <>
    <PageCommunityFooter />
    <footer className="rw-footer rw-footer-v71 rw-footer-v72 rw-footer-v73">
      <div className="rw-footer-brand">
        <BookOpen size={25} strokeWidth={1.6} aria-hidden="true" />
        <div>
        <strong>RocoWiki</strong>
        <span>洛克王国页游 · 玩家共建百科</span>
        <p>记录每一次探索，连接每一份发现。</p>
        <div className="rw-footer-standards-v73"><span><BookOpen size={12} />条目有出处</span><span><History size={12} />修订可追溯</span></div>
        </div>
      </div>
      <nav aria-label="页脚导航">
        <div><h2>一起维护资料</h2><Link to="/help/contributing/">第一次编辑怎么做</Link><Link to="/community/">共建任务与待核内容</Link><Link to="/history/">查看资料修订记录</Link><Link to="/copyright/">版权与许可 / Copyright</Link></div>
        <div><h2>来自洛克王国</h2><a href="https://17roco.qq.com/" target="_blank" rel="noreferrer">页游官方网站<ExternalLink size={11} /></a><a href="https://17roco.gamebbs.qq.com/" target="_blank" rel="noreferrer">官方论坛与游戏公告<ExternalLink size={11} /></a><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("roco:open-feedback"))}><MessageSquareText size={13} />反馈本页问题</button></div>
      </nav>
      <small><span>玩家共建的非官方百科 · 原创代码 GPLv3 · 原创正文许可政策 CC BY-SA 4.0 · 游戏及第三方素材权利归原权利人，授权范围见版权声明。</span><span>{demo ? "界面预览 · 投稿、讨论与计算记录保存在当前浏览器；资料日期以条目内标注为准。" : "正式修订通过站内账号提交审核；资料日期以条目内标注为准。"}</span></small>
    </footer>
    </>
  );
}
