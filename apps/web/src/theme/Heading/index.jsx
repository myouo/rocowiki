import React from "react";
import OriginalHeading from "@theme-original/Heading";
import { useLocation } from "@docusaurus/router";
import EditEntry from "../../wiki/editing/EditEntry";
import { publishedDocs } from "../../wiki/content/bundled.js";
function textOf(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return React.isValidElement(node) ? textOf(node.props.children) : "";
}
export default function Heading(props) {
  const location = useLocation();
  const doc = publishedDocs.documents.find((d) => d.path === location.pathname);
  const eligible = doc && /^h[2-6]$/.test(String(props.as));
  const section = textOf(props.children);
  return (
    <OriginalHeading {...props} data-has-editor={eligible ? "true" : undefined}>
      {props.children}
      {eligible && (
        <span className="rw-inline-section-edit">
          <EditEntry
            entity={doc.title}
            section={section}
            mode="article"
            returnTo={location.pathname + (props.id ? "#" + props.id : "")}
            label="编辑本节"
            compact
          />
        </span>
      )}
    </OriginalHeading>
  );
}
