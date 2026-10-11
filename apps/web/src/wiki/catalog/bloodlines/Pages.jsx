import { bloodlineDetailHref, resolveCatalogBloodlines, getBloodlineArticleSnapshot } from "../../catalogBloodlines";
import EditEntry from "../../editing/EditEntry";
import ReadingMarkdown from "../../editing/ReadingMarkdown";
import { petMetadata } from "../../content/bundled.js";
import React from "react";
import { useHistory, useLocation } from "@docusaurus/router";
import { Search, ArrowRight, BookOpen, ExternalLink, Layers, Dna } from "lucide-react";
import { Link, PageHeader, Section, Notice, EmptyState, Contribution, TextLink, Subnav, setQuery } from "../../core";
import { haifuSource } from "../../data";
import { useCatalogSubmissions, usePublishedPets } from "../hooks.js";
import { PetPortrait } from "../components.jsx";
import { externalSource } from "../model.js";

function BloodlinePage({ detail = false }) {
  const publishedPets = usePublishedPets();
  const location = useLocation(), history = useHistory();
  const query = new URLSearchParams(location.search);
  const bloodlineRows = resolveCatalogBloodlines({ pets: publishedPets, metadata: petMetadata });
  const selectedName = query.get("entry");
  if (!detail && selectedName) return <BloodlineEntryPage bloodline={bloodlineRows.find((row) => row.name === selectedName)} requestedName={selectedName} />;
  const haifuMetadata = petMetadata.pets.haifu;
  return (
    <>
      <PageHeader
        title={detail ? "海芙约忒 · 血脉与专属资源" : "血脉资料"}
        eyebrow={!detail ? "BLOODLINE REFERENCE" : null}
        description={detail ? "把被动、专属资源与技能联动放在同一个上下文里。" : "按血脉查规则，再查看可选宠物与技能联动。"}
        back={detail ? "/bloodlines/" : null}
        crumbs={
          detail
            ? [{ label: "血脉资料", to: "/bloodlines/" }, { label: "海芙约忒" }]
            : []
        }
      />
      {!detail ? (
        <>
          <Subnav
            current="/bloodlines/"
            items={[
              ["/skills/", "技能查询"],
              ["/bloodlines/", "血脉资料"],
            ]}
          />
          <div className="rw-bloodline-index-toolbar-v72">
            <label className="rw-input-icon"><Search size={17} /><input value={query.get("q") || ""} aria-label="搜索血脉名称或关联宠物" placeholder="血脉名称 / 关联宠物" onChange={(event) => setQuery(history, location, { q: event.target.value })} /></label>
            <span>已收录 <b>{bloodlineRows.length}</b> 种血脉</span>
          </div>
          <div className="rw-bloodline-grid-v72">
            {bloodlineRows.filter((row) => !query.get("q") || (row.name + " " + row.owners.map((pet) => pet.name).join(" ")).includes(query.get("q"))).map((row, index) => <article className={"rw-bloodline-card-v72 tone-" + index % 4} key={row.name}>
              <Link className="rw-bloodline-card-main-v72" to={row.href}><span className="rw-bloodline-symbol-v72"><Dna size={23} /></span><div><small>血脉条目</small><h2>{row.name}</h2></div><ArrowRight size={17} /></Link>
              <div className="rw-bloodline-owners-v72"><span>已收录可选宠物</span>{row.owners.map((pet) => <Link key={pet.slug} to={pet.href}><PetPortrait pet={pet} />{pet.name}</Link>)}</div>
              <p>名称与持有关系已收录 · 触发与数值逐项核验</p>
            </article>)}
          </div>
          {query.get("q") && !bloodlineRows.some((row) => (row.name + " " + row.owners.map((pet) => pet.name).join(" ")).includes(query.get("q"))) && <EmptyState title="未找到对应血脉" action={<button className="rw-button" onClick={() => setQuery(history, location, { q: null })}>清除搜索</button>}>未收录不等于游戏中不存在。</EmptyState>}
          <Notice title="先补准确的关系，再扩充数量">
            血脉名称、持有者、资源上限、获得与消耗方式、换宠及阵亡后是否保留，分别核验。
          </Notice>
        </>
      ) : (
        <>
          <Notice title="已收录血脉名称与持有关系" tone="gold">
            {haifuMetadata.bloodlines.join("、")}
            已有资料出处；资源阈值、触发时点与技能联动仍需逐项核验。
            <a
              href={haifuMetadata.fieldSources.bloodlines}
              target="_blank"
              rel="noreferrer"
            >
              查看名称来源 ↗
            </a>
          </Notice>
          <Section title="资源与技能的关系" id="skill-relations" edit={{mode: "article", entity: "海芙约忒 · 血脉与专属资源", section: "资源与技能的关系", returnTo: "/bloodlines/haifu/#skill-relations"}}>
            <div className="rw-table-scroll">
              <table className="rw-table">
                <thead>
                  <tr>
                    <th>概念</th>
                    <th>已知关联</th>
                    <th>仍需核对</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>怒气</td>
                    <td>
                      <Link to="/skills/yuanyun/">渊云点墨</Link>、
                      <Link to="/skills/feixing/">飞星浮渡</Link>
                    </td>
                    <td>初始值、上限、获得/消耗时点</td>
                  </tr>
                  <tr>
                    <td>战意</td>
                    <td>
                      <Link to="/skills/yuanyun/">满额资源条件</Link>
                    </td>
                    <td>持续、重置与其他相互作用</td>
                  </tr>
                  <tr>
                    <td>乘胜</td>
                    <td>
                      <Link to="/skills/feixing/">飞星浮渡的命中条件</Link>
                    </td>
                    <td>状态来源、持续与解除</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>
          <div className="rw-two-cols">
            <Notice title="血脉与普通被动分开">
              免疫、技能携带被动与可选择血脉不是同一个数据字段。
            </Notice>
            <Notice title="选择需要保留上下文">
              将来比较不同血脉时，同步展示受影响的技能，不只更换一个名称。
            </Notice>
          </div>
          <TextLink to="/pets/haifu/">查看海芙约忒图鉴</TextLink>
        </>
      )}
      <Contribution
        entity={detail ? "海芙约忒血脉" : "血脉资料"}
        source={haifuSource}
      />
    </>
  );
}

