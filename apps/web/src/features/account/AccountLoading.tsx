// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import {ShieldCheck} from 'lucide-react';

/** Reserve the account layout without displaying an assumed identity or balance. */
export default function AccountLoading() {
  return <div className="account-loading" aria-busy="true" aria-label="正在确认登录状态">
    <p className="account-loading-status" role="status"><ShieldCheck size={17} aria-hidden="true"/>正在确认登录状态<span>确认后加载你的个人资料与社区记录</span></p>
    <div aria-hidden="true">
      <div className="account-loading-identity">
        <span className="account-skeleton account-skeleton-avatar"/>
        <div className="account-loading-details"><span className="account-skeleton account-skeleton-name"/><span className="account-skeleton account-skeleton-tag"/><span className="account-skeleton account-skeleton-line"/></div>
      </div>
      <div className="account-loading-shell">
        <div className="account-loading-nav">{Array.from({length:7},(_,index)=><span className="account-skeleton" key={index}/>)}</div>
        <div className="account-loading-content"><div className="cm-paper account-loading-paper"><span className="account-skeleton account-skeleton-title"/><div className="account-loading-metrics">{Array.from({length:4},(_,index)=><span className="account-skeleton" key={index}/>)}</div></div><div className="cm-paper account-loading-paper"><span className="account-skeleton account-skeleton-title"/><span className="account-skeleton account-skeleton-line"/><span className="account-skeleton account-skeleton-line"/></div></div>
      </div>
    </div>
  </div>;
}
