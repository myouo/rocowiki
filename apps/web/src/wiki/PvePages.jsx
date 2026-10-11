import {useMemo} from "react";
import {useDemoSubmissions} from "./community/useDemoSubmissions";
import React, { useEffect, useState } from "react";
import { useHistory, useLocation } from "@docusaurus/router";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Castle,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  ExternalLink,
  Flag,
  Gem,
  Layers3,
  Mountain,
  Search,
  Share2,
  Shield,
  Sparkles,
  Swords,
  X,
  Plus,
} from "lucide-react";
import {
  Link,
  PageHeader,
  Section,
  Badge,
  EmptyState,
  Contribution,
  TextLink,
  DocGrid,
  BookmarkButton,
} from "./core";
import EditEntry from "./editing/EditEntry";
import { COMMUNITY_STORAGE_KEY } from "./editing/registry";
import { ColorIcon } from "./visuals";
import PvePlanCard from "./PvePlanCard";
import { GuideLikeButton } from "./PageCommunityFooter";
import { resolvePublishedPveGuides, pveGuideHref } from "./pvePublished";
import { PveGuidePreview } from "./PveGuideEditor";
import ReadingMarkdown from "./editing/ReadingMarkdown";
import SevenSanctuaries from "./SevenSanctuaries";
import { pets } from "./data";
import { pvePetRecords as recommendations } from "./content/bundled.js";
import "./WorldV7.css";
import { pveData as pve } from "./content/bundled.js";

const GOALS = [
  { value: "all", label: "全部玩法", Icon: Compass },
  { value: "progress", label: "推进关卡", Icon: Flag },
  { value: "pets", label: "获取宠物", Icon: Sparkles },
  { value: "equipment", label: "取得装备", Icon: Shield },
  { value: "training", label: "培养资源", Icon: Gem },
];
const GUIDE_VISUALS = {
  "star-tower": { Icon: Castle, tone: "blue", action: "选层数 · 查挑战", brief: "闯关与星辰令", context: "选择层数", note: "1—7 层与第 8 层分别查阅" },
  shanhai: { Icon: Mountain, tone: "teal", action: "查看秘境挑战", brief: "每日秘境与挑战掉落", context: "选择挑战内容", note: "山海召唤在奖励与兑换中查阅" },
  "sentry-intelligence": { Icon: Shield, tone: "amber", action: "查看情报与任务", brief: "情报、赏金与契约", context: "选择查阅环节", note: "按任务、兑换或契约查资料" },
  "training-hall": { Icon: Swords, tone: "rose", action: "选择训练馆", brief: "解锁与天赋培养", context: "选择训练馆", note: "普通馆与终极馆分别查阅" },
  "seven-sanctuaries": { Icon: Sparkles, tone: "violet", action: "选曜日 · 查奖励", brief: "七座曜日与努力值果实", context: "选择查阅环节", note: "按曜日、难度查挑战对象与奖励" },
};
const sourceById = Object.fromEntries(
  pve.sources.map((source) => [source.id, source]),
);
const href = (slug) => pveGuideHref({slug, localEntry: !pve.guides.some(guide => guide.slug === slug)});
const guideVisual = guide => GUIDE_VISUALS[guide.slug] || {Icon: Compass,tone:"blue",action:"查看玩法与关卡",brief:guide.category || "玩家补充玩法",context:"选择分区",note:"挑战对象、条件和奖励一起核对"};
function guideLink(guide, changes = {}) {
  const url = new URL(href(guide.slug), "https://wiki.invalid");
  for (const [key,value] of Object.entries(changes)) {if (value == null || value === "") url.searchParams.delete(key); else url.searchParams.set(key,String(value));}
  return url.pathname + url.search;
}
function usePveGuides() { const submissions=useDemoSubmissions(); return useMemo(()=>resolvePublishedPveGuides({submissions}),[submissions]); }

function usePveQuery(query) {
  const history = useHistory(),
    location = useLocation();
  return (changes) => {
    const next = new URLSearchParams(query?.toString() || "");
    for (const [key, value] of Object.entries(changes)) {
      if (value === "" || value === null) next.delete(key);
      else next.set(key, String(value));
    }
    history.replace(location.pathname + (next.toString() ? "?" + next : ""));
  };
}

