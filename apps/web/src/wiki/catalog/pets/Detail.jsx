import StatsRadar from "../../StatsRadar";
import PetStatsMini from "../../PetStatsMini";
import { bloodlineDetailHref } from "../../catalogBloodlines";
import { petDetailHref } from "../../catalogPublished";
import EditEntry from "../../editing/EditEntry";
import React, { useState } from "react";
import { GitCompareArrows, BookOpen, ChevronDown, ExternalLink, Shield } from "lucide-react";
import { Link, Badge, PageHeader, Section, Notice, EmptyState, Contribution, BookmarkButton, DocGrid, DataPair, TextLink } from "../../core";
import { haifuSource } from "../../data";
import { externalSource, petMeta } from "../model.js";
import { usePublishedPets, usePublishedSkills } from "../hooks.js";
import { AttributeBadge, PetAppearanceGallery, SkillTable } from "../components.jsx";
import { AcquisitionTimeline } from "./Acquisition.jsx";
import { PetMatchups } from "./Matchups.jsx";

function PetPage({ slug }) {
  const pets = usePublishedPets();
  const skills = usePublishedSkills();
  const pet = pets.find((p) => p.slug === slug);
  const [skillMode, setSkillMode] = useState("key");
  if (!pet)
    return (
      <>
        <PageHeader
          title="宠物资料待收录"
          back="/pets/"
          crumbs={[{ label: "宠物图鉴", to: "/pets/" }, { label: "待收录" }]}
        />
        <EmptyState
          title="这只宠物还没有完整条目"
          action={
            <Link className="rw-button" to="/pets/">
              浏览已收录图鉴
            </Link>
          }
        >
          当前预览只收录一组资料样本，未给未知宠物套用其他宠物数据。
        </EmptyState>
      </>
    );
  if (pet.deleted) return <div className="rw-pet-detail-v6">
    <PageHeader title={pet.name} back="/pets/" edit={false} crumbs={[{ label: "宠物图鉴", to: "/pets/" }, { label: pet.name }]} />
    <Notice title="这条图鉴已在本机审核流程中移除" tone="gold">
      {pet.deletionReason || "条目维护决定已发布。"} 历史引用仍然保留，关联技能和活动记录未被删除。
    </Notice>
    {/^\/(?!\/)[^\s<>\\]*$/.test(pet.redirectTo || "") && <TextLink to={pet.redirectTo}>前往关联条目</TextLink>}
    <TextLink to="/pets/">返回宠物图鉴</TextLink>
  </div>;
  const petReturnBase = petDetailHref(pet);
  const mainSkills = skills.filter((s) => s.ownerSlug === pet.slug || s.learners?.some((row) => row.petSlug === pet.slug));
  const meta = petMeta(pet);
  const toc = [
    ["overview", "基础资料"],
    ["ability", "能力计算"],
    ["skills", "技能池"],
    ["bloodline", "血脉与联动"],
    ["acquire", "获取时间线"],
    ["matchups", "对位 Counter"],
    ["training", "培养资料"],
    ["sources", "来源与修订"],
  ];
  return (
    <div className="rw-pet-detail-v6">
      <PageHeader
        title={pet.name}
        back="/pets/"
        crumbs={[{ label: "宠物图鉴", to: "/pets/" }, { label: pet.name }]}
        actions={
          <>
            <BookmarkButton
              id={"pet:" + slug}
              title={pet.name}
              href={petReturnBase}
            />
            <Link className="rw-button" to={"/tools/compare/?pets=" + slug}>
              <GitCompareArrows size={15} />
              对比
            </Link>
            <EditEntry
              entity={pet.name}
              section="基础资料"
              mode="pet"
              record={pet.slug}
              returnTo={petReturnBase + "#overview"}
              label="编辑条目"
            />
          </>
        }
      />
      {pet.publishedRevision && <p className="rw-catalog-local-revision-v7">正在阅读本机已发布的宠物资料 · {pet.publishedAt?.slice(0, 10) || "本次会话"}</p>}
      <DocGrid toc={toc}>
        <section className="rw-pet-overview rw-pet-overview-v72" id="overview">
          <PetAppearanceGallery pet={pet} />
          <div className="rw-pet-facts">
            <div className="rw-catalog-section-edit-v7">
              <h2>基础资料</h2>
              <EditEntry
                entity={pet.name}
                section="基础资料"
                mode="pet"
                record={pet.slug}
                returnTo={petReturnBase + "#overview"}
                label="编辑资料"
              />
            </div>
            <div className="rw-pet-facttop">
              <div className="rw-type-list">
                {pet.types.map((t) => (
                  <AttributeBadge key={t} type={t} />
                ))}
              </div>
              <Badge>页游图鉴</Badge>
            </div>
            <dl className="rw-facts-grid">
              <DataPair label="组别" value={meta.group || "待核"} />
              <DataPair
                label="所属系列"
                value={meta.series?.join(" / ") || "待核"}
              />
              <DataPair
                label="常用别名"
                value={
                  pet.aliases.length ? pet.aliases.join(" / ") : "暂未收录"
                }
              />
              <DataPair
                label="经验类型"
                value={meta.experienceType ?? "待核"}
              />
              <DataPair label="可选血脉" value={meta.bloodlines?.length ? <span className="rw-pet-fact-links-v72">{meta.bloodlines.map((name) => <Link key={name} to={bloodlineDetailHref(name)}>{name}</Link>)}</span> : "待核"} />
              <DataPair label="身高" value={meta.heightM != null ? meta.heightM + " m" : "待核"} />
              <DataPair label="体重" value={meta.weightKg != null ? meta.weightKg + " kg" : "待核"} />
              <DataPair label="颜色" value={meta.color || "待核"} />
              <DataPair label="捕捉分类" value={meta.catchCategory != null ? <span title="来源中的分类编号，不是捕获概率">{meta.catchCategory} <small>（源表编号）</small></span> : "待核"} />
            </dl>
          </div>
          <div className="rw-pet-radar">
            <div className="rw-stats-title">
              <strong>种族值</strong>
              <EditEntry
                entity={pet.name}
                section="种族值"
                mode="pet"
                record={pet.slug}
                returnTo={petReturnBase + "#overview"}
                label="编辑"
              />
              <span>
                总和{" "}
                <b>{pet.stats ? pet.stats.reduce((a, b) => a + b, 0) : "—"}</b>
              </span>
            </div>
            {pet.stats ? (
              <StatsRadar
                pets={[pet]}
                compact
                showLegend={false}
                showTable={false}
              />
            ) : (
              <p className="rw-muted">种族值待核验，暂不计算总和。</p>
            )}
            <p className="rw-subnote">
              基础种族值用于比较，不等同培养后的面板与实战强度。
            </p>
          </div>
        </section>
        <nav className="rw-anchor-strip" aria-label="快速跳到本页章节">
          {toc.slice(1, -1).map(([id, label]) => (
            <button
              key={id}
              onClick={() =>
                document.getElementById(id)?.scrollIntoView({
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "auto"
                    : "smooth",
                })
              }
            >
              {label}
              <ChevronDown size={12} />
            </button>
          ))}
        </nav>
        <PetStatsMini key={pet.slug} pet={pet} />
        <Section
          title="技能池"
          id="skills"
          aside={
            <div className="rw-segmented">
              <button
                className={skillMode === "key" ? "active" : ""}
                onClick={() => setSkillMode("key")}
              >
                重点技能
              </button>
              <button
                className={skillMode === "source" ? "active" : ""}
                onClick={() => setSkillMode("source")}
              >
                收录与来源
              </button>
            </div>
          }
        >
          {mainSkills.length && skillMode === "key" ? (
            <>
              <SkillTable items={mainSkills} compact petContext={pet.slug} />
              <div className="rw-table-note">
                按基础参数查阅。完整规则与命中条件进入技能详情；候选技能不等同同时携带。
              </div>
            </>
          ) : (
            <Notice
              title={
                mainSkills.length
                  ? "已收录 " + mainSkills.length + " 个重点技能"
                  : "技能池尚待补全"
              }
            >
              预览不以空白代表“不会该技能”。
              <a
                href={pet.sourceUrl || haifuSource}
                target="_blank"
                rel="noreferrer"
              >
                {" "}
                查看完整来源 <ExternalLink size={12} />
              </a>
            </Notice>
          )}
        </Section>
        <Section title="血脉与技能联动" id="bloodline">
          <div className="rw-bloodline-strip">
            <div className="rw-icon-tile">
              <Shield size={25} />
            </div>
            <div>
              <strong>
                {meta.bloodlines?.length
                  ? meta.bloodlines.join(" / ")
                  : "血脉资料待核"}
              </strong>
              <p>
                {pet.slug === "haifu"
                  ? "两种血脉与怒气、战意及乘胜分别关联；完整触发阈值和版本差异进入条目核对。"
                  : "血脉名称、被动条件及对技能的影响独立核验。"}
              </p>
            </div>
            {meta.bloodlines?.length ? <TextLink to={bloodlineDetailHref(meta.bloodlines[0])}>查看血脉</TextLink> : <EditEntry entity={pet.name} section="基础资料" mode="pet" record={pet.slug} returnTo={petReturnBase + "#bloodline"} label="补充血脉" />}
          </div>
          {meta.bloodlineSources?.length > 0 && (
            <div className="rw-inline-links">
              {meta.bloodlineSources.map((source) => (
                <a
                  key={source.name}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.name}来源
                  <ExternalLink size={11} />
                </a>
              ))}
            </div>
          )}
          <div className="rw-inline-links">
            <Link to="/mechanics/pp/">PP 变化</Link>
            <Link to="/mechanics/status/">异常免疫</Link>
            <Link to="/mechanics/weather/">天气与环境</Link>
          </div>
        </Section>
        <Section title="获取时间线" id="acquire">
          <AcquisitionTimeline pet={pet} />
          <details className="rw-details">
            <summary>进化与重生关系</summary>
            <p>
              独立记录关系类型。未核实前，不把不同形态当作纯外观，也不推断能够互相转换。
            </p>
            {pet.slug === "haifu" && (
              <div className="rw-relation-row">
                <Badge>本体</Badge>
                <strong>海芙约忒</strong>
                <span>已收录外观可在页首原图下方切换查看。</span>
              </div>
            )}
          </details>
        </Section>
        <Section title="对位 Counter" id="matchups">
          <PetMatchups pet={pet} />
        </Section>
        <Section title="培养资料" id="training">
          <div className="rw-two-cols">
            <div className="rw-inline-card">
              <h3>先确定用途，再决定培养</h3>
              <p>
                性格、努力值、技能和装备应与目标挑战或赛规对应。当前尚未收录已验证配置。
              </p>
              <TextLink to="/guides/training/">培养指南</TextLink>
            </div>
            <div className="rw-inline-card">
              <h3>查看对战的适用条件</h3>
              <p>先核对规则日期、队伍门槛与可替代宠物，再参考打法。</p>
              <div className="rw-inline-links">
                <Link to="/battle/">PVP 规则</Link>
              </div>
            </div>
          </div>
        </Section>
        <Section title="来源与修订" id="sources">
          <div className="rw-source-row">
            <BookOpen size={18} />
            <div>
              <strong>页游资料站 · {pet.name}图鉴</strong>
              <p>
                基础资料来自可查阅的来源；页面未声明官方核验。各项来源与适用时间分别记录。
              </p>
            </div>
            {externalSource(pet.sourceUrl) ? <a
              href={externalSource(pet.sourceUrl)}
              target="_blank"
              rel="noreferrer"
            >
              打开来源 <ExternalLink size={13} />
            </a> : <span className="rw-muted">来源待补</span>}
          </div>
          <Contribution
            entity={pet.name}
            source={externalSource(pet.sourceUrl)}
          />
        </Section>
      </DocGrid>
      <details className="rw-entry-maintenance-v71" data-no-editor>
        <summary>条目维护</summary>
        <p>遇到重复或无效条目，可以提交删除提议。提议通过审核并发布前，当前宠物资料继续保留。</p>
        <EditEntry entity={pet.name} section="删除提议" mode="pet" record={pet.slug} returnTo={petReturnBase} intent="delete" label="提议删除此宠物条目" />
      </details>
    </div>
  );
}

export { PetPage };
