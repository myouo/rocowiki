import React from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Link, PageHeader, Notice, Contribution, Badge } from "../core";
import { usePublishedPets } from "../CatalogPages";
import { petDetailHref } from "../catalogPublished";
import { STAT_NAMES, NATURES, RELATIONSHIPS, calculateStats } from "../rocoCalculations";
import { calculatorData as calculatorSources } from "../content/bundled.js";
import { normalizeStatsLinkData } from "../statsProfiles";
import { GuardianLevelField, GuardianMappingNote, StatsEquipmentFields } from "../StatsInputsV73";
import CalculatorSnapshots from "../CalculatorSnapshots";
import { statsDefaults, useCalculatorForm } from "./useCalculatorForm.js";
import { CalculatorErrors, NumberField, SelectField, SourcesDetails } from "./components.jsx";

function StatsPage() {
  const { form, invalidLink, update, reset } = useCalculatorForm(statsDefaults, normalizeStatsLinkData);
  const result = calculateStats(form);
  const publishedPets = usePublishedPets().filter((pet) => !pet.deleted);
  const selectedPet = publishedPets.find((pet) => pet.slug === form.pet);
  const snapshotPet = selectedPet || { slug: form.pet || "custom", name: form.petName || "手动种族" };
  const historicalSpecies = selectedPet?.stats?.length === 6 && form.base.some((value, index) => Number(value) !== selectedPet.stats[index]);
  const nature = NATURES.find((item) => item.value === form.nature);
  const relationship = RELATIONSHIPS.find(
    (item) => item.value === form.relationship,
  );
  function setArray(key, index, value) {
    const values = [...form[key]];
    values[index] = value;
    update({ [key]: values, ...(key === "base" ? { pet: "custom", petName: "手动种族", petHref: "" } : {}) });
  }
  function setPet(value) {
    const pet = publishedPets.find((item) => item.slug === value);
    update(
      pet ? { pet: value, petName: pet.name, petHref: petDetailHref(pet), base: pet.stats.map(String) } : { pet: "custom", petName: "手动种族", petHref: "" },
    );
  }
  function setRelationship(value) {
    const currentTotal = form.intimacy.reduce(
      (sum, item) => sum + (Number(item) || 0),
      0,
    );
    update({
      relationship: value,
      intimacy:
        value === "none"
          ? Array(6).fill("0")
          : currentTotal === 50
            ? form.intimacy
            : ["20", "0", "10", "0", "20", "0"],
    });
  }
  return (
    <div className="rw-calculator-page rw-stats-page-v73">
      <PageHeader
        title="能力计算器"
        back="/tools/"
        crumbs={[{ label: "实用工具", to: "/tools/" }, { label: "能力计算器" }]}
        description="看看一次培养，具体改变了哪些能力。每一项都能展开核对。"
        actions={
          <button type="button" className="rw-button" onClick={reset}>
            <RotateCcw size={15} />
            重置
          </button>
        }
      />
      {invalidLink && (
        <Notice title="已恢复可读取的参数">
          链接中有无法识别的参数，对应位置已恢复默认值。你可以继续修改并分享当前地址。
        </Notice>
      )}
      <div className="rw-calc-topline">
        <Badge>洛克王国页游</Badge>
        <span>培养公式 · 官方论坛版主团</span>
        <small>地址保留当前参数</small>
      </div>
      <div className="rw-stats-overview-fields">
        <SelectField
          label="选择宠物种族"
          value={form.pet}
          onChange={setPet}
          searchable
          options={[
            ...publishedPets.map((pet) => ({ value: pet.slug, label: pet.name })),
            { value: "custom", label: "手动输入种族值" },
          ]}
        />
        <NumberField
          label="等级"
          value={form.level}
          min={1}
          max={100}
          onChange={(value) => update({ level: value })}
        />
        <SelectField
          label="性格"
          value={form.nature}
          onChange={(value) => update({ nature: value })}
          options={NATURES}
          searchable
        />
        <GuardianLevelField form={form} update={update} />
      </div>
      <GuardianMappingNote legacyRange={form.guardianLegacyRange} />
      {selectedPet && (
        <p className="rw-calc-pet-source">
          {historicalSpecies ? "当前使用记录中的历史种族值；最新资料见 " : "种族值来自 "}
          <Link to={petDetailHref(selectedPet)}>
            {selectedPet.name}图鉴
          </Link>
          ；修改种族值后按手动输入计算。
          {nature?.boost !== null && nature?.boost !== undefined
            ? `当前性格提升${STAT_NAMES[nature.boost]}、降低${STAT_NAMES[nature.drop]}。`
            : "当前性格不修正能力。"}
        </p>
      )}
      {historicalSpecies && <div className="rw-mini-historical-v73"><span>其他培养参数保留，可将种族值更新为最新图鉴。</span><button type="button" onClick={() => update({ base: selectedPet.stats.map(String) })}>使用图鉴种族</button></div>}
      <section
        className="rw-calc-cultivation"
        aria-labelledby="cultivation-heading"
      >
        <div className="rw-calc-section-heading">
          <div>
            <h2 id="cultivation-heading">基础培养</h2>
            <p>天赋 0–31，努力每项 0–255；满级每 4 点努力折算 1 点能力。</p>
          </div>
          <div className="rw-calc-small-actions">
            <button
              type="button"
              onClick={() => update({ talent: Array(6).fill("31") })}
            >
              天赋全 31
            </button>
            <button
              type="button"
              onClick={() => update({ effort: Array(6).fill("0") })}
            >
              努力清零
            </button>
          </div>
        </div>
        <div className="rw-calc-stat-inputs">
          {STAT_NAMES.map((name, index) => (
            <fieldset key={name}>
              <legend>{name}</legend>
              <NumberField
                label={name + "种族值"}
                value={form.base[index]}
                min={1}
                max={999}
                onChange={(value) => setArray("base", index, value)}
              />
              <NumberField
                label={name + "天赋"}
                value={form.talent[index]}
                max={31}
                onChange={(value) => setArray("talent", index, value)}
              />
              <NumberField
                label={name + "努力值"}
                value={form.effort[index]}
                max={255}
                onChange={(value) => setArray("effort", index, value)}
              />
            </fieldset>
          ))}
        </div>
        <div
          className={
            "rw-calc-budget " + (result.effortTotal > 510 ? "is-over" : "")
          }
        >
          <span>
            努力值 <strong>{result.effortTotal} / 510</strong>
          </span>
          <span>
            {result.effortTotal > 510
              ? "已超出分配上限"
              : `尚可分配 ${510 - result.effortTotal} 点`}
          </span>
        </div>
      </section>
      <details className="rw-calc-additions" open>
        <summary>亲密关系与装备</summary>
        <div className="rw-calc-additions-body">
          <div className="rw-calc-affection">
            <SelectField
              label="亲密关系"
              value={form.relationship}
              onChange={setRelationship}
              options={RELATIONSHIPS}
              hint="关系加成与手动分配分开显示；速度不参与。"
            />
            {form.relationship !== "none" && (
              <>
                <div className="rw-calc-intimacy-fields">
                  {STAT_NAMES.slice(0, 5).map((name, index) => (
                    <div key={name}>
                      <SelectField
                        label={name + "亲密分配"}
                        value={form.intimacy[index]}
                        onChange={(value) => setArray("intimacy", index, value)}
                        options={[0, 10, 20].map((value) => ({
                          value: String(value),
                          label: String(value),
                        }))}
                      />
                      {relationship?.bonus[index] > 0 && (
                        <small>关系另加 {relationship.bonus[index]}</small>
                      )}
                    </div>
                  ))}
                </div>
                <p className="rw-calc-inline-note">
                  手动分配 <strong>{result.intimacyTotal} / 50</strong>{" "}
                  点。每项最多 20 点；特殊关系的额外点数不占这 50 点。
                </p>
              </>
            )}
          </div>
          <StatsEquipmentFields form={form} update={update} />
          <p className="rw-calc-inline-note">已收录五件 100 级史诗装备的六维加成。其他装备可按游戏面板填写主加成；命中、闪避、暴击、抗暴和专属技能效果另查。</p>
        </div>
      </details>
      <section
        className="rw-calc-result-section"
        aria-labelledby="stats-result-heading"
      >
        <div className="rw-calc-section-heading">
          <div>
            <h2 id="stats-result-heading">计算结果</h2>
            <p>
              守护兽单列为战斗加成，速度保持原值。这里尚未施加战斗中的强化、血脉或临时效果。
            </p>
          </div>
          <Badge>逐步向下取整</Badge>
        </div>
        {!result.valid ? (
          <CalculatorErrors errors={result.errors} />
        ) : (
          <>
            <div
              className="rw-calc-six-results"
              aria-live="polite"
              aria-atomic="true"
            >
              {result.rows.map((row) => (
                <div key={row.key}>
                  <span>{row.name}</span>
                  <strong>{row.battle}</strong>
                  <small>
                    面板 {row.panel}
                    {row.guardian > 0 ? ` + 守护 ${row.guardian}` : ""}
                  </small>
                </div>
              ))}
            </div>
            <details className="rw-calc-breakdown">
              <summary>展开六项能力的计算明细</summary>
              <div className="rw-table-scroll">
                <table className="rw-table">
                  <thead>
                    <tr>
                      <th>能力</th>
                      <th>等级折算后</th>
                      <th>性格修正</th>
                      <th>装备</th>
                      <th>面板</th>
                      <th>守护兽</th>
                      <th>战斗基础</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={row.key}>
                        <th>{row.name}</th>
                        <td>{row.neutral}</td>
                        <td>
                          ×{row.natureNumerator / 10} → {row.cultivated}
                        </td>
                        <td>+{row.equipment}</td>
                        <td>{row.panel}</td>
                        <td>+{row.guardian}</td>
                        <td>
                          <strong>{row.battle}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <div className="rw-calc-next-links">
              <Link
                className="rw-button primary"
                to={
                  "/tools/damage/?category=physical&level=" +
                  form.level +
                  "&attack=" +
                  result.battle[1]
                }
              >
                用物攻计算伤害 <ArrowRight size={15} />
              </Link>
              <Link
                className="rw-button"
                to={
                  "/tools/damage/?category=magic&level=" +
                  form.level +
                  "&attack=" +
                  result.battle[3]
                }
              >
                用魔攻计算伤害 <ArrowRight size={15} />
              </Link>
            </div>
          </>
        )}
      </section>
      <CalculatorSnapshots form={form} result={result} pet={snapshotPet} onRestore={update} />
      <SourcesDetails ids={["forum-training"]}>
        <h3>计算顺序</h3>
        <p>
          先把努力值除以 4
          向下取整；亲密分配与关系加成合并后，和种族、天赋一起按等级折算，再向下取整。性格按
          9/10、1 或 11/10
          作用于非精力项，取整后再加装备。守护兽最后加入战斗基础能力。
        </p>
        <div className="rw-calc-formulas">
          <code>
            B = floor((2 × 种族 + 天赋 + floor(努力 / 4) + 亲密) × 等级 / 100)
          </code>
          <code>精力 = B + 等级 + 10 + 装备 + 守护兽</code>
          <code>其他能力 = floor((B + 5) × 性格) + 装备 + 守护兽</code>
        </div>
        <p>
          速度的亲密、装备、守护兽均取 0。论坛公式段最后编辑于
          2026-04-14；这是原教程公式的计算实现，尚未以本项目游戏账号逐项复现。
        </p>
      </SourcesDetails>
      <Contribution
        entity="能力计算器"
        source={calculatorSources.sources[0].url}
      />
    </div>
  );
}

export { StatsPage };