function PveNav({ current, guides = pve.guides }) {
  return (
    <nav className="pv71-nav" aria-label="PVE 副本目录" data-no-editor>
      <Link
        to="/pve/"
        className={`pv71-nav-home rw-tone-teal ${current === "/pve/" ? "is-active" : ""}`}
        aria-current={current === "/pve/" ? "page" : undefined}
      >
        <ColorIcon Icon={Compass} tone="teal" size={19} />
        <span>全部 PVE</span>
      </Link>
      {guides.map((guide) => {
        const visual = guideVisual(guide);
        return <Link
          key={guide.slug}
          to={href(guide.slug)}
          className={`rw-tone-${visual.tone} ${current === href(guide.slug) ? "is-active" : ""}`}
          aria-current={current === href(guide.slug) ? "page" : undefined}
        >
          <ColorIcon Icon={visual.Icon} tone={visual.tone} size={19} />
          <span>{guide.shortName}</span>
        </Link>;
      })}
    </nav>
  );
}

function SourceMark({ id }) {
  const source = sourceById[id];
  return source ? (
    <a
      className="pv6-source-mark"
      href={source.url}
      target="_blank"
      rel="noreferrer"
      title={source.title + " · " + source.publishedAt}
      aria-label={"查看依据：" + source.title}
    >
      {source.kind === "official_announcement" ? "官方说明" : "资料来源"}
      <ExternalLink size={11} />
    </a>
  ) : null;
}

function Sources({ ids = pve.sources.map((source) => source.id) }) {
  return (
    <div className="pv6-sources">
      {[...new Set(ids)]
        .map((id) => sourceById[id])
        .filter(Boolean)
        .map((source) => (
          <article key={source.id}>
            <BookOpen size={17} />
            <div>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
                <ExternalLink size={12} />
              </a>
              <p>{source.scope}</p>
              <small>
                {source.publisher} · 发布于 {source.publishedAt} · 核对于{" "}
                {source.checkedAt}
              </small>
            </div>
          </article>
        ))}
    </div>
  );
}

function GuideCard({ guide }) {
  const visual = guideVisual(guide);
  return (
    <article className={`pv6-directory-row pv71-guide-card rw-tone-${visual.tone}`} data-guide={guide.slug} data-no-editor>
      <div className="pv71-guide-card-heading">
        <ColorIcon Icon={visual.Icon} tone={visual.tone} size={25} />
        <div className="pv6-directory-name">
          <span className="pv71-guide-brief">{visual.brief}</span>
        <h2>
          <Link to={href(guide.slug)}>{guide.name}</Link>
        </h2>
        </div>
      </div>
      <p className="pv71-guide-summary">{guide.summary}</p>
      <div className="pv71-guide-reward"><Gem size={15} /><span>{guide.focus}</span></div>
      <p className="pv71-guide-cadence"><CalendarDays size={14} />{guide.cadence}</p>
      <nav className="pv71-card-sections" aria-label={`${guide.name}快捷入口`}>
        {guide.slug === "star-tower" ? <>
          <Link to={href(guide.slug) + "?level=1#pve-context"}>第 1—7 层 <ChevronRight size={13} /></Link>
          <Link to={href(guide.slug) + "?level=8#pve-context"}>第 8 层 · 星辰令 <ChevronRight size={13} /></Link>
        </> : guide.sections.slice(0, 3).map((section) => <Link key={section.value} to={guideLink(guide, {view: section.value}) + "#pve-context"}>{section.label}<ChevronRight size={13} /></Link>)}
      </nav>
      <Link
        className="pv6-open-guide pv71-open-guide"
        to={href(guide.slug)}
        aria-label={"查阅" + guide.name + "规则与攻略"}
      >
        {visual.action}
        <ArrowRight size={16} />
      </Link>
    </article>
  );
}

