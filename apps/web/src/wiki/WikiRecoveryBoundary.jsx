import React from "react";
import { CircleAlert, Copy, House, RotateCcw } from "lucide-react";

/** A rendering error must leave a usable route back, rather than an empty root. */
export default class WikiRecoveryBoundary extends React.Component {
  state = { error: null, copied: false };
  static getDerivedStateFromError(error) { return { error, copied: false }; }
  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null, copied: false });
  }
  render() {
    if (!this.state.error) return this.props.children;
    const detail = String(this.state.error?.message || "Unknown rendering error").slice(0, 500);
    const home = typeof window !== "undefined" && window.location.hash.startsWith("#/") ? "#/" : "/";
    return <section className="rw-recovery-v73" role="alert" data-no-editor>
      <CircleAlert size={27} />
      <div><h2>{this.props.title || "这部分内容暂时无法显示"}</h2>
        <p>可以重新显示，或返回首页继续查阅。已保存的本机草稿和计算记录仍然保留。</p>
        <div className="rw-recovery-actions-v73">
          <button type="button" onClick={() => this.setState({ error: null, copied: false })}><RotateCcw size={15} />重新显示</button>
          <a href={home}><House size={15} />返回首页</a>
          <button type="button" onClick={async () => {
            try { await navigator.clipboard.writeText("RocoWiki V7.3 · " + detail); this.setState({ copied: true }); }
            catch { this.setState({ copied: false }); }
          }}><Copy size={14} />{this.state.copied ? "已复制摘要" : "复制错误摘要"}</button>
        </div>
        <details><summary>错误摘要</summary><code>{detail}</code></details>
      </div>
    </section>;
  }
}
