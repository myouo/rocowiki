import {useMemo} from "react";
import {useDemoSubmissions} from "../community/useDemoSubmissions";
import React, { useEffect, useState } from "react";
import { ArrowRight, BookOpen, ExternalLink, Users } from "lucide-react";
import { Link, PageHeader, Section, Badge, Notice, EmptyState, Contribution, TextLink, DocGrid, DataPair, BookmarkButton } from "../core";
import { places, npcs } from "../data";
import Select from "../Select";
import EditEntry from "../editing/EditEntry";
import DirectoryPanel, { DirectorySearch } from "../DirectoryPanel";
import { COMMUNITY_STORAGE_KEY } from "../editing/registry";
import { NPC_DETAILS } from "../npcPresentation";
import { AdventureNav, MissingInline, SOURCES, SourceLine, Trail, WorldNotFound, useWorldQuery } from "./components.jsx";

function npcText(value) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).slice(0, 12000)
    : Array.isArray(value)
      ? value
          .filter((part) => typeof part === "string")
          .join("；")
          .slice(0, 12000)
      : "";
}

function safeSource(value) {
  const text = npcText(value).trim();
  return /^https?:\/\//i.test(text) ? text : "";
}

function npcDirectoryFrom(workspace) {
  const known = npcs.map((npc) => ({
    ...npc,
    profile: { ...NPC_DETAILS[npc.slug] },
    to: `/npcs/${npc.slug}/`,
  }));
  const local = new globalThis.Map();
  const submissions = Array.isArray(workspace?.submissions)
    ? workspace.submissions
    : [];
  const published = submissions
    .filter(
      (row) =>
        row &&
        row.status === "published" &&
        row.editorVersion === 7 &&
        row.editorMode === "npc" &&
        row.typedData &&
        typeof row.typedData === "object" &&
        !Array.isArray(row.typedData),
    )
    .sort((a, b) =>
      String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")),
    )
    .slice(-500);
  for (const row of published) {
    const data = Object.fromEntries(
      Object.entries(row.typedData)
        .filter(([key]) =>
          [
            "name",
            "slug",
            "aliases",
            "location",
            "role",
            "intro",
            "services",
            "relatedTasks",
            "sourceUrl",
            "sourceTitle",
          ].includes(key),
        )
        .map(([key, value]) => [key, npcText(value)]),
    );
    if (!data.name.trim()) continue;
    const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug || "")
      ? data.slug
      : "";
    const originalSlug = String(row.editorRequest?.returnTo || "").match(
      /^\/npcs\/([^/?#]+)\//,
    )?.[1];
    const existing = known.find(
      (npc) =>
        npc.slug === originalSlug ||
        (npc.slug === slug && row.editorRequest?.intent !== "add"),
    );
    const mappedPlace = places.find(
      (place) =>
        place.name === data.location ||
        place.slug === data.location ||
        data.location?.startsWith(`${place.name} · `),
    );
    const scene =
      mappedPlace && data.location?.startsWith(`${mappedPlace.name} · `)
        ? data.location.slice(mappedPlace.name.length + 3)
        : data.location;
    const profile = {
      ...(existing?.profile || {}),
      identity: data.role || existing?.profile?.identity || "身份待补充",
      scene: scene || existing?.profile?.scene || "地点待补充",
      description: data.intro || existing?.profile?.description || "简介待补充",
      services: data.services || "服务待补充",
      serviceNote: data.relatedTasks || "任务关联待补充",
    };
    const patch = {
      name: data.name,
      aliases: data.aliases,
      role:
        mappedPlace?.name || data.location || existing?.role || "地点待补充",
      place: mappedPlace?.slug || (data.location ? null : existing?.place),
      profile,
      localRevision: true,
      submissionId: npcText(row.id),
      editedAt: npcText(row.updatedAt),
      sourceUrl: safeSource(data.sourceUrl),
      sourceTitle: data.sourceTitle || "本次修订来源",
      typedData: data,
    };
    if (existing) Object.assign(existing, patch);
    else {
      const key = slug || npcText(row.id);
      if (!key) continue;
      local.set(key, {
        ...patch,
        slug: slug || key,
        entryKey: key,
        localOnly: true,
        to: `/npcs/?entry=${encodeURIComponent(key)}`,
      });
    }
  }
  return [...known, ...local.values()];
}

function useNpcDirectory() { const submissions=useDemoSubmissions(); return useMemo(()=>npcDirectoryFrom({submissions}),[submissions]); }

function LocalNpcDetail({ npc }) {
  const profile = npc.profile;
  return (
    <div className="wa-page wv7-local-npc">
      <PageHeader
        title={npc.name}
        eyebrow="本机新条目"
        description={profile.identity}
        back="/npcs/"
        crumbs={[{ label: "人物与NPC", to: "/npcs/" }, { label: npc.name }]}
        edit={{
          entity: npc.name,
          section: "人物条目",
          mode: "npc",
          record: npc.entryKey,
          returnTo: npc.to,
        }}
      />
      <Notice title="本机新条目 · 尚未同步到线上">
        这份人物资料已在当前浏览器完成审核。正式发布并完成构建后，地址将为{" "}
        <code>{`/npcs/${npc.slug}/`}</code>。当前通过人物目录中的本机入口查看。
      </Notice>
      <Section
        title="人物资料"
        id="local-npc-profile"
        edit={{
          entity: npc.name,
          section: "人物条目",
          mode: "npc",
          record: npc.entryKey,
          returnTo: npc.to,
        }}
      >
        <div className="wa-person-profile">
          <span className="wa-person-symbol">
            <Users size={34} />
          </span>
          <div>
            <h2>{profile.identity}</h2>
            <p>{profile.description}</p>
          </div>
        </div>
        <dl className="wa-facts">
          <DataPair label="姓名" value={npc.name} />
          <DataPair label="别名" value={npc.aliases || "未填写"} />
          <DataPair
            label="出现地点"
            value={npc.typedData.location || profile.scene}
          />
        </dl>
      </Section>
      <Section
        title="任务与服务"
        id="local-npc-services"
        edit={{
          entity: npc.name,
          section: "人物条目",
          mode: "npc",
          record: npc.entryKey,
          returnTo: npc.to,
        }}
      >
        <h3>提供的服务</h3>
        <p className="wv7-multiline">{profile.services}</p>
        <h3>关联任务</h3>
        <p className="wv7-multiline">{profile.serviceNote}</p>
      </Section>
      <Section
        title="资料依据"
        id="local-npc-source"
        edit={{
          entity: npc.name,
          section: "人物条目",
          mode: "npc",
          record: npc.entryKey,
          returnTo: npc.to,
        }}
      >
        {npc.sourceUrl ? (
          <a href={npc.sourceUrl} target="_blank" rel="noreferrer">
            {npc.sourceTitle} <ExternalLink size={13} />
          </a>
        ) : (
          <p>来源链接待补充。</p>
        )}
        <p className="wa-small">
          本机修订时间：
          {npc.editedAt
            ? npc.editedAt.replace("T", " ").slice(0, 19)
            : "待补充"}
        </p>
      </Section>
    </div>
  );
}

function NpcIndex({ query }) {
  const update = useWorldQuery(query),
    q = (query.get("q") || "").trim(),
    area = query.get("area") || "all";
  const directory = useNpcDirectory();
  const rows = directory.filter(
    (npc) =>
      (!q ||
        [
          npc.name,
          npc.role,
          npc.profile?.identity,
          npc.profile?.scene,
          npc.aliases,
        ]
          .join(" ")
          .includes(q)) &&
      (area === "all" || npc.place === area),
  );
  const selectedEntry = query.get("entry");
  const localEntry = directory.find(
    (npc) =>
      npc.localOnly &&
      (npc.entryKey === selectedEntry || npc.submissionId === selectedEntry),
  );
  if (localEntry) return <LocalNpcDetail npc={localEntry} />;
  return (
    <div className="wa-page">
      <PageHeader
        title="人物与NPC"
        actions={
          <EditEntry
            entity="人物与NPC"
            section="人物条目"
            mode="npc"
            intent="add"
            returnTo="/npcs/"
            label="新增人物条目"
            variant="primary"
          />
        }
        description="按姓名、身份或地点查找人物，任务与服务在人物页中集中记录。"
        crumbs={[
          { label: "首页", to: "/" },
          { label: "冒险资料", to: "/adventure/" },
          { label: "人物" },
        ]}
      />
      <AdventureNav current="/npcs/" />
      <DirectoryPanel directory="npcs" title="人物目录" Icon={Users} tone="amber"
        summary={`${rows.length} 条匹配 · ${directory.length} 位已收录${directory.some(npc => npc.localOnly) ? " · 含本机新条目" : ""}`}
        search={<DirectorySearch
        query={query}
        onSubmit={(value) => update({ q: value })}
        placeholder="姓名、身份或地点"
        label="搜索人物"
        extra={
          <Select
            ariaLabel="按地区筛选人物"
            value={area}
            options={[
              { value: "all", label: "全部地区" },
              { value: "academy", label: "魔法学院" },
              { value: "castle", label: "王国城堡" },
            ]}
            onChange={(value) => update({ area: value })}
          />
        }
      />}>
      {selectedEntry && !localEntry && (
        <Notice title="本机条目未找到">
          这个入口属于创建它的浏览器。你可以继续查看已收录的人物，或从本机投稿记录恢复资料。
        </Notice>
      )}
      <div className="wa-table-wrap rw-directory-table" role="region" aria-label="人物目录表格" tabIndex={0}>
        <table className="wa-table">
          <thead>
            <tr>
              <th>人物</th>
              <th>身份</th>
              <th>所在场景</th>
              <th>资料</th>
              <th>参与完善</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((npc) => {
              const detail = npc.profile;
              return (
                <tr
                  key={`${npc.localOnly ? "local" : "published"}-${npc.slug}`}
                >
                  <td>
                    <Link className="wa-title-link" to={npc.to}>
                      {npc.name}
                    </Link>
                    {npc.localOnly ? (
                      <Badge tone="amber">本机新条目</Badge>
                    ) : npc.localRevision ? (
                      <small>本机已发布修订</small>
                    ) : null}
                  </td>
                  <td>{detail?.identity || "待核实"}</td>
                  <td>
                    {npc.place ? (
                      <Link to={"/places/" + npc.place + "/"}>{npc.role}</Link>
                    ) : (
                      <span>{npc.role}</span>
                    )}
                    <small>
                      {detail?.scene !== npc.role
                        ? detail?.scene
                        : "地区主场景"}
                    </small>
                  </td>
                  <td>
                    <Link to={npc.to}>
                      位置与任务 <ArrowRight size={13} />
                    </Link>
                  </td>
                  <td>
                    <EditEntry
                      entity={npc.name}
                      section="人物条目"
                      mode="npc"
                      returnTo={npc.to}
                      record={npc.localOnly ? npc.entryKey : undefined}
                      label="编辑人物"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <EmptyState
          action={
            <Link to="/npcs/" className="rw-button">
              清除筛选
            </Link>
          }
        >
          当前人物索引中没有匹配项，不代表游戏中不存在该人物。
        </EmptyState>
      )}
      </DirectoryPanel>
      <SourceLine source={SOURCES.npcs} note="位置与身份的历史资料" />
      <Contribution entity="人物与NPC索引" source={SOURCES.npcs.url} />
    </div>
  );
}

function NpcDetail({ slug }) {
  const directory = useNpcDirectory();
  const npc = directory.find((item) => item.slug === slug && !item.localOnly),
    detail = npc?.profile;
  const source =
    npc?.localRevision && npc.sourceUrl
      ? {
          url: npc.sourceUrl,
          label: npc.sourceTitle,
          date: npc.editedAt.slice(0, 10),
        }
      : SOURCES.npcs;
  if (!npc || !detail) return <WorldNotFound kind="人物" back="/npcs/" />;
  return (
    <div className="wa-page">
      <PageHeader
        title={npc.name}
        eyebrow="人物资料"
        description={detail.identity}
        back="/npcs/"
        crumbs={[
          { label: "冒险资料", to: "/adventure/" },
          { label: "人物", to: "/npcs/" },
          { label: npc.name },
        ]}
        actions={
          <BookmarkButton
            id={"npc-" + slug}
            title={npc.name}
            href={"/npcs/" + slug + "/"}
            kind="人物"
          />
        }
      />
      {npc.localRevision && (
        <Notice title="本机已发布修订">
          当前展示本浏览器审核后的新版人物资料，线上站点未发生变化。
        </Notice>
      )}
      <DocGrid
        toc={[
          ["npc-location", "出现地点"],
          ["npc-services", "任务与服务"],
          ["npc-sources", "资料来源"],
        ]}
      >
        <div className="wa-person-profile">
          <div className="wa-person-symbol">
            <Users size={36} />
          </div>
          <div>
            <span className="wa-kicker">人物档案</span>
            <h2>{detail.identity}</h2>
            <p>{detail.description}</p>
          </div>
        </div>
        <Section title="出现地点" id="npc-location">
          <dl className="wa-facts">
            <DataPair
              label="所属地区"
              value={
                npc.place ? (
                  <Link to={"/places/" + npc.place + "/"}>{npc.role}</Link>
                ) : (
                  npc.role
                )
              }
            />
            <DataPair label="具体场景" value={detail.scene} />
            <DataPair label="特殊出现条件" value="尚未收录" />
          </dl>
          <Trail
            items={
              npc.role === detail.scene
                ? ["大地图", npc.role]
                : ["大地图", npc.role, detail.scene]
            }
          />
          {npc.place && (
            <TextLink to={"/places/" + npc.place + "/"}>
              查看地区与子场景
            </TextLink>
          )}
        </Section>
        <Section title="任务与服务" id="npc-services">
          <div className="wa-service-row">
            <BookOpen size={21} />
            <div>
              <h3 className="wv7-multiline">{detail.services}</h3>
              <p className="wv7-multiline">{detail.serviceNote}</p>
            </div>
            <Badge>{npc.localRevision ? "本机修订" : "待补充"}</Badge>
          </div>
          {!npc.localRevision && (
            <MissingInline
              title="尚未收录完整任务记录"
              entity={npc.name + " · 任务与服务"}
            >
              补充时请注明任务名、触发条件、对话位置、奖励与适用时间。
            </MissingInline>
          )}
          <TextLink to="/tasks/">查任务与剧情</TextLink>
        </Section>
        <Section title="资料来源" id="npc-sources">
          <SourceLine source={source} />
          <p className="wa-small">
            当前条目提供人物定位；任务与服务更新需要对应的游戏内依据。
          </p>
        </Section>
        <Contribution entity={npc.name} source={source.url} />
      </DocGrid>
    </div>
  );
}

export { NpcIndex, NpcDetail };
