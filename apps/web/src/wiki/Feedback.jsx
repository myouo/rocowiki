import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "@docusaurus/router";
import { MessageSquareText, X, CheckCircle2, ArrowRight } from "lucide-react";
import { Link, PageHeader, EmptyState } from "./core";
import CustomSelect from "./Select";
import BoundedTextarea from "./BoundedTextarea";

const KEY = "roco-wiki-v5:feedback";
function readFeedback() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (v) =>
              v && typeof v.id === "string" && typeof v.details === "string",
          )
          .map((v) => ({
            ...v,
            title: typeof v.title === "string" ? v.title : "未记录页面标题",
            path:
              typeof v.path === "string" &&
              v.path.startsWith("/") &&
              !v.path.startsWith("//")
                ? v.path
                : "/feedback/",
            kind: typeof v.kind === "string" ? v.kind : "其他建议",
            source: typeof v.source === "string" ? v.source : "",
            createdAt:
              typeof v.createdAt === "string" &&
              Number.isFinite(Date.parse(v.createdAt))
                ? v.createdAt
                : null,
          }))
      : [];
  } catch {
    return [];
  }
}
export function GlobalFeedback() {
  const location = useLocation();
  const [open, setOpen] = useState(false),
    [kind, setKind] = useState("资料错误"),
    [details, setDetails] = useState(""),
    [source, setSource] = useState(""),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef(null),
    trigger = useRef(null),
    invoker = useRef(null),
    context = useRef({});
  useEffect(() => {
    const el = dialog.current;
    if (!el?.isConnected) return;
    try {
      if (open && !el.open) {
        if (typeof el.showModal === "function") el.showModal();
        else el.setAttribute("open", "");
      }
      if (!open && el.open) {
        if (typeof el.close === "function") el.close();
        else el.removeAttribute("open");
      }
    } catch {
      setError("反馈面板暂时无法打开，请重试。");
      setOpen(false);
    }
  }, [open]);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const requested = (event) => launch(event.detail);
    window.addEventListener("roco:open-feedback", requested);
    return () => window.removeEventListener("roco:open-feedback", requested);
  }, [location.pathname, location.search]);
  const close = () => {
    setOpen(false);
    (invoker.current?.isConnected ? invoker.current : trigger.current)?.focus();
  };
  function launch(requested) {
    invoker.current = document.activeElement;
    context.current = {
      path: typeof requested?.path === "string" && requested.path.startsWith("/") && !requested.path.startsWith("//") ? requested.path : location.pathname + location.search,
      title: typeof requested?.title === "string" ? requested.title : document.title,
    };
    setSaved(false);
    setError("");
    setDetails("");
    setSource("");
    setOpen(true);
  }
  function submit(e) {
    e.preventDefault();
    if (details.trim().length < 5) {
      setError("请至少写 5 个字，说明具体位置和问题。");
      return;
    }
    try {
      const item = {
        id: "FB-" + Date.now().toString(36).toUpperCase(),
        ...context.current,
        kind,
        details: details.trim(),
        source: source.trim(),
        createdAt: new Date().toISOString(),
        status: "local",
      };
      localStorage.setItem(KEY, JSON.stringify([item, ...readFeedback()]));
      window.dispatchEvent(new Event("roco-wiki-feedback"));
      setSaved(true);
      setError("");
    } catch {
      setError("当前浏览器无法保存反馈，请复制内容后重试。");
    }
  }
  return (
    <>
      <button
        ref={trigger}
        className="rw-feedback-trigger"
        onClick={launch}
        aria-haspopup="dialog"
      >
        <MessageSquareText size={19} />
        <span>反馈问题</span>
      </button>
      <dialog
        className="rw-feedback-dialog"
        ref={dialog}
        onCancel={close}
        onClose={() => { if (!dialog.current?.open) setOpen(false); }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        aria-labelledby="rw-feedback-title"
      >
        <div className="rw-dialog-top">
          <h2 id="rw-feedback-title">帮助完善这页资料</h2>
          <button
            className="rw-icon-button"
            aria-label="关闭反馈"
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        {saved ? (
          <div className="rw-feedback-saved" role="status">
            <CheckCircle2 size={35} />
            <h3>反馈已保存在本机</h3>
            <p>
              你可以在个人中心的“我的反馈”中继续查看。此预览尚未连接站点反馈服务。
            </p>
            <Link to="/feedback/" className="rw-button primary" onClick={close}>
              查看我的反馈 <ArrowRight size={15} />
            </Link>
            <button onClick={close} className="rw-button">
              继续阅读
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="rw-feedback-context">
              <small>反馈页面</small>
              <strong>{context.current.title || "当前页面"}</strong>
              <span>{context.current.path}</span>
            </div>
            <label>
              问题类型
              <CustomSelect ariaLabel="反馈问题类型" value={kind} onChange={setKind} options={[
                  "资料错误",
                  "规则已过期",
                  "缺少资料",
                  "显示或交互异常",
                  "其他建议",
                ]} />
            </label>
            <label>
              问题说明 <span className="rw-required">必填</span>
              <BoundedTextarea
                aria-label="问题说明"
                required
                minLength={5}
                maxLength={4000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="哪一段有问题？你看到的实际情况是什么？"
                rows={5}
              />
            </label>
            <label>
              参考来源 <span className="rw-muted">选填</span>
              <input
                type="url"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="公告、实测视频或资料链接"
              />
            </label>
            {error && (
              <p className="rw-form-error" role="alert">
                {error}
              </p>
            )}
            <p className="rw-subnote">
              交互预览：记录仅保存在当前浏览器。页面地址已自动附上。
            </p>
            <div className="rw-feedback-actions">
              <Link to="/help/contributing/" onClick={close}>
                想直接修订？查看贡献指南
              </Link>
              <button className="rw-button primary" type="submit">
                保存反馈
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
export function FeedbackPage() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const sync = () => setItems(readFeedback());
    sync();
    window.addEventListener("roco-wiki-feedback", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("roco-wiki-feedback", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return (
    <>
      <PageHeader
        title="我的反馈"
        back="/account/"
        crumbs={[{ label: "个人中心", to: "/account/" }, { label: "我的反馈" }]}
        description="查看你在阅读时记录的问题，带着页面上下文继续完善资料。"
      />
      <p className="rw-subnote">以下为本机保存记录，尚未发送给站点编辑。</p>
      {items.length ? (
        <div className="rw-feedback-records">
          {items.map((item) => (
            <article key={item.id}>
              <div>
                <span className="rw-badge">{item.kind}</span>
                <time>
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString("zh-CN")
                    : "日期未记录"}
                </time>
                <small>{item.id}</small>
              </div>
              <h2>
                <Link to={item.path}>
                  {item.title.replace(/ · RocoWiki$/, "")}
                </Link>
              </h2>
              <p>{item.details}</p>
              {/^https?:\/\//.test(item.source) && (
                <a href={item.source} target="_blank" rel="noreferrer">
                  查看参考来源
                </a>
              )}
              <span className="rw-local-status">本机记录</span>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="暂时没有反馈记录">
          阅读任何页面时，都可以通过右下角的“反馈问题”按钮记录疑问。
        </EmptyState>
      )}
    </>
  );
}
