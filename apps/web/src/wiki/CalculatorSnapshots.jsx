import React, { useEffect, useId, useState } from "react";
import { BookmarkPlus, Check, GitCompareArrows, History, RotateCcw, Trash2 } from "lucide-react";
import { Link } from "./core";
import { CALCULATOR_DATA_VERSION, RELATIONSHIPS } from "./rocoCalculations";
import { CALCULATION_SNAPSHOT_KEY, compareCalculationSnapshots, deleteCalculationSnapshot, readCalculationSnapshots, saveCalculationSnapshot } from "./calculatorSnapshotStore";
import { fullStatsToolHref } from "./statsProfiles";

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function CalculatorSnapshots({ form, result, pet, onRestore }) {
  const uid = useId(), [state, setState] = useState({ ok: true, records: [] }), [ready, setReady] = useState(false);
  const [label, setLabel] = useState(""), [message, setMessage] = useState(""), [scope, setScope] = useState("pet"), [selected, setSelected] = useState([]), [open, setOpen] = useState(false);
  useEffect(() => {
    const refresh = () => { const value = readCalculationSnapshots(); setState(value); setReady(true); setSelected((ids) => ids.filter((id) => value.records.some((row) => row.id === id))); };
    const onStorage = (event) => { if (!event.key || event.key === CALCULATION_SNAPSHOT_KEY) refresh(); };
    refresh(); window.addEventListener("storage", onStorage); window.addEventListener("roco:stats-snapshots-updated", refresh);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("roco:stats-snapshots-updated", refresh); };
  }, []);
  const currentSlug = pet?.slug || form.pet;
  useEffect(() => { setSelected([]); setScope("pet"); setMessage(""); setLabel(""); }, [currentSlug]);
  const records = state.records.filter((row) => scope === "all" || row.pet.slug === currentSlug);
  const pair = selected.map((id) => state.records.find((row) => row.id === id)).filter(Boolean);
  const comparison = pair.length === 2 ? compareCalculationSnapshots(pair[0], pair[1]) : null;
  function save() {
    const saved = saveCalculationSnapshot({ form, pet, label });
    setMessage(saved.message);
    if (saved.ok) {
      setState({ ok: true, records: saved.records }); setLabel(""); setOpen(true);
      setSelected((ids) => ids.length < 2 ? [...ids, saved.record.id] : ids);
    }
  }
  function select(id) {
    if (selected.includes(id)) { setSelected((ids) => ids.filter((item) => item !== id)); return; }
    if (selected.length === 2) { setMessage("已选择两条记录。取消其中一条后，再加入新的记录。"); return; }
    setSelected((ids) => [...ids, id]); setMessage("");
  }
  function remove(id) {
    const removed = deleteCalculationSnapshot(id); setMessage(removed.message);
    if (removed.ok) { setState({ ok: true, records: removed.records }); setSelected((ids) => ids.filter((item) => item !== id)); }
  }
  function restore(row) {
    if (row.pet.slug === currentSlug && onRestore) { onRestore(row.form); setMessage(`已载入“${row.label}”的参数并按当前资料重算，原记录保留。`); }
  }
  return <section className="rw-calculation-records-v73" aria-labelledby={uid + "-title"} data-no-editor>
    <div className="rw-calculation-save-v73">
      <div><h3 id={uid + "-title"}><History size={17} />计算记录</h3><p>记下当前性格与培养配置，选两次计算比较六维变化。</p></div>
      <label><span className="rw-visually-hidden">计算记录名称</span><input aria-label="计算记录名称" value={label} maxLength={60} placeholder="给本次计算起个名字（可选）" onChange={(event) => setLabel(event.target.value)} /></label>
      <button type="button" className="rw-button primary" disabled={!ready || !state.ok || !result.valid} onClick={save}><BookmarkPlus size={16} />保存本次计算</button>
    </div>
    {(!state.ok || message) && <p className="rw-calculation-status-v73" role="status">{!state.ok ? state.message : message}</p>}
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>查看本机记录 <span>{state.records.length} 条{selected.length > 0 ? ` · 已选 ${selected.length} / 2` : ""}</span></summary>
      <div className="rw-calculation-history-v73">
        <div className="rw-calculation-history-toolbar-v73"><div aria-label="计算记录范围"><button type="button" aria-pressed={scope === "pet"} onClick={() => setScope("pet")}>当前宠物</button><button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")}>全部记录</button></div>{selected.length > 0 && <button type="button" onClick={() => setSelected([])}>清空对比选择</button>}</div>
        {!records.length ? <p className="rw-calculation-empty-v73">{scope === "pet" ? "这只宠物还没有计算记录。保存两套配置后，就能直接比较。" : "还没有计算记录。"}</p> : <div className="rw-calculation-record-list-v73">{records.map((row) => {
          const index = selected.indexOf(row.id), samePet = row.pet.slug === currentSlug;
          return <article key={row.id} className={index >= 0 ? "is-selected" : ""}>
            <button type="button" className="rw-record-select-v73" aria-label={"选择对比：" + row.label} aria-pressed={index >= 0} onClick={() => select(row.id)}><span>{index >= 0 ? String.fromCharCode(65 + index) : <Check size={14} />}</span><strong>{row.label}</strong></button>
            <p>{row.pet.name} · {row.form.nature} · Lv. {row.form.level}</p><small>守护兽 {row.form.guardianLevel === "0" ? "不计" : "Lv. " + row.form.guardianLevel} · {formatTime(row.savedAt)}{row.dataVersion !== CALCULATOR_DATA_VERSION ? " · 历史映射，载入将重算" : ""}</small>
            <div className="rw-record-actions-v73">{samePet && onRestore ? <button type="button" onClick={() => restore(row)}><RotateCcw size={13} />载入参数</button> : <Link to={fullStatsToolHref(row.form)}>到完整工具载入</Link>}<button type="button" aria-label={"删除记录：" + row.label} onClick={() => remove(row.id)}><Trash2 size={13} />删除</button></div>
          </article>;
        })}</div>}
        {comparison && <section className="rw-calculation-compare-v73" aria-label="两次能力计算对比">
          <h4><GitCompareArrows size={17} />A → B · 六维变化</h4><p><strong>A</strong> {pair[0].label}　<strong>B</strong> {pair[1].label}</p>
          <p className="rw-comparison-context-v73">{comparison.samePet ? "同一宠物的两套配置。" : "不同宠物或手动种族，差异包含种族变化。"}{!comparison.sameVersion ? " 两条记录使用不同资料版本，以下保留各自保存时的结果。" : " 数字为保存当时的战斗基础能力，增加不代表配置一定更合适。"}</p>
          <div className="rw-calculation-table-scroll-v73" tabIndex={0} role="region" aria-label="六项能力对比表"><table><thead><tr><th>能力</th><th>A</th><th>B</th><th>变化</th></tr></thead><tbody>{comparison.rows.map((row) => <tr key={row.key}><th>{row.name}</th><td>{row.a}<small>面板 {row.panelA}</small></td><td>{row.b}<small>面板 {row.panelB}</small></td><td className={row.delta > 0 ? "is-up" : row.delta < 0 ? "is-down" : ""}>{row.delta > 0 ? "+" : ""}{row.delta}</td></tr>)}</tbody></table></div>
          <details><summary>查看性格、培养与装备差异</summary><div className="rw-calculation-table-scroll-v73" tabIndex={0} role="region" aria-label="培养参数对比表"><table><thead><tr><th>参数</th><th>A</th><th>B</th></tr></thead><tbody>{comparison.parameters.map((row) => <tr key={row.label} className={row.changed ? "is-changed" : ""}><th>{row.label}</th><td>{row.label === "亲密关系" ? RELATIONSHIPS.find((item) => item.value === row.before)?.label || row.before : row.before}</td><td>{row.label === "亲密关系" ? RELATIONSHIPS.find((item) => item.value === row.after)?.label || row.after : row.after}</td></tr>)}</tbody></table></div></details>
        </section>}
        {selected.length === 1 && <p className="rw-calculation-empty-v73">已选择 A。再选一条记录作为 B；可以切到全部记录跨宠物比较。</p>}
        <small className="rw-calculation-local-note-v73">记录仅保存在当前浏览器。保存时同时记录参数、结果和资料版本；最多保留 40 条，满后由你选择删除。当前映射：{CALCULATOR_DATA_VERSION}。</small>
      </div>
    </details>
  </section>;
}
