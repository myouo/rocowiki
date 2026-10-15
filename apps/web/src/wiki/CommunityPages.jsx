import React from "react";
import "./CommunityPages.css";
import SectionEditor from "./editing/SectionEditor";
import { useWorkspace } from "./community/useDemoWorkspace.js";
import { queryValue } from "./community/navigation.js";
import { PrototypeNote, StatusBadge } from "./community/components.jsx";
import { Community } from "./community/OverviewPage.jsx";
import { Account } from "./community/AccountPage.jsx";
import { DiffViewer, MarkdownPreview } from "./community/DiffPreview.jsx";
import { Editor } from "./community/demo/LegacyEditor.jsx";
import { Review } from "./community/demo/ReviewPage.jsx";
import { HistoryPage } from "./community/demo/HistoryPage.jsx";
import { useWikiRuntime } from "./runtime/useWikiRuntime";
import ServerWorkflowRoute from "./runtime/ServerWorkflowRoute";
import RequireRole from "./auth/RequireRole";
import AccountCenter from "../features/account/AccountCenter";
import PublicHistoryPage from "../features/history/HistoryPage";
import {getSearchRecords} from './data';

function DemoCommunityPages({ path = "/community/", query }) {
  const state = useWorkspace();
  const requestedSubmission = state.workspace.submissions.find((row) => row.id === queryValue(query, "submission"));
  const legacyEditor = queryValue(query, "legacy") === "1" || (requestedSubmission && requestedSubmission.editorVersion !== 7);
  let content;
  if (path.startsWith("/account/"))
    content = <Account {...state} query={query} />;
  else if (path.startsWith("/edit/"))
    content = legacyEditor ? (
      <Editor
        key={`${queryValue(query, "entity", "海芙约忒")}:${queryValue(query, "section", "机制解析")}:${queryValue(query, "submission")}`}
        {...state}
        query={query}
      />
    ) : (
      <SectionEditor
        key={`${queryValue(query, "entity")}:${queryValue(query, "section")}:${queryValue(query, "mode")}:${queryValue(query, "record")}:${queryValue(query, "intent")}:${queryValue(query, "action")}:${queryValue(query, "submission")}`}
        {...state}
        query={query}
        DiffViewer={DiffViewer}
        MarkdownPreview={MarkdownPreview}
        StatusBadge={StatusBadge}
      />
    );
  else if (path.startsWith("/review/"))
    content = <Review {...state} query={query} />;
  else if (path.startsWith("/history/"))
    content = <HistoryPage {...state} query={query} />;
  else content = <Community {...state} />;
  return (
    <div className="cm-root">
      <PrototypeNote storageError={state.storageError} />
      {content}
    </div>
  );
}

export default function CommunityPages(props) {
  const {demo} = useWikiRuntime();
  const request=props.path==='/history/'?Object.fromEntries(props.query||[]):{},record=request.entity&&!request.page&&!request.from?getSearchRecords().find(row=>row.title===request.entity):null;
  const content = !demo&&props.path==='/history/' ? <PublicHistoryPage target={request.page||request.from||record?.to||'/'} title={String(request.entity||record?.title||'首页').slice(0,150)}/> : demo ? <DemoCommunityPages {...props} /> : props.path === "/account/" ? <AccountCenter /> : <ServerWorkflowRoute {...props} />;
  return ["/edit/", "/review/"].includes(props.path) ? <RequireRole review={props.path === "/review/"}>{content}</RequireRole> : content;
}
