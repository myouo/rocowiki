import CounterVotes from "../../CounterVotes";
import CounterBloodlineSides from "../../CounterBloodlineSides";
import { EntityText } from "../../EntityReference";
import { counterClaimKey } from "../../counterVoteState";
import { petDetailHref } from "../../catalogPublished";
import EditEntry from "../../editing/EditEntry";
import React, { useState } from "react";
import { Swords, ExternalLink, Clock, Info, CornerDownRight, Flag, UsersRound } from "lucide-react";
import { Link } from "../../core";
import { skills } from "../../data";
import { externalSource, petMeta } from "../model.js";
import { useCatalogPublishedRecords, usePublishedPets } from "../hooks.js";
import { PetPortrait } from "../components.jsx";

const counterScenes = [
  {
    value: "lead-together",
    label: "同起",
    Icon: UsersRound,
    description: "双方同时起手；记录初始精力、状态与先手。",
  },
  {
    value: "switch-in",
    label: "后上拦截",
    Icon: CornerDownRight,
    description: "我方后上，尝试拦截已在场的对手。",
  },
  {
    value: "already-active",
    label: "先在场",
    Icon: Flag,
    description: "我方已在场，应对随后登场的对手。",
  },
  {
    value: "unspecified",
    label: "出场情形待补",
    Icon: Info,
    description: "来源未说明出场顺序，不能套用其他情形。",
  },
];

function counterSceneDescription(petName, record) {
  const scene = counterScenes.some((entry) => entry.value === record.scene)
    ? record.scene
    : "unspecified";
  if (record.sceneDirection && record.sceneDirectionFor === scene)
    return record.sceneDirection;
  const opponent = record.opponent || "对手";
  if (scene === "lead-together")
    return `${petName}与${opponent}同起；按记录的初始状态判断。`;
  if (scene === "switch-in") return `${petName}后上，拦截已在场的${opponent}。`;
  if (scene === "already-active")
    return `${petName}先在场，应对随后上场的${opponent}。`;
  return "出场顺序尚未注明；同起、后上拦截与先在场不能互相套用。";
}

