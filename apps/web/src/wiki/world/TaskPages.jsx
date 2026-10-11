import React from "react";
import { ChevronRight, Flag } from "lucide-react";
import { Link, PageHeader, Notice, EmptyState, Contribution, TextLink, TypeBadge } from "../core";
import EditEntry from "../editing/EditEntry";
import DirectoryPanel, { DirectoryFilters, DirectoryEntry } from "../DirectoryPanel";
import { AdventureNav, MissingInline, SOURCES, SourceLine, hrefWith } from "./components.jsx";

const BADGE_TYPES = [
  "草",
  "水",
  "石",
  "火",
  "冰",
  "电",
  "翼",
  "幽",
  "机械",
  "龙",
];

function TasksIndex({ query }) {
  const view = query.get("view") || "badges";
  return (
    <div className="wa-page">
      <PageHeader
        title="任务与剧情"
        actions={
          <EditEntry
            entity="任务与剧情"
            section="任务目录"
            mode="index"
            intent="add"
            returnTo="/tasks/"
            label="新增任务入口"
            variant="primary"
          />
        }
        description="先确认任务类别与前置，再找人物、场景和奖励。"
        crumbs={[
          { label: "首页", to: "/" },
          { label: "冒险资料", to: "/adventure/" },
          { label: "任务与剧情" },
        ]}
      />
      <AdventureNav current="/tasks/" />
      <DirectoryPanel directory="tasks" title="任务目录" Icon={Flag} tone="coral" summary={view === "badges" ? "1 个已收录任务目录" : "这个分类等待玩家补充"}
        filters={<DirectoryFilters current={view} label="任务分类" items={[["badges", "徽章任务"], ["story", "主线剧情"], ["side", "支线任务"]].map(([value, label]) => ({ value, label, to: hrefWith("/tasks/", query, { view: value }) }))} />}>
      {view === "badges" ? (
        <DirectoryEntry to="/tasks/badges/" title="徽章任务" eyebrow="按挑战类别查阅" Icon={Flag} tone="coral" actionLabel="打开徽章索引"
          description="早期八枚徽章之外，资料中还记录了机械与龙系徽章。各项任务的条件与入口分别整理。">
          {BADGE_TYPES.map(type => <TypeBadge key={type} type={type} />)}
        </DirectoryEntry>
      ) : (
        <EmptyState
          title={view === "story" ? "主线章节目录待补充" : "支线任务目录待补充"}
          action={
            <EditEntry entity="任务与剧情" section="任务目录" mode="index" intent="add" returnTo={hrefWith("/tasks/", query, { view })} label="补充任务记录" />
          }
        >
          每条记录需包含任务名、前置、领取人物、出场地区与奖励。可从人物页或地区页继续查找线索。
        </EmptyState>
      )}
      </DirectoryPanel>
      <div className="wa-task-tools">
        <TextLink to="/npcs/">按领取人物查找</TextLink>
        <TextLink to="/places/">按出场地区查找</TextLink>
        <TextLink to="/events/">查询限时任务与活动</TextLink>
      </div>
      <Contribution entity="任务与剧情目录" />
    </div>
  );
}

function BadgesPage({ query }) {
  const chosen = BADGE_TYPES.includes(query.get("type"))
    ? query.get("type")
    : "草";
  return (
    <div className="wa-page">
      <PageHeader
        title="徽章任务"
        eyebrow="任务索引"
        description="按徽章类别查前置与挑战资料。"
        back="/tasks/"
        crumbs={[
          { label: "冒险资料", to: "/adventure/" },
          { label: "任务与剧情", to: "/tasks/" },
          { label: "徽章任务" },
        ]}
      />
      <Notice title="徽章名称与历史资料">
        2016年的资料整理已列出十类挑战徽章。以下为分类索引，现行入口、解锁条件和具体打法仍待补充。
      </Notice>
      <div className="wa-badges-workspace">
        <nav aria-label="徽章类别">
          {BADGE_TYPES.map((type) => (
            <Link
              key={type}
              to={hrefWith("/tasks/badges/", query, { type })}
              className={chosen === type ? "active" : ""}
              aria-current={chosen === type ? "page" : undefined}
            >
              <Flag size={16} />
              {type}系徽章
              <ChevronRight size={13} />
            </Link>
          ))}
        </nav>
        <div className="wa-badge-record">
          <span className="wa-kicker">当前选择</span>
          <h2>{chosen}系徽章</h2>
          <p>领取前应核对任务档案中的解锁状态与对应挑战要求。</p>
          <MissingInline
            title="完整的挑战记录待补充"
            entity={chosen + "系徽章 · 前置与挑战"}
          >
            需要补充领取人物、具体地点、前置任务、Boss规则及可复现打法。
          </MissingInline>
          {chosen === "翼" && (
            <TextLink to="/places/sky/">查天空城场景资料</TextLink>
          )}
          {chosen === "水" && (
            <TextLink to="/places/mermaid-bay/">查人鱼湾与海域场景</TextLink>
          )}
          {chosen === "冰" && (
            <TextLink to="/places/snow-valley/">查雪人谷场景资料</TextLink>
          )}
          <SourceLine source={SOURCES.badges} />
        </div>
      </div>
      <Contribution entity={chosen + "系徽章"} source={SOURCES.badges.url} />
    </div>
  );
}

export { TasksIndex, BadgesPage };
