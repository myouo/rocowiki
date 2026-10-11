/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
module.exports = {
  mechanicsSidebar: [
    "mechanics/overview",
    {
      type: "category",
      label: "基础与行动",
      collapsed: false,
      items: [
        "mechanics/attributes",
        "mechanics/priority",
        "mechanics/accuracy",
        "mechanics/stages",
        "mechanics/timing",
      ],
    },
    {
      type: "category",
      label: "伤害与治疗",
      collapsed: true,
      items: ["mechanics/damage", "mechanics/shield", "mechanics/healing"],
    },
    {
      type: "category",
      label: "资源与限制",
      collapsed: true,
      items: ["mechanics/pp", "mechanics/effects/pressure"],
    },
    {
      type: "category",
      label: "状态与效果",
      collapsed: false,
      items: [
        "mechanics/effects",
        "mechanics/interactions",
        "mechanics/status",
        "mechanics/passive",
      ],
    },
    {
      type: "category",
      label: "战场与换宠",
      collapsed: true,
      items: [
        "mechanics/weather",
        "mechanics/environments/mirage",
        "mechanics/switching",
      ],
    },
    {
      type: "category",
      label: "查证与术语",
      collapsed: true,
      items: ["mechanics/evidence", "mechanics/glossary"],
    },
  ],
  guidesSidebar: [
    "guides/returning",
    {
      type: "category",
      label: "培养与挑战",
      collapsed: false,
      items: ["guides/training", "guides/pve"],
    },
  ],
  helpSidebar: ["help/contributing"],
};