function PveHome({ query, guides }) {
  const update = usePveQuery(query);
  const rawGoal = query.get("goal") || "all";
  const goal = GOALS.some((item) => item.value === rawGoal) ? rawGoal : "all";
  const currentQ = query.get("q") || "";
  const [search, setSearch] = useState(currentQ);
  useEffect(() => setSearch(currentQ), [currentQ]);
  const needle = currentQ.trim().toLowerCase();
  const rows = guides.filter(
    (guide) =>
      (goal === "all" || guide.goals.includes(goal)) &&
      (!needle ||
        [
          guide.name,
          guide.focus,
          guide.summary,
          ...guide.aliases,
          ...guide.rewards.map((reward) => reward.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle)),
  );
  return (
    <div className="pv6 pv71 pv6-hub" data-no-editor>
      <PageHeader
        title="PVE 副本与挑战"
        eyebrow="挑战手册"
        description="按奖励目标找玩法，按关卡条件查队伍。首通、日常资源与兑换分别整理。"
        crumbs={[{ label: "首页", to: "/" }, { label: "PVE 副本与挑战" }]}
        actions={<><EditEntry variant="primary" className="rw-catalog-create-v73" mode="pve-guide" entity="新 PVE 玩法" section="玩法资料" intent="add" returnTo="/pve/" label="新增玩法" /><TextLink to="/guides/pve/">怎样阅读一份打法</TextLink></>}
        edit={false}
      />
      <PveNav current="/pve/" guides={guides} />
      <div className="pv6-hub-intro pv71-hub-intro">
        <div>
          <h2>这次想挑战什么？</h2>
          <p>
            选副本、查关卡，再看适用宠物和打法。也可以按想获得的奖励筛选。
          </p>
        </div>
        <aside>
          <Shield size={18} />
          <span>
            {guides.length} 份副本手册
            <small>规则、奖励、挑战方案分别查阅</small>
          </span>
        </aside>
      </div>
      <form
        className="pv6-filter pv71-filter"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: search.trim() });
        }}
      >
        <div className="pv71-search-row"><div className="pv6-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="搜索 PVE 玩法或奖励"
            placeholder="搜索副本、奖励，如飞鹰契约、天赋"
          />
          {search && (
            <button
              type="button"
              aria-label="清空 PVE 搜索"
              onClick={() => {
                setSearch("");
                update({ q: null });
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button className="rw-button" type="submit">
          搜索
        </button>
        </div>
        <div className="pv71-goal-filter" role="group" aria-label="按 PVE 奖励目标筛选">
          <span>按目标浏览</span>
          <div>{GOALS.map(({value, label, Icon}) => <button
            type="button"
            key={value}
            className={goal === value ? "is-active" : ""}
            aria-pressed={goal === value}
            onClick={() => update({ goal: value === "all" ? null : value })}
          ><Icon size={15} />{label}</button>)}</div>
        </div>
      </form>
      <div className="pv6-results-meta pv71-results-meta" aria-live="polite">
        <span>{GOALS.find((item) => item.value === goal)?.label} · {rows.length} 份手册</span>
        {(goal !== "all" || currentQ) && <button type="button" onClick={() => {setSearch(""); update({q: null, goal: null});}}><X size={13} />清除筛选</button>}
      </div>
      <div className="pv6-directory pv71-directory">
        {rows.map((guide) => (
          <GuideCard key={guide.slug} guide={guide} />
        ))}
      </div>
      {!rows.length && (
        <EmptyState
          title="没有匹配的 PVE 资料"
          action={
            <Link className="rw-button" to="/pve/">
              查看全部玩法
            </Link>
          }
        >
          试试玩法正式名称或奖励名称，也可以用常用简称检索。
        </EmptyState>
      )}
      <Section title="从查规则到完成挑战" id="pve-flow" edit={false}>
        <div className="pv6-reading-path">
          <article>
            <span>01</span>
            <h3>确认关卡条件</h3>
            <p>保留 Boss、每日任务或星辰令原文，确认是相同版本和模式。</p>
            <TextLink to="/mechanics/">查战斗机制</TextLink>
          </article>
          <article>
            <span>02</span>
            <h3>核对自己的配置</h3>
            <p>比对宠物、配招、血脉、面板与替代条件；只有名字相同还不够。</p>
            <TextLink to="/pets/">查宠物与配招</TextLink>
          </article>
          <article>
            <span>03</span>
            <h3>区分奖励与资格</h3>
            <p>通关奖励、兑换资源、随机召唤和进化资格需要分别确认。</p>
            <TextLink to="/guides/training/">查看培养资料</TextLink>
          </article>
        </div>
      </Section>
      <div className="pv6-crosslinks">
        <Link to="/events/">
          <CalendarDays size={18} />
          <span>本期活动与宠物获取</span>
          <ChevronRight size={16} />
        </Link>
        <Link to="/challenges/">
          <BookOpen size={18} />
          <span>历史挑战资料</span>
          <ChevronRight size={16} />
        </Link>
        <Link to="/adventure/">
          <Swords size={18} />
          <span>地图、人物与任务</span>
          <ChevronRight size={16} />
        </Link>
      </div>
      <Section title="资料依据" id="pve-sources" edit={false}>
        <p className="pv6-source-note">
          LITE 是与原 Flash
          端数据互通的页游入口。以下资料不包含你的账号进度，也未实时读取当日
          Boss；动态内容在对应页面列明。
        </p>
        <Sources ids={["lite-pve-20250910"]} />
      </Section>
      <div className="pv71-contribute-note"><BookOpen size={20} /><div><strong>有自己的通关经验？</strong><p>进入对应副本，在“用什么宠物挑战”中新增方案，保留关卡条件和测试日期。</p></div><TextLink to="/help/contributing/">阅读贡献指南</TextLink></div>
    </div>
  );
}

function GuideContext({ guide, query }) {
  const update = usePveQuery(query);
  const rawLevel = Number(query.get("level") || 1);
  const level =
    Number.isInteger(rawLevel) && rawLevel >= 1 && rawLevel <= 8 ? rawLevel : 1;
  const requested = query.get("view");
  const isTower = guide.slug === "star-tower";
  const sectionId = isTower ? (level === 8 ? "eighth" : "progress") : requested;
  const section = guide.sections.find((item) => item.value === sectionId) || (!isTower && guide.sections[0]) || {
    value: sectionId || "unrecorded",
    label: isTower ? (level === 8 ? "第八层 · 星辰令" : "前七层 · 首通与星级") : "分区待补充",
    title: "这个分区的资料待补充",
    body: "本次修订尚未提供这个分区的规则。请核对来源后补充，其他分区的内容不作为本区规则。",
    points: [],
  };
  const visual = guideVisual(guide);
  const currentLabel = isTower ? `第 ${level} 层` : section.label;
  const [copyMessage, setCopyMessage] = useState("");
  useEffect(() => setCopyMessage(""), [guide.slug, level, section.value]);
  async function copyContext() {
    // Use the active URL so the standalone hash router and native pages both
    // retain their selected floor/stage when the link is shared.
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyMessage("已复制当前关卡链接");
    } catch {
      setCopyMessage("可复制地址栏链接，已保留当前选择");
    }
  }
  const contextQuery = new URLSearchParams(query.toString());
  if (isTower) { contextQuery.set("level", String(level)); contextQuery.delete("view"); }
  else { contextQuery.set("view", section.value); contextQuery.delete("level"); }
  const contextHref = guideLink(guide, Object.fromEntries(contextQuery));
  return (
    <div className={`pv71-context rw-tone-${visual.tone}`} data-no-editor data-pve-context={isTower ? level : section.value}>
      <div className="pv6-context-picker pv71-context-picker">
        <div>
          <ColorIcon Icon={isTower ? Layers3 : visual.Icon} tone={visual.tone} size={22} />
          <div><span className="pv71-context-label">{visual.context}</span><strong>{visual.note}</strong></div>
        </div>
        <button className="pv71-share" type="button" onClick={copyContext}><Share2 size={15} />分享当前选择</button>
      </div>
      {isTower ? (
        <div className="pv71-floor-options" role="group" aria-label="选择星辰塔层数">
          {Array.from({length: 8}, (_, index) => index + 1).map((floor) => <button
            type="button" key={floor} data-floor={floor}
            className={floor === level ? "is-active" : ""}
            aria-pressed={floor === level}
            aria-label={`第 ${floor} 层${floor === 8 ? " · 星辰令" : ""}`}
            onClick={() => update({level: floor, view: null})}
          ><strong>{floor}</strong><span>{floor === 8 ? "星辰令" : "层"}</span></button>)}
        </div>
      ) : (
        <div className="pv71-stage-options" role="group" aria-label={`选择${guide.name}查阅环节`}>
          {guide.sections.map((item, index) => <button
            type="button" key={item.value} data-stage={item.value}
            className={item.value === section.value ? "is-active" : ""}
            aria-pressed={item.value === section.value}
            onClick={() => update({view: item.value, level: null})}
          ><span className="pv71-stage-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{item.label}</strong><small>{item.title}</small></span><ChevronRight size={16} /></button>)}
        </div>
      )}
      {copyMessage && <p className="pv71-copy-message" role="status">{copyMessage}</p>}
      <div className="pv6-context-body pv71-context-body" aria-live="polite" aria-atomic="true">
        <div className="pv71-context-current"><span>{currentLabel}</span><span>{isTower ? section.label : "规则与参与条件"}</span></div>
        <h3>{section.title}</h3>
        <ReadingMarkdown editHeadings={false} markdown={section.body} context={{entity:guide.name,returnTo:contextHref}} />
        <ul>{(section.points || []).map((point) => <li key={point}>{point}</li>)}</ul>{(section.bosses || section.rewards) && <div className="pv72-boss-reward-grid"><section><h4>挑战 BOSS / NPC</h4><ReadingMarkdown editHeadings={false} markdown={section.bosses || "待核对"} context={{entity:guide.name,returnTo:contextHref}} /></section><section><h4>奖励与数量</h4><ReadingMarkdown editHeadings={false} markdown={section.rewards || "待核对"} context={{entity:guide.name,returnTo:contextHref}} /></section></div>}
      </div>
      <div className="pv71-context-next">
        <Link to={contextHref + "#pve-pets"}><ColorIcon Icon={Swords} tone={visual.tone} size={20} /><span><strong>用什么宠物挑战</strong><small>核对配置、打法与失败条件</small></span><ArrowRight size={16} /></Link>
        {isTower ? <Link to={`/challenges/star-tower/?level=${level}`} data-pve-archive-link><ColorIcon Icon={BookOpen} tone="amber" size={20} /><span><strong>第 {level} 层历史对手</strong><small>{level === 8 ? "2023 年资料" : "2016 年资料"} · 按 Boss 查阅</small></span><ArrowRight size={16} /></Link> : <Link to={contextHref + "#pve-rewards"}><ColorIcon Icon={Gem} tone="amber" size={20} /><span><strong>奖励与兑换</strong><small>查获得形式、条件与消耗</small></span><ArrowRight size={16} /></Link>}
      </div>
      <div className="pv71-data-status"><CircleHelp size={18} /><p>{isTower ? `当前第 ${level} 层的完整 Boss 名单与可复现队伍仍待补充；历史对手入口保留资料年份。` : guide.slug === "shanhai" ? "今日秘境的 Boss、队伍限制与召唤概率尚未接入，以上展示已收录的玩法规则。" : "当前 Boss、具体次数与临时调整请核对游戏界面；本页保留各项规则的资料依据。"}</p></div>
      {guide.slug === "training-hall" && <TextLink to="/pve/seven-sanctuaries/">需要努力值果实？查看七曜圣地</TextLink>}
      {guide.slug === "seven-sanctuaries" && <TextLink to="/pve/training-hall/">需要天赋重置道具？查看勇者训练馆</TextLink>}
    </div>
  );
}

export function guidePlansFrom(guide, workspace) {
  const plans = new Map(recommendations.records.filter((row) => row.guideSlug === guide.slug).map(({petSlug, record}) => [record.id, {
    recordId: record.id,
    data: {
      title: record.direction,
      challenge: record.opponent,
      version: record.recordedAt ? `${record.recordedAt} · 历史记录` : "",
      testedAt: record.testedAt || "",
      pets: pets.find((row) => row.slug === petSlug)?.name || petSlug,
      requirements: record.conditions,
      steps: record.conclusion,
      alternatives: record.limitations,
      sourceUrl: record.sourceUrl,
    },
    meta: {
      caution: record.direction === "需防范的反制",
      historical: true,
      evidenceLabel: record.evidenceLabel,
      sourceLabel: record.sourceLabel,
      recordedAt: record.recordedAt,
      floorLabel: guide.slug === "star-tower" ? (record.opponent.includes("历史第七层") ? "历史第 7 层" : "层数待补") : undefined,
    },
  }]));
  const submissions = Array.isArray(workspace?.submissions) ? workspace.submissions : [];
  const published = submissions.filter((row) => row?.status === "published" && row.editorVersion === 7 && row.editorMode === "pve" &&
    guideLink(guide) === (() => { try { const u = new URL(row.editorRequest?.returnTo || "/", "https://wiki.invalid"); return u.pathname + (u.searchParams.has("entry") ? "?entry=" + encodeURIComponent(u.searchParams.get("entry")) : ""); } catch { return ""; } })() &&
    row.typedData && typeof row.typedData === "object" && !Array.isArray(row.typedData))
    .sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || ""))).slice(-500);
  for (const row of published) {
    const recordId = String(row.editorRequest?.record || row.id || "");
    if (!recordId || !String(row.typedData.challenge || "").trim()) continue;
    const data = Object.fromEntries(["title", "challenge", "version", "testedAt", "pets", "requirements", "steps", "alternatives", "sourceUrl"].map((key) => [key, typeof row.typedData[key] === "string" ? row.typedData[key] : ""]));
    const previous = plans.get(recordId);
    // Appreciation belongs to the stable plan's creator. Later revisions earn
    // contribution credit without reassigning this plan's existing likes.
    plans.set(recordId, {recordId, data, authorId:previous ? previous.authorId || "" : row.authorId || "", author:previous ? previous.author || "" : row.author || "", updatedBy:row.author || "", meta: {caution: /需防范的反制|不适用与失败/.test(data.title), historical: false, evidenceLabel: "本机修订", sourceLabel: "本次修订来源"}});
  }
  return [...plans.values()];
}
function useGuidePlans(guide) { const submissions=useDemoSubmissions(); return useMemo(()=>guidePlansFrom(guide,{submissions}),[guide,submissions]); }
function ChallengePets({ guide, query }) {
  const returnTo = guideLink(guide, Object.fromEntries(query)) + "#pve-pets";
  const records = useGuidePlans(guide);
  const renderRecord = (record) => <PvePlanCard
    key={record.recordId}
    {...record}
    actions={<EditEntry entity={guide.name} section="挑战方案" mode="pve" record={record.recordId} returnTo={returnTo} label="编辑此方案" />}
    appreciation={<GuideLikeButton targetId={`pve-plan:${guide.slug}:${record.recordId}`} title={`${guide.name} · ${record.data.title}`} href={returnTo} authorId={record.authorId} author={record.author} />}
  />;
  return (
    <Section
      title="用什么宠物挑战"
      id="pve-pets"
      edit={false}
      aside={
        <EditEntry
          entity={guide.name}
          section="挑战方案"
          mode="pve"
          intent="add"
          returnTo={returnTo}
          label="新增挑战方案"
        />
      }
    >
      <p className="wv7-pve-pets-intro">
        从关卡选择合适的宠物，再核对配置、步骤与失败条件。以下记录保留原有的关卡、版本和来源，不随上方层数选择改变适用范围。
      </p>
      {records.length ? (
        <div className="wv7-pve-plans">
          {records
            .filter((row) => !row.meta.caution)
            .map(renderRecord)}
          {records
            .filter((row) => row.meta.caution)
            .map(renderRecord)}
        </div>
      ) : (
        <div className="wv7-pve-empty" data-no-editor>
          <Swords size={25} />
          <div>
            <strong>这个副本的挑战方案等你补充</strong>
            <p>填写关卡、挑战宠物、必要配置、操作步骤、测试日期与来源。</p>
          </div>
        </div>
      )}
    </Section>
  );
}

