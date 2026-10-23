// SPDX-License-Identifier: GPL-3.0-only
import React, { useEffect, useState } from "react";
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { ArrowRight, HeartHandshake } from "lucide-react";
import "./HomeEndnote.css";

const counterUrl = "https://count.getloli.com/@rocowiki?theme=miku&padding=7&offset=0&align=center&scale=1.0&pixelated=1&darkmode=auto";

function HomeVisitCounter() {
  const [state, setState] = useState<"pending" | "loading" | "loaded" | "failed">("pending");
  useEffect(() => {
    // Keep static rendering and the standalone file preview free of counting requests.
    if (window.location.protocol !== "file:") setState("loading");
  }, []);
  useEffect(() => {
    if (state !== "loading") return;
    const timer = window.setTimeout(() => {
      setState(current => current === "loading" ? "failed" : current);
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state === "pending") return null;
  return (
    <div className="rw-home-visit-counter">
      <span>感谢每一位来查资料的小洛克</span>
      <div className="rw-home-counter-image" aria-busy={state === "loading"}>
        {state === "failed" ? (
          <p role="status">访问计数暂时无法加载</p>
        ) : (
          <img src={counterUrl} alt="RocoWiki 项目访问计数（Miku 主题）" decoding="async"
            onLoad={() => setState(current => current === "loading" ? "loaded" : current)}
            onError={() => setState("failed")} />
        )}
      </div>
      <small>项目访问计数</small>
    </div>
  );
}

function HomeEndnoteContent() {
  return (
    <aside className="rw-home-endnote" aria-labelledby="rw-home-thanks-title" data-no-editor>
      <div className="rw-home-thanks">
        <HeartHandshake size={22} aria-hidden="true" />
        <div>
          <h2 id="rw-home-thanks-title">数据来源与致谢</h2>
          <p>感谢游戏资料的整理者、玩家研究者与开源项目维护者，让每一份发现都有迹可循。</p>
          <nav aria-label="主要资料来源与致谢">
            <a href="https://17roco.qq.com/" target="_blank" rel="noreferrer">洛克王国</a>
            <a href="https://roco.dvg.cn/" target="_blank" rel="noreferrer">洛克小册子</a>
            <a href="https://gitcode.com/rocoai-dev/roco-desc" target="_blank" rel="noreferrer">roco-desc</a>
            <Link to="/copyright/#credits">查看来源与项目 <ArrowRight size={13} aria-hidden="true" /></Link>
          </nav>
        </div>
      </div>
      <HomeVisitCounter />
    </aside>
  );
}

export default function HomeEndnote() {
  const { pathname } = useLocation();
  const baseUrl = useBaseUrl("/");
  const basePath = baseUrl.replace(/\/+$/, "");
  const routePath = basePath && (pathname === basePath || pathname.startsWith(basePath + "/"))
    ? pathname.slice(basePath.length)
    : pathname;
  const isHome = routePath === "" || routePath === "/";
  return isHome ? <HomeEndnoteContent /> : null;
}
