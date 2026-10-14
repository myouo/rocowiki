import React from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CircleHelp,
  GitBranch,
  Plus,
  Trash2,
} from "lucide-react";
import Select from "../Select";
import EntityTextarea from "../EntityTextarea";
import { eventData } from "../content/bundled.js";
import SkillBranchEditor, { EffectStepsEditor } from "./SkillBranchEditor";
import SkillTermsEditor from "./SkillTermsEditor";
import BloodlinePicker from "./BloodlinePicker";
import { PveGuideFields } from "../PveGuideEditor";
import { SkillLearnerFields } from "../SkillLearners";
import { normalizeMatchupBloodline } from "../matchupBloodlines";
import {
  blankAcquisition,
  blankMatchup,
  blankOccurrence,
  fieldLabel,
} from "./model";

function Field({
  label,
  name,
  value,
  change,
  error,
  kind = "text",
  rows = 3,
  help,
  required = false,
  step,
  options,
}) {
  const caption = label || fieldLabel(name.split(".").at(-1));
  return (
    <div className={`ev7-field ${kind === "textarea" ? "ev7-field-wide" : ""}`}>
      <label>
        <span>
          {caption}
          {required && <em>必填</em>}
        </span>
        {options ? (
          <Select
            value={String(value ?? "")}
            onChange={change}
            options={options}
            ariaLabel={caption}
          />
        ) : kind === "textarea" ? (
          <EntityTextarea
            value={String(value ?? "")}
            onChange={change}
            rows={rows}
            ariaLabel={caption}
            maxLength={12000}
            aria-invalid={!!error}
          />
        ) : (
          <input
            aria-label={caption}
            aria-invalid={!!error}
            value={value ?? ""}
            onChange={(event) => change(event.target.value)}
            type={kind}
            step={step}
            inputMode={kind === "number" ? "numeric" : undefined}
            maxLength={kind === "number" || kind === "date" ? undefined : 2000}
          />
        )}
      </label>
      {help && <small>{help}</small>}
      {error && (
        <small className="ev7-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

function Repeater({
  title,
  name,
  rows,
  change,
  makeBlank,
  render,
  addLabel = "添加一条",
  icon: Icon = CalendarDays,
  highlightedId = "",
  single = false,
}) {
  function move(index, step) {
    const next = [...rows];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    change(next);
  }
  return (
    <section className="ev7-repeater" aria-label={title}>
      <div className="ev7-repeater-title">
        <Icon size={18} />
        <h3>{title}</h3>
        <span>{rows.length} 条</span>
      </div>
      {!rows.length && (
        <p className="ev7-empty">
          这一节还没有记录。点击下方按钮，填写第一条。
        </p>
      )}
      {rows.map((row, index) => (
        <fieldset
          key={row.id || `${name}-${index}`}
          className={`ev7-record ${highlightedId && row.id === highlightedId ? "ev7-record-selected" : ""}`}
        >
          <legend>
            {index + 1}.{" "}
            {row.label || row.title || row.opponent || row.name || "新记录"}
          </legend>
          <div className="ev7-record-tools">
            <button
              type="button"
              disabled={index === 0}
              aria-label={`上移第 ${index + 1} 条`}
              onClick={() => move(index, -1)}
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              disabled={index === rows.length - 1}
              aria-label={`下移第 ${index + 1} 条`}
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              aria-label={`移除第 ${index + 1} 条${title}`}
              onClick={() => change(rows.filter((_, i) => i !== index))}
            >
              <Trash2 size={14} />
              <span>移除</span>
            </button>
          </div>
          {render(row, index, (key, value) =>
            change(
              rows.map((item, i) =>
                i === index ? { ...item, [key]: value } : item,
              ),
            ),
          )}
        </fieldset>
      ))}
      {!single && <button
        type="button"
        className="cm-button ev7-add-record"
        onClick={() =>
          change([
            ...rows,
            {
              ...makeBlank(),
              id: `draft-${Date.now().toString(36)}-${rows.length}`,
            },
          ])
        }
      >
        <Plus size={15} />
        {addLabel}
      </button>}
    </section>
  );
}

export default function TypedFields({
  mode,
  data,
  onChange,
  errors = {},
  record = "",
  intent = "edit",
  entity = "当前宠物",
  submissions = [],
  context = {},
}) {
  const change = (key, value) => onChange({ ...data, [key]: value });
  const field = (key, options = {}) => (
    <Field
      key={key}
      name={key}
      value={data[key]}
      change={(value) => change(key, value)}
      error={errors[key]}
      {...options}
    />
  );
  const rowField = (row, i, update, group, key, options = {}) => (
    <Field
      key={key}
      name={`${group}.${i}.${key}`}
      value={row[key]}
      change={(value) => update(key, value)}
      error={errors[`${group}.${i}.${key}`]}
      {...options}
    />
  );
  if (mode === "article")
    return (
      <>
        {field("markdown", {
          label: "本节正文",
          kind: "textarea",
          rows: 18,
          required: true,
          help: "输入 / 快速关联宠物、技能、环境和其他条目。支持标题、列表、引用与链接。",
        })}
      </>
    );
  if (mode === "acquisition")
    return (
      <>
        <div className="ev7-tip">
          <CalendarDays size={17} />
          <p>
            一次获取机会对应一条记录。返场时可关联同一活动的新批次；不会覆盖旧活动日期。
          </p>
        </div>
        <Repeater
          title="获取记录"
          name="records"
          rows={data.records || []}
          change={(value) => change("records", value)}
          makeBlank={blankAcquisition}
          addLabel="再补充一次获取机会"
          render={(row, i, update) => {
            const selected = eventData.activities?.find(
              (activity) => activity.id === row.activityId,
            );
            return (
              <>
                <div className="ev7-field-grid">
                  <Field
                    name={`records.${i}.activityId`}
                    label="关联已有活动"
                    value={row.activityId || ""}
                    options={[
                      { value: "", label: "未关联 · 手动补录历史活动" },
                      ...(eventData.activities || []).map((activity) => ({
                        value: activity.id,
                        label: activity.name,
                      })),
                    ]}
                    change={(value) => {
                      const activity = eventData.activities?.find(
                        (a) => a.id === value,
                      );
                      onChange({
                        ...data,
                        records: data.records.map((r, n) =>
                          n === i
                            ? {
                                ...r,
                                activityId: value,
                                occurrenceId: "",
                                title: activity?.name || r.title,
                              }
                            : r,
                        ),
                      });
                    }}
                  />
                  {selected && (
                    <Field
                      name={`records.${i}.occurrenceId`}
                      label="对应开放批次"
                      value={row.occurrenceId || ""}
                      options={[
                        { value: "", label: "另行补充开放记录" },
                        ...selected.occurrences.map((occ) => ({
                          value: occ.id,
                          label: `${occ.label || selected.name} · ${occ.startDate || "日期待补"}`,
                        })),
                      ]}
                      change={(value) => {
                        const occ = selected.occurrences.find(
                          (o) => o.id === value,
                        );
                        onChange({
                          ...data,
                          records: data.records.map((r, n) =>
                            n === i
                              ? {
                                  ...r,
                                  occurrenceId: value,
                                  ...(occ
                                    ? {
                                        startDate: occ.startDate || "",
                                        endDate: occ.endDate || "",
                                        place: occ.location || "",
                                        conditions:
                                          typeof occ.conditions === "string"
                                            ? occ.conditions
                                            : (occ.conditions || []).join("\n"),
                                        sourceUrl: occ.sourceUrl || r.sourceUrl,
                                        sourceLabel:
                                          occ.sourceTitle || r.sourceLabel,
                                      }
                                    : {}),
                                }
                              : r,
                          ),
                        });
                      }}
                    />
                  )}
                  {rowField(row, i, update, "records", "title", {
                    label: "活动／获取记录名称",
                    required: true,
                  })}
                  {rowField(row, i, update, "records", "kind", {
                    label: "获取形式",
                    options: [
                      "限时活动",
                      "限时返场",
                      "系统开放记录",
                      "兑换",
                      "进化资格",
                      "其他",
                    ].map((value) => ({ value, label: value })),
                  })}
                  {rowField(row, i, update, "records", "startDate", {
                    kind: "date",
                    required: true,
                  })}
                  {rowField(row, i, update, "records", "endDate", {
                    kind: "date",
                    help: "确实未知时留空；空白不代表永久开放。",
                  })}
                  {rowField(row, i, update, "records", "place", {
                    label: "地点／进入路径",
                    required: true,
                  })}
                  {rowField(row, i, update, "records", "reward", {
                    label: "完成后获得什么",
                    required: true,
                    help: "区分宠物本体、进化资格和兑换材料。",
                  })}
                </div>
                {rowField(row, i, update, "records", "conditions", {
                  label: "参与条件与消耗",
                  kind: "textarea",
                  required: true,
                })}
                {rowField(row, i, update, "records", "method", {
                  label: "完成方式",
                  kind: "textarea",
                })}
                <div className="ev7-field-grid">
                  {rowField(row, i, update, "records", "sourceLabel", {
                    label: "该次记录的来源名称",
                  })}
                  {rowField(row, i, update, "records", "sourceUrl", {
                    label: "该次记录的来源链接",
                    kind: "url",
                    required: true,
                  })}
                </div>
              </>
            );
          }}
        />
        {errors.records && (
          <p className="ev7-error" role="alert">
            {errors.records}
          </p>
        )}
      </>
    );
  if (mode === "event")
    return (
      <>
        <div className="ev7-field-grid">
          {field("name", { label: "活动名称", required: true })}
          {field("id", {
            label: "活动标识",
            help: "同一活动历次返场共用这个标识；新活动可留空由发布流程分配。",
          })}
        </div>
        {field("summary", { label: "活动简介", kind: "textarea" })}
        <Repeater
          title="历次开放批次"
          name="occurrences"
          rows={data.occurrences || []}
          change={(value) => change("occurrences", value)}
          makeBlank={blankOccurrence}
          addLabel="新增一次开放／返场"
          highlightedId={record}
          render={(row, i, update) => (
            <>
              <div className="ev7-field-grid">
                {rowField(row, i, update, "occurrences", "label", {
                  label: "本次开放名称",
                  required: true,
                  help: "例如活动当次公告所用名称，不必与往年完全相同。",
                })}
                {rowField(row, i, update, "occurrences", "location", {
                  label: "本次地点／入口",
                  required: true,
                })}
                {rowField(row, i, update, "occurrences", "startDate", {
                  kind: "date",
                  required: true,
                })}
                {rowField(row, i, update, "occurrences", "endDate", {
                  kind: "date",
                  help: "日期未知可留空，不能因此认定为常驻。",
                })}
              </div>
              {rowField(row, i, update, "occurrences", "conditions", {
                label: "本次参与条件",
                kind: "textarea",
                required: true,
              })}
              {rowField(row, i, update, "occurrences", "rewards", {
                label: "本次奖励",
                kind: "textarea",
                required: true,
              })}
              <div className="ev7-field-grid">
                {rowField(row, i, update, "occurrences", "sourceTitle", {
                  label: "本次公告名称",
                })}
                {rowField(row, i, update, "occurrences", "sourceUrl", {
                  label: "本次公告／来源链接",
                  kind: "url",
                  required: true,
                })}
              </div>
            </>
          )}
        />
        {errors.occurrences && (
          <p className="ev7-error">{errors.occurrences}</p>
        )}
      </>
    );
  if (mode === "skill" && record === "learners") return <SkillLearnerFields data={data} onChange={onChange} errors={errors} submissions={submissions} />;
  if (mode === "skill" && record === "base")
    return (
      <>
        <h3 className="ev7-subtitle">基础效果</h3>
        <p className="ev7-muted">
          正在修改「{data.name}」的基础效果，其他技能字段保持原有内容。
        </p>
        <EffectStepsEditor label="基础效果" value={data.common} onChange={(value) => change("common", value)} error={errors.common} />
        {field("sourceUrl", { label: "技能资料来源", kind: "url" })}
      </>
    );
  if (mode === "skill" && /^branch-\d+$/.test(record)) return <><SkillBranchEditor branches={data.phases || []} onChange={(value) => change("phases", value)} errors={errors} record={record} flowData={data} />{field("sourceUrl", { label: "技能资料来源", kind: "url" })}</>;
  if (mode === "skill")
    return (
      <>
        <h3 className="ev7-subtitle">技能基本信息</h3>
        <div className="ev7-field-grid ev7-field-grid-three">
          {field("name", { label: "技能名称", required: true })}
          {field("number", { label: "技能编号", kind: "number", help: "只填已核实的游戏编号；尚未收录时留空。" })}
          {field("type", { label: "技能属性" })}
          {field("category", {
            label: "技能类型",
            options: ["物理", "魔法", "变化"].map((value) => ({
              value,
              label: value,
            })),
          })}
          {field("power", {
            label: "基础威力",
            kind: "number",
            help: "变化技能或未知时留空。",
          })}
          {field("pp", { label: "初始 PP", kind: "number" })}
          {field("priority", { label: "技能先手", kind: "number" })}
        </div>
        {field("summary", {
          label: "技能描述",
          kind: "textarea",
          required: true,
        })}
        <h3 className="ev7-subtitle">基础效果组件</h3>
        <EffectStepsEditor label="基础效果" value={data.common} onChange={(value) => change("common", value)} error={errors.common} />
        {field("hit", {
          label: "命中说明",
          help: "区分固定命中规则和需要条件的必中分支。",
        })}
        <SkillTermsEditor terms={data.terms || []} onChange={(value) => change("terms", value)} errors={errors} />
        <SkillBranchEditor branches={data.phases || []} onChange={(value) => change("phases", value)} errors={errors} flowData={data} />
        {field("sourceUrl", { label: "技能资料来源", kind: "url" })}
      </>
    );
  if (mode === "matchup")
    return (
      <>
        <div className="ev7-tip">
          <CircleHelp size={17} />
          <p>
            场景一律以当前宠物为视角。投票表示对这条结论的支持态度；编辑内容时不能手工修改票数或胜率。
          </p>
        </div>
        <Repeater
          title="PVP 对位"
          name="records"
          icon={GitBranch}
          rows={data.records || []}
          change={(value) => change("records", value)}
          makeBlank={blankMatchup}
          addLabel="添加一个对位场景"
          render={(row, i, update) => (
            <>
              <div className="ev7-field-grid">
                {rowField(row, i, update, "records", "opponent", {
                  label: "对手宠物／形态",
                  required: true,
                })}
                {rowField(row, i, update, "records", "scene", {
                  label: "当前宠物的上场情境",
                  required: true,
                  options: [
                    { value: "", label: "请选择上场情境" },
                    { value: "unspecified", label: "尚待核实 · 来源未说明" },
                    { value: "lead-together", label: "同起 · 双方同时上场" },
                    { value: "switch-in", label: "后上拦截 · 当前宠物后上" },
                    { value: "already-active", label: "先在场 · 对手后上" },
                  ],
                })}
              </div>
              <div className="ev71-bloodline-fields">{[["myBloodline", entity], ["opponentBloodline", row.opponent || "对手"]].map(([key, petIdentity]) => <BloodlinePicker key={key} value={row[key]} label={`${petIdentity} · 本场血脉`} petIdentity={petIdentity} onChange={(value) => update(key, value)} submissions={submissions} error={errors[`records.${i}.${key}`]} />)}</div>
              {rowField(row, i, update, "records", "conclusion", {
                label: "这个场景下的对位结论",
                kind: "textarea",
                required: true,
              })}
              {rowField(row, i, update, "records", "conditions", {
                label: "优势成立的条件",
                kind: "textarea",
                required: true,
                help: "写明血脉、配招、速度、精力、环境和关键状态，逐项说明。",
              })}
              {rowField(row, i, update, "records", "limitations", {
                label: "何时不成立／尚未验证的范围",
                kind: "textarea",
                required: true,
              })}
              <div className="ev7-field-grid">
                {rowField(row, i, update, "records", "recordedAt", {
                  label: "资料所属日期",
                  kind: "date",
                })}
                {rowField(row, i, update, "records", "testedAt", {
                  label: "实测日期",
                  kind: "date",
                })}
                {rowField(row, i, update, "records", "sourceLabel", {
                  label: "录像／分析来源名称",
                })}
                {rowField(row, i, update, "records", "sourceUrl", {
                  label: "录像／分析来源链接",
                  kind: "url",
                  required: true,
                })}
              </div>
            </>
          )}
        />
        {errors.records && <p className="ev7-error">{errors.records}</p>}
      </>
    );
  if (mode === "npc")
    return (
      <>
        <div className="ev7-field-grid">
          {field("name", { label: "人物／NPC 名称", required: true })}
          {field("aliases", { label: "别名与常用称呼" })}
          {field("location", { label: "出现场景／具体位置", required: true })}
          {field("role", { label: "身份与职责", required: true })}
        </div>
        {field("intro", {
          label: "人物介绍",
          kind: "textarea",
          required: true,
        })}
        {field("services", {
          label: "提供的服务",
          kind: "textarea",
          help: "例如商店、兑换、学习、挑战入口；每行一项并保留条件。",
        })}
        {field("relatedTasks", {
          label: "相关任务与剧情",
          kind: "textarea",
          help: "输入 / 关联已有任务；缺少任务条目时可先写清名称。",
        })}
        <div className="ev7-field-grid">
          {field("sourceTitle", { label: "资料来源名称" })}
          {field("sourceUrl", {
            label: "资料来源链接",
            kind: "url",
            required: true,
          })}
          {field("slug", {
            label: "条目路径标识",
            help: "可留空。发布时分配稳定路径，不要求新用户先理解路由。",
          })}
        </div>
      </>
    );
  if (mode === "pet" && intent === "delete") return <section className="ev71-delete-proposal"><h3>提出删除「{data.name}」的建议</h3><p>此提议只针对这一只宠物条目。投稿与审核期间，现有页面和其他条目的关联资料继续保留。</p>{field("deletionReason", { label: "具体删除理由", kind: "textarea", required: true, help: "例如重复条目、编号录入错误，或内容并不对应游戏中的宠物。请说明可核验的依据。" })}{field("redirectTo", { label: "正确或替代条目（可选）", help: "有对应条目时填写站内路径，帮助已有链接找到正确资料。" })}{field("sourceUrl", { label: "支持此提议的来源", kind: "url" })}</section>;
  if (mode === "pet")
    return (
      <>
        <div className="ev7-field-grid ev7-field-grid-three">
          {field("name", { label: "宠物名称", required: true })}
          {field("number", { label: "游戏图鉴编号", kind: "number" })}
          {field("types", { label: "主／副属性" })}
          {field("group", { label: "组别" })}
          {field("series", { label: "系列" })}
          {field("experienceType", { label: "经验类型", kind: "number" })}
          {field("bloodlines", { label: "血脉" })}
          {field("heightM", { label: "身高（米）", kind: "number", step: "any" })}
          {field("weightKg", { label: "体重（千克）", kind: "number", step: "any" })}
          {field("color", { label: "颜色" })}
          {field("catchCategory", { label: "捕捉分类", kind: "number", help: "来源表中的分类编号，不是捕捉概率。" })}
          {field("ladderMagic", {
            label: "天梯费用",
            kind: "number",
            help: "同时在来源说明记录适用赛季或日期。",
          })}
        </div>
        <h3 className="ev7-subtitle">六项种族值</h3>
        <div className="ev7-field-grid ev7-field-grid-three">
          {[
            "hp",
            "attack",
            "defense",
            "magicAttack",
            "magicDefense",
            "speed",
          ].map((key) => field(key, { kind: "number" }))}
        </div>
        {field("sourceUrl", { label: "宠物资料来源", kind: "url" })}
        {intent === "add" && <details className="ev71-advanced-field"><summary>路径标识（可选）</summary>{field("slug", { label: "宠物路径标识", help: "留空即可自动分配。后续更名不会改变已有链接。" })}</details>}
      </>
    );
  if (mode === "pve-guide") return <PveGuideFields data={data} onChange={onChange} context={context} errors={Object.entries(errors).filter(([key]) => key.startsWith("pveGuide")).map(([,value]) => value)} />;
  if (mode === "pve")
    return (
      <>
        <div className="ev7-field-grid">
          {field("title", { label: "攻略标题" })}
          {field("challenge", { label: "副本／关卡／Boss", required: true })}
          {field("version", { label: "适用版本与规则", required: true })}
          {field("testedAt", { label: "实测日期", kind: "date" })}
        </div>
        {field("pets", {
          label: "用哪些宠物挑战",
          kind: "textarea",
          required: true,
          help: "从副本攻略单向关联宠物资料；不建立宠物 PVE Counter。",
        })}
        {field("requirements", {
          label: "必要配置与条件",
          kind: "textarea",
          required: true,
        })}
        {field("steps", {
          label: "操作步骤与失败处理",
          kind: "textarea",
          rows: 7,
          required: true,
        })}
        {field("alternatives", {
          label: "可替代宠物／配置及成立条件",
          kind: "textarea",
        })}
        {field("sourceUrl", {
          label: "实测或攻略来源",
          kind: "url",
          required: true,
        })}
      </>
    );
  if (mode === "relationship")
    return (
      <>
        <div className="ev7-field-grid">
          {["sourceEffect", "incomingEffect", "order", "timing"].map((key) =>
            field(key, { required: true }),
          )}
        </div>
        {field("conditions", {
          label: "宠物形态、场地与其他条件",
          kind: "textarea",
        })}
        {field("result", {
          label: "覆盖／共存／解除的观察结果",
          kind: "textarea",
          required: true,
        })}
        {field("certainty", {
          label: "核验状态",
          options: ["待验证", "已复现", "历史结论", "存在争议"].map(
            (value) => ({ value, label: value }),
          ),
        })}
        {field("reproduction", {
          label: "版本、复现步骤与对照组",
          kind: "textarea",
          required: true,
        })}
        {field("sourceUrl", { label: "原始记录来源", kind: "url" })}
      </>
    );
  return (
    <>
      {intent !== "add" && <>{field("title", { label: "目录名称" })}{field("description", { label: "目录说明", kind: "textarea" })}</>}
      {intent === "add" && <div className="ev7-tip"><Plus size={17} /><p>只补充这一条入口，已有目录内容不会在此修改。</p></div>}
      <Repeater
        title={intent === "add" ? "新增入口" : "目录入口"}
        name="entries"
        single={intent === "add"}
        rows={data.entries || []}
        change={(value) => change("entries", value)}
        makeBlank={() => ({ title: "", href: "/", description: "" })}
        addLabel="增加一个目录入口"
        render={(row, i, update) => (
          <>
            <div className="ev7-field-grid">
              {rowField(row, i, update, "entries", "title", {
                label: "入口名称",
                required: true,
              })}
              {rowField(row, i, update, "entries", "href", {
                label: "站内去向",
                required: true,
              })}
            </div>
            {rowField(row, i, update, "entries", "description", {
              label: "用途说明",
            })}
          </>
        )}
      />
    </>
  );
}