function BloodlineEntryPage({ bloodline, requestedName }) {
  const submissions = useCatalogSubmissions();
  const articleContext = { entity: bloodline?.name || requestedName, section: "血脉效果", mode: "article", returnTo: bloodlineDetailHref(bloodline?.name || requestedName) + "#effects" };
  const snapshot = getBloodlineArticleSnapshot(articleContext, { submissions });
  const sources = [...(bloodline?.sources || [])];
  if (externalSource(snapshot?.sourceUrl) && !sources.some((source) => source.url === snapshot.sourceUrl)) sources.unshift({ name: "本次修订来源", url: snapshot.sourceUrl });
  if (!bloodline) return <><PageHeader title="血脉资料待收录" back="/bloodlines/" edit={false} /><EmptyState title={requestedName + "尚无已收录条目"} action={<TextLink to="/bloodlines/">返回血脉资料</TextLink>}>请先核对名称及宠物的可选血脉。</EmptyState></>;
  return <div className="rw-bloodline-detail-v72">
    <PageHeader title={bloodline.name} description="核对这条血脉的持有关系、效果条件与关联资料。" back="/bloodlines/" edit={false} actions={<EditEntry {...articleContext} label="编辑血脉效果" />} crumbs={[{ label: "血脉资料", to: "/bloodlines/" }, { label: bloodline.name }]} />
    <Section title="可选宠物" id="holders" edit={false}>
      <div className="rw-bloodline-holders-v72">{bloodline.owners.map((pet) => <article key={pet.slug}><Link to={pet.href}><PetPortrait pet={pet} /><div><h3>{pet.name}</h3><p>{pet.metadata.bloodlines.join(" / ")}</p></div><ArrowRight size={16} /></Link><EditEntry entity={pet.name} section="基础资料" mode="pet" record={pet.slug} returnTo={pet.href + "#bloodline"} label="编辑持有关系" /></article>)}</div>
      <p className="rw-subnote">这里列出宠物可选择的血脉。具体 Counter 的本场配置，应在对位记录内分别填写。</p>
    </Section>
    <Section title="血脉效果" id="effects" edit={false} aside={<EditEntry {...articleContext} label={snapshot?.markdown ? "编辑效果" : "补充效果解析"} />}>
      {snapshot?.publishedRevision && <p className="rw-catalog-local-revision-v7">正在阅读本机已发布的血脉效果 · {snapshot.publishedAt?.slice(0, 10)}</p>}
      {snapshot?.markdown ? <ReadingMarkdown markdown={snapshot.markdown} context={articleContext} editHeadings={false} /> : <Notice title="触发条件与完整数值待核验" tone="gold">已收录名称和持有关系；尚未把来源中的血脉效果拆分为可核对的条件记录。请查看对应原文，不从宠物的其他被动推定血脉效果。</Notice>}
      <div className="rw-bloodline-source-links-v72">{sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><BookOpen size={17} /><span>{source.name || bloodline.name} · 原始资料</span><ExternalLink size={14} /></a>)}</div>
      {bloodline.owners.some((pet) => pet.slug === "haifu") && <Link className="rw-bloodline-related-v72" to="/bloodlines/haifu/"><Layers size={22} /><div><strong>海芙约忒的血脉与专属资源</strong><p>联合查看怒气、战意、乘胜及关联技能，具体阈值仍需逐项核对。</p></div><ArrowRight size={17} /></Link>}
    </Section>
    <Contribution entity={bloodline.name} source={bloodline.sources[0]?.url} />
  </div>;
}

export { BloodlinePage };
