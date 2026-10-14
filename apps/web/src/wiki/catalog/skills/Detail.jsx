import SkillRuleReading from "../../SkillRuleReading";
import SkillLearners from "../../SkillLearners";
import { resolveSkillLearners } from "../../skillLearnerModel";
import { EntityText } from "../../EntityReference";
import { skillRulePresentation } from "../../skillPresentation";
import { petSkillPoolHref, skillDetailHref } from "../../catalogPublished";
import EditEntry from "../../editing/EditEntry";
import React, { useState } from "react";
import { useLocation } from "@docusaurus/router";
import { ArrowRight, BookOpen, ChevronDown, ExternalLink } from "lucide-react";
import { Link, PageHeader, Section, Notice, EmptyState, Contribution, BookmarkButton, DocGrid } from "../../core";
import { usePublishedPets, usePublishedSkills } from "../hooks.js";
import { AttributeBadge, PetPortrait, SkillKind } from "../components.jsx";
import { officialSkillData } from '../../content/bundled.js';
import OfficialSkillSource from './OfficialSource';
import SkillAnalysisSource, { SkillAnalysisNotes } from './AnalysisSource';
import CompactAnalysis from './CompactAnalysis';
import { useHydratedSearch } from '../pets/useHydratedSearch';
import { skillCollection } from './officialModel';

