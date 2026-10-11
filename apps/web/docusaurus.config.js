const fs = require("node:fs");
const path = require("node:path");
const baseUrl = process.env.WIKI_BASE_URL || "/";
const runtime = require('./config/runtime.cjs').resolveRuntimeConfig(process.env);

/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: "RocoWiki",
  tagline: "洛克王国页游 · 玩家共建资料库",
  url: runtime.url,
  customFields: {
    apiOrigin: runtime.apiOrigin,
    workspaceMode: runtime.workspaceMode,
    workspaceModeExplicit: runtime.workspaceModeExplicit,
    githubUrl: `https://github.com/${process.env.GITHUB_REPOSITORY || 'myouo/rocowiki'}`,
  },
  baseUrl,
  staticDirectories: fs.existsSync(path.join(__dirname, "static"))
    ? ["static"]
    : [],
  trailingSlash: true,
  onBrokenLinks: "throw",
  onDuplicateRoutes: "throw",
  i18n: { defaultLocale: "zh-Hans", locales: ["zh-Hans"] },
  presets: [
    [
      "classic",
      {
        docs: {
          path: "docs",
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl: ({ docPath }) => {
            const snapshots = require("./content/published-docs-v7.json").documents;
            const doc = snapshots.find((entry) => entry.sourceFile === `docs/${docPath}`);
            const params = new URLSearchParams({
              entity: doc?.title || docPath,
              section: "条目正文",
              mode: "article",
              returnTo: doc?.path || "/help/",
            });
            return `${baseUrl}edit/?${params}`;
          },
          breadcrumbs: false,
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
        },
        blog: false,
        theme: { customCss: require.resolve("./src/css/custom.css") },
        sitemap: { changefreq: "weekly" },
      },
    ],
  ],
  plugins: [require.resolve("./plugins/wiki-routes"), ["@docusaurus/plugin-content-docs", {
    id: "community", path: "docs-generated", routeBasePath: "wiki",
    sidebarPath: false, breadcrumbs: false,
  }]],
  markdown: {
    hooks: { onBrokenMarkdownLinks: "throw" },
  },
  themeConfig: {
    metadata: [
      {
        name: "description",
        content: "面向洛克王国页游的宠物、技能、血脉、活动、对战与冒险资料。",
      },
      { name: "theme-color", content: "#f6f4f0" },
    ],
    colorMode: {
      defaultMode: "light",
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "RocoWiki",
      hideOnScroll: false,
      items: [
        { to: "/pets/", label: "宠物图鉴", position: "left" },
        { to: "/skills/", label: "技能与血脉", position: "left" },
        { to: "/mechanics/", label: "战斗机制", position: "left" },
        { to: "/events/", label: "活动与获取", position: "left" },
        { to: "/battle/", label: "PVP 对战", position: "left" },
        { to: "/pve/", label: "PVE 指南", position: "left" },
        { to: "/help/contributing/", label: "贡献指南", position: "right" },
        { to: "/account/", label: "个人中心", position: "right" },
      ],
    },
    docs: {
      sidebar: { hideable: true, autoCollapseCategories: false },
    },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 2 },
    footer: {
      style: "light",
      links: [
        {
          title: "资料索引",
          items: [
            { label: "宠物图鉴", to: "/pets/" },
            { label: "技能资料", to: "/skills/" },
            { label: "洛克大陆", to: "/adventure/" },
          ],
        },
        {
          title: "共同维护",
          items: [
            { label: "贡献与修订", to: "/community/" },
            { label: "编辑指南", to: "/help/contributing/" },
            { label: "版权与许可 / Copyright", to: "/copyright/" },
          ],
        },
      ],
      copyright:
        "RocoWiki · 玩家共建的洛克王国页游资料库 · 游戏及相关素材权利归原权利人所有。",
    },
  },
};
