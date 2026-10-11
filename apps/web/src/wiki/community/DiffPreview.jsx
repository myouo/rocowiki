import React, { useMemo, useState } from "react";
import Link from "@docusaurus/Link";
import { GitCompareArrows } from "lucide-react";
import { lineDiff } from "./demo/editorModel.js";
import { isHttpUrl } from "./navigation.js";

function DiffViewer({
  before,
  after,
  beforeLabel = "修改前",
  afterLabel = "修改后",
}) {
  const [unified, setUnified] = useState(false);
  const lines = useMemo(
    () => lineDiff(before || "", after || ""),
    [before, after],
  );
  const plus = lines.filter((line) => line.type === "add").length;
  const minus = lines.filter((line) => line.type === "remove").length;
  return (
    <div className="cm-diff">
      <div className="cm-diff-toolbar">
        <div>
          <GitCompareArrows size={16} />
          <strong>版本差异</strong>
          <span className="cm-diff-plus">+{plus}</span>
          <span className="cm-diff-minus">−{minus}</span>
        </div>
        <button type="button" onClick={() => setUnified((value) => !value)}>
          {unified ? "并排查看" : "逐行查看"}
        </button>
      </div>
      {unified ? (
        <div className="cm-diff-unified">
          {lines.map((line, index) => (
            <div className={`cm-diff-line cm-diff-${line.type}`} key={index}>
              <span className="cm-line-number">{line.old || ""}</span>
              <span className="cm-line-number">{line.next || ""}</span>
              <span className="cm-line-sign">
                {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
              </span>
              <span>{line.text || " "}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="cm-diff-split">
          <div>
            <h4>{beforeLabel}</h4>
            {lines
              .filter((line) => line.type !== "add")
              .map((line, index) => (
                <div
                  className={`cm-diff-line cm-diff-${line.type}`}
                  key={index}
                >
                  <span className="cm-line-number">{line.old}</span>
                  <span>{line.text || " "}</span>
                </div>
              ))}
          </div>
          <div>
            <h4>{afterLabel}</h4>
            {lines
              .filter((line) => line.type !== "remove")
              .map((line, index) => (
                <div
                  className={`cm-diff-line cm-diff-${line.type}`}
                  key={index}
                >
                  <span className="cm-line-number">{line.next}</span>
                  <span>{line.text || " "}</span>
                </div>
              ))}
          </div>
        </div>
      )}
      {plus === 0 && minus === 0 && (
        <p className="cm-diff-no-change">两个版本内容相同。</p>
      )}
    </div>
  );
}

function inlineMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={index}>{part.slice(1, -1)}</code>;
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (match && /^\/(?!\/)[^\s<>\\]*$/.test(match[2]))
      return (
        <Link key={index} to={match[2]}>
          {match[1]}
        </Link>
      );
    if (match && isHttpUrl(match[2]))
      return (
        <a
          key={index}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[1]}
        </a>
      );
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function MarkdownPreview({ value }) {
  if (!value.trim())
    return <p className="cm-muted">输入正文后，这里会显示阅读预览。</p>;
  const lines = value.split("\n");
  const blocks = [];
  const cells = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replace(/\\\|/g, "|"));
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (
      line.includes("|") &&
      lines[index + 1] &&
      cells(lines[index + 1]).every((cell) => /^:?-{3,}:?$/.test(cell))
    ) {
      const header = cells(line),
        rows = [];
      index += 2;
      while (
        index < lines.length &&
        lines[index].includes("|") &&
        lines[index].trim()
      ) {
        rows.push(cells(lines[index]));
        index++;
      }
      index--;
      blocks.push(
        <div key={`table-${index}`} className="ev7-markdown-table">
          <table>
            <thead>
              <tr>
                {header.map((cell, column) => (
                  <th key={column}>{inlineMarkdown(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {header.map((_, column) => (
                    <td key={column}>{inlineMarkdown(row[column] || "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push(
        React.createElement(
          `h${Math.min(heading[1].length + 1, 6)}`,
          { key: index },
          inlineMarkdown(heading[2]),
        ),
      );
      continue;
    }
    const bullet = line.match(/^(?:([-*])|(\d+)\.)\s+(.+)$/);
    if (bullet) {
      blocks.push(
        <div className="cm-markdown-bullet" key={index}>
          <span>{bullet[2] ? `${bullet[2]}.` : "•"}</span>
          <span>{inlineMarkdown(bullet[3])}</span>
        </div>,
      );
      continue;
    }
    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote key={index}>{inlineMarkdown(line.slice(2))}</blockquote>,
      );
      continue;
    }
    blocks.push(
      line ? (
        <p key={index}>{inlineMarkdown(line)}</p>
      ) : (
        <div className="cm-markdown-space" key={index} />
      ),
    );
  }
  return <div className="cm-markdown-preview">{blocks}</div>;
}

export { DiffViewer, MarkdownPreview };
