import React from "react";
import { GitCompareArrows, Calculator, SlidersHorizontal, ArrowRight } from "lucide-react";
import { Link, PageHeader, Notice, Contribution, Badge } from "./core";
import "./CalculatorsV73.css";
import "./ToolsV6.css";
import "./ToolsV7.css";
import { ComparePage, MovedToolPage } from "./tools/ComparePage.jsx";
import { StatsPage } from "./tools/StatsPage.jsx";
import { DamagePage } from "./tools/DamagePage.jsx";

function ToolsPages({ path, query }) {
  if (path === "/tools/compare/") return <ComparePage query={query} />;
  if (path === "/tools/stats/") return <StatsPage />;
  if (path === "/tools/damage/") return <DamagePage />;
  if (path === "/tools/pp/" || path === "/tools/range/")
    return <MovedToolPage />;
  return (
    <>
      <PageHeader
        title="实用工具"
        description="从培养到对战，把一只宠物的数值算清楚。"
        eyebrow="PLAYER TOOLKIT"
      />
      <div className="rw-tools-index">
        {[
          [
            Calculator,
            "威力伤害计算器",
            "参考官方论坛工具，查看伤害上限、下限与强化后的攻防。",
            "/tools/damage/",
            "伤害上限 · 强化与修正",
          ],
          [
            SlidersHorizontal,
            "能力计算器",
            "从种族、天赋到性格、努力、亲密与装备，查看六项能力的形成过程。",
            "/tools/stats/",
            "六维培养 · 完整拆解",
          ],
          [
            GitCompareArrows,
            "宠物对比",
            "并排比较种族值、属性与重点技能，雷达图共用同一把量尺。",
            "/tools/compare/",
            "最多 3 只",
          ],
        ].map(([Icon, title, desc, to, meta]) => (
          <Link key={to} to={to}>
            <Icon size={28} />
            <div>
              <Badge>{meta}</Badge>
              <h2>{title}</h2>
              <p>{desc}</p>
              <strong>
                打开工具 <ArrowRight size={15} />
              </strong>
            </div>
          </Link>
        ))}
      </div>
      <Notice title="先看适用条件，再看数字">
        能力与威力伤害采用官方论坛公开的计算口径。设置攻防与本次生效的修正，结果随参数更新；特殊技能请同时查看其结算分支。
      </Notice>
      <Contribution entity="实用工具" />
    </>
  );
}

export default ToolsPages;
