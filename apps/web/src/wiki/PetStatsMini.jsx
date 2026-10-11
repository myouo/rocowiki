import React, { useEffect, useState } from "react";
import { Calculator, ArrowUpRight, RotateCcw } from "lucide-react";
import { Link } from "./core";
import CustomSelect from "./Select";
import { STAT_NAMES, NATURES, RELATIONSHIPS, calculateStats } from "./rocoCalculations";
import { statsDefaultsForPet, fullStatsToolHref } from "./statsProfiles";
import { GuardianLevelField, GuardianMappingNote, StatsEquipmentFields } from "./StatsInputsV73";
import CalculatorSnapshots from "./CalculatorSnapshots";
import "./CalculatorsV73.css";

export const petStatsDefaults = statsDefaultsForPet;
export { fullStatsToolHref };

function MiniSelect({ label, value, onChange, options, searchable = false }) {
  return <div className="rw-pet-mini-field"><span>{label}</span><CustomSelect ariaLabel={"简易能力 · " + label} value={value} onChange={onChange} options={options} searchable={searchable} /></div>;
}

export default function PetStatsMini({ pet }) {
  return <PetStatsMiniBody key={pet.slug} pet={pet} />;
}

function PetStatsMiniBody({ pet }) {
  const [form, setForm] = useState(() => petStatsDefaults(pet));
  const speciesKey = JSON.stringify(pet.stats);
  useEffect(() => { setForm((previous) => { const current = petStatsDefaults(pet); return { ...previous, pet: current.pet, petName: current.petName, petHref: current.petHref, base: current.base }; }); }, [pet.slug, pet.name, speciesKey]);
  const result = calculateStats(form);
  const speciesKnown = pet.stats?.length === 6 && pet.stats.every((value) => Number.isFinite(value) && value > 0);
  const historicalSpecies = speciesKnown && form.base.some((value, index) => Number(value) !== pet.stats[index]);
  const update = (change) => setForm((previous) => ({ ...previous, ...change }));
  const setArray = (key, index, value) => setForm((previous) => ({ ...previous, [key]: previous[key].map((old, i) => i === index ? value : old) }));
  const setRelationship = (value) => update({ relationship: value, intimacy: value === "none" ? Array(6).fill("0") : form.intimacy.reduce((sum, item) => sum + Number(item || 0), 0) === 50 ? form.intimacy : ["20", "0", "10", "0", "20", "0"] });
  return <section className="rw-pet-stats-mini-v72 rw-pet-stats-mini-v73" id="ability" aria-labelledby={"pet-ability-" + pet.slug} data-no-editor>
    <div className="rw-pet-mini-heading">
      <div><span><Calculator size={18} /><h2 id={"pet-ability-" + pet.slug}>简易能力计算</h2></span><p>使用{pet.name}的已收录种族值，快速查看培养后的六项能力。</p></div>
      <Link className="rw-textlink" to={fullStatsToolHref(form)}>打开完整工具 <ArrowUpRight size={15} /></Link>
    </div>
    {!speciesKnown ? <p className="rw-pet-mini-unknown" role="status">种族值尚未完整收录，暂不计算能力。补充基础资料后即可使用；完整工具会保留缺失项，供你手动填写。</p> : <>
      <div className="rw-pet-mini-controls">
        <label className="rw-pet-mini-field"><span>等级</span><input aria-label="简易能力 · 等级" type="number" inputMode="numeric" min="1" max="100" value={form.level} onChange={(event) => update({ level: event.target.value })} /></label>
        <MiniSelect label="性格" value={form.nature} onChange={(value) => update({ nature: value })} options={NATURES} searchable />
        <GuardianLevelField form={form} update={update} prefix="简易能力 · " />
      </div>
      <GuardianMappingNote legacyRange={form.guardianLegacyRange} />
      {historicalSpecies && <div className="rw-mini-historical-v73" role="status"><span>当前使用计算记录保存时的种族值，与最新图鉴不同。</span><button type="button" onClick={() => update({ base: petStatsDefaults(pet).base })}>使用图鉴种族</button></div>}
      <div className="rw-pet-mini-result" aria-live="polite" aria-atomic="true">
        {result.valid ? result.rows.map((row) => <div key={row.key} className={"stat-" + row.key}><span>{row.name}</span><strong>{row.battle}</strong><small>面板 {row.panel}{row.guardian ? " + 守护 " + row.guardian : ""}{row.equipment > 0 ? " · 含装备 +" + row.equipment : ""}</small></div>) : <div className="rw-pet-mini-errors" role="status"><strong>请先调整培养参数</strong><ul>{result.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      </div>
      <details className="rw-pet-mini-details" open>
        <summary>天赋与努力分配 <small>努力 {result.effortTotal} / 510</small></summary>
        <div className="rw-pet-mini-details-body">
          <div className="rw-mini-quick-actions-v73"><button type="button" onClick={() => update({ talent: Array(6).fill("31") })}>天赋全 31</button><button type="button" onClick={() => update({ effort: Array(6).fill("0") })}>努力清零</button><button type="button" onClick={() => setForm(petStatsDefaults(pet))}><RotateCcw size={13} />重置培养</button></div>
          <div className="rw-pet-mini-cultivation">
            {STAT_NAMES.map((name, i) => <fieldset key={name}><legend>{name}</legend>
              <label><span>天赋</span><input type="number" inputMode="numeric" min="0" max="31" aria-label={name + "天赋"} value={form.talent[i]} onChange={(event) => setArray("talent", i, event.target.value)} /></label>
              <label><span>努力</span><input type="number" inputMode="numeric" min="0" max="255" aria-label={name + "努力值"} value={form.effort[i]} onChange={(event) => setArray("effort", i, event.target.value)} /></label>
            </fieldset>)}
          </div>
        </div>
      </details>
      <details className="rw-pet-mini-details rw-mini-extras-v73">
        <summary>装备与亲密关系 <small>{[form.accessory, form.weapon, form.armor].filter((item) => item !== "none").length} 件装备 · {form.relationship === "none" ? "未培养亲密" : "已培养亲密"}</small></summary>
        <div className="rw-pet-mini-details-body">
          <div className="rw-pet-mini-additions">
            <MiniSelect label="亲密关系" value={form.relationship} onChange={setRelationship} options={RELATIONSHIPS} />
          </div>
          {form.relationship !== "none" && <div className="rw-pet-mini-intimacy">
            {STAT_NAMES.slice(0, 5).map((name, i) => <MiniSelect key={name} label={name + "亲密分配"} value={form.intimacy[i]} onChange={(value) => setArray("intimacy", i, value)} options={[0, 10, 20].map((value) => ({ value: String(value), label: String(value) }))} />)}
            <p>亲密分配 {result.intimacyTotal} / 50；关系额外加成另计，速度不参与。</p>
          </div>}
          <StatsEquipmentFields form={form} update={update} prefix="简易能力 · " />
        </div>
      </details>
      <CalculatorSnapshots form={form} result={result} pet={pet} onRestore={(saved) => setForm({ ...petStatsDefaults(pet), ...saved, pet: pet.slug })} />
      <p className="rw-pet-mini-note">初始参数：100级、天赋全31、努力0、平衡性格，无亲密与装备加成。计算口径与完整工具一致；战斗强化、血脉和临时效果另查。</p>
    </>}
  </section>;
}
