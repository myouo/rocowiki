import React, { useState } from "react";
import Link from "@docusaurus/Link";
import { useHistory, useLocation } from "@docusaurus/router";
import { Moon, Flame, Droplets, Leaf, Sun, Mountain, Star, Swords, Gift, ArrowRight, ExternalLink, CircleHelp } from "lucide-react";
import { seven } from "./content/bundled.js";
import { ColorIcon } from "./visuals";
import CustomSelect from "./Select";
import EditEntry from "./editing/EditEntry";
import ReadingMarkdown from "./editing/ReadingMarkdown";
import { PVE_DIFFICULTIES, pveDifficultyDetails } from "./pvePublished";

const icons = {moon:Moon,fire:Flame,water:Droplets,wood:Leaf,metal:Star,earth:Mountain,sun:Sun};
const difficulties = PVE_DIFFICULTIES;
export default function SevenSanctuaries({guide,query = new URLSearchParams(),preview = false}) {
  const history = useHistory(), location = useLocation();
  const [previewQuery,setPreviewQuery] = useState(() => new URLSearchParams(query));
  const activeQuery = preview ? previewQuery : query;
  const current = seven.stages.find(row => row.id === activeQuery.get("view")) || seven.stages[0];
  const difficulty = difficulties.some(row => row.value === activeQuery.get("difficulty")) ? activeQuery.get("difficulty") : "hard";
  const difficultyLabel = difficulties.find(row => row.value === difficulty).label;
  const changed = guide.sections?.find(row => row.value === current.id);
  const currentDetails = pveDifficultyDetails(changed?.difficultyDetails)[difficulty];
  const returnTo = "/pve/seven-sanctuaries/?" + new URLSearchParams({...Object.fromEntries(activeQuery),view:current.id,difficulty}) + "#pve-context";
  const context = {entity:guide.name,returnTo};
  function choose(changes) {
    const next = new URLSearchParams(activeQuery);
    Object.entries(changes).forEach(([key,value]) => next.set(key,value));
    if (preview) setPreviewQuery(next);
    else history.replace(location.pathname + "?" + next.toString() + "#pve-context");
  }
  return <div className="pv72-seven" data-no-editor>
    <div className="pv72-seven-intro"><div><h3>先选想要的果实，再选挑战难度</h3><p>每个曜日对应一种培养目标。挑战胜利后领取基础奖励，当日七曜秘赐另行结算。</p></div><span className="rw-badge amber">数值为历史参考</span></div>
    <div className="pv72-seven-days" role="group" aria-label="七曜关卡">{seven.stages.map(row => <button key={row.id} type="button" className={`rw-tone-${row.tone} ${row.id === current.id ? "is-active" : ""}`} aria-pressed={row.id === current.id} onClick={() => choose({view:row.id})}><ColorIcon Icon={icons[row.id]} tone={row.tone} size={22} /><strong>{row.label}</strong><span>{row.fruit}</span><small>{row.bonusDay}秘赐</small></button>)}</div>
    <article className={`pv72-seven-detail rw-tone-${current.tone}`} data-seven-stage={current.id} data-seven-difficulty={difficulty}>
      <header><div><ColorIcon Icon={icons[current.id]} tone={current.tone} size={25} /><h3>{changed?.title || current.name}</h3></div><CustomSelect ariaLabel="七曜挑战难度" value={difficulty} onChange={value => choose({difficulty:value})} options={difficulties} /></header>
      <div className="pv72-boss-reward-grid"><section><h4><Swords size={17} />{difficultyLabel} · 挑战 BOSS / NPC</h4><ReadingMarkdown editHeadings={false} markdown={currentDetails.bosses || "当前难度的 BOSS 名称与配置待实测补充。"} context={context} /><p className="pv72-field-note">从本曜日的“进入挑战”核对对手；历史旧版名单不自动沿用。</p>{!preview && <EditEntry entity={guide.name} section="玩法资料" mode="pve-guide" record={guide.slug} returnTo={returnTo} label={`补充${current.label} · ${difficultyLabel}`} />}</section><section><h4><Gift size={17} />{difficultyLabel} · 基础奖励</h4>{currentDetails.rewards ? <><ReadingMarkdown editHeadings={false} markdown={currentDetails.rewards} context={context} /><span className="rw-badge violet">{preview ? "本次编辑预览" : `本机修订 · 核对于 ${guide.localSource?.checkedAt || "待补充"}`}</span></> : <><strong className="pv72-fruit-count">{current.amounts[difficulty]} <span>颗</span></strong><p>{current.fruit}</p><span className="rw-badge amber">历史资料 · 本期数量待复核</span></>}</section></div>
      {(changed?.bosses || changed?.rewards) && <aside className="pv72-general-notes pv72-general-reading"><strong>本曜综合备注 · 适用难度以正文为准</strong><ReadingMarkdown editHeadings={false} markdown={[changed.bosses,changed.rewards].filter(Boolean).join("\n\n")} context={context} /></aside>}
      <ReadingMarkdown className="pv72-seven-unlock" editHeadings={false} markdown={changed?.body || current.condition} context={context} />
      <div className="pv72-seven-next"><span>{current.bonusDay}对应本曜秘赐；当前额外数量与遗忘果实概率以游戏规则为准。</span>{!preview && <Link to={returnTo.replace("#pve-context","#pve-pets")}>查看挑战方案<ArrowRight size={13} /></Link>}</div>
    </article>
    <details className="pv72-seven-table" open><summary>七曜奖励与挑战对象对照</summary><div className="rw-table-scroll"><table className="rw-table"><caption>未补充的基础数量保留历史参考；不包含七曜秘赐。日曜为随机种类，不表示每种都领取相同数量。</caption><thead><tr><th>曜日 / 秘赐日</th><th>培养奖励</th><th>简单</th><th>普通</th><th>困难</th><th>BOSS / NPC</th></tr></thead><tbody>{seven.stages.map(row => {const local=guide.sections?.find(section => section.value === row.id), details=pveDifficultyDetails(local?.difficultyDetails); return <tr key={row.id} data-seven-table-stage={row.id} className={row.id === current.id ? "is-current" : ""}><th scope="row"><button type="button" onClick={() => choose({view:row.id})}>{row.label}</button><small>{row.bonusDay}</small></th><td>{row.fruit}</td>{difficulties.map(mode => <td key={mode.value} data-seven-reward={mode.value}>{details[mode.value].rewards ? <ReadingMarkdown editHeadings={false} markdown={details[mode.value].rewards} context={context} /> : <>{row.amounts[mode.value]} 颗<small>历史参考</small></>}</td>)}<td>{difficulties.map(mode => <div className="pv72-table-difficulty-boss" key={mode.value}><strong>{mode.label}</strong><ReadingMarkdown editHeadings={false} markdown={details[mode.value].bosses || "本档待核对"} context={context} /></div>)}</td></tr>;})}</tbody></table></div></details>
    <div className="pv72-seven-evidence"><CircleHelp size={17} /><div><p>七曜分区与难度已经独立记录，可逐曜补充对手、奖励与条件。这里未导入你的游戏进度。</p><p>基础数量参照历史资料；秘赐的额外果实与概率遗忘果实规则参照 2025 年官方说明。以下链接保留原始出处。</p><div>{seven.sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink size={11} /></a>)}</div></div></div>
  </div>;
}
