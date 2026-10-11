import React, { useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { COMMUNITY_STORAGE_KEY } from "./registry";
import { composePublishedDocument } from "./documentComposition";
import ReadingMarkdown from "./ReadingMarkdown";
import {useDemoSubmissions} from "../community/useDemoSubmissions";

export default function PublishedDocument({ document: doc, children }) {
  const [current, setCurrent] = useState(null);
  const submissions = useDemoSubmissions();
  useEffect(() => {
    const result = composePublishedDocument({document: doc, submissions});
    setCurrent(result.isLocal ? result : null);
  }, [doc, submissions]);
  if (!doc || !current) return children;
  return (
    <div className="theme-doc-markdown" data-wiki-entity={doc.title}>
      <div className="rw-document-revision">
        <FileCheck2 size={17} />
        <span>
          正在阅读本机已发布版本 · {current.publishedAt?.slice(0, 10)}
          <small>线上内容尚未改变。整篇和小节修订已经合并到下方正文。</small>
        </span>
      </div>
      <h1>{doc.title}</h1>
      <ReadingMarkdown document={doc} markdown={current.markdown} />
      {current.unresolved.length > 0 && (
        <p className="rw-notice">
          {current.unresolved.length}{" "}
          条历史修订的章节已不存在，未自动套用到其他章节。请在修订记录中核对。
        </p>
      )}
    </div>
  );
}
