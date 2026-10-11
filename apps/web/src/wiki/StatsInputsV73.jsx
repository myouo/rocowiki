import React from "react";
import { Shield, Sparkles, Swords } from "lucide-react";
import CustomSelect from "./Select";
import { CALCULATOR_MAPPING_SOURCE, EQUIPMENT, EQUIPMENT_SLOTS, STAT_KEYS, STAT_NAMES, guardianForLevel, statsEquipmentDetails } from "./rocoCalculations";

export function StatsNumberField({ label, value, onChange, min = 0, max, hint, ariaLabel }) {
  return <label className="rw-stats-field-v73"><span>{label}</span><input type="number" inputMode="numeric" min={min} max={max} step="1" value={value} aria-label={ariaLabel || label} onChange={(event) => onChange(event.target.value)} />{hint && <small>{hint}</small>}</label>;
}

export function GuardianLevelField({ form, update, prefix = "" }) {
  const guardian = guardianForLevel(form.guardianLevel);
  return <div className="rw-guardian-field-v73">
    <StatsNumberField label="守护兽等级" ariaLabel={prefix + "守护兽等级"} value={form.guardianLevel} min={0} max={40} onChange={(value) => update({ guardianLevel: value, guardianLegacyRange: "" })} />
    <small aria-live="polite">{guardian.valid ? guardian.disabled ? "0 · 不计守护兽" : `五项 +${guardian.bonus[0]} · 速度 +0` : guardian.error}</small>
  </div>;
}

export function GuardianMappingNote({ legacyRange = "" }) {
  return <div className="rw-guardian-note-v73">
    <span>输入等级，按已收录映射取值；加成计入战斗基础能力，面板另列。</span>
    <a href={CALCULATOR_MAPPING_SOURCE.url} target="_blank" rel="noreferrer">等级映射来源 · 2026.10.10 核对</a>
    {legacyRange && <strong role="status">旧记录只有 {legacyRange} 级的阶段信息，已按区间起点代入相同加成；请确认实际等级。</strong>}
  </div>;
}

const ICONS = { accessory: Sparkles, weapon: Swords, armor: Shield };
const SECONDARY_NAMES = { accuracy: "命中", evasion: "闪避", critical: "暴击", criticalResistance: "抗暴" };

export function StatsEquipmentFields({ form, update, prefix = "" }) {
  const details = statsEquipmentDetails(form);
  return <div className="rw-stats-equipment-v73">{EQUIPMENT_SLOTS.map(([slot, label, indices]) => {
    const Icon = ICONS[slot], selected = details.find((entry) => entry.slot === slot);
    return <section className={"rw-equipment-slot-v73 slot-" + slot} key={slot} aria-label={label + "设置"}>
      <div className="rw-equipment-heading-v73"><Icon size={17} /><strong>{label}</strong><span>{selected?.valid && selected.bonus > 0 ? `${STAT_NAMES[selected.stat]} +${selected.bonus}` : "未加成"}</span></div>
      <CustomSelect ariaLabel={prefix + label} value={form[slot]} onChange={(value) => update({ [slot]: value })} options={EQUIPMENT[slot]} />
      {form[slot] === "custom" ? <div className="rw-equipment-manual-v73">
        {slot !== "accessory" && <div className="rw-stats-field-v73"><span>加成能力</span><CustomSelect ariaLabel={prefix + label + "加成能力"} value={form[slot + "Stat"]} onChange={(value) => update({ [slot + "Stat"]: value })} options={indices.map((index) => ({ value: STAT_KEYS[index], label: STAT_NAMES[index] }))} /></div>}
        <StatsNumberField label={slot === "accessory" ? "精力加成" : "面板加成"} ariaLabel={prefix + label + "面板加成"} value={form[slot + "Bonus"]} min={0} max={9999} onChange={(value) => update({ [slot + "Bonus"]: value })} />
        <small>按游戏装备面板填写。请确认穿戴条件；这里不模拟专属技能效果。</small>
      </div> : selected?.secondary ? <details className="rw-equipment-secondary-v73"><summary>100 级史诗 · 查看附加属性</summary><p>{Object.entries(selected.secondary).map(([key, value]) => SECONDARY_NAMES[key] + " +" + value).join(" / ")}，其中一项；不计入六维。</p></details> : <small className="rw-equipment-empty-v73">只计算当前选择的这一槽位。</small>}
    </section>;
  })}</div>;
}
