import { EntityText } from "../../EntityReference";
import { petDetailHref } from "../../catalogPublished";
import EditEntry from "../../editing/EditEntry";
import React from "react";
import { CalendarDays, ExternalLink } from "lucide-react";
import { Badge, TextLink } from "../../core";
import { externalSource, petMeta } from "../model.js";
import { useCatalogPublishedRecords } from "../hooks.js";

function AcquisitionTimeline({ pet }) {
  const meta = petMeta(pet);
  const published = useCatalogPublishedRecords(
    pet,
    "acquisition",
    meta.acquisitionHistory || [],
  );
  const records = [...published.records].sort((a, b) =>
    String(b.startDate || "").localeCompare(String(a.startDate || "")),
  );
  return (
    <div className="rw-acquisition-v6">
      <div className="rw-section-intro-v6">
        <p>每次开放各留一条记录，返场不会覆盖上一次的时间与条件。</p>
        <TextLink to="/events/">查看活动</TextLink>
      </div>
      {published.revision && (
        <p className="rw-catalog-local-revision-v7">
          正在阅读本机已发布修订 ·{" "}
          {published.publishedAt?.slice(0, 10) || "本次会话"}
        </p>
      )}
      {records.length ? (
        <ol className="rw-acquisition-timeline-v6">
          {records.map((record) => (
            <li key={record.id}>
              <div className="rw-acquisition-dates-v6">
                {record.startDate ? (
                  <time dateTime={record.startDate}>
                    {record.startDate.replaceAll("-", ".")}
                  </time>
                ) : (
                  <strong>开始日期待补</strong>
                )}
                <span>
                  {record.endDate ? (
                    <>
                      至{" "}
                      <time dateTime={record.endDate}>
                        {record.endDate.replaceAll("-", ".")}
                      </time>
                    </>
                  ) : (
                    "起 · 截止日期未记录"
                  )}
                </span>
              </div>
              <div className="rw-acquisition-entry-v6">
                <div className="rw-acquisition-title-v6">
                  <h3>{record.title}</h3>
                  <Badge>{record.kind}</Badge>
                  <EditEntry
                    entity={pet.name}
                    section="获取时间线"
                    mode="acquisition"
                    returnTo={petDetailHref(pet) + "#acquire"}
                    record={record.id}
                    label="编辑这次获取"
                  />
                </div>
                <p><EntityText text={record.method} path={petDetailHref(pet)} /></p>
                <dl>
                  <div>
                    <dt>地点</dt>
                    <dd><EntityText text={record.place} path={petDetailHref(pet)} /></dd>
                  </div>
                  <div>
                    <dt>条件</dt>
                    <dd><EntityText text={record.conditions} path={petDetailHref(pet)} /></dd>
                  </div>
                  <div>
                    <dt>获得</dt>
                    <dd><EntityText text={record.reward || "具体奖励待补"} path={petDetailHref(pet)} /></dd>
                  </div>
                </dl>
                <a
                  href={externalSource(record.sourceUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {record.sourceLabel}
                  <ExternalLink size={12} />
                </a>
                <span className="rw-history-evidence-v6">
                  {record.evidence}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="rw-history-empty-v6">
          <CalendarDays size={23} />
          <div>
            <h3>带日期的获取记录待补</h3>
            <p>
              {meta.undatedAcquisition
                ? `现有来源记载“${meta.undatedAcquisition}”，未注明完整开放日期。`
                : "尚未找到可核对的活动起止时间。"}
            </p>
            <a href={pet.sourceUrl} target="_blank" rel="noreferrer">
              查看现有来源
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}
      <EditEntry
        entity={pet.name}
        section="获取时间线"
        mode="acquisition"
        returnTo={petDetailHref(pet) + "#acquire"}
        intent="add"
        label="新增一次获取或返场"
      />
    </div>
  );
}

export { AcquisitionTimeline };
