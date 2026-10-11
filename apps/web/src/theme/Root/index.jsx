import React from "react";
import { GlobalFeedback } from "../../wiki/Feedback";
import { useLocation } from "@docusaurus/router";
import WikiRecoveryBoundary from "../../wiki/WikiRecoveryBoundary";
export default function Root({ children }) {
  const location = useLocation();
  return (
    <>
      <WikiRecoveryBoundary resetKey={location.pathname + location.search}>{children}</WikiRecoveryBoundary>
      <WikiRecoveryBoundary resetKey={location.pathname + location.search} title="反馈面板暂时无法显示"><GlobalFeedback /></WikiRecoveryBoundary>
    </>
  );
}
