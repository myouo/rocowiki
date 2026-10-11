// The standalone HTML is explicitly an offline demonstration.
export default function useDocusaurusContext() {
  return {siteConfig: {customFields: {workspaceMode: "demo", workspaceModeExplicit: true}}};
}
