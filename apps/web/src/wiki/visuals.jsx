import React from "react";
import {
  BookOpen,
  PawPrint,
  WandSparkles,
  Swords,
  CalendarDays,
  Compass,
  Map,
  UsersRound,
  Package,
  Flag,
  Calculator,
  NotebookPen,
  CircleUserRound,
  House,
  Castle,
  ScrollText,
  Shield,
  GitCompareArrows,
  Sparkles,
} from "lucide-react";

export const PAGE_VISUALS = {
  pets: { Icon: PawPrint, tone: "blue", label: "宠物图鉴" },
  skills: { Icon: WandSparkles, tone: "violet", label: "技能与血脉" },
  bloodlines: { Icon: Sparkles, tone: "rose", label: "血脉资料" },
  mechanics: { Icon: ScrollText, tone: "violet", label: "战斗机制" },
  events: { Icon: CalendarDays, tone: "amber", label: "活动与获取" },
  battle: { Icon: Swords, tone: "coral", label: "PVP 对战" },
  pve: { Icon: Castle, tone: "teal", label: "PVE 指南" },
  challenges: { Icon: Castle, tone: "teal", label: "PVE 指南" },
  adventure: { Icon: Compass, tone: "teal", label: "冒险资料" },
  places: { Icon: Map, tone: "teal", label: "地图与地区" },
  npcs: { Icon: UsersRound, tone: "amber", label: "人物与 NPC" },
  items: { Icon: Package, tone: "amber", label: "道具" },
  tasks: { Icon: Flag, tone: "coral", label: "任务与剧情" },
  tools: { Icon: Calculator, tone: "blue", label: "计算工具" },
  guides: { Icon: BookOpen, tone: "teal", label: "玩家指南" },
  help: { Icon: NotebookPen, tone: "coral", label: "贡献帮助" },
  community: { Icon: NotebookPen, tone: "coral", label: "参与共建" },
  account: { Icon: CircleUserRound, tone: "violet", label: "个人中心" },
  review: { Icon: Shield, tone: "blue", label: "修订审阅" },
  history: { Icon: GitCompareArrows, tone: "violet", label: "修订记录" },
  home: { Icon: House, tone: "blue", label: "首页" },
};
export function pageVisual(path = "") {
  return (
    PAGE_VISUALS[String(path).split("/").filter(Boolean)[0]] || {
      Icon: BookOpen,
      tone: "blue",
      label: "百科资料",
    }
  );
}
export function ColorIcon({ kind, Icon, tone, size = 22, className = "" }) {
  const visual = PAGE_VISUALS[kind] || PAGE_VISUALS.home;
  const Glyph = Icon || visual.Icon;
  return (
    <span
      aria-hidden="true"
      className={`rw-color-icon rw-tone-${tone || visual.tone} ${className}`}
    >
      <Glyph size={size} strokeWidth={1.75} />
    </span>
  );
}
