import React, {useEffect} from "react";
import {useHistory} from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";
import Link from "@docusaurus/Link";
import catalog from "../../generated/catalog.json";
import {formalWorkspaceHref, registeredEditTarget} from "./policy";

/** No local state is mounted on a formal account/edit/review route. */
export default function ServerWorkflowRoute({path, query}) {
  const history = useHistory();
  const request = Object.fromEntries(query || []);
  const tab = path === "/account/" ? "account" : path === "/review/" ? "review" : "edit";
  const page = registeredEditTarget(catalog.pages, request);
  const canEnter = ["/account/", "/review/"].includes(path) || path === "/edit/" && page;
  const destination = useBaseUrl(formalWorkspaceHref(catalog.pages, request, tab));
  useEffect(() => { if (canEnter) history.replace(destination); }, [canEnter, destination, history]);
  return <section className="cm-paper">
    <h1>{canEnter ? "打开共建工作台" : "参与资料维护"}</h1>
    <p>{canEnter ? "工作台使用正式账号、私有草稿和审核队列。" : path === "/history/" ? "正式修订以已发布内容的 Git 历史与来源记录为准。" : "这份资料尚未登记为正式投稿对象。你可以先查看已开放的共建条目。"}</p>
    <Link className="rw-button primary" to={destination}>进入共建工作台</Link>
    <Link className="rw-textlink" to="/wiki/guides/contributing/">阅读投稿规范</Link>
  </section>;
}
