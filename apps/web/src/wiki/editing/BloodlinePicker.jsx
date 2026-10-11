import React from "react";
import { Check, Dna } from "lucide-react";
import Select from "../Select";
import { getPetBloodlineOptions } from "../catalogBloodlines";
import { normalizeMatchupBloodline } from "../matchupBloodlines";

export default function BloodlinePicker({ value, onChange, petIdentity, label, submissions = [], error }) {
  const row = normalizeMatchupBloodline(value), { options, pet } = getPetBloodlineOptions(petIdentity, { submissions });
  const unrecorded = row.names.filter((name) => !options.some((option) => option.value === name));
  const choices = [...options, ...unrecorded.map((name) => ({ value: name, label: name, unrecorded: true }))];
  function toggle(name) { onChange({ ...row, names: row.names.includes(name) ? row.names.filter((old) => old !== name) : [...row.names, name] }); }
  return <fieldset className="ev71-bloodline-field"><legend><Dna size={14} />{label}</legend><Select ariaLabel={label} value={row.status} onChange={(status) => onChange({ ...row, status })} options={[{ value: "unknown", label: "尚未记录／来源未说明" }, { value: "none", label: "确认未携带血脉" }, { value: "specified", label: "选择本场使用的血脉" }, { value: "any", label: "任意血脉均适用" }]} />
    {row.status === "specified" && <><div className="ev72-bloodline-options" role="group" aria-label={`${label}可选血脉`}>{choices.map((option) => <button key={option.value} type="button" role="checkbox" aria-checked={row.names.includes(option.value)} className={`ev72-bloodline-choice${option.unrecorded ? " is-unrecorded" : ""}`} onClick={() => toggle(option.value)}><span className="ev72-check-shape"><Check size={11} /></span>{option.label}{option.unrecorded && <small>资料未列出</small>}</button>)}</div>{!options.length && <p className="ev72-bloodline-empty">{pet ? "这只宠物的血脉列表尚未收录。请先补充宠物资料，或保留“尚未记录”。" : "填写已收录的宠物名称后，这里会读取它的血脉列表。"}</p>}{unrecorded.length > 0 && <p className="ev72-bloodline-empty">旧记录中的未匹配名称已保留。请先核对宠物的血脉资料，再选择本场配置。</p>}</>}
    {row.status === "any" && <p className="ev72-bloodline-any-note">表示无论这只宠物携带哪一种血脉，当前结论都成立。仍需在成立条件、限制和来源中说明适用范围。</p>}
    {error && <p className="ev7-error" role="alert">{error}</p>}<label className="ev71-branch-field"><span>{label}备注</span><input aria-label={`${label}备注`} value={row.note} onChange={(event) => onChange({ ...row, note: event.target.value })} /><small>可注明等级、是否生效和来源位置。</small></label>
  </fieldset>;
}
