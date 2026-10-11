import React, { useEffect, useMemo, useState } from "react";
import Link from "@docusaurus/Link";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, FileText, GitCompareArrows, History, Info, Link2, PencilLine } from "lucide-react";
import CustomSelect from "../../Select";
import { articleHref, domainFor, editHref, formatTime, isHttpUrl, queryValue } from "../navigation.js";
import { ContributionFooter, PageHeading, SectionHeading } from "../components.jsx";
import { DiffViewer, MarkdownPreview } from "../DiffPreview.jsx";
import { HISTORY_SEED } from "./fixtures.js";

function HistoryPage({ workspace, query }) {
  const target = queryValue(query, "entity", "海芙约忒").slice(0, 80);
  const versions = useMemo(
    () => [
      ...workspace.submissions
        .filter((s) => s.target === target && s.status === "published")
        .map((s) => ({
          id: s.id,
          local: true,
          title: `本地修订 · ${s.id}`,
          at: formatTime(s.updatedAt),
          author: s.author,
          summary: s.summary,
          body: s.after,
          source: s.evidenceUrl,
          sourceNote: s.evidenceNote,
        })),
      ...HISTORY_SEED,
    ],
    [workspace.submissions, target],
  );
  const [oldId, setOldId] = useState("demo-r16");
  const [newId, setNewId] = useState("demo-r17");
  const [tab, setTab] = useState("compare");
  const [activeVersion, setActiveVersion] = useState("demo-r17");
  const [onlyLocal, setOnlyLocal] = useState(false);
  useEffect(() => {
    setNewId(versions[0].id);
    setOldId(versions[1]?.id || versions[0].id);
    setActiveVersion(versions[0].id);
  }, [target, versions.length]);
  const oldVersion =
    versions.find((v) => v.id === oldId) || versions[1] || versions[0];
  const newVersion = versions.find((v) => v.id === newId) || versions[0];
  const selectedVersion =
    versions.find((v) => v.id === activeVersion) || versions[0];
  const visibleVersions = versions.filter((v) => !onlyLocal || v.local);
  return (
    <>
      <PageHeading
        eyebrow="内容版本与出处"
        title={`修订记录 · ${target}`}
        description="查看哪些内容发生变化、由谁修改，以及依据的来源。"
        parent={articleHref(target)}
        actions={
          <>
            <Link className="cm-button" to={articleHref(target)}>
              查看词条
              <ArrowUpRight size={14} />
            </Link>
            <Link className="cm-button cm-button-primary" to={editHref(target)}>
              <PencilLine size={15} />
              纠错与补充
            </Link>
          </>
        }
      />
      <div className="cm-history-notice">
        <Info size={16} />
        <p>
          demo-r15 至 demo-r17
          是版本交互样例；在本地审核流程中「模拟上线」的投稿也会出现在这里。真实
          Git 修订尚未接入。
        </p>
      </div>
      <div className="cm-history-grid">
        <aside className="cm-paper cm-version-list">
          <SectionHeading icon={History} title="修订列表" />
          <label className="cm-local-filter">
            <input
              type="checkbox"
              checked={onlyLocal}
              onChange={(event) => setOnlyLocal(event.target.checked)}
            />
            只看本地流程产生的修订
          </label>
          {visibleVersions.length ? (
            visibleVersions.map((version) => (
              <article
                key={version.id}
                className={activeVersion === version.id ? "is-active" : ""}
              >
                <button
                  type="button"
                  className="cm-version-title"
                  onClick={() => {
                    setActiveVersion(version.id);
                    setTab("version");
                  }}
                >
                  <strong>{version.title}</strong>
                  <ChevronRight size={14} />
                </button>
                <p>{version.summary}</p>
                <small>
                  {version.author} · {version.at}
                </small>
                <div className="cm-version-compare-picks">
                  <button
                    type="button"
                    className={oldId === version.id ? "is-selected" : ""}
                    onClick={() => {
                      setOldId(version.id);
                      setTab("compare");
                    }}
                  >
                    {oldId === version.id ? <Check size={12} /> : null}选为旧版
                  </button>
                  <button
                    type="button"
                    className={newId === version.id ? "is-selected" : ""}
                    onClick={() => {
                      setNewId(version.id);
                      setTab("compare");
                    }}
                  >
                    {newId === version.id ? <Check size={12} /> : null}选为新版
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="cm-version-empty">
              <p>还没有本地发布记录。</p>
              <Link to="/review/">
                体验一次发布流程
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </aside>
        <div className="cm-history-main">
          <nav className="cm-tabs" aria-label="修订查看方式">
            <button
              type="button"
              className={tab === "compare" ? "is-active" : ""}
              onClick={() => setTab("compare")}
            >
              <GitCompareArrows size={15} />
              版本对比
            </button>
            <button
              type="button"
              className={tab === "version" ? "is-active" : ""}
              onClick={() => setTab("version")}
            >
              <FileText size={15} />
              单个版本与来源
            </button>
          </nav>
          {tab === "compare" ? (
            <>
              <section className="cm-paper cm-compare-selectors">
                <label>
                  <span>旧版</span>
                  <CustomSelect
                    ariaLabel="对比旧版本"
                    value={oldVersion.id}
                    onChange={setOldId}
                    options={versions.map((version) => ({
                      value: version.id,
                      label: version.title,
                    }))}
                  />
                </label>
                <button
                  type="button"
                  className="cm-swap-versions"
                  aria-label="交换比较版本"
                  onClick={() => {
                    const previous = oldId;
                    setOldId(newId);
                    setNewId(previous);
                  }}
                >
                  <GitCompareArrows size={20} />
                </button>
                <label>
                  <span>新版</span>
                  <CustomSelect
                    ariaLabel="对比新版本"
                    value={newVersion.id}
                    onChange={setNewId}
                    options={versions.map((version) => ({
                      value: version.id,
                      label: version.title,
                    }))}
                  />
                </label>
              </section>
              <DiffViewer
                before={oldVersion.body}
                after={newVersion.body}
                beforeLabel={oldVersion.title}
                afterLabel={newVersion.title}
              />
              <div className="cm-version-source-grid">
                {[oldVersion, newVersion].map((version, index) => (
                  <section className="cm-paper" key={`${index}-${version.id}`}>
                    <h3>{index === 0 ? "旧版" : "新版"}来源</h3>
                    <p>{version.sourceNote}</p>
                    {version.source && isHttpUrl(version.source) && (
                      <a
                        href={version.source}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {domainFor(version.source)}
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </section>
                ))}
              </div>
            </>
          ) : (
            <section className="cm-paper cm-single-version">
              <div className="cm-single-version-heading">
                <h2>{selectedVersion.title}</h2>
                <span className="cm-soft-label">
                  {selectedVersion.local ? "本地演示版本" : "示例版本"}
                </span>
              </div>
              <p className="cm-section-note">
                {selectedVersion.author} · {selectedVersion.at}
              </p>
              <div className="cm-version-summary">
                <strong>修改摘要</strong>
                <p>{selectedVersion.summary}</p>
              </div>
              <MarkdownPreview value={selectedVersion.body} />
              <div className="cm-single-source">
                <h3>
                  <Link2 size={16} />
                  来源与核验
                </h3>
                <p>{selectedVersion.sourceNote}</p>
                {selectedVersion.source &&
                  isHttpUrl(selectedVersion.source) && (
                    <a
                      href={selectedVersion.source}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {selectedVersion.source}
                      <ArrowUpRight size={14} />
                    </a>
                  )}
              </div>
            </section>
          )}
        </div>
      </div>
      <ContributionFooter target={target} />
    </>
  );
}

export { HistoryPage };
