import React from "react";
import Link from "@docusaurus/Link";
import "./CopyrightPage.css";

type Section = { id: string; title: string; paragraphs: string[] };
type Notice = { title: string; intro: string; sections: Section[] };

const notices: Record<"zh" | "en", Notice> = {
  zh: {
    title: "版权与许可",
    intro: "RocoWiki 是玩家共建的非官方百科，不代表游戏运营方，也不表示获得其赞助或认可。",
    sections: [
      { id: "code", title: "代码与第三方软件", paragraphs: ["本项目有权许可的原创代码和仓库规范文档采用 GPL-3.0-only，版权由相应作者或其他权利人保留。分发代码须遵守 GPLv3，包括保留声明及提供对应源码。第三方软件继续使用各自许可，本地 Noto 字体使用 OFL-1.1。"] },
      { id: "prose", title: "Wiki 正文与作者", paragraphs: ["有权授权的原创正文、攻略和研究记录采用 CC BY-SA 4.0，版权由相应作者或其他权利人保留。投稿、审核、GitHub 署名和积分记录不构成版权转让；修订记录不表示某一用户拥有整篇文章。", "允许复制、转载、改编和商业使用。分享时须合理署名，保留提供的版权、来源与许可信息，链接许可并标注修改、保留先前修改说明；分享改编作品须按许可要求以相同方式共享。不得增加限制这些权利的条款或技术措施。", "获有效授权后，许可人不能对遵守条款的使用者单方面撤销许可。关闭账号、撤销 GitHub 邮箱署名授权或停止展示文章不等于撤回已经授予的 CC 许可。依法无需授权的使用仍然适用法律规定。"] },
      { id: "assets", title: "游戏素材、商标与引用", paragraphs: ["游戏图片、截图、美术、角色及标识的相关权利归原权利人所有；游戏名称与商标权仍由其权利人保留。引用和转载保留作者、出处及原许可，不因进入本站而变成 GPL。", "标注来源、公开可访问、非营利或用于学习交流，本身都不等于获得授权。当前游戏图片已记录来源，再分发权限仍待核验；公开发行前须确认、替换或移除。"] },
      { id: "contributing", title: "投稿与转载", paragraphs: ["只提交你有权许可的资料，区分引用与自己的总结，并记录出处和授权依据。不要整篇搬运未经授权的攻略、移除水印或为第三方素材自行标注开放许可。", "转载署名建议包含文章标题、条目提供的作者或修订记录、原文和版本链接、CC BY-SA 4.0 链接，以及修改说明。不要求公开 GitHub 邮箱，也不得暗示原作者认可转载者。", "正式投稿的许可确认尚未启用，开放投稿前须记录作者明确同意。已有作品和导入资料以有效授权为准，不因这次政策自动改为 CC；游戏素材与第三方引用须单独标记许可范围。"] },
      { id: "rights-reports", title: "版权问题处理", paragraphs: ["版权联系渠道尚未配置，正式上线前将公布可实际接收通知的私密渠道。当前本机演示的页面反馈不会送达维护者；安全漏洞报告渠道不用于版权投诉。", "渠道启用后，请提供涉及的页面或文件位置、原作品及权利关系说明、期望的处理方式和可回复的联系方式。请勿在公开页面上传身份证件或其他敏感证明。维护者将核对来源与授权，必要时限制展示、联系投稿者，并移除或替换缺乏可用授权的内容。"] },
    ],
  },
  en: {
    title: "Copyright and licensing",
    intro: "RocoWiki is an unofficial encyclopedia maintained by players. It does not represent the game operator or imply its sponsorship or endorsement.",
    sections: [
      { id: "code", title: "Code and third-party software", paragraphs: ["Original code and repository policy documents the project can license use GPL-3.0-only. Relevant authors or other rights holders retain copyright. Distributing code requires compliance with GPLv3, including retained notices and corresponding source. Third-party software retains its own licenses; local Noto fonts use OFL-1.1."] },
      { id: "prose", title: "Wiki prose and authors", paragraphs: ["Original prose, guides and research notes that can be licensed use CC BY-SA 4.0. Relevant authors or other rights holders retain copyright. Submitting, reviewing, GitHub attribution and points records do not transfer copyright. Revision histories do not imply that one user owns the entire article.", "Copying, redistribution, adaptation and commercial use are allowed. When sharing, provide reasonable attribution, retain supplied copyright, source and license information, link the license, indicate changes and retain previous modification notices. Share adaptations under the license's ShareAlike requirements. Do not add terms or technical measures restricting these rights.", "Once validly granted, the license cannot be unilaterally revoked for users complying with its terms. Account closure, withdrawn GitHub email attribution consent or stopping article display does not revoke existing CC permission. Uses lawful without permission remain governed by applicable law."] },
      { id: "assets", title: "Game assets, trademarks and quotations", paragraphs: ["Relevant rights in game images, screenshots, artwork, characters and marks remain with their holders, as do game-name and trademark rights. Preserve authors, sources and original licenses for quotations and reproductions; entering this site does not make them GPL.", "Attribution, public availability, nonprofit status or educational use does not itself grant permission. Current game images have provenance records, but redistribution permission remains unverified. Confirm permission, replace or remove them before public distribution."] },
      { id: "contributing", title: "Contributing and reuse", paragraphs: ["Submit only material you have authority to license. Distinguish quotations from your summaries, and record sources and permission. Do not copy entire guides without permission, remove watermarks or assign open licenses to third-party assets.", "Suggested attribution includes the title, supplied authors or revision history, source and version links, a CC BY-SA 4.0 link and modification details. Public GitHub email disclosure is not required; do not imply the author's endorsement.", "Formal submission-license confirmation is not enabled yet; explicit author consent must be recorded before contributions open. Existing and imported material follows its valid permission and is not automatically relicensed by this policy. Mark the license scope separately for game assets and third-party quotations."] },
      { id: "rights-reports", title: "Rights concerns", paragraphs: ["A copyright contact channel is pending. A private channel capable of receiving notices will be published before launch. Local demo feedback does not reach maintainers; security vulnerability reporting is not for copyright complaints.", "Once the channel is available, identify the affected page or file, the original work and relationship to its rights, your requested resolution and a reply contact. Do not post identity documents or other sensitive evidence publicly. Maintainers will verify provenance and permission, restrict display when needed, contact contributors and remove or replace material lacking applicable permission."] },
    ],
  },
};

