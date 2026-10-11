import React, { useState } from "react";
import { useHistory, useLocation } from "@docusaurus/router";
import {
  ArrowRight,
  ArrowLeftRight,
  BookOpen,
  ExternalLink,
  FlaskConical,
  Search,
  Layers,
  ListTree,
  Clock3,
  Shuffle,
} from "lucide-react";
import {
  Link,
  PageHeader,
  Section,
  Notice,
  Badge,
  Contribution,
  setQuery,
} from "./core";
import { battleRelations as data } from "./content/bundled.js";
import CustomSelect from "./Select";
import { ColorIcon } from "./visuals";
import "./WorldV7.css";

const groups = [
  [
    "基础与行动",
    "属性与速度决定起点，技能阶段决定后续。",
    [
      ["attributes", "属性与克制"],
      ["priority", "速度与先手"],
      ["accuracy", "命中与闪避"],
      ["stages", "技能阶段与结算"],
      ["timing", "完整行动时间线"],
    ],
  ],
  [
    "伤害与治疗",
    "看清威力、固伤、护盾与精力回复的边界。",
    [
      ["damage", "伤害类型与计算条件"],
      ["shield", "护盾与减伤"],
      ["healing", "治疗、吸血与回复修正"],
    ],
  ],
  [
    "资源与限制",
    "区分扣 PP、额外消耗、技能限制和回复。",
    [
      ["pp", "PP 与技能限制"],
      ["effects/pressure", "压迫（双损）专题"],
    ],
  ],
  [
    "状态与效果",
    "同名效果先辨来源，再看施加与解除关系。",
    [
      ["effects", "效果身份与分类"],
      ["interactions", "覆盖、共存与冲突"],
      ["status", "异常、强化与标记"],
      ["passive", "血脉、被动与触发"],
    ],
  ],
  [
    "战场与换宠",
    "天气、环境、场上对象与换宠后继承。",
    [
      ["weather", "天气与环境"],
      ["switching", "换宠、驱逐与阵亡"],
    ],
  ],
  [
    "查证与术语",
    "让结论可复现，也让不确定性可见。",
    [
      ["evidence", "实测记录与证据"],
      ["glossary", "战斗术语表"],
    ],
  ],
];
const recommendations = [
  [
    "effects/pressure",
    "压迫（双损）怎么查？",
    "同样是额外消耗 PP，来源、持续对象和解除关系都可能不同。读懂压迫专题，再查一对效果。",
  ],
  [
    "priority",
    "先手值之外，谁先行动？",
    "把技能先手、宠物速度与特殊行动规则分开核对，理解一次行动的先后。",
  ],
  [
    "damage",
    "这一段伤害从哪里来？",
    "区分威力伤害、固定伤害、附加伤害与波及，再确定该查哪些条件。",
  ],
  [
    "timing",
    "沿着完整回合查触发点",
    "从回合开始到行动结束，把状态检查、技能效果与延迟结算放回时间线上。",
  ],
  [
    "weather",
    "天气与环境怎样改变战场？",
    "先辨影响对象和触发时点，再查持续时间以及被替换后的结算。",
  ],
  [
    "shield",
    "护盾和减伤各挡住什么？",
    "伤害类型、保护额度和生效条件要一起看，不能仅凭精力变化判断。",
  ],
  [
    "switching",
    "换宠之后，哪些效果还在？",
    "从主动换宠、驱逐与阵亡切入，逐项查看场上对象和继承条件。",
  ],
];
export function MechanicsHome() {
  // A fixed initial item avoids server/client hydration differences. Randomness
  // only follows an explicit user action and never selects the same article.
  const [recommendedIndex, setRecommendedIndex] = useState(0);
  const recommended = recommendations[recommendedIndex];
  function anotherArticle() {
    setRecommendedIndex(
      (current) =>
        (current +
          1 +
          Math.floor(Math.random() * (recommendations.length - 1))) %
        recommendations.length,
    );
  }
  return (
    <div className="rw-mechanics-hub rw-mechanics-v71" data-no-editor>
      <PageHeader
        title="战斗机制"
        description="从一次出手，到一组效果的覆盖关系。把对战规则按问题展开查。"
        crumbs={[{ label: "Wiki", to: "/" }, { label: "战斗机制" }]}
        edit={false}
        actions={
          <>
          <Link className="rw-button primary" to="/mechanics/overview/" data-mechanics-overview-entry>
            <ListTree size={17} />
            全部机制
          </Link>
          <Link className="rw-button" to="/mechanics/glossary/">
            <BookOpen size={16} />
            查术语
          </Link>
          </>
        }
      />
      <section className="rw-mechanics-feature">
        <div>
          <span className="rw-wiki-kicker">效果关系查询</span>
          <h2>名字相同，结算也相同吗？</h2>
          <p>
            选择场上已有和新施加的效果，分别查看施加、到期清除、换宠之后的结果。每条关系保留条件和证据日期。
          </p>
          <Link to="/mechanics/relations/" className="rw-button primary">
            选择两个效果 <ArrowRight size={16} />
          </Link>
          <Link to="/mechanics/interactions/" className="rw-textlink">
            先理解覆盖与共存
          </Link>
        </div>
        <div
          className="rw-mechanics-feature-example"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>推荐阅读 · 战斗机制</span>
          <strong>{recommended[1]}</strong>
          <p>{recommended[2]}</p>
          <div className="rw-mechanics-recommend-actions">
            <Link to={"/mechanics/" + recommended[0] + "/"}>
              阅读文章 <ArrowRight size={14} />
            </Link>
            <button
              type="button"
              className="rw-textlink"
              onClick={anotherArticle}
            >
              <Shuffle size={14} /> 换一篇
            </button>
          </div>
        </div>
      </section>
      <div className="rw-mechanics-directory">
        {groups.map(([name, desc, entries], i) => (
          <section key={name}>
            <div className="rw-directory-heading">
              <ColorIcon Icon={[Clock3, Layers, BookOpen, ArrowLeftRight, Shuffle, FlaskConical][i]} tone={["blue", "violet", "amber", "rose", "teal", "coral"][i]} size={19} />
              <h2>{name}</h2>
            </div>
            <p>{desc}</p>
            <nav aria-label={name}>
              {entries.map(([slug, label]) => (
                <Link key={slug} to={"/mechanics/" + slug + "/"}>
                  {label}
                  <ArrowRight size={14} />
                </Link>
              ))}
            </nav>
          </section>
        ))}
      </div>
      <div className="rw-mechanics-bottom">
        <div>
          <FlaskConical size={22} />
          <strong>你遇到了与资料不同的结果？</strong>
          <p>
            记录版本、宠物、技能、天气环境和出手顺序，复现比一句“优先级更高”更有用。
          </p>
        </div>
        <Link to="/mechanics/evidence/" className="rw-button">
          查看实测规范
        </Link>
      </div>
    </div>
  );
}
function effectById(id) {
  return data.effects.find((e) => e.id === id);
}
export function EffectRelations() {
  const location = useLocation(),
    history = useHistory(),
    query = new URLSearchParams(location.search);
  const requestedExisting = query.get("existing"),
    requestedIncoming = query.get("incoming");
  const existing =
      effectById(requestedExisting) ||
      effectById(data.defaultSelection.existing),
    incoming =
      effectById(requestedIncoming) ||
      effectById(data.defaultSelection.incoming);
  const invalid =
    (requestedExisting && !effectById(requestedExisting)) ||
    (requestedIncoming && !effectById(requestedIncoming));
  const relations = data.relations.filter(
    (r) =>
      r.existingEffectId === existing.id && r.incomingEffectId === incoming.id,
  );
  const change = (values) => setQuery(history, location, values);
  function chooser(effect, key, label, caption) {
    return (
      <label className="rw-effect-chooser">
        <span>{label}</span>
        <CustomSelect
          ariaLabel={label}
          value={effect.id}
          onChange={(value) => change({ [key]: value })}
          options={data.effects.map((item) => ({
            value: item.id,
            label: `${item.skill} · ${item.pet}`,
          }))}
        />
        <strong>{effect.displayName}</strong>
        <small>{caption}</small>
        <div>{effect.scope}</div>
        <a href={effect.source} target="_blank" rel="noreferrer">
          {effect.skill} · 技能来源 <ExternalLink size={12} />
        </a>
      </label>
    );
  }
  return (
    <div className="rw-relations-page">
      <PageHeader
        title="效果关系查询"
        back="/mechanics/"
        crumbs={[
          { label: "战斗机制", to: "/mechanics/" },
          { label: "效果关系查询" },
        ]}
        description="已有哪个效果，再施加哪个效果？顺序、条件和结算阶段分别核对。"
        actions={
          <Link to="/mechanics/effects/pressure/" className="rw-button">
            压迫专题 <ArrowRight size={15} />
          </Link>
        }
      />
      <div className="rw-relations-scope">
        <Layers size={18} />
        <span>
          当前收录：压迫（双损） · 5 种来源 · 8 条方向查询记录（共享历史线索）
        </span>
        <Link to="/mechanics/effects/">效果分类</Link>
      </div>
      {invalid && (
        <Notice tone="gold" title="链接中的效果 ID 未收录">
          已显示示例配对，请重新选择要核对的两种效果。
        </Notice>
      )}
      <section className="rw-effect-pair" aria-label="选择效果顺序">
        {chooser(
          existing,
          "existing",
          "场上已有的效果",
          "第一步：该效果已满足条件并生效",
        )}
        <button
          className="rw-swap-effects"
          onClick={() =>
            change({ existing: incoming.id, incoming: existing.id })
          }
          aria-label="交换已有与新施加效果"
        >
          <ArrowLeftRight size={21} />
          <span>交换顺序</span>
        </button>
        {chooser(
          incoming,
          "incoming",
          "新施加的效果",
          "第二步：在已有状态下尝试施加",
        )}
      </section>
      <section
        className="rw-relation-results"
        aria-live="polite"
        key={existing.id + incoming.id}
      >
        <div className="rw-section-head">
          <h2>查询结果</h2>
          <span className="rw-query-direction">
            {existing.skill} <ArrowRight size={14} /> {incoming.skill}
          </span>
        </div>
        {relations.length ? (
          relations.map((r) => {
            const source = data.sources.find((s) => s.id === r.sourceId);
            return (
              <article className="rw-relation-result" key={r.id}>
                <div className="rw-result-verdict">
                  <div>
                    <Badge tone="gold">{r.evidenceLabel}</Badge>
                    <h3>{data.relationLabels[r.relation]}</h3>
                    <p>{r.result}</p>
                  </div>
                  <div>
                    <span>来源日期</span>
                    <strong>{r.sourceDate}</strong>
                    <small>当前版本复核：未完成</small>
                  </div>
                </div>
                <div className="rw-relation-phases">
                  {[
                    ["01", "施加瞬间", r.applicationResult],
                    ["02", "效果到期／解除", r.expiryResult],
                    ["03", "换宠之后", r.switchResult],
                  ].map(([num, title, text]) => (
                    <div key={num}>
                      <span>{num}</span>
                      <h4>{title}</h4>
                      <p>{text}</p>
                    </div>
                  ))}
                </div>
                <dl className="rw-relation-details">
                  <div>
                    <dt>作用对象</dt>
                    <dd>{r.scope}</dd>
                  </div>
                  <div>
                    <dt>记录时点</dt>
                    <dd>{r.phase}</dd>
                  </div>
                  <div>
                    <dt>宠物与形态</dt>
                    <dd>{r.petScope}</dd>
                  </div>
                  <div>
                    <dt>适用条件</dt>
                    <dd>
                      <ul>
                        {r.conditions.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  {r.historicalPriority && (
                    <div>
                      <dt>历史优先记载</dt>
                      <dd>
                        {effectById(r.historicalPriority.higherEffectId).skill}{" "}
                        高于{" "}
                        {effectById(r.historicalPriority.lowerEffectId).skill}。
                        {r.historicalPriority.note}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="rw-relation-evidence">
                  <FlaskConical size={18} />
                  <div>
                    <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                      {source?.title}
                      <ExternalLink size={12} />
                    </a>
                    <p>
                      {source?.author} · {r.locator}
                    </p>
                  </div>
                  <Link
                    to={
                      "/edit/?entity=" +
                      encodeURIComponent(
                        existing.skill + "与" + incoming.skill + "效果关系",
                      ) +
                      "&section=" +
                      encodeURIComponent("效果关系实测")
                    }
                  >
                    补充复现证据 <ArrowRight size={14} />
                  </Link>
                </div>
                <details className="rw-open-questions">
                  <summary>还需要验证哪些条件？</summary>
                  <ul>
                    {r.openQuestions.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p>{r.limitations.join(" ")}</p>
                </details>
              </article>
            );
          })
        ) : (
          <div className="rw-relation-unknown">
            <Search size={29} />
            <h3>
              {existing.id === incoming.id
                ? "同来源重复施加的关系待收录"
                : "这组配对还没有可引用的记录"}
            </h3>
            <p>
              未知不表示共存，也不表示没有影响。相同的效果名称无法替代这一顺序下的实测。
            </p>
            <Link to="/mechanics/evidence/" className="rw-button">
              按规范补充测试 <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </section>
      <Section
        title="按来源交叉查"
        aside={<span className="rw-subnote">行 = 已有 · 列 = 新施加</span>}
      >
        <div className="rw-table-scroll">
          <table className="rw-table rw-effect-matrix">
            <thead>
              <tr>
                <th>已有 ↓ / 新施加 →</th>
                {data.effects.map((e) => (
                  <th key={e.id}>{e.skill}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.effects.map((a) => (
                <tr key={a.id}>
                  <th>{a.skill}</th>
                  {data.effects.map((b) => {
                    const r = data.relations.find(
                      (r) =>
                        r.existingEffectId === a.id &&
                        r.incomingEffectId === b.id,
                    );
                    return (
                      <td key={b.id}>
                        <button
                          className={
                            (a.id === existing.id && b.id === incoming.id
                              ? "is-selected "
                              : "") +
                            (r?.relation === "mutual_clear" ? "has-record" : "")
                          }
                          onClick={() =>
                            change({ existing: a.id, incoming: b.id })
                          }
                          aria-label={a.skill + "已有，施加" + b.skill}
                        >
                          {a.id === b.id
                            ? "重复施加待核"
                            : r?.relation === "mutual_clear"
                              ? "历史互解记录"
                              : r
                                ? "历史优先记载"
                                : "未收录"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rw-subnote">
          矩阵用于定位记录，不把历史记载自动推广成现版本结论，也不通过 A、B、C
          的关系推导未测过的配对。
        </p>
      </Section>
      <Contribution entity="效果关系查询" source={data.sources[0].url} />
    </div>
  );
}
