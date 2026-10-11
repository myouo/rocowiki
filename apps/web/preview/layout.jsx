import React, { useEffect } from "react";
import { PreviewHeader, PreviewFooter } from "../src/wiki/core";
import { GlobalFeedback } from "../src/wiki/Feedback";
import WikiRecoveryBoundary from "../src/wiki/WikiRecoveryBoundary";
export default function PreviewLayout({ title, children }) {
  useEffect(() => {
    document.title = (title ? title + " · " : "") + "RocoWiki";
  }, [title]);
  return (
    <>
      <a
        className="sr-only"
        href="#rw-main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("rw-main")?.focus();
        }}
      >
        跳到主要内容
      </a>
      <PreviewHeader />
      {children}
      <PreviewFooter />
      <WikiRecoveryBoundary title="反馈面板暂时无法显示"><GlobalFeedback /></WikiRecoveryBoundary>
    </>
  );
}
