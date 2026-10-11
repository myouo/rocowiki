import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {workspaceMode} from "./policy";

export function useWikiRuntime() {
  const fields = useDocusaurusContext()?.siteConfig?.customFields || {};
  // Derive defaults from this bundle's target, even if a concurrent build refreshed site metadata.
  const mode = workspaceMode(fields.workspaceModeExplicit ? fields.workspaceMode : process.env.NODE_ENV === "production" ? "server" : "demo");
  return {mode, demo: mode === "demo", apiOrigin: fields.apiOrigin, githubUrl: fields.githubUrl};
}