function PveGuide({ guide, query, guides }) {
  const update = usePveQuery(query);
  const returnTo = guideLink(guide, Object.fromEntries(query));
  return (
    <div className={`pv6 pv71 pv6-guide rw-tone-${guideVisual(guide).tone}`}>
      <PageHeader
        title={guide.name}
        eyebrow="PVE 挑战手册"
        description={guide.summary}
        back="/pve/"
        crumbs={[
          { label: "PVE 副本与挑战", to: "/pve/" },
          { label: guide.name },
        ]}
        edit={false}
        actions={
          <><EditEntry entity={guide.name} section="玩法资料" mode="pve-guide" record={guide.slug} returnTo={href(guide.slug)} label="编辑玩法" /><BookmarkButton
            id={"pve-" + guide.slug}
            title={guide.name}
            href={href(guide.slug)}
            kind="PVE"
          /></>
        }
      />
      <PveNav current={href(guide.slug)} guides={guides} />
      <div className="pv6-evidence-bar" data-no-editor>
        <Badge tone={guide.localSource ? "violet" : "blue"}>{guide.localSource ? "本机修订" : "来源规则已核对"}</Badge>
        <span>{guide.localSource ? "本次资料：" + guide.localSource.title : "主要规则来源：2025.09.10 官方说明"}</span>
        <span>本页核对：{guide.localSource?.checkedAt || pve.asOf}</span>
        <a
          href="#pve-sources"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("pve-sources")?.scrollIntoView({
              behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
                ?.matches
                ? "auto"
                : "smooth",
              block: "start",
            });
          }}
        >
          查看依据
          <ChevronRight size={13} />
        </a>
      </div>
      <DocGrid
        toc={[
          ["pve-context", "关卡与条件"],
          ["pve-entrance", "入口与规则"],
          ["pve-rewards", "奖励与兑换"],
          ["pve-process", "参与步骤"],
          ["pve-pets", "用什么宠物挑战"],
          ["pve-records", "打法与补充"],
          ["pve-sources", "资料来源"],
        ]}
      >
        <Section title="关卡与条件" id="pve-context" edit={false} aside={<EditEntry entity={guide.name} section="玩法资料" mode="pve-guide" record={guide.slug} returnTo={returnTo + "#pve-context"} label="编辑关卡资料" />}>
          {guide.slug === "seven-sanctuaries" ? <SevenSanctuaries guide={guide} query={query} /> : guide.localEntry ? <PveGuidePreview data={guide.editorData} context={{entity:guide.name,returnTo}} onSelectSection={view => update({view,level:null})} /> : <GuideContext guide={guide} query={query} />}
        </Section>
        <Section title="入口与规则" id="pve-entrance" edit={false} aside={<EditEntry entity={guide.name} section="玩法资料" mode="pve-guide" record={guide.slug} returnTo={returnTo + "#pve-entrance"} label="编辑入口与规则" />}>
          <div className="pv6-entrances">
            {guide.entrances.map((entry, index) => (
              <div key={`${entry.client}-${index}`}>
                <span>{entry.client}</span>
                <ReadingMarkdown className="pv72-entrance-path" editHeadings={false} markdown={entry.path} context={{entity:guide.name,returnTo}} />
                <SourceMark id={entry.sourceId} />
              </div>
            ))}
          </div>
          <dl className="pv6-facts">
            {guide.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>
                  {fact.value}
                  <span className="pv6-fact-source">
                    <SourceMark id={fact.sourceId} />
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section title="奖励与兑换" id="pve-rewards" edit={false} aside={<EditEntry entity={guide.name} section="玩法资料" mode="pve-guide" record={guide.slug} returnTo={returnTo + "#pve-rewards"} label="编辑奖励资料" />}>
          {guide.slug === "shanhai" && <div id="shanhai-summon" className="pv72-summon" data-pve-reward-activity><div><ColorIcon Icon={Sparkles} tone="amber" size={23} /><h3>山海召唤</h3><Badge tone="amber">随机抽取</Badge></div><p>使用挑战获得的祥云印记进行召唤；投入异兽魂珠可提高对应召唤概率。先确认奖池、消耗与概率，再决定是否参与。</p><p>这是挑战后的奖励活动，不是需要击败 BOSS 的 PVE 关卡。当前完整奖池和概率待补充。</p><SourceMark id="lite-pve-20250910" /></div>}
          <div className="rw-table-scroll">
            <table className="rw-table pv6-rewards">
              <thead>
                <tr>
                  <th>奖励 / 资源</th>
                  <th>如何取得</th>
                  <th>领取前确认</th>
                </tr>
              </thead>
              <tbody>
                {guide.rewards.map((reward, index) => (
                  <tr key={`${reward.name}-${index}`}>
                    <td>
                      <strong>{reward.name}</strong>
                      <small>{reward.kind}</small>
                    </td>
                    <td><ReadingMarkdown editHeadings={false} markdown={reward.how} context={{entity:guide.name,returnTo}} /></td>
                    <td>
                      <p>{reward.note}</p>
                      <SourceMark id={reward.sourceId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="参与步骤" id="pve-process" edit={false}>
          <ol className="pv6-steps">
            {guide.steps.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <p className="pv6-source-note">
            这是依据规则整理的参与顺序。Boss
            战斗中的出招步骤，需要对应队伍和实测记录。
          </p>
        </Section>
        <ChallengePets guide={guide} query={query} />
        <Section title="打法与补充" id="pve-records" edit={false}>
          <div className="pv6-record-intro" data-no-editor>
            <div>
              <h3>查打法时保留这个玩法的条件</h3>
              <p>
                同名 Boss 在不同副本中的规则未必相同。请把 {guide.name}
                、关卡条件与队伍一起带入查证。
              </p>
            </div>
            <TextLink to="/guides/pve/">怎样写一份打法</TextLink>
          </div>
          <ul className="pv6-record-fields">
            <li>
              <Check size={15} />
              <span>宠物、等级与准确面板</span>
            </li>
            <li>
              <Check size={15} />
              <span>配招、血脉、装备与场下队友</span>
            </li>
            <li>
              <Check size={15} />
              <span>起手、关键条件与失败分支</span>
            </li>
            <li>
              <Check size={15} />
              <span>测试日期、关卡截图或录像</span>
            </li>
          </ul>
          <details className="pv6-unknowns">
            <summary>当前还缺哪些动态资料？</summary>
            <ul>
              {guide.unknowns.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>现行 Boss、规则与奖励需要按具体日期补充。</p>
          </details>
          <div className="pv6-related-reading">
            <TextLink to="/guides/pve/">怎样核对和复现攻略</TextLink>
            <TextLink to="/mechanics/relations/">查效果覆盖与共存</TextLink>
            <TextLink to="/pets/">核对宠物与技能</TextLink>
          </div>
        </Section>
        <Section title="资料来源" id="pve-sources" edit={false} aside={<EditEntry entity={guide.name} section="玩法资料" mode="pve-guide" record={guide.slug} returnTo={returnTo + "#pve-sources"} label="编辑资料来源" />}>
          {guide.localSource && <div className="pv72-guide-source"><a href={guide.localSource.url} target="_blank" rel="noreferrer">{guide.localSource.title}<ExternalLink size={12} /></a><span>核对于 {guide.localSource.checkedAt}</span></div>}<Sources ids={guide.sourceIds} />
          <p className="pv6-source-note">
            来源分别标明官方公告、公告转载及社区位置资料；“已核对”指读过这些资料，并非已验证当天游戏配置。
          </p>
        </Section>
        <Contribution
          entity={guide.name + " · PVE资料"}
          source={sourceById[guide.sourceIds[0]]?.url}
        />
      </DocGrid>
    </div>
  );
}

export default function PvePages({
  path = "/pve/",
  query = new URLSearchParams(),
}) {
  const guides = usePveGuides();
  if ((path === "/pve/" || path === "/pve") && !query.get("entry")) return <PveHome query={query} guides={guides} />;
  const slug = query.get("entry") || path.split("/").filter(Boolean)[1];
  const guide = guides.find((item) => item.slug === slug);
  if (!guide || (!query.get("entry") && path.split("/").filter(Boolean).length !== 2))
    return (
      <div className="pv6">
        <PageHeader title="尚未收录这个 PVE 页面" back="/pve/" />
        <EmptyState
          action={
            <Link className="rw-button" to="/pve/">
              返回 PVE 目录
            </Link>
          }
        >
          请从副本正式名称继续查找。
        </EmptyState>
      </div>
    );
  return <PveGuide guide={guide} query={query} guides={guides} />;
}
