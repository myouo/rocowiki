import React, { useState } from "react";
import Link from "@docusaurus/Link";
import { ArrowRight, BookOpen, Check, ChevronRight, FileCheck2, FilePenLine, ListChecks, UsersRound } from "lucide-react";
import { editorHref as sectionEditHref } from "../editing/registry";
import { TASKS } from "./demo/fixtures.js";
import { articleHref } from "./navigation.js";
import { ContributionFooter, PageHeading, SectionHeading } from "./components.jsx";

function Community({ workspace, update }) {
  const [period, setPeriod] = useState("month");
  const [filter, setFilter] = useState("全部任务");
  const taskList = TASKS.filter(
    (t) => filter === "全部任务" || t.tag === filter,
  );
  const claimTask = (id) =>
    update((old) => ({
      ...old,
      claimedTasks: Array.from(new Set([...old.claimedTasks, id])),
    }));
  return (
    <>
      <PageHeading
        eyebrow="一起把资料写准确"
        title="贡献中心"
        description="从一个可核验的修正开始，让每条结论都有出处。"
        actions={
          <Link className="cm-button cm-button-primary" to="/account/">
            <FilePenLine size={16} />
            个人中心
          </Link>
        }
      />
      <div className="cm-community-intro">
        <div>
          <span className="cm-intro-number">01</span>
          <h3>找一处待完善内容</h3>
          <p>认领任务，或从词条内进入纠错。</p>
        </div>
        <div>
          <span className="cm-intro-number">02</span>
          <h3>说明修改与证据</h3>
          <p>保留条件、例外和资料适用日期。</p>
        </div>
        <div>
          <span className="cm-intro-number">03</span>
          <h3>经过审核后发布</h3>
          <p>审核、合并、构建和上线分别可追溯。</p>
        </div>
      </div>
      <div className="cm-community-grid">
        <section className="cm-paper cm-task-panel">
          <SectionHeading icon={ListChecks} title="待完善任务">
            <span className="cm-soft-label">任务为展示样例</span>
          </SectionHeading>
          <div className="cm-filter-row" role="group" aria-label="筛选贡献任务">
            {["全部任务", "机制核验", "来源整理", "时效核对"].map((item) => (
              <button
                type="button"
                key={item}
                className={filter === item ? "is-active" : ""}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="cm-task-list">
            {taskList.map((task) => (
              <article className="cm-task" key={task.id}>
                <div className="cm-task-kicker">
                  <span>{task.tag}</span>
                  <span className="cm-task-priority">
                    {workspace.claimedTasks.includes(task.id)
                      ? "已在本机认领"
                      : task.priority}
                  </span>
                </div>
                <h3>{task.title}</h3>
                <p>{task.detail}</p>
                <div className="cm-task-bottom">
                  <span>
                    {task.target}
                    <ChevronRight size={12} />
                    {task.section}
                  </span>
                  <Link
                    to={sectionEditHref({entity: task.target, section: task.section, mode: task.mode, record: task.record, returnTo: task.returnTo || articleHref(task.target)})}
                    onClick={() => claimTask(task.id)}
                  >
                    {workspace.claimedTasks.includes(task.id)
                      ? "继续编辑"
                      : "认领并编辑"}
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="cm-community-side">
          <section className="cm-paper cm-credit-panel">
            <SectionHeading icon={FileCheck2} title="怎样才算被采纳？" />
            <p>
              投稿审核通过后，还要合并到主仓库。
              <strong>贡献署名在合并后记入修订记录</strong>
              ，页面实际可见时间以上线状态为准。
            </p>
            <ol className="cm-credit-list">
              <li>
                <Check size={15} />
                <span>保留投稿者与每次修订的对应关系</span>
              </li>
              <li>
                <Check size={15} />
                <span>个人修订保留独立提交，采用普通合并</span>
              </li>
              <li>
                <Check size={15} />
                <span>绑定 GitHub 为可选项，署名须经本人授权</span>
              </li>
            </ol>
            <Link className="cm-inline-link" to="/review/">
              查看审核与发布流程
              <ArrowRight size={14} />
            </Link>
          </section>
          <section className="cm-paper cm-first-contribution">
            <h3>
              <BookOpen size={18} />
              第一次参与？
            </h3>
            <p>
              推荐从错字、失效链接和出处补充开始。游戏机制有争议时，先记录可复现的现象。
            </p>
            <Link to={sectionEditHref({entity: "海芙约忒", section: "获取时间线", mode: "acquisition", record: "haifu-20240705", returnTo: "/pets/haifu/#acquire"})}>
              试一次词条纠错
              <ArrowRight size={14} />
            </Link>
          </section>
        </aside>
      </div>
      <section className="cm-paper cm-contributors">
        <SectionHeading icon={UsersRound} title="贡献署名">
          <div className="cm-segmented" aria-label="署名时间范围">
            <button
              type="button"
              className={period === "month" ? "is-active" : ""}
              onClick={() => setPeriod("month")}
            >
              本月
            </button>
            <button
              type="button"
              className={period === "all" ? "is-active" : ""}
              onClick={() => setPeriod("all")}
            >
              全部
            </button>
          </div>
        </SectionHeading>
        <p className="cm-section-note">
          以下姓名、次数和排序均为演示数据，用于展示署名方式。
        </p>
        <div className="cm-table-scroll">
          <table className="cm-table">
            <thead>
              <tr>
                <th>贡献者</th>
                <th>主要参与</th>
                <th>已采纳修订 · 演示</th>
                <th>最近贡献 · 演示</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "资料整理示例",
                  "出处与历史资料",
                  period === "month" ? 18 : 62,
                  "为资料补齐原始来源",
                ],
                [
                  "机制核验示例",
                  "技能触发与结算",
                  period === "month" ? 12 : 48,
                  "补充分支条件的说明",
                ],
                [
                  "勘误维护示例",
                  "失效链接与错字",
                  period === "month" ? 7 : 31,
                  "修复无法访问的引用",
                ],
              ].map((row, index) => (
                <tr key={row[0]}>
                  <td>
                    <div className="cm-person">
                      <span className={`cm-avatar cm-avatar-${index}`}>
                        {row[0].slice(0, 1)}
                      </span>
                      <strong>{row[0]}</strong>
                    </div>
                  </td>
                  <td>{row[1]}</td>
                  <td className="cm-tabular">{row[2]}</td>
                  <td>{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <ContributionFooter />
    </>
  );
}

export { Community };
