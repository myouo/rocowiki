import { Castle, Cloud, GraduationCap, Mountain, Snowflake, Waves } from "lucide-react";
import { SOURCES } from "./components.jsx";

const PLACE_DETAILS = {
  castle: {
    intro: "查找城堡内的场景、王国人物与相关事务。",
    path: ["大地图", "王国城堡"],
    entrance: "在大地图中选择王国城堡；城堡大厅属于该地区内的子场景。",
    scenes: ["王国城堡", "城堡大厅", "城堡露台", "宴会厅"],
    focus: "人物与王国事务",
    service: "兰斯洛的所在地区；城堡大厅中可查找麦斯威尔相关资料。",
    source: SOURCES.npcs,
  },
  academy: {
    intro: "沿教学楼、图书馆与课程场景查找学院人物和任务。",
    path: ["大地图", "魔法学院"],
    entrance:
      "从魔法学院进入教学楼，可查找格里芬院长；其他学院场景在下方分开列出。",
    scenes: ["魔法学院", "教学楼", "图书馆", "魔法课教室", "宠物训练室"],
    focus: "教学楼与学院人物",
    service:
      "格里芬院长、杰瑞西、菲尔特的出场地点收录为教学楼；爱德华对应图书馆。",
    source: SOURCES.npcs,
  },
  "mermaid-bay": {
    intro: "从海湾查到海洋研究院，再确认前往浅海与深海的条件。",
    path: ["大地图", "人鱼湾"],
    entrance:
      "页游位置资料提醒，探索海底前需学会辟水咒。已收录路线从人鱼湾进入海洋研究院，经潜艇前往杰诺斯浅海，再通过漩涡抵达深海；资料也记有区域地图直达入口。",
    scenes: ["人鱼湾", "海洋研究院", "杰诺斯浅海", "杰诺斯深海"],
    focus: "海域入口",
    service: "海湾入口和海底场景分开记录，查找深海地点时可先确认所在子场景。",
    source: SOURCES.sea,
  },
  "snow-valley": {
    intro: "按冰雪地区的子场景查找探索与宠物资料。",
    path: ["大地图", "雪人谷"],
    entrance:
      "已有页游地图资料列出雪人谷与怀特冰川的地区关系。最新的场景入口截图与解锁条件待补。",
    scenes: ["雪人谷", "怀特冰川"],
    focus: "冰雪场景",
    service: "场景目录已建立，捕捉分布、等级与出没条件尚未逐项核验。",
    source: SOURCES.maps,
  },
  "xuan-yu": {
    intro: "查找玄玉地区的场景、人物线索与相关活动。",
    path: ["大地图", "玄玉岛"],
    entrance:
      "本条目先收录玄玉岛与云烟桃源的场景目录；具体点击路径及前置任务待补。",
    scenes: ["玄玉岛", "云烟桃源"],
    focus: "玄玉地区场景",
    service: "场景目录参考已有页游资料整理。人物的具体出现条件需要随任务记录。",
    source: null,
  },
  sky: {
    intro: "将天空城的地区入口、御风术与后续场景放在一起查阅。",
    path: ["大地图", "天空城"],
    entrance:
      "天空城探索与御风术有关。旧版资料记载了御风术课程及光之藤、风铃岛等场景；当前课程入口与解锁条件待复核。",
    scenes: ["天空城", "光之藤", "风铃岛", "漂浮宫殿"],
    focus: "御风术与空中场景",
    service:
      "御风术课程的历史资料可查；徽章挑战的配置和逐步流程另列在任务资料中。",
    source: SOURCES.flight,
  },
};

const PLACE_VISUALS = {
  castle: {Icon: Castle, tone: "amber"},
  academy: {Icon: GraduationCap, tone: "violet"},
  "mermaid-bay": {Icon: Waves, tone: "blue"},
  "snow-valley": {Icon: Snowflake, tone: "blue"},
  "xuan-yu": {Icon: Mountain, tone: "rose"},
  sky: {Icon: Cloud, tone: "teal"},
};

export { PLACE_DETAILS, PLACE_VISUALS };