function PetMatchups({ pet }) {
  const pets = usePublishedPets();
  const [scene, setScene] = useState("");
  const published = useCatalogPublishedRecords(
    pet,
    "matchup",
    petMeta(pet).matchups?.pvp || [],
  );
  const records = published.records.map((record) => ({
    ...record,
    conditions: Array.isArray(record.conditions)
      ? record.conditions
      : String(record.conditions || "")
          .split(/\r?\n/)
          .filter(Boolean),
    relatedSkills: Array.isArray(record.relatedSkills)
      ? record.relatedSkills
      : [],
  }));
  const shown = records.filter(
    (record) => !scene || (record.scene || "unspecified") === scene,
  );
  return (
    <div className="rw-matchups-v7">
      <div className="rw-matchup-intro-v7">
        <div>
          <h3>
            <Swords size={19} /> PVP · 对位条件
          </h3>
          <p>
            以下“我方”均指<strong>{pet.name}</strong>
            。先看出场情形，再核对配招、场地和双方状态。
          </p>
        </div>
        <EditEntry
          entity={pet.name}
          section="对位 Counter"
          mode="matchup"
          returnTo={petDetailHref(pet) + "#matchups"}
          intent="add"
          label="新增对位记录"
        />
      </div>
      {published.revision && (
        <p className="rw-catalog-local-revision-v7">
          正在阅读本机已发布修订 ·{" "}
          {published.publishedAt?.slice(0, 10) || "本次会话"} ·
          对位条件修订后单独统计支持率
        </p>
      )}
      <div
        className="rw-counter-scenes-v7"
        role="group"
        aria-label="按当前宠物的出场情形筛选对位"
      >
        <button
          type="button"
          className={!scene ? "active" : ""}
          aria-pressed={!scene}
          onClick={() => setScene("")}
        >
          全部 <b>{records.length}</b>
        </button>
        {counterScenes.map(({ value, label, Icon }) => (
          <button
            type="button"
            key={value}
            className={scene === value ? "active" : ""}
            aria-pressed={scene === value}
            onClick={() => setScene(scene === value ? "" : value)}
          >
            <Icon size={14} />
            {label}
            <b>
              {
                records.filter(
                  (record) => (record.scene || "unspecified") === value,
                ).length
              }
            </b>
          </button>
        ))}
      </div>
      <dl className="rw-counter-scene-guide-v7">
        {counterScenes
          .slice(0, 3)
          .map(({ value, label, Icon, description }) => (
            <div key={value}>
              <dt>
                <Icon size={14} />
                {label}
              </dt>
              <dd>{description}</dd>
            </div>
          ))}
      </dl>
      {shown.length ? (
        <div className="rw-matchup-list-v7">
          {shown.map((record) => {
            const currentScene =
              counterScenes.find((entry) => entry.value === record.scene) ||
              counterScenes[3];
            const opponent = pets.find(
              (candidate) => candidate.slug === record.opponentSlug,
            );
            return (
              <article className="rw-matchup-card-v7" key={record.id}>
                <div className="rw-matchup-card-top-v7">
                  <span
                    className={
                      "rw-counter-scene-badge-v7 " + currentScene.value
                    }
                  >
                    <currentScene.Icon size={14} />
                    {currentScene.label}
                  </span>
                  <EditEntry
                    entity={pet.name}
                    section="对位 Counter"
                    mode="matchup"
                    returnTo={petDetailHref(pet) + "#matchups"}
                    record={record.id}
                    label="编辑对位"
                  />
                </div>
                <div className="rw-matchup-opponent-v7">
                  {opponent ? (
                    <PetPortrait pet={opponent} size="small" />
                  ) : (
                    <span className="rw-counter-opponent-placeholder-v7">
                      <Swords size={25} />
                    </span>
                  )}
                  <div>
                    <span>对手</span>
                    <h4>
                      {record.opponentSlug ? (
                        <Link to={opponent ? petDetailHref(opponent) : "/pets/" + record.opponentSlug + "/"}>
                          {record.opponent}
                        </Link>
                      ) : (
                        record.opponent
                      )}
                    </h4>
                    <small>{record.direction}</small>
                  </div>
                </div>
                <p className="rw-counter-scene-direction-v7">
                  {counterSceneDescription(pet.name, record)}
                </p>
                <CounterBloodlineSides record={record} myName={pet.name} />
                <p className="rw-matchup-conclusion-v7"><EntityText text={record.conclusion} path={petDetailHref(pet)} /></p>
                <strong className="rw-matchup-label-v6">成立条件</strong>
                <ul>
                  {record.conditions.map((condition) => (
                    <li key={condition}><EntityText text={condition} path={petDetailHref(pet)} /></li>
                  ))}
                </ul>
                <div className="rw-matchup-skilllinks-v6">
                  {(record.relatedSkills || []).map((slug) => {
                    const skill = skills.find((entry) => entry.slug === slug);
                    return (
                      skill && (
                        <Link
                          key={slug}
                          to={"/skills/" + slug + "/?pet=" + pet.slug}
                        >
                          {skill.name}
                        </Link>
                      )
                    );
                  })}
                </div>
                <div className="rw-counter-record-meta-v7">
                  <Clock size={13} />
                  <span>资料日期 {record.recordedAt || "未注明"}</span>
                  <span>·</span>
                  <span title={"结论版本：" + (record.claimRevision || "r1")}>
                    结论{" "}
                    {record.claimRevision?.startsWith("local-")
                      ? "已修订"
                      : record.claimRevision || "r1"}
                  </span>
                  <span>·</span>
                  <span>
                    {record.testedAt
                      ? "复现于 " + record.testedAt
                      : "本站待复现"}
                  </span>
                </div>
                <details className="rw-counter-evidence-v7">
                  <summary>{record.evidenceLabel} · 查看依据与局限</summary>
                  <p>{record.limitations}</p>
                  <a
                    href={externalSource(record.sourceUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {record.sourceLabel}
                    <ExternalLink size={12} />
                  </a>
                </details>
                <CounterVotes
                  key={counterClaimKey(pet.slug, record)}
                  petSlug={pet.slug}
                  record={record}
                />
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rw-matchup-empty-v7">
          <Swords size={28} />
          <h4>{scene ? "这类出场情形还没有记录" : "还没有收录具体对位"}</h4>
          <p>
            写下对手、双方状态和成立条件，并附上对战记录。属性克制本身不能替代对位结论。
          </p>
          <EditEntry
            entity={pet.name}
            section="对位 Counter"
            mode="matchup"
            returnTo={petDetailHref(pet) + "#matchups"}
            intent="add"
            label="写下第一条对位记录"
          />
        </div>
      )}
    </div>
  );
}

export { counterScenes, counterSceneDescription, PetMatchups };
