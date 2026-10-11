import React from "react";
import { FlaskConical, Package } from "lucide-react";
import { Link, PageHeader, Section, Notice, EmptyState, Contribution, TextLink, DocGrid, DataPair } from "../core";
import EditEntry from "../editing/EditEntry";
import DirectoryPanel, { DirectorySearch, DirectoryFilters, DirectoryEntry } from "../DirectoryPanel";
import { AdventureNav, MissingInline, SOURCES, SourceLine, Trail, hrefWith, useWorldQuery } from "./components.jsx";

const ITEM_CATEGORIES = [
  ["all", "全部"],
  ["recovery", "恢复道具"],
  ["training", "培养材料"],
  ["equipment", "宠物装备"],
  ["exchange", "兑换物品"],
];

function ItemsIndex({ query }) {
  const update = useWorldQuery(query),
    category = query.get("category") || "all",
    q = (query.get("q") || "").trim().toLowerCase();
  const showPotion =
    ["all", "recovery"].includes(category) &&
    (!q ||
      ["hp药剂", "恢复", "精力", "药水", "宠物道具店"].some((value) =>
        value.includes(q),
      ));
  return (
    <div className="wa-page">
      <PageHeader
        title="道具与物品"
        actions={
          <EditEntry
            entity="道具与物品"
            section="物品目录"
            mode="index"
            intent="add"
            returnTo="/items/"
            label="新增物品入口"
            variant="primary"
          />
        }
        description="按用途查物品，核对效果、使用限制和来源。"
        crumbs={[
          { label: "首页", to: "/" },
          { label: "冒险资料", to: "/adventure/" },
          { label: "道具" },
        ]}
      />
      <AdventureNav current="/items/" />
      <DirectoryPanel directory="items" title="物品目录" Icon={Package} tone="violet" summary={`${showPotion ? 1 : 0} 条匹配 · 按用途核对效果与来源`}
        filters={<DirectoryFilters current={category} label="道具用途" items={ITEM_CATEGORIES.map(([value, label]) => ({ value, label, to: hrefWith("/items/", query, { category: value }) }))} />}
        search={<DirectorySearch query={query} onSubmit={value => update({ q: value })} placeholder="名称、用途或来源地点" label="搜索道具" />}>
      {showPotion ? (
        <DirectoryEntry to="/items/potion/" title="HP药剂" eyebrow="恢复道具 · 按规格区分" description="恢复宠物精力" Icon={FlaskConical} tone="violet"
          facts={[{ label: "来源记录", value: "商店街 · 宠物道具店" }, { label: "规格与售价", value: "现行资料待补充" }]} />
      ) : (
        <EmptyState
          title="这一分类还没有匹配的物品"
          action={
            <Link className="rw-button" to="/items/">
              查看全部已收录物品
            </Link>
          }
        >
          可以更换关键词，或补充道具名称、效果和获取来源。
        </EmptyState>
      )}
      </DirectoryPanel>
      <div className="wa-item-guide">
        <h2>查来源，也查使用条件</h2>
        <p>
          相同用途的道具可能有不同规格。购买、兑换、活动掉落分别记录，并保留适用时间和原始说明。
        </p>
        <TextLink to="/events/">查看活动与兑换记录</TextLink>
      </div>
      <Contribution entity="道具与物品索引" />
    </div>
  );
}

function PotionDetail() {
  return (
    <div className="wa-page">
      <PageHeader
        title="HP药剂"
        eyebrow="道具资料 · 恢复"
        description="用于恢复宠物精力；不同规格的数值与价格需要分别核对。"
        back="/items/"
        crumbs={[
          { label: "冒险资料", to: "/adventure/" },
          { label: "道具", to: "/items/" },
          { label: "HP药剂" },
        ]}
      />
      <DocGrid
        toc={[
          ["item-effect", "用途与限制"],
          ["item-source", "来源与购买"],
          ["item-specs", "规格资料"],
        ]}
      >
        <div className="wa-item-profile">
          <span>
            <FlaskConical size={37} />
          </span>
          <dl className="wa-facts">
            <DataPair label="物品类别" value="恢复道具" />
            <DataPair label="作用对象" value="宠物" />
            <DataPair label="主要用途" value="恢复精力（HP）" />
          </dl>
        </div>
        <Section title="用途与限制" id="item-effect">
          <p>
            HP药剂用于恢复宠物的血量。使用前应确认药剂规格、恢复量及当前战斗模式的道具限制。
          </p>
          <p className="wa-small">
            本条目未逐项核验各比赛、Boss挑战中的使用许可；能否使用请核对对应模式。
          </p>
        </Section>
        <Section title="来源与购买" id="item-source">
          <Trail items={["大地图", "商店街", "宠物道具店"]} />
          <p>已收录的页游资料将宠物道具店列为HP药剂购买地点。</p>
          <SourceLine source={SOURCES.potion} note="历史购买地点记录" />
          <Notice title="购买信息待更新">
            当前在售规格、单价与购买限制尚未核验；本页不提供未经确认的价格。
          </Notice>
        </Section>
        <Section title="规格资料" id="item-specs">
          <MissingInline
            title="各规格的精确数值尚未收录"
            entity="HP药剂 · 规格与售价"
          >
            可补充道具名称、恢复精力数值、使用说明、商店价格和截图日期。
          </MissingInline>
        </Section>
        <Contribution entity="HP药剂" source={SOURCES.potion.url} />
      </DocGrid>
    </div>
  );
}

export { ItemsIndex, PotionDetail };
