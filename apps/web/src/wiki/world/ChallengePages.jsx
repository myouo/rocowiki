import React from "react";
import { ArrowRight, BookOpen, ChevronRight, Layers3 } from "lucide-react";
import { Link, PageHeader, Section, Badge, Notice, Contribution, TextLink, DataPair, BookmarkButton } from "../core";
import Select from "../Select";
import { SOURCES, SourceLine, hrefWith, useWorldQuery } from "./components.jsx";

const TOWER_LEVELS = [
  { level: 1, bosses: ["助手兔", "炼狱使者", "诡法师"] },
  { level: 2, bosses: ["劫影龙皇", "沉沦纺锤", "暗黑法师"] },
  { level: 3, bosses: ["合金战神", "太鼓雷鸣", "觉醒武藏"] },
  {
    level: 4,
    bosses: ["圣电雷王 + 觉醒蛛后", "雪莉实验机", "灵蔓草王 + 圣藤草王"],
  },
  { level: 5, bosses: ["蛋蛋超人", "恶魔男爵", "玄灵妲己"] },
  { level: 6, bosses: ["镇狱修罗王", "海皇波塞冬", "蹦神幻影"] },
  { level: 7, bosses: ["北辰"] },
  { level: 8, bosses: ["破启幽王"] },
];

function ChallengesIndex() {
  return (
    <div className="wa-page">
      <PageHeader
        title="历史挑战资料"
        eyebrow="PVE资料档案"
        description="保留旧版关卡目录与来源，查证时确认年份和规则。各玩法的入口、奖励与参与步骤在 PVE 手册中集中查阅。"
        back="/pve/"
        crumbs={[
          { label: "PVE 副本与挑战", to: "/pve/" },
          { label: "历史挑战资料" },
        ]}
        actions={
          <Link className="rw-button" to="/pve/">
            进入 PVE 手册
            <ArrowRight size={15} />
          </Link>
        }
      />
      <div className="wa-challenge-feature">
        <div>
          <span className="wa-kicker">已收录历史目录</span>
          <h2>星辰之塔</h2>
          <p>
            从层数进入Boss目录，按关卡规则核对打法。当前提供历史目录，实测方案持续补充。
          </p>
          <div className="wa-inline-labels">
            <Badge>层数 / Boss检索</Badge>
            <Badge>历史版本</Badge>
          </div>
          <Link className="rw-button primary" to="/challenges/star-tower/">
            查历史 Boss 目录 <ArrowRight size={15} />
          </Link>
        </div>
        <div className="wa-tower-index" aria-label="星辰之塔层数">
          {[8, 7, 6, 5, 4, 3, 2, 1].map((level) => (
            <Link key={level} to={"/challenges/star-tower/?level=" + level}>
              <span>第 {level} 层</span>
              <ChevronRight size={13} />
            </Link>
          ))}
        </div>
      </div>
      <p className="wa-v6-pve-link">
        <TextLink to="/pve/star-tower/">
          查看星辰之塔规则、奖励与星辰令说明
        </TextLink>
      </p>
      <div className="wa-two-column">
        <Section title="选择打法之前">
          <ol className="wa-plain-list">
            <li>确认挑战模式、关卡与Boss名称。</li>
            <li>核对宠物、配招、血脉及培养配置。</li>
            <li>检查攻略的实测日期和适用版本。</li>
            <li>缺少某只宠物时，查替代方案的验证记录。</li>
          </ol>
          <TextLink to="/guides/pve/">挑战攻略怎么选</TextLink>
        </Section>
        <Section title="准备好自己的宠物">
          <div className="wa-related-lines">
            <Link to="/pets/">
              <BookOpen size={19} />
              <div>
                <strong>查宠物与可学技能</strong>
                <span>先核对配置所需要的资料</span>
              </div>
              <ArrowRight size={16} />
            </Link>
            <Link to="/guides/training/">
              <Layers3 size={19} />
              <div>
                <strong>宠物培养指南</strong>
                <span>等级、天赋、努力值与装备</span>
              </div>
              <ArrowRight size={16} />
            </Link>
          </div>
        </Section>
      </div>
      <Contribution entity="PVE挑战目录" />
    </div>
  );
}

