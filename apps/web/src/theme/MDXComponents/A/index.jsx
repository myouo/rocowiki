import React from "react";
import OriginalLink from "@theme-original/MDXComponents/A";
import { useLocation } from "@docusaurus/router";
import EntityReference from "../../../wiki/EntityReference";
import { resolveEntityReference } from "../../../wiki/entityReferences";
import { readableLink } from "../../../wiki/editing/ReadingMarkdown";

/** Native built Markdown uses the same entity presentation as editing previews. */
export default function WikiMarkdownLink({ href, children, ...props }) {
  const location = useLocation();
  const to = readableLink(href, location.pathname);
  return resolveEntityReference(to)
    ? <EntityReference {...props} to={to}>{children}</EntityReference>
    : <OriginalLink {...props} href={href}>{children}</OriginalLink>;
}
