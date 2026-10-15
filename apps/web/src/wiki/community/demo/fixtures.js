

const TASKS = [
  {
    id: "skill-hit",
    title: "把「条件必中」的触发条件写清楚",
    target: "灵火之杖",
    section: "效果与触发条件",
    mode: "skill",
    record: "branch-2",
    returnTo: "/skills/2907/#effects",
    tag: "机制核验",
    detail: "分别记录基础信息、触发条件与例外，并提供能复现的出处。",
    priority: "待核验",
  },
  {
    id: "pet-source",
    title: "为解析补充能追溯的原始出处",
    target: "海芙约忒",
    section: "对位 Counter",
    mode: "matchup",
    record: "haifu-stone-20240215",
    returnTo: "/pets/3092/#matchups",
    tag: "来源整理",
    detail: "把结论与公告、原始对战记录相连，标明时间或具体回合。",
    priority: "缺少来源",
  },
  {
    id: "priority-record",
    title: "完善先手与速度的核验记录",
    target: "速度与先手",
    section: "实测记录至少包含什么",
    mode: "article",
    returnTo: "/mechanics/priority/#section-3",
    tag: "实测补充",
    detail: "写明技能先手、双方速度、场上状态与结算过程，保留来源和适用条件。",
    priority: "待核验",
  },
];

function makeSeed() {
  const before = "## 资料记录\n触发条件、结算顺序与例外情况待补充。";
  const after =
    "## 资料记录\n- 触发条件：逐条填写，并附可定位的出处。\n- 结算顺序：对照原始对战记录核验。\n- 例外情况：区分已复现结论与待验证猜测。\n\n> 这是编辑流程示例，不是已确认的游戏机制。";
  return {
    version: 1,
    profile: { nickname: "", bio: "", avatar: "dimo", uuid: "", uid: "" },
    drafts: [],
    claimedTasks: [],
    submissions: [
      {
        id: "demo-001",
        isExample: true,
        target: "海芙约忒",
        section: "机制解析",
        type: "markdown",
        fields: { trigger: "", effect: "", limits: "" },
        markdown: after,
        summary: "演示：把待补充的机制说明拆成可核验的记录项目。",
        evidenceUrl: "https://roco.qq.com/",
        evidenceNote:
          "此链接仅演示证据入口。正式投稿需要具体公告、原始日志或能定位到回合的记录。",
        before,
        after,
        baseVersion: "demo-r17",
        status: "pending",
        author: "演示贡献者",
        submittedAt: "",
        updatedAt: "",
        revisionCount: 1,
        reviewNote: "",
        events: [
          { label: "示例投稿已创建", at: "", note: "仅用于体验本地审核流程。" },
        ],
      },
    ],
  };
}

const HISTORY_SEED = [
  {
    id: "demo-r17",
    title: "示例修订 17",
    at: "示例日期 · 10 月 08 日",
    author: "机制核验示例",
    summary: "统一未验证内容的标记，并补充来源定位要求。",
    body: "## 资料记录\n触发条件、结算顺序与例外情况待补充。\n\n## 核验方式\n引用原始出处时，注明可定位的段落、时间或回合。\n尚未复现的现象标为「待验证」。",
    source: "https://roco.qq.com/",
    sourceNote: "演示入口：正式修订需关联原始公告或对战记录。",
  },
  {
    id: "demo-r16",
    title: "示例修订 16",
    at: "示例日期 · 10 月 06 日",
    author: "资料整理示例",
    summary: "增加原始出处的记录要求。",
    body: "## 资料记录\n触发条件、结算顺序与例外情况待补充。\n\n## 核验方式\n引用原始出处时，注明对应的公告或对战记录。",
    source: "https://roco.qq.com/",
    sourceNote: "演示链接，不代表这条修订已经发生。",
  },
  {
    id: "demo-r15",
    title: "示例修订 15",
    at: "示例日期 · 10 月 04 日",
    author: "页面整理示例",
    summary: "建立资料记录章节，待后续贡献者补充。",
    body: "## 资料记录\n触发条件与结算顺序待补充。",
    source: "",
    sourceNote: "结构调整示例，不含已确认的游戏结论。",
  },
];

export { TASKS, makeSeed, HISTORY_SEED };
