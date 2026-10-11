import {useEffect, useState} from "react";
import {readDemoWorkspace, subscribeDemoWorkspace} from "./workspaceRepository";
import {useWikiRuntime} from "../runtime/useWikiRuntime";
const EMPTY = Object.freeze([]);

/** Local overlays are a demo capability, never an input to a production reader. */
export function useDemoSubmissions() {
  const {demo} = useWikiRuntime();
  const [submissions, setSubmissions] = useState(EMPTY);
  useEffect(() => {
    if (!demo) { setSubmissions(EMPTY); return; }
    const refresh = () => {
      try { setSubmissions(readDemoWorkspace()?.submissions || []); }
      catch { /* Retain the last usable view when stored JSON is damaged. */ }
    };
    refresh();
    return subscribeDemoWorkspace(refresh);
  }, [demo]);
  return demo ? submissions : EMPTY;
}
