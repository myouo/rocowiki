import React from "react";
import { CircleAlert, RotateCcw } from "lucide-react";

/** Keep a failed reader inside its own panel. Retry never rewrites the draft. */
export default class PreviewBoundary extends React.Component {
  state = { error: null, attempt: 0 };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error) {
    const scope = this.props.scope || "reading-preview";
    const detail = { scope, message: String(error?.message || "未知渲染错误") };
    if (typeof window !== "undefined") window.dispatchEvent(new window.CustomEvent("roco:render-error", { detail }));
    this.props.onError?.(error);
  }

  componentDidUpdate(previous) {
    if (this.state.error && (previous.resetKey !== this.props.resetKey || previous.scope !== this.props.scope)) {
      this.setState({ error: null });
    }
  }

  retry = () => {
    this.setState((state) => ({ error: null, attempt: state.attempt + 1 }));
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.error) return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    return <section className="rw-local-render-error-v73" role="alert" data-render-error-scope={this.props.scope || "reading-preview"}>
      <CircleAlert size={21} aria-hidden="true" />
      <div><strong>{this.props.title || "这部分内容暂时无法展示"}</strong><p>{this.props.message || "可以重试，或返回填写界面检查内容。当前输入仍保留在编辑器中。"}</p>
        <button type="button" onClick={this.retry}><RotateCcw size={13} aria-hidden="true" />重新显示</button>
        <details><summary>错误信息</summary><pre>{String(this.state.error?.message || "未知渲染错误")}</pre></details>
      </div>
    </section>;
  }
}