function StarTower({ query }) {
  const update = useWorldQuery(query);
  const rawLevel = Number(query.get("level") || 1),
    level = rawLevel >= 1 && rawLevel <= 8 ? Math.floor(rawLevel) : 1;
  const record = TOWER_LEVELS[level - 1],
    rawBoss = query.get("boss"),
    boss = record.bosses.includes(rawBoss) ? rawBoss : record.bosses[0];
  const source = level === 8 ? SOURCES.tower : SOURCES.towerOld;
  const entity =
    "星辰之塔 · 第" + level + "层 · " + boss + " · " + source.date + "历史资料";
  return (
    <div className="wa-page">
      <PageHeader
        title="星辰之塔 · 历史 Boss 目录"
        eyebrow="PVE历史资料"
        description="选择历史记录中的层数与对手，核对当时的来源。现行玩法规则和奖励在星辰之塔手册中单独查阅。"
        back="/pve/star-tower/"
        crumbs={[
          { label: "PVE 副本与挑战", to: "/pve/" },
          { label: "星辰之塔", to: "/pve/star-tower/" },
          { label: "历史 Boss 目录" },
        ]}
        actions={
          <BookmarkButton
            id="challenge-star-tower"
            title="星辰之塔"
            href="/challenges/star-tower/"
            kind="挑战"
          />
        }
      />
      <Notice title="当前展示历史关卡目录">
        第1—7层的Boss目录来自2016年资料，第8层来自2023年更新记录。当前关卡与实测配置仍待复核。
        <TextLink to="/pve/star-tower/">查看玩法规则与奖励</TextLink>
      </Notice>
      <div className="wa-tower-workspace">
        <aside className="wa-floor-panel">
          <span className="wa-kicker">第一步 · 选择层数</span>
          <nav aria-label="星辰之塔层数">
            {TOWER_LEVELS.map((item) => (
              <Link
                to={hrefWith("/challenges/star-tower/", query, {
                  level: item.level,
                  boss: null,
                })}
                key={item.level}
                className={item.level === level ? "active" : ""}
                aria-current={item.level === level ? "page" : undefined}
              >
                <span className="wa-floor-number">
                  {String(item.level).padStart(2, "0")}
                </span>
                <span>第 {item.level} 层</span>
                <ChevronRight size={14} />
              </Link>
            ))}
          </nav>
          <small>
            目录用于查阅历史资料，
            <br />
            不表示今日Boss轮换。
          </small>
        </aside>
        <div className="wa-boss-panel">
          <div className="wa-boss-picker">
            <div>
              <span className="wa-kicker">第二步 · 选择对手</span>
              <Select
                ariaLabel="选择历史星辰塔 Boss"
                value={boss}
                options={record.bosses.map((name) => ({
                  value: name,
                  label: name,
                }))}
                onChange={(value) => update({ boss: value })}
              />
            </div>
            <Badge>第 {level} 层</Badge>
          </div>
          <div className="wa-selected-boss">
            <span className="wa-kicker">关卡对手</span>
            <h2>{boss}</h2>
            <p>
              {level === 8
                ? "2023年9月更新将破启幽王列为第8层对手，并介绍了星辰令与星辰之光。"
                : "此名称收录于2016年星辰之塔的对应层数目录。"}
            </p>
            <SourceLine source={source} />
          </div>
          <div className="wa-strategy-state">
            <span className="wa-kicker">第三步 · 查看打法</span>
            <h3>尚未收录可复现的实测方案</h3>
            <p>
              这个关卡还缺少经过核验的配置、出招步骤与替代方案。可提交自己实际完成挑战的记录。
            </p>
            <Link
              className="rw-button primary"
              to={"/edit/?entity=" + encodeURIComponent(entity)}
            >
              补充这个Boss的打法 <ArrowRight size={14} />
            </Link>
          </div>
          <details className="wa-check-details">
            <summary>一份可复现的打法需要哪些内容？</summary>
            <dl className="wa-requirement-list">
              <DataPair
                label="必要配置"
                value="宠物、等级、天赋、努力值、配招、血脉与装备"
              />
              <DataPair
                label="可替代配置"
                value="替代宠物及可替代的条件，注明是否实测"
              />
              <DataPair
                label="行动步骤"
                value="起手、循环、关键触发条件与失败分支"
              />
              <DataPair
                label="验证记录"
                value="游戏版本、实测日期、关卡与过程截图"
              />
            </dl>
          </details>
        </div>
      </div>
      <Section title="复现失败时，先核对这些">
        <div className="wa-troubleshoot">
          <details>
            <summary>配置是否与攻略一致？</summary>
            <p>
              逐项比对配招、血脉、能力值、装备和场下队友。缺少的条件应在反馈中说明。
            </p>
          </details>
          <details>
            <summary>关键条件是否确实触发？</summary>
            <p>
              记录先后手、天气环境、对手状态与技能PP；将预期结果和实际结果一起提交。
            </p>
          </details>
          <details>
            <summary>是否是同一关卡与版本？</summary>
            <p>
              核对层数、Boss、挑战模式与记录日期，避免把其他关卡的同名对手当成同一规则。
            </p>
          </details>
        </div>
      </Section>
      <Contribution entity={entity} source={source.url} />
    </div>
  );
}

export { ChallengesIndex, StarTower };