function SkillPage({ slug }) {
  const skills = usePublishedSkills();
  const pets = usePublishedPets();
  const location = useLocation();
  const search = useHydratedSearch(location.search);
  const skill = skills.find((s) => s.slug === slug);
  const [expand, setExpand] = useState(true);
  if (!skill)
    return (
      <>
        <PageHeader title="技能资料待收录" back="/skills/" />
        <EmptyState action={<Link to="/skills/">查看技能目录</Link>} />
      </>
    );
  const requestedPet = new URLSearchParams(search).get("pet");
  const learningPets = resolveSkillLearners({ skill, pets }).rows.map((row) => row.pet);
  const contextPet = learningPets.find((pet) => pet.slug === requestedPet);
  const rules = skillRulePresentation(skill);
  const skillReturnBase = skillDetailHref(skill) +
    (contextPet ? (skill.localEntry || skill.catalogEntry ? "&pet=" : "?pet=") + encodeURIComponent(contextPet.slug) : "");
  return (
    <div className="rw-skill-detail-v6">
      <PageHeader
        title={skill.name}
        back={contextPet ? petSkillPoolHref(contextPet) : "/skills/"}
        crumbs={[{ label: "技能查询", to: "/skills/" }, { label: skill.name }]}
        actions={
          <>
            <BookmarkButton
              id={"skill:" + slug}
              title={skill.name}
              href={skillDetailHref(skill)}
              kind="技能"
            />
            <EditEntry
              entity={skill.name}
              section="基础参数"
              mode="skill"
              returnTo={skillReturnBase}
              label="编辑条目"
            />
          </>
        }
      />
      {contextPet && (
        <div className="rw-skill-pet-context-v6">
          <PetPortrait pet={contextPet} />
          <div>
            <span>正在查阅 {contextPet.name} 的技能</span>
            <Link to={petSkillPoolHref(contextPet)}>
              返回 {contextPet.name} 技能池
              <ArrowRight size={13} />
            </Link>
          </div>
          <Link to={skillDetailHref(skill)}>查看独立条目</Link>
        </div>
      )}
      {skillCollection(skill) === 'placeholder' && <Notice title="资料待定">官方配置中的名称与描述仍为占位内容，请核对后续资料。</Notice>}
      <DocGrid
        toc={[
          ["parameters", "基础参数"],
          ["effects", "效果与条件"],
          ["relations", "相互作用"],
          ["owners", "学习宠物"],
          ["sources", "来源与待核"],
        ]}
      >
        <section className="rw-skill-parameters" id="parameters">
          <div>
            <span>属性</span>
            <AttributeBadge type={skill.type} />
          </div>
          <div>
            <span>技能类别</span>
            <SkillKind category={skill.category} />
          </div>
          <div>
            <span>基础威力</span>
            <strong>{skill.power ?? "—"}</strong>
          </div>
          <div>
            <span>基础 PP</span>
            <strong>{skill.pp}</strong>
          </div>
          <div>
            <span>先手值</span>
            <strong>
              {Number.isFinite(skill.priority) ? skill.priority : "待核"}
            </strong>
          </div>
          <div className="rw-hit-parameter">
            <span>命中规则</span>
            <strong>{skill.hit}</strong>
          </div>
        </section>
        <div className="rw-skill-summary">
          <div className="rw-catalog-section-edit-v7">
            <h2>技能描述</h2>
            <EditEntry
              entity={skill.name}
              section="技能描述"
              mode="skill"
              returnTo={skillReturnBase}
              label="编辑描述"
            />
          </div>
          <p><EntityText text={skill.summary} path={skillReturnBase} /></p>
          <div>
            {skill.tags.map((t) => (
              <Link
                className="rw-effecttag"
                key={t}
                to={"/skills/?effect=" + encodeURIComponent(t)}
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
        <Section
          id="effects"
          title="效果与触发条件"
          aside={
            <button
              className="rw-small-button"
              onClick={() => setExpand(!expand)}
              aria-expanded={expand}
              aria-controls="rw-skill-branches-v6"
            >
              {expand ? "收起条件" : "展开条件"}
              <ChevronDown size={14} />
            </button>
          }
        >
          {!(skill.analysisCurrent && !skill.publishedRules) && <SkillAnalysisNotes skill={skill} />}
          {expand && <div id="rw-skill-branches-v6">{skill.analysisCurrent && !skill.publishedRules ? <>
            <CompactAnalysis record={skill.analysis} context={{ entity: skill.name, returnTo: skillReturnBase }}
              baseAction={<EditEntry entity={skill.name} section="效果与触发条件" mode="skill" returnTo={skillReturnBase + "#effects"} record="base" label="编辑基础效果" />}
              actionFor={(phase, i) => <EditEntry entity={skill.name} section="效果与触发条件" mode="skill" returnTo={skillReturnBase + "#effects"} record={"branch-" + (i + 1)} label="编辑分支" />} />
          </> : <SkillRuleReading
            data={{ name: skill.name, summary: skill.summary, base: rules.base, branches: rules.branches, terms: skill.terms }}
            context={{ entity: skill.name, returnTo: skillReturnBase }}
            showDescription={false}
            baseAction={<EditEntry entity={skill.name} section="效果与触发条件" mode="skill" returnTo={skillReturnBase + "#effects"} record="base" label="编辑基础效果" />}
            actionFor={(phase, i) => <EditEntry entity={skill.name} section="效果与触发条件" mode="skill" returnTo={skillReturnBase + "#effects"} record={"branch-" + (i + 1)} label="编辑分支" />}
          />}</div>}
          <EditEntry
            entity={skill.name}
            section="效果与触发条件"
            mode="skill"
            returnTo={skillReturnBase + "#effects"}
            intent="add"
            label="新增条件分支"
          />
          {!(skill.analysisCurrent && !skill.publishedRules) && <Notice title="这是结构化摘要">
            仅解释来源已描述的关系。具体阈值、伤害公式、触发优先级等未证实内容保留待核，不从标签推导。
          </Notice>}
        </Section>
        <Section title="相互作用" id="relations">
          <div className="rw-relation-list">
            <Link to="/mechanics/priority/">
              <span>行动顺序</span>
              <strong>基础先手与战斗中修正</strong>
              <ArrowRight size={15} />
            </Link>
            <Link to="/mechanics/pp/">
              <span>技能资源</span>
              <strong>PP 消耗、删除、回复与目标</strong>
              <ArrowRight size={15} />
            </Link>
            <Link to="/mechanics/weather/">
              <span>场地条件</span>
              <strong>天气、环境与失败分支</strong>
              <ArrowRight size={15} />
            </Link>
          </div>
        </Section>
        <Section title="学习宠物" id="owners" edit={false} aside={<EditEntry entity={skill.name} section="学习宠物" mode="skill" record="learners" returnTo={skillReturnBase + "#owners"} label="编辑学习关系" />}>
          <SkillLearners skill={skill} pets={pets} />
        </Section>
        <Section title="来源与待核" id="sources">
          <OfficialSkillSource skill={skill.official} source={officialSkillData.source} />
          <SkillAnalysisSource skill={skill} />
          {(skill.curatedSource || !skill.official) && <div className="rw-source-row">
            <BookOpen size={18} />
            <div>
              <strong>资料站技能描述</strong>
              <p>
                保留资料站原始出处与社区结构化解读，技能基础参数以官方配置为准。
              </p>
            </div>
            <a href={skill.curatedSource || skill.source} target="_blank" rel="noreferrer">
              打开原文 <ExternalLink size={13} />
            </a>
          </div>}
          <Contribution entity={skill.name} source={skill.source} />
        </Section>
      </DocGrid>
    </div>
  );
}

export { SkillPage };
