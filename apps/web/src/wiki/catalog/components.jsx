import useBaseUrl from "@docusaurus/useBaseUrl";
import { EntityText } from "../EntityReference";
import { petDetailHref, skillDetailHref } from "../catalogPublished";
import { petMetadata } from "../content/bundled.js";
import { petAppearances } from "../content/bundled.js";
import React, { useState, useEffect } from "react";
import LadderCostBadge from "./pets/LadderCostBadge";
import { GitCompareArrows, ExternalLink, Check } from "lucide-react";
import { Link } from "../core";
import { skills } from "../data";
import { externalSource, normalType, petMeta } from "./model.js";

function AttributeBadge({ type, iconOnly = false }) {
  const normalized = normalType(type);
  const icon = petMetadata.typeIcons[normalized];
  const imageUrl = useBaseUrl(icon?.path || "");
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  return (
    <span
      className={"rw-attribute-v6" + (iconOnly ? " icon-only" : "")}
      title={normalized + "属性"}
    >
      {icon && !failed && (
        <img
          src={imageUrl}
          alt={normalized + "属性"}
          width="22"
          height="22"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      {(!iconOnly || !icon || failed) && (
        <span aria-hidden={icon && !failed ? "true" : undefined}>
          {normalized}
        </span>
      )}
    </span>
  );
}

function MagicCostBadge({ pet }) {
  return <LadderCostBadge name={pet.name} magic={petMeta(pet).ladderMagic} />;
}

function PetPortrait({ pet, size = "", className = "" }) {
  const imageUrl = useBaseUrl(pet.image || "");
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [pet.image]);
  return (
    <div className={"rw-portrait " + size + " " + className}>
      {pet.image && !failed ? (
        <img
          src={imageUrl}
          alt={pet.name + "正面图"}
          loading={size === "hero" ? "eager" : "lazy"}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="rw-image-unavailable">
          <span>{pet.name}</span>
          <small>原图暂不可用</small>
        </div>
      )}
    </div>
  );
}

function PetAppearanceGallery({ pet }) {
  const [selected, setSelected] = useState("original");
  const appearances = [
    { id: "original", name: pet.name, label: "原始外观", image: pet.image, sourceUrl: pet.sourceUrl },
    ...(petAppearances.pets[pet.slug] || []),
  ];
  const current = appearances.find((item) => item.id === selected) || appearances[0];
  useEffect(() => setSelected("original"), [pet.slug]);
  function onKeyDown(event, index) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const next = event.key === "Home" ? 0 : event.key === "End" ? appearances.length - 1 : delta ? (index + delta + appearances.length) % appearances.length : null;
    if (next == null) return;
    event.preventDefault();
    setSelected(appearances[next].id);
    event.currentTarget.parentElement.querySelectorAll("button")[next]?.focus();
  }
  return <div className="rw-pet-identity rw-pet-identity-v72">
    <div className="rw-pet-gallery-image-v72">
      <PetPortrait pet={{ ...pet, image: current.image, name: current.name }} size="hero" />
      <div className="rw-pet-hero-magic-v72"><MagicCostBadge pet={pet} /></div>
    </div>
    <div className="rw-number">No. {pet.number ?? "待录入"} · {current.label}</div>
    <div className="rw-pet-appearance-options-v72" role="group" aria-label={pet.name + "外观切换"}>
      {appearances.map((appearance, index) => <button key={appearance.id} type="button" aria-pressed={current.id === appearance.id} tabIndex={current.id === appearance.id ? 0 : -1} onClick={() => setSelected(appearance.id)} onKeyDown={(event) => onKeyDown(event, index)}>{appearance.label}</button>)}
    </div>
    <div className="rw-pet-appearance-caption-v72" aria-live="polite">
      <span>{appearances.length > 1 ? current.name : "其他外观图片待收录"}</span>
      {externalSource(current.sourceUrl) && <a href={externalSource(current.sourceUrl)} target="_blank" rel="noreferrer">图片出处 <ExternalLink size={10} /></a>}
    </div>
  </div>;
}

/** @param {{pet: import('./pets/officialTypes').WikiPet, onCompare?: (slug: string) => void, compared?: boolean, href?: string, onOpen?: () => void}} props */
function PetCard({ pet, onCompare, compared = false, href, onOpen }) {
  return (
    <article className="rw-petcard rw-petcard-v6">
      <div className="rw-petcard-top">
        <span className="rw-number">
          No. {String(pet.number ?? "—").padStart(3, "0")}
        </span>
        {onCompare && (
          <button
            className={"rw-card-compare " + (compared ? "active" : "")}
            onClick={() => onCompare(pet.slug)}
            title={compared ? "移出对比" : "加入对比"}
            aria-label={(compared ? "移出对比：" : "加入对比：") + pet.name}
            aria-pressed={compared}
          >
            {compared ? <Check size={14} /> : <GitCompareArrows size={14} />}
            <span>{compared ? "已选" : "对比"}</span>
          </button>
        )}
      </div>
      <MagicCostBadge pet={pet} />
      <Link to={href || petDetailHref(pet)} className="rw-petcard-main" onClick={(event) => {
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onOpen?.();
      }}>
        <PetPortrait pet={pet} />
        <h3>{pet.name}</h3>
        <div className="rw-petcard-types">
          {pet.types.map((t) => (
            <AttributeBadge key={t} type={t} />
          ))}
        </div>
      </Link>
    </article>
  );
}

function SkillKind({ category }) {
  return (
    <span
      className={
        "rw-skillkind " +
        ({ 物理: "physical", 魔法: "magic", 变化: "status" }[category] || "")
      }
    >
      <span>
        {category === "变化" ? "变" : category === "魔法" ? "魔" : "物"}
      </span>
      {category}
    </span>
  );
}

function SkillTable({
  items = skills,
  compact = false,
  petContext = null,
}) {
  return (
    <div className="rw-table-scroll" data-no-editor>
      <table
        className={"rw-table rw-skill-table " + (compact ? "compact" : "")}
      >
        <thead>
          <tr>
            <th>技能</th>
            <th>类别</th>
            <th>威力</th>
            <th>PP</th>
            <th>先手</th>
            <th>技能描述</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.slug}>
              <td>
                <div className="rw-skill-name-top-v7">
                  <Link
                    className="rw-entity-link"
                    to={
                      skillDetailHref(s) +
                      (petContext
                        ? (s.localEntry ? "&pet=" : "?pet=") + encodeURIComponent(petContext)
                        : "")
                    }
                  >
                    {s.name}
                  </Link>
                </div>
                <small>
                  <AttributeBadge type={s.type} />
                </small>
              </td>
              <td>
                <SkillKind category={s.category} />
              </td>
              <td className="rw-num">{s.power ?? "—"}</td>
              <td className="rw-num">{s.pp}</td>
              <td className="rw-num rw-priority">
                {!Number.isFinite(s.priority)
                  ? "待核"
                  : s.priority > 0
                    ? "+" + s.priority
                    : s.priority}
              </td>
              <td>
                <span className="rw-cell-summary"><EntityText text={s.summary} path={skillDetailHref(s)} /></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { AttributeBadge, MagicCostBadge, PetPortrait, PetAppearanceGallery, PetCard, SkillKind, SkillTable };