export default function CopyrightPage({ english = false }: { english?: boolean }) {
  const notice = notices[english ? "en" : "zh"];
  return (
    <article className="rw-legal" lang={english ? "en" : "zh-CN"} data-no-editor>
      <header className="rw-legal-heading">
        <span className="rw-eyebrow">COPYRIGHT &amp; LICENSING</span>
        <h1>{notice.title}</h1>
        <p>{notice.intro}</p>
        <nav aria-label={english ? "Statement language" : "声明语言"}>
          <Link to="/copyright/" hrefLang="zh-CN" aria-current={!english ? "page" : undefined}>中文</Link>
          <Link to="/copyright/en/" hrefLang="en" aria-current={english ? "page" : undefined}>English</Link>
        </nav>
      </header>
      <div className="rw-legal-sections">
        {notice.sections.map(section => (
          <section key={section.id} aria-labelledby={section.id}>
            <h2 id={section.id}>{section.title}</h2>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            {section.id === "prose" && <a rel="license" href={english ? "https://creativecommons.org/licenses/by-sa/4.0/" : "https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hans"}>{english ? "Read the CC BY-SA 4.0 license" : "阅读 CC BY-SA 4.0 许可"}</a>}
          </section>
        ))}
      </div>
      <p className="rw-legal-reference">
        {english ? "References: " : "参考："}
        <a href="https://www.gnu.org/licenses/gpl-3.0.html">GNU GPLv3</a>
        {" · "}<a href="https://www.wipo.int/en/web/copyright/faq-copyright">WIPO {english ? "copyright FAQ" : "版权问答"}</a>
      </p>
    </article>
  );
}
