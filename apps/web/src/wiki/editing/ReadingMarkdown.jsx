import React from "react";
import { marked } from "marked";
import GithubSlugger from "github-slugger";
import Link from "@docusaurus/Link";
import EntityReference from "../EntityReference";
import EditEntry from "./EditEntry";
import { documentSections, plainHeading } from "./documentComposition";

const decodeText = (value) =>
  String(value || "").replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (full, code) => {
      const basic = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
      if (basic[code]) return basic[code];
      const number =
        code[1]?.toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isInteger(number) && number >= 0 && number <= 0x10ffff
        ? String.fromCodePoint(number)
        : full;
    },
  );

export function readableLink(href, path = "/") {
  const value = String(href || "").trim();
  if (!value) return "";
  if (/^(https?:\/\/|mailto:)/i.test(value)) return value;
  if (/^#/.test(value)) return value;
  if (
    /^\/\//.test(value) ||
    /^[a-z][a-z\d+.-]*:/i.test(value) ||
    /[<>\\]/.test(value)
  )
    return "";
  try {
    // Wiki document slugs end with '/', but relative Markdown links refer to
    // the source file's siblings (returning.md → training.md).
    const url = new URL(
      value,
      "https://wiki.invalid" + (path === "/" ? path : path.replace(/\/$/, "")),
    );
    let pathname = url.pathname.replace(/\.mdx?$/, "");
    if (!/\.[a-z\d]+$/i.test(pathname) && !pathname.endsWith("/"))
      pathname += "/";
    return pathname + url.search + url.hash;
  } catch {
    return "";
  }
}

/** Render constrained Markdown as React nodes; never evaluate MDX or raw HTML. */
export default function ReadingMarkdown({
  markdown = "",
  document: doc,
  context,
  editHeadings = true,
  className = "",
}) {
  const tokens = marked.lexer(String(markdown), { gfm: true });
  const sections = documentSections(markdown, doc?.sections || []);
  const slugger = new GithubSlugger();
  const path = doc?.path || context?.returnTo?.split(/[?#]/)[0] || "/";
  const entity = doc?.title || context?.entity;
  let headingIndex = 0;
  let serial = 0;
  function children(token) {
    return render(token.tokens || [{ type: "text", text: token.text || "" }]);
  }
  function link(token, key) {
    const to = readableLink(token.href, path);
    const content = children(token);
    if (!to) return <span key={key}>{content}</span>;
    if (to.startsWith("#"))
      return (
        <a
          key={key}
          href={to}
          onClick={(event) => {
            event.preventDefault();
            let id = to.slice(1);
            try {
              id = decodeURIComponent(id);
            } catch {}
            const document = event.currentTarget.ownerDocument;
            document
              .getElementById(id)
              ?.scrollIntoView({
                behavior: document.defaultView?.matchMedia?.(
                  "(prefers-reduced-motion: reduce)",
                ).matches
                  ? "auto"
                  : "smooth",
                block: "start",
              });
          }}
        >
          {content}
        </a>
      );
    return to.startsWith("/") ? (
      <EntityReference key={key} to={to}>
        {content}
      </EntityReference>
    ) : (
      <a key={key} href={to} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }
  function render(items) {
    return items.map((token) => {
      const key = serial++;
      switch (token.type) {
        case "space":
          return null;
        case "text":
        case "escape":
          return token.tokens ? (
            <React.Fragment key={key}>{render(token.tokens)}</React.Fragment>
          ) : (
            decodeText(token.text)
          );
        case "strong":
          return <strong key={key}>{children(token)}</strong>;
        case "em":
          return <em key={key}>{children(token)}</em>;
        case "del":
          return <del key={key}>{children(token)}</del>;
        case "codespan":
          return <code key={key}>{decodeText(token.text)}</code>;
        case "br":
          return <br key={key} />;
        case "paragraph":
          return <p key={key}>{children(token)}</p>;
        case "link":
          return link(token, key);
        case "image": {
          const src = readableLink(token.href, path);
          return /^(\/|https?:\/\/)/.test(src) ? (
            <img
              key={key}
              src={src}
              alt={decodeText(token.text)}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span key={key}>{decodeText(token.text)}</span>
          );
        }
        case "heading": {
          const title = plainHeading(token.text);
          const nativeId = slugger.slug(title);
          const section = token.depth >= 2 ? sections[headingIndex++] : null;
          const id = section?.id || nativeId;
          const Heading = `h${Math.min(6, Math.max(2, token.depth))}`;
          return (
            <React.Fragment key={key}>
              {nativeId !== id && (
                <span
                  id={nativeId}
                  className="rw-anchor-alias"
                  aria-hidden="true"
                />
              )}
              <Heading
                id={id}
                data-has-editor={editHeadings && entity ? "true" : undefined}
              >
                {children(token)}
                {editHeadings && entity && (
                  <span className="rw-inline-section-edit">
                    <EditEntry
                      entity={entity}
                      section={title}
                      mode="article"
                      returnTo={path + "#" + id}
                      compact
                    />
                  </span>
                )}
              </Heading>
            </React.Fragment>
          );
        }
        case "list": {
          const List = token.ordered ? "ol" : "ul";
          return (
            <List key={key} start={token.ordered ? token.start : undefined}>
              {token.items.map((item, index) => (
                <li key={index}>
                  {item.task && (
                    <input
                      type="checkbox"
                      checked={Boolean(item.checked)}
                      readOnly
                      aria-label={item.checked ? "已完成" : "未完成"}
                    />
                  )}
                  {render(item.tokens || [])}
                </li>
              ))}
            </List>
          );
        }
        case "table":
          return (
            <table key={key}>
              <thead>
                <tr>
                  {token.header.map((cell, index) => (
                    <th
                      key={index}
                      scope="col"
                      style={{ textAlign: token.align[index] || undefined }}
                    >
                      {render(cell.tokens)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {token.rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, column) => (
                      <td
                        key={column}
                        style={{ textAlign: token.align[column] || undefined }}
                      >
                        {render(cell.tokens)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        case "blockquote":
          return (
            <blockquote key={key}>{render(token.tokens || [])}</blockquote>
          );
        case "code":
          return (
            <pre key={key}>
              <code>{token.text}</code>
            </pre>
          );
        case "hr":
          return <hr key={key} />;
        case "html":
          return <p key={key}>{token.text || token.raw}</p>;
        default:
          return (
            <React.Fragment key={key}>
              {decodeText(token.text || token.raw || "")}
            </React.Fragment>
          );
      }
    });
  }
  return (
    <div className={"rw-reading-markdown " + className}>{render(tokens)}</div>
  );
}
