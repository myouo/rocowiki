import React, { useEffect, useId, useRef, useState } from "react";
import { ThumbsDown, ThumbsUp, UsersRound } from "lucide-react";
import { useWikiRuntime } from "./runtime/useWikiRuntime";
import {
  COUNTER_VOTE_KEY,
  COUNTER_VISITOR_KEY,
  COUNTER_VOTE_EVENT,
  emptyCounterVotes,
  normalizeCounterVotes,
  counterClaimKey,
  counterVoter,
  counterVoteSummary,
  toggleCounterVote,
  adoptVisitorCounterVotes,
} from "./counterVoteState";

function DemoCounterVotes({
  petSlug,
  record,
  authenticatedUserId = null,
}) {
  const helpId = useId();
  const target = counterClaimKey(petSlug, record);
  const [state, setState] = useState(emptyCounterVotes);
  const [voter, setVoter] = useState(null);
  const [message, setMessage] = useState("");
  const [storageNote, setStorageNote] = useState("");
  const current = useRef(state);
  const writable = useRef(true);
  useEffect(() => setMessage(""), [target]);

  useEffect(() => {
    let guestId = null;
    let next = emptyCounterVotes();
    try {
      const storedGuest = window.localStorage.getItem(COUNTER_VISITOR_KEY);
      if (storedGuest && /^guest:[A-Za-z0-9._~-]{1,100}$/.test(storedGuest))
        guestId = storedGuest;
      const raw = window.localStorage.getItem(COUNTER_VOTE_KEY);
      if (raw) next = normalizeCounterVotes(JSON.parse(raw));
    } catch {
      setStorageNote("本机记录暂时无法读取，当前仍可投票。");
    }
    if (!guestId) {
      const random =
        globalThis.crypto?.randomUUID?.() ||
        `v${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      guestId = "guest:" + random;
      try {
        window.localStorage.setItem(COUNTER_VISITOR_KEY, guestId);
      } catch {
        writable.current = false;
        setStorageNote("本次投票暂存于当前会话，刷新后可能丢失。");
      }
    }
    const identity = counterVoter({ authenticatedUserId, guestId });
    if (authenticatedUserId) {
      next = adoptVisitorCounterVotes(next, guestId, identity);
      try {
        window.localStorage.setItem(COUNTER_VOTE_KEY, JSON.stringify(next));
      } catch {
        writable.current = false;
        setStorageNote("本次投票暂存于当前会话，刷新后可能丢失。");
      }
    }
    current.current = next;
    setState(next);
    setVoter(identity);

    const sync = (event) => {
      if (event.type === "storage" && event.key !== COUNTER_VOTE_KEY) return;
      try {
        const value =
          event.type === COUNTER_VOTE_EVENT
            ? event.detail
            : JSON.parse(event.newValue || "null");
        const normalized = normalizeCounterVotes(value);
        current.current = normalized;
        setState(normalized);
      } catch {
        setStorageNote("另一个页面的本机记录无法读取，已保留当前投票。");
      }
    };
    window.addEventListener("storage", sync);
    window.addEventListener(COUNTER_VOTE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(COUNTER_VOTE_EVENT, sync);
    };
  }, [authenticatedUserId]);

  const summary = counterVoteSummary(state, target, voter);
  function vote(choice) {
    if (!voter) return;
    let before = current.current;
    if (writable.current) {
      try {
        const raw = window.localStorage.getItem(COUNTER_VOTE_KEY);
        if (raw) before = normalizeCounterVotes(JSON.parse(raw));
      } catch {
        // A broken disk value cannot destroy the still usable in-memory ballot.
      }
    }
    const previous = counterVoteSummary(before, target, voter).choice;
    const next = toggleCounterVote(before, target, voter, choice);
    current.current = next;
    setState(next);
    try {
      window.localStorage.setItem(COUNTER_VOTE_KEY, JSON.stringify(next));
      writable.current = true;
      setStorageNote("");
    } catch {
      writable.current = false;
      setStorageNote("本次投票暂存于当前会话，刷新后可能丢失。");
    }
    window.dispatchEvent(
      new window.CustomEvent(COUNTER_VOTE_EVENT, { detail: next }),
    );
    setMessage(
      previous === choice
        ? "已撤销投票。"
        : choice === 1
          ? "已支持这条对位结论，可再次点击撤销。"
          : "已表示不支持，可再次点击撤销。",
    );
  }

  return (
    <div className="rw-counter-vote-v7" data-claim-key={target}>
      <div className="rw-counter-vote-main-v7">
        <div
          className="rw-counter-vote-buttons-v7"
          role="group"
          aria-label="你是否支持这条对位结论"
          aria-describedby={helpId}
        >
          <button
            type="button"
            className={summary.choice === 1 ? "is-support" : ""}
            aria-pressed={summary.choice === 1}
            disabled={!voter}
            onClick={() => vote(1)}
          >
            <ThumbsUp size={15} />
            支持 <b>{summary.support}</b>
          </button>
          <button
            type="button"
            className={summary.choice === -1 ? "is-oppose" : ""}
            aria-pressed={summary.choice === -1}
            disabled={!voter}
            onClick={() => vote(-1)}
          >
            <ThumbsDown size={15} />
            不支持 <b>{summary.oppose}</b>
          </button>
        </div>
        <div className="rw-counter-vote-rate-v7">
          {summary.total ? (
            <>
              <strong>{summary.supportRate}%</strong>
              <span>支持率 · {summary.total} 票</span>
            </>
          ) : (
            <>
              <UsersRound size={16} />
              <span>暂无投票</span>
            </>
          )}
        </div>
      </div>
      {summary.total > 0 && (
        <div className="rw-counter-vote-track-v7" aria-hidden="true">
          <span style={{ width: summary.supportRate + "%" }} />
        </div>
      )}
      <p id={helpId} className="rw-counter-vote-help-v7">
        {authenticatedUserId ? "账户" : "访客"}可参与 · 本机体验数据 ·
        仅针对上述出场情形、双方血脉与结论版本。支持率表示意见，不代表已验证胜率。
      </p>
      <p
        className="rw-counter-vote-message-v7"
        role="status"
        aria-live="polite"
      >
        {storageNote || message}
      </p>
    </div>
  );
}

export default function CounterVotes(props) {
  const {demo} = useWikiRuntime();
  return demo ? <DemoCounterVotes {...props} /> : <p className="rw-counter-vote-help-v7">公共投票尚未开放，结论请以来源与实测条件为依据。</p>;
}
