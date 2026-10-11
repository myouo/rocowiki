import React from "react";
import { ArrowRight, ExternalLink, RotateCcw, Info, Swords, Shield, Sparkles, TrendingUp, ChevronDown } from "lucide-react";
import { Link, PageHeader, Section, Notice, Contribution, Badge } from "../core";
import EditEntry from "../editing/EditEntry";
import { POWER_MATCHUPS, POWER_STAGES, calculatePowerDamage } from "../rocoCalculations";
import { calculatorData as calculatorSources } from "../content/bundled.js";
import { damageDefaults, useCalculatorForm } from "./useCalculatorForm.js";
import { CalculatorErrors, NumberField, SelectField, SourcesDetails } from "./components.jsx";

function DamagePage() {
  const { form, invalidLink, update, reset } =
    useCalculatorForm(damageDefaults);
  const result = calculatePowerDamage(form);
  const magic = form.category === "magic";
  const source = calculatorSources.sources.find(
    (item) => item.id === "forum-power-calculator",
  );
  return (
    <div className="rw-calculator-page rw-power-calculator">
      <PageHeader
        title="威力伤害计算器"
        back="/tools/"
        crumbs={[
          { label: "实用工具", to: "/tools/" },
          { label: "威力伤害计算器" },
        ]}
        description="这一下，最多能打多少？填入攻防、强化等级与本次修正，即时查看伤害上限。"
        actions={
          <button type="button" className="rw-button" onClick={reset}>
            <RotateCcw size={15} />
            重置参数
          </button>
        }
      />
      {invalidLink && (
        <Notice title="已恢复可读取的参数">
          链接中有无法识别的参数，对应位置已恢复默认值。当前地址会保留后续修改。
        </Notice>
      )}
      <div className="rw-calc-topline">
        <Badge>洛克王国页游</Badge>
        <span>官方论坛工具口径 · 2026.10.06</span>
        <a href={source.url} target="_blank" rel="noreferrer">
          查看原工具 <ExternalLink size={12} />
        </a>
      </div>

      <section
        className="rw-power-result"
        aria-labelledby="damage-result-heading"
      >
        <div className="rw-power-result-heading">
          <span className="rw-power-symbol">
            <TrendingUp size={21} />
          </span>
          <div>
            <h2 id="damage-result-heading">本次威力伤害</h2>
            <p>上限对应 1.00 档；随机档位由游戏规则确定。</p>
          </div>
          <Badge>{magic ? "魔法" : "物理"} · 单段</Badge>
        </div>
        {!result.valid ? (
          <CalculatorErrors errors={result.errors} />
        ) : !result.supported ? (
          <div className="rw-calc-unsupported" role="status">
            <Info size={25} />
            <h3>这组条件需要技能专属公式</h3>
            <p>{result.reason}</p>
            <Link to="/mechanics/damage/" className="rw-textlink">
              查看伤害结算 <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <>
            <div
              className="rw-power-extremes"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="rw-power-maximum">
                <span>伤害上限</span>
                <strong>{result.max.toLocaleString("zh-CN")}</strong>
                <small>目标当前精力的 {result.percentMax.toFixed(1)}%</small>
              </div>
              <div className="rw-power-minimum">
                <span>伤害下限</span>
                <strong>{result.min.toLocaleString("zh-CN")}</strong>
                <small>目标当前精力的 {result.percentMin.toFixed(1)}%</small>
              </div>
              <div className="rw-power-result-context">
                <div
                  className="rw-damage-health-bar"
                  role="img"
                  aria-label={`伤害占目标当前精力 ${result.percentMin.toFixed(1)}% 至 ${result.percentMax.toFixed(1)}%`}
                >
                  <span
                    className="rw-damage-bar-max"
                    style={{ width: Math.min(100, result.percentMax) + "%" }}
                  />
                  <span
                    className="rw-damage-bar-min"
                    style={{ width: Math.min(100, result.percentMin) + "%" }}
                  />
                </div>
                <p>
                  当前精力 <b>{result.hp}</b> · 单次命中后的计算值
                </p>
                <small>不包含命中概率、护盾、限伤与固伤。</small>
              </div>
            </div>
            <details className="rw-power-roll-details">
              <summary>
                展开全部 21 档伤害 <ChevronDown size={16} />
              </summary>
              <div className="rw-calc-rolls">
                {result.rolls.map((roll) => (
                  <div
                    key={roll.coefficient}
                    className={roll.coefficient === 100 ? "is-maximum" : ""}
                  >
                    <span>×{(roll.coefficient / 100).toFixed(2)}</span>
                    <strong>{roll.damage.toLocaleString("zh-CN")}</strong>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </section>

      <div className="rw-power-controls">
        <section
          className="rw-power-side rw-power-attacker"
          aria-labelledby="power-attacker-heading"
        >
          <div className="rw-power-section-title">
            <span>
              <Swords size={20} />
            </span>
            <h2 id="power-attacker-heading">攻击方</h2>
            <small>01</small>
          </div>
          <div className="rw-calc-fields-two">
            <SelectField
              label="技能类别"
              value={form.category}
              onChange={(value) => update({ category: value })}
              options={[
                { value: "physical", label: "物理 · 物攻对物防" },
                { value: "magic", label: "魔法 · 魔攻对魔抗" },
              ]}
            />
            <NumberField
              label="宠物等级"
              value={form.level}
              min={1}
              max={100}
              onChange={(value) => update({ level: value })}
            />
            <NumberField
              label="技能威力"
              value={form.power}
              min={1}
              max={99999}
              onChange={(value) => update({ power: value })}
              hint="填本次已确认的威力。"
            />
            <NumberField
              label={magic ? "魔攻能力" : "物攻能力"}
              value={form.attack}
              min={1}
              max={99999}
              onChange={(value) => update({ attack: value })}
              hint="未计下方强化等级的能力。"
            />
            <SelectField
              label="攻击强化等级"
              value={form.attackStage}
              onChange={(value) => update({ attackStage: value })}
              options={POWER_STAGES}
            />
            <div className="rw-power-effective-stat">
              <span>强化后的{magic ? "魔攻" : "物攻"}</span>
              <strong>
                {result.supported
                  ? Number(result.attackAfterStage.toFixed(3)).toLocaleString(
                      "zh-CN",
                    )
                  : "—"}
              </strong>
            </div>
          </div>
          <Link to="/tools/stats/" className="rw-textlink">
            先计算培养后的能力 <ArrowRight size={14} />
          </Link>
        </section>
        <section
          className="rw-power-side rw-power-defender"
          aria-labelledby="power-defender-heading"
        >
          <div className="rw-power-section-title">
            <span>
              <Shield size={20} />
            </span>
            <h2 id="power-defender-heading">防御方</h2>
            <small>02</small>
          </div>
          <div className="rw-calc-fields-two">
            <NumberField
              label={magic ? "魔抗能力" : "物防能力"}
              value={form.defense}
              min={1}
              max={99999}
              onChange={(value) => update({ defense: value })}
              hint="未计下方强化等级的能力。"
            />
            <NumberField
              label="目标当前精力"
              value={form.hp}
              min={1}
              max={99999}
              onChange={(value) => update({ hp: value })}
              hint="用于显示伤害占比。"
            />
            <SelectField
              label="防御强化等级"
              value={form.defenseStage}
              onChange={(value) => update({ defenseStage: value })}
              options={POWER_STAGES}
            />
            <div className="rw-power-effective-stat">
              <span>强化后的{magic ? "魔抗" : "物防"}</span>
              <strong>
                {result.supported
                  ? Number(result.defenseAfterStage.toFixed(3)).toLocaleString(
                      "zh-CN",
                    )
                  : "—"}
              </strong>
            </div>
          </div>
          <p className="rw-calc-inline-note">
            如果输入的攻防已经包含本轮强化，请把对应强化等级设为
            0，避免重复计算。
          </p>
        </section>
        <section
          className="rw-power-modifiers"
          aria-labelledby="power-modifiers-heading"
        >
          <div className="rw-power-section-title">
            <span>
              <Sparkles size={20} />
            </span>
            <h2 id="power-modifiers-heading">伤害修正</h2>
            <small>03</small>
          </div>
          <div className="rw-power-modifier-fields">
            <SelectField
              label="属性关系"
              value={form.matchup}
              onChange={(value) => update({ matchup: value })}
              options={POWER_MATCHUPS}
              hint="按本次攻击的实际判定选择。"
            />
            <NumberField
              label="增伤比例（%）"
              value={form.boost}
              min={0}
              max={10000}
              onChange={(value) => update({ boost: value })}
              hint="0 表示没有增伤。"
            />
            <NumberField
              label="减伤比例（%）"
              value={form.reduction}
              min={0}
              max={100}
              onChange={(value) => update({ reduction: value })}
              hint="填实际生效的总比例。"
            />
          </div>
          <p className="rw-calc-inline-note">
            多个效果先按其覆盖、叠加规则确认总比例；不能把不同技能写出的百分比直接相加。
          </p>
          <details className="rw-power-special-conditions">
            <summary>本次还有固伤、护盾或其他特殊结算？</summary>
            <div className="rw-calc-fields-two">
              <SelectField
                label="结算类型"
                value={form.mode}
                onChange={(value) => update({ mode: value })}
                options={[
                  { value: "ordinary", label: "单段普通威力伤害" },
                  { value: "special", label: "固伤 / 斩杀 / 多段独立结算" },
                ]}
              />
              <SelectField
                label="其他结算条件"
                value={form.conditions}
                onChange={(value) => update({ conditions: value })}
                options={[
                  { value: "plain", label: "没有其他结算" },
                  { value: "modified", label: "存在护盾 / 限伤 / 伤害转化" },
                ]}
              />
            </div>
          </details>
        </section>
      </div>
      <p className="rw-power-share-note">
        参数会保留在当前网址，复制链接即可复现这组计算。
      </p>
      <Section
        title="计算规则"
        id="calculation-rules"
        aside={
          <EditEntry
            entity="威力伤害计算器"
            section="计算规则"
            mode="article"
            returnTo="/tools/damage/#calculation-rules"
            label="编辑计算规则"
          />
        }
      >
        <SourcesDetails ids={["forum-power-calculator"]}>
          <h3>与官方论坛工具相同的计算口径</h3>
          <p>
            先根据 −6 至 +6
            的能力等级修正攻防，再代入普通威力公式，依次乘属性、随机档位与增减伤比例，最后向下取整。最低结果按该工具取
            1。
          </p>
          <div className="rw-calc-formulas">
            <code>
              A′ = 攻击能力 × 攻击强化倍率；D′ = 防御能力 × 防御强化倍率
            </code>
            <code>B = (0.4 × 等级 + 2) × 威力 × A′ / D′ / 50 + 2</code>
            <code>
              伤害 = max(1, floor(B × 属性关系 × r × (1 + 增伤 / 100) × (1 −
              减伤 / 100)))
            </code>
            <code>r ∈ &#123;0.80, 0.81, …, 1.00&#125;</code>
          </div>
          <p>
            正强化倍率为 (等级 + 2) / 2，负强化倍率为 2 / (2 −
            等级)。五档属性关系对应
            3、2、1、1/2、1/3。输入能力与属性关系由使用者确认，本工具不推断宠物的全部技能效果。
          </p>
          <h3>上限的含义</h3>
          <p>
            这里的“伤害上限”是当前参数、当前结算口径下 1.00
            档的结果。它不是技能威力的全局封顶值，也不是所有技能、护盾与限伤处理后的实战保证。官方原工具名为“威力伤害计算器”。
          </p>
          <p>
            本实现保留分式中间值，只在最终伤害取整，避免浮点数恰逢整数边界时产生误差。威力、攻防、精力的
            99999 与增伤 10000% 为本工具输入范围，不代表游戏上限。
          </p>
        </SourcesDetails>
      </Section>
      <Contribution entity="威力伤害计算器 · 计算规则" source={source.url} />
    </div>
  );
}

export { DamagePage };
