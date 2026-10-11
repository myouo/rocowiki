import React from "react";
import OriginalContent from "@theme-original/DocItem/Content";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import Link from "@docusaurus/Link";
import { useLocation, useHistory } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";
import sidebars from "../../../../sidebars.js";
import { docTitles } from "../../../wiki/data";
import { ArrowLeft } from "lucide-react";
import { Contribution } from "../../../wiki/core";
import CustomSelect from "../../../wiki/Select";
import EditEntry from "../../../wiki/editing/EditEntry";
import PublishedDocument from "../../../wiki/editing/PublishedDocument";
import { publishedDocs } from "../../../wiki/content/bundled.js";

export default function DocContent(props) {
  const { metadata } = useDoc();
  const location = useLocation();
  const history = useHistory();
  const base = useBaseUrl("/");
  const path = location.pathname;
  const parent = path.includes("/help/")
    ? "/help/"
    : path.includes("/guides/")
      ? "/guides/"
      : "/mechanics/";
  const section = path.includes("/help/")
    ? "贡献帮助"
    : path.includes("/guides/")
      ? "玩家指南"
      : "战斗机制";
  const sidebar = path.includes("/help/")
    ? sidebars.helpSidebar
    : path.includes("/guides/")
      ? sidebars.guidesSidebar
      : sidebars.mechanicsSidebar;
  const flatten = (items, group = "") =>
    items.flatMap((item) =>
      typeof item === "string"
        ? [
            {
              value: base + item + "/",
              label: docTitles["/" + item + "/"] || item,
              group,
            },
          ]
        : flatten(item.items || [], item.label),
    );
  const options = flatten(sidebar);
  if (!options.some((option) => option.value === path))
    options.unshift({ value: path, label: metadata.title });
  return (
    <div className="rw-doc-sheet" data-pagefind-body>
      <CustomSelect
        className="rw-native-doc-select"
        ariaLabel="切换知识文章"
        value={path}
        onChange={(value) => history.push(value)}
        searchable
        options={options}
      />
      <div className="rw-doc-native-back">
        {path !== parent && (
          <Link className="rw-back" to={parent} aria-label="返回上级目录">
            <ArrowLeft size={17} />
          </Link>
        )}
        <nav className="rw-doc-breadcrumbs" aria-label="文档位置">
          <Link to={parent}>{section}</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{metadata.title}</span>
        </nav>
        <EditEntry
          entity={metadata.title}
          section="条目正文"
          mode="article"
          returnTo={path}
          label="编辑条目"
        />
      </div>
      <PublishedDocument
        document={publishedDocs.documents.find((doc) => doc.path === path)}
      >
        <OriginalContent {...props} />
      </PublishedDocument>
      <div className="rw-doc-native-contribution">
        <Contribution entity={metadata.title} />
      </div>
    </div>
  );
}
