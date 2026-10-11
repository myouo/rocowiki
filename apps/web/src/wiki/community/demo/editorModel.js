import { isHttpUrl, isMechanicsEntry } from "../navigation.js";

function defaultForm(target, section, submission = "") {
  return {
    target,
    section,
    type: isMechanicsEntry(target) ? "structured" : "markdown",
    fields: String(target).includes("效果关系")
      ? {
          trigger:
            "已有来源：\n新施加来源：\n宠物与形态：\n施加顺序：\n天气／环境与其他条件：",
          effect:
            "施加瞬间：待验证\n原效果到期／清除时：待验证\n换宠后：待验证",
          limits:
            "客户端版本／测试日期：\n复现步骤与对照组：\n反向施加是否测试：\n尚未验证的范围：",
        }
      : { trigger: "", effect: "", limits: "" },
    markdown: "",
    summary: "",
    evidenceUrl: "",
    evidenceNote: "",
    baseVersion: "demo-r17",
    revisesSubmissionId: submission,
  };
}

function baselineFor(type) {
  return type === "structured"
    ? "触发条件：待补充\n效果与结算：待补充\n限制与例外：待补充"
    : "## 资料记录\n触发条件、结算顺序与例外情况待补充。";
}

const UPSTREAM_REQUIREMENT = "来源要求：注明可定位的时间或回合数。";

function withUpstreamRequirement(content, type) {
  if (content.includes(UPSTREAM_REQUIREMENT)) return content;
  if (type === "structured" && /^限制与例外：/m.test(content))
    return content.replace(
      /^(限制与例外：.*)$/m,
      `$1；${UPSTREAM_REQUIREMENT}`,
    );
  return `${content}\n\n${UPSTREAM_REQUIREMENT}`;
}

function contentFor(form) {
  return form.type === "structured"
    ? `触发条件：${form.fields.trigger.trim() || "待补充"}\n效果与结算：${form.fields.effect.trim() || "待补充"}\n限制与例外：${form.fields.limits.trim() || "待补充"}`
    : form.markdown.trim();
}

function validateForm(form) {
  const errors = {};
  if (form.type === "structured") {
    if (form.fields.trigger.trim().length < 4)
      errors.trigger = "请说明触发条件，至少 4 个字符。";
    if (form.fields.effect.trim().length < 8)
      errors.effect = "请说明效果和结算，至少 8 个字符。";
  } else {
    if (form.markdown.trim().length < 16)
      errors.markdown = "请填写有效的修改正文，至少 16 个字符。";
    if (
      /<\/?[a-zA-Z][^>]*>|(^|\n)\s*(import|export)\s|javascript\s*:|data\s*:|\{\s*[^}]+\s*\}/im.test(
        form.markdown,
      )
    )
      errors.markdown =
        "正文仅支持受限 Markdown，请移除 HTML、MDX 表达式、脚本或模块语句。";
  }
  if (form.summary.trim().length < 8)
    errors.summary = "请写明具体改了什么，至少 8 个字符。";
  if (form.evidenceUrl.trim() && !isHttpUrl(form.evidenceUrl.trim()))
    errors.evidenceUrl = "请填写完整的 http:// 或 https:// 来源链接。";
  if (form.evidenceNote.trim().length < 12)
    errors.evidenceNote =
      "请说明如何核验证据，至少 12 个字符；有链接时也需定位到具体内容。";
  return errors;
}

function lineDiff(before, after) {
  const a = before.split("\n");
  const b = after.split("\n");
  // Cap the comparison matrix while preserving every line in unusually long drafts.
  if (a.length * b.length > 250000)
    return [
      ...a.map((text, index) => ({ type: "remove", text, old: index + 1 })),
      ...b.map((text, index) => ({ type: "add", text, next: index + 1 })),
    ];
  const dp = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const lines = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({ type: "same", text: a[i], old: i + 1, next: j + 1 });
      i++;
      j++;
    } else if (
      j < b.length &&
      (i === a.length || dp[i][j + 1] >= dp[i + 1][j])
    ) {
      lines.push({ type: "add", text: b[j], next: j + 1 });
      j++;
    } else {
      lines.push({ type: "remove", text: a[i], old: i + 1 });
      i++;
    }
  }
  return lines;
}

export { defaultForm, baselineFor, withUpstreamRequirement, contentFor, validateForm, lineDiff };
