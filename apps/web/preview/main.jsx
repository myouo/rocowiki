import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterContext, useHistory } from "./router";
import PreviewLayout from "./layout";
import WikiPage from "../src/wiki/WikiPage";
import { Link, Contribution, normalizePath } from "../src/wiki/core";
import { ArrowLeft } from "lucide-react";
import docs from "./generated-docs.json";
import sidebars from "../sidebars.js";
import CustomSelect from "../src/wiki/Select";
import EditEntry from "../src/wiki/editing/EditEntry";
import PublishedDocument from "../src/wiki/editing/PublishedDocument";
import publishedDocs from "../content/published-docs-v7.json";
import WikiRecoveryBoundary from "../src/wiki/WikiRecoveryBoundary";

function sidebarEntries(items) {
  return items.flatMap((item) => {
    if (typeof item === "string") {
      const to = normalizePath(item);
      if (!docs[to]) return [];
      return [
        {
          type: "doc",
          to,
          label: item === "mechanics/overview" ? "全部机制" : docs[to].title,
        },
      ];
    }
    if (item.type === "category") {
      const children = sidebarEntries(item.items || []);
      return children.length
        ? [
            {
              type: "category",
              label: item.label,
              collapsed: item.collapsed !== false,
              children,
            },
          ]
        : [];
    }
    return [];
  });
}
function sidebarLeaves(items) {
  return items.flatMap((item) =>
    item.type === "doc" ? [item] : sidebarLeaves(item.children),
  );
}
function SidebarLinks({ items, path }) {
  return items.map((item) =>
    item.type === "doc" ? (
      <Link
        to={item.to}
        key={item.to}
        className={path === item.to ? "active" : ""}
        aria-current={path === item.to ? "page" : undefined}
      >
        {item.label}
      </Link>
    ) : (
      <details
        key={item.label}
        className="rw-preview-sidebar-group"
        open={
          !item.collapsed ||
          sidebarLeaves(item.children).some((entry) => entry.to === path)
        }
      >
        <summary>{item.label}</summary>
        <div className="rw-preview-sidebar-children">
          <SidebarLinks items={item.children} path={path} />
        </div>
      </details>
    ),
  );
}
function mobileSidebarOptions(items) {
  return items.flatMap((item) =>
    item.type === "doc"
      ? [{ value: item.to, label: item.label }]
      : sidebarLeaves(item.children).map((entry) => ({
          value: entry.to,
          label: entry.label,
          group: item.label,
        })),
  );
}
function scrollToHeading(id) {
  let decodedId = id;
  try {
    decodedId = decodeURIComponent(id);
  } catch {}
  const reduceMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  document.getElementById(decodedId)?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

function readLocation() {
  const raw = window.location.hash.slice(1) || "/";
  const fragmentIndex = raw.indexOf("#");
  const route = fragmentIndex >= 0 ? raw.slice(0, fragmentIndex) : raw;
  const split = route.indexOf("?");
  return {
    pathname: normalizePath(split >= 0 ? route.slice(0, split) : route),
    search: split >= 0 ? route.slice(split) : "",
    hash: fragmentIndex >= 0 ? raw.slice(fragmentIndex) : "",
  };
}
function PreviewDoc({ path }) {
  const doc = docs[path],
    history = useHistory();
  const isHelp = path.startsWith("/help/"),
    isGuide = path.startsWith("/guides/");
  const group = isHelp ? "贡献帮助" : isGuide ? "玩家指南" : "战斗机制";
  const sidebar = sidebarEntries(
    isHelp
      ? sidebars.helpSidebar
      : isGuide
        ? sidebars.guidesSidebar
        : sidebars.mechanicsSidebar,
  );
  const groupKeys = sidebarLeaves(sidebar).map((item) => item.to);
  const currentIndex = groupKeys.indexOf(path);
  const parent = isHelp ? "/help/" : isGuide ? "/guides/" : "/mechanics/";
  function contentLink(e) {
    const anchor = e.target.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href") || "";
    if (href.startsWith("/")) {
      e.preventDefault();
      history.push(href);
    } else if (href.startsWith("#")) {
      e.preventDefault();
      scrollToHeading(href.slice(1));
    }
  }
  return (
    <PreviewLayout title={doc.title}>
      <main id="rw-main" tabIndex={-1} className="rw-preview-doc-layout">
        <aside className="rw-preview-sidebar">
          <strong>{group}</strong>
          <SidebarLinks items={sidebar} path={path} />
          <small>继续查阅</small>
          <Link to="/skills/">技能查询</Link>
          <Link to="/pets/">宠物图鉴</Link>
          <Link to="/guides/returning/">回归指南</Link>
        </aside>
        <CustomSelect
          className="rw-mobile-doc-select"
          ariaLabel="切换知识文章"
          value={path}
          onChange={(value) => history.push(value)}
          searchable
          options={
            groupKeys.includes(path)
              ? mobileSidebarOptions(sidebar)
              : [
                  { value: path, label: doc.title },
                  ...mobileSidebarOptions(sidebar),
                ]
          }
        />
        <article className="rw-preview-doc-body">
          <div className="rw-doc-native-back">
            {path !== parent && (
              <Link to={parent} className="rw-back" aria-label="返回上级目录">
                <ArrowLeft size={17} />
              </Link>
            )}
            <nav className="rw-doc-breadcrumbs" aria-label="文档位置">
              <Link to={parent}>{group}</Link>
              <span aria-hidden="true"> / </span>
              <span aria-current="page">{doc.title}</span>
            </nav>
            <EditEntry
              entity={doc.title}
              section="条目正文"
              mode="article"
              returnTo={path}
              label="编辑条目"
            />
          </div>
          <PublishedDocument
            document={publishedDocs.documents.find((doc) => doc.path === path)}
          >
            <div className="theme-doc-markdown" onClick={contentLink}>
              <h1>{doc.title}</h1>
              <div dangerouslySetInnerHTML={{ __html: doc.html }} />
            </div>
          </PublishedDocument>
          <Contribution entity={doc.title} />
          <div className="rw-inline-links">
            {currentIndex > 0 && (
              <Link to={groupKeys[currentIndex - 1]}>
                上一篇：{docs[groupKeys[currentIndex - 1]].title}
              </Link>
            )}
            {currentIndex >= 0 && currentIndex < groupKeys.length - 1 && (
              <Link to={groupKeys[currentIndex + 1]}>
                下一篇：{docs[groupKeys[currentIndex + 1]].title}
              </Link>
            )}
          </div>
        </article>
        <aside className="rw-preview-doc-toc">
          <span className="rw-small-label">本页内容</span>
          {doc.headings.map((h) => (
            <a
              key={h.id}
              href={"#" + h.id}
              onClick={(e) => {
                e.preventDefault();
                scrollToHeading(h.id);
              }}
            >
              {h.text}
            </a>
          ))}
        </aside>
      </main>
    </PreviewLayout>
  );
}
function App() {
  const [loc, setLoc] = useState(readLocation);
  useEffect(() => {
    function onHash() {
      setLoc(readLocation());
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (loc.hash) scrollToHeading(loc.hash.slice(1));
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [loc.pathname, loc.hash]);
  return (
    <RouterContext.Provider value={loc}>
      <WikiRecoveryBoundary resetKey={loc.pathname + loc.search}>
      {docs[loc.pathname] ? (
        <PreviewDoc key={loc.pathname} path={loc.pathname} />
      ) : (
        <WikiPage key={loc.pathname} routeData={{ path: loc.pathname }} />
      )}
      </WikiRecoveryBoundary>
    </RouterContext.Provider>
  );
}
createRoot(document.getElementById("root")).render(<App />);
