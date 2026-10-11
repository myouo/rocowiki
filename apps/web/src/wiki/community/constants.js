

const STORAGE_KEY = "roco-wiki-v4:community";

const BOOKMARKS_KEY = "roco-wiki-v4:bookmarks";

const KNOWN_STATUSES = new Set([
  "pending",
  "changes_requested",
  "approved",
  "conflict",
  "merged",
  "building",
  "build_failed",
  "built",
  "published",
]);

const STATUS = {
  pending: { label: "待审核", tone: "amber" },
  changes_requested: { label: "需修改", tone: "red" },
  approved: { label: "审核通过 · 待合并", tone: "green" },
  conflict: { label: "上游有冲突", tone: "red" },
  merged: { label: "已合并 · 待构建", tone: "green" },
  building: { label: "构建中", tone: "blue" },
  build_failed: { label: "构建失败", tone: "red" },
  built: { label: "构建完成 · 待发布", tone: "blue" },
  published: { label: "已上线 · 本地演示", tone: "green" },
};

export { STORAGE_KEY, BOOKMARKS_KEY, KNOWN_STATUSES, STATUS };
