import useBaseUrl from "@docusaurus/useBaseUrl";
import React, { useState, useEffect } from "react";
import { useHistory, useLocation } from "@docusaurus/router";
import { Search, ArrowRight } from "lucide-react";
import { Link, Badge, PageHeader, EmptyState, Contribution, setQuery } from "../core";
import { getSearchRecords } from "../data";
import {searchRecords,matchedExcerpt} from './searchModel';

function SearchPage() {
  const searchRoute = useBaseUrl("/search/");
  const history = useHistory(),
    location = useLocation(),
    params = new URLSearchParams(location.search);
  const term = params.get("q") || "",
    kind = params.get("kind") || "";
  const records = getSearchRecords();
  const results = searchRecords(records,term,kind);
  const [draft, setDraft] = useState(term);
  useEffect(() => setDraft(term), [term]);
  return (
    <>
      <PageHeader
        title={term ? "“" + term + "”的搜索结果" : "全站搜索"}
        eyebrow="SEARCH THE WIKI"
      />
      <form
        className="rw-searchform large"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(history, location, { q: draft });
        }}
      >
        <Search size={22} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="全站搜索词"
          placeholder="宠物、技能、地图、活动…"
        />
        <button className="rw-button primary" type="submit">
          搜索
        </button>
      </form>
      <div className="rw-filterchips search">
        {["", ...new Set(records.map((r) => r.kind))].map((t) => (
          <button
            key={t}
            className={kind === t ? "active" : ""}
            onClick={() => setQuery(history, location, { kind: t || null })}
          >
            {t || "全部"}
          </button>
        ))}
      </div>
      <div className="rw-results-meta">
        <span>
          共 <b>{results.length}</b> 条匹配资料
        </span>
        <span>名称优先 · 匹配别名、机制标签与共建正文</span>
      </div>
      <div className="rw-search-results">
        {results.length ? (
          results.map((r) => (
            <Link key={r.to} to={r.to}>
              <Badge>{r.kind}</Badge>
              <div>
                <h2>{r.title}</h2>
                <p>{r.meta}</p>
                {term && !r.title.includes(term) && (
                  <small>匹配别名或相关内容：{matchedExcerpt(r.keywords,term)}</small>
                )}
              </div>
              <ArrowRight size={17} />
            </Link>
          ))
        ) : (
          <EmptyState
            action={
              <button
                className="rw-button"
                onClick={() => {
                  setDraft("");
                  history.replace(searchRoute);
                }}
              >
                查看收录内容
              </button>
            }
          >
            核对名称，或换用技能机制等关键词。没有结果表示尚未收录或未命中，不代表游戏中不存在。
          </EmptyState>
        )}
      </div>
      <Contribution entity="全站搜索" />
    </>
  );
}

export { SearchPage };
