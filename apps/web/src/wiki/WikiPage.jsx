import React from "react";
import Layout from "@theme/Layout";
import { useLocation } from "@docusaurus/router";
import { BookOpen, ArrowRight, FileCheck, Lightbulb } from "lucide-react";
import {
  normalizePath,
  PageHeader,
  Link,
  Contribution,
  EmptyState,
} from "./core";
import {
  PetsPage,
  PetPage,
  SkillsPage,
  SkillPage,
  BloodlinePage,
  SearchPage,
} from "./CatalogPages";
import ToolsPages from "./ToolsPages";
import HomePage from "./HomePage";
import { FeedbackPage } from "./Feedback";
import { MechanicsHome, EffectRelations } from "./MechanicsPages";
import CommunityPages from "./CommunityPages";
import WorldPages from "./WorldPages";
import PvePages from "./PvePages";
import { pets, skills } from "./data";
import InlineSectionEdits from "./InlineSectionEdits";
import { ColorIcon } from "./visuals";
import WikiRecoveryBoundary from "./WikiRecoveryBoundary";
import { isReaderPath } from "./editingContext";
import {useWikiRuntime} from "./runtime/useWikiRuntime";
import CopyrightPage from "./legal/CopyrightPage";
import { useHydratedSearch } from "./catalog/pets/useHydratedSearch";

export function GuideIndex({ help = false }) {
  const entries = help
    ? [["/help/contributing/", "贡献指南", "补充证据、编辑预览、提交与修订。"]]
    : [
        [
          "/guides/returning/",
          "回归玩家指南",
          "先盘点已有宠物，再确定要做的事情。",
        ],
        [
          "/guides/training/",
          "宠物培养指南",
          "围绕用途核对性格、努力、装备与技能。",
        ],
        [
          "/guides/pve/",
          "挑战攻略怎么选",
          "先比门槛、前置和规则，再参考打法。",
        ],
      ];
  return (
    <>
      <PageHeader
        title={help ? "贡献帮助" : "玩家指南"}
        eyebrow={help ? "COMMUNITY GUIDE" : "PLAYER GUIDES"}
      />
      <div className="rw-guide-index">
        {entries.map(([to, title, desc], index) => (
          <Link key={to} to={to}>
            <ColorIcon
              kind={
                help
                  ? "help"
                  : index === 0
                    ? "guides"
                    : index === 1
                      ? "pets"
                      : "pve"
              }
              size={25}
            />
            <div>
              <h2>{title}</h2>
              <p>{desc}</p>
            </div>
            <ArrowRight size={17} />
          </Link>
        ))}
      </div>
      <Contribution entity={help ? "帮助中心" : "玩家指南"} />
    </>
  );
}

export function PageContent({ path, query }) {
  if (path === "/") return <HomePage />;
  if (path === "/feedback/") return <FeedbackPage />;
  if (["/copyright/", "/copyright/en/"].includes(path)) return <CopyrightPage english={path === "/copyright/en/"} />;
  if (path === "/mechanics/") return <MechanicsHome />;
  if (path === "/mechanics/relations/") return <EffectRelations />;
  if (path === "/pets/") return <PetsPage query={query} />;
  if (path.startsWith("/pets/")) return <PetPage slug={path.split("/")[2]} />;
  if (path === "/skills/") return <SkillsPage />;
  if (path.startsWith("/skills/"))
    return <SkillPage slug={path.split("/")[2]} />;
  if (["/bloodlines/", "/bloodlines/haifu/"].includes(path))
    return <BloodlinePage detail={path !== "/bloodlines/"} />;
  if (path === "/search/") return <SearchPage />;
  if (path.startsWith("/tools/"))
    return <ToolsPages path={path} query={query} />;
  if (path.startsWith("/pve/")) return <PvePages path={path} query={query} />;
  if (
    ["/community/", "/account/", "/edit/", "/review/", "/history/"].includes(
      path,
    )
  )
    return <CommunityPages path={path} query={query} />;
  if (path === "/guides/" || path === "/help/")
    return <GuideIndex help={path === "/help/"} />;
  if (
    [
      "/adventure/",
      "/places/",
      "/npcs/",
      "/items/",
      "/events/",
      "/battle/",
      "/challenges/",
      "/tasks/",
    ].some((p) => path.startsWith(p))
  )
    return <WorldPages path={path} query={query} />;
  return (
    <>
      <PageHeader
        title="没有找到这份资料"
        description="地址可能已变更，或资料还没有被收录。"
      />
      <EmptyState
        title="试试名称或关键词"
        action={
          <Link className="rw-button primary" to="/search/">
            搜索 Wiki 资料
          </Link>
        }
      >
        你可以返回上一层目录，或者用正式名称查找相关条目。
      </EmptyState>
      <Contribution entity="找不到的条目" />
    </>
  );
}
export default function WikiPage({ routeData }) {
  const {demo} = useWikiRuntime();
  const location = useLocation();
  const path = normalizePath(routeData?.path || location.pathname);
  const query = new URLSearchParams(useHydratedSearch(location.search));
  const title =
    pets.find((p) => path === "/pets/" + p.slug + "/" || (path === "/pets/" && query.get("entry") === p.slug))?.name ||
    skills.find((s) => path === "/skills/" + s.slug + "/")?.name ||
    {
      "/": "洛克王国资料库",
      "/pets/": "宠物图鉴",
      "/skills/": "技能查询",
      "/events/": "活动与获取",
      "/adventure/": "冒险资料",
      "/battle/": "赛事与禁赛",
      "/community/": "参与共建",
      "/account/": "个人中心",
      "/feedback/": "我的反馈",
      "/mechanics/": "战斗机制",
      "/mechanics/relations/": "效果关系查询",
      "/tools/": "实用工具",
      "/search/": "搜索资料",
      "/copyright/": "版权与许可",
      "/copyright/en/": "Copyright and licensing",
    }[path] ||
    "洛克王国 Wiki";
  return (
    <Layout
      title={title}
      description={path.startsWith("/copyright/") ? (path === "/copyright/en/" ? "RocoWiki copyright, CC BY-SA 4.0 prose licensing and third-party rights." : "RocoWiki 版权归属、CC BY-SA 4.0 正文许可与第三方权利说明。") : "洛克王国页游：宠物、技能、机制、活动与冒险的完整查阅系统。"}
    >
      <main className="rw" id="rw-main" tabIndex={-1} data-pagefind-body={isReaderPath(path) && path !== "/community/" ? "" : undefined}>
        <div className="rw-prototype-label">
          <span />
          {demo ? "本机演示 · 样本资料已标注来源 · " : "资料适用范围以条目来源为准 · "}<Link to="/workbench/">站内账号与投稿</Link>
        </div>
        <WikiRecoveryBoundary resetKey={path + location.search}>
          <PageContent key={"content:" + JSON.stringify([path, query.get("entry") || ""])} path={path} query={query} />
          <InlineSectionEdits key={"inline:" + path + location.search} />
        </WikiRecoveryBoundary>
      </main>
    </Layout>
  );
}
