import React from "react";
import { Check } from "lucide-react";

const STAGES = [
  ["pending", "投稿待审"],
  ["approved", "审核通过"],
  ["merged", "提交合并"],
  ["building", "执行构建"],
  ["built", "等待发布"],
  ["published", "正式上线"],
];

function stageIndex(status) {
  if (status === "changes_requested") return 0;
  if (status === "conflict") return 1;
  if (status === "build_failed") return 3;
  return Math.max(
    0,
    STAGES.findIndex(([id]) => id === status),
  );
}

function Pipeline({ status }) {
  const index = stageIndex(status);
  const blocked = ["changes_requested", "conflict", "build_failed"].includes(
    status,
  );
  return (
    <ol className="cm-pipeline" aria-label="本地投稿发布进度">
      {STAGES.map(([id, label], i) => (
        <li
          key={id}
          className={`${i < index || status === "published" ? "is-complete" : ""} ${i === index ? "is-current" : ""} ${i === index && blocked ? "is-blocked" : ""}`}
        >
          <span>
            {i < index || status === "published" ? <Check size={13} /> : i + 1}
          </span>
          <strong>{label}</strong>
          <small>
            {i === index && blocked
              ? "需要处理"
              : i < index
                ? "已完成"
                : i === index
                  ? status === "published"
                    ? "本地演示"
                    : "当前阶段"
                  : "尚未到达"}
          </small>
        </li>
      ))}
    </ol>
  );
}

export { Pipeline };
