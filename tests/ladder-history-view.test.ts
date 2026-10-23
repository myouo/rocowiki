// SPDX-License-Identifier: GPL-3.0-only
import React,{type AnchorHTMLAttributes,type ReactNode} from 'react';
import {renderToString} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import LadderHistoryPage from '../apps/web/src/wiki/world/LadderHistory';
vi.mock('@docusaurus/router',()=>({useHistory:()=>({replace(){}})}));
vi.mock('@docusaurus/useBaseUrl',()=>({default:(value:string)=>value}));
vi.mock('@docusaurus/Link',()=>({default:({to,children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{to?:string;children?:ReactNode})=>React.createElement('a',{...props,href:to||props.href},children)}));
const render=(query:string)=>renderToString(React.createElement(LadderHistoryPage,{query:new URLSearchParams(query),header:React.createElement('h1',null,'天梯历史档案')}));

it('renders an explicit no-ban record and an unknown date as different states',()=>{
  expect(render('view=bans&date=2026-02-13')).toContain('原公告明确记载：本期无禁赛宠物');
  const missing=render('view=bans&date=2026-02-14');
  expect(missing).toContain('没有匹配的记录');expect(missing).not.toContain('原公告明确记载');
});
it('preserves mode-specific tournament details and does not silently select a different record',()=>{
  const html=render('view=bans&mode=type&date=2025-12-02');
  expect(html).toContain('幽灵 / 毒 / 虫');expect(html).toContain('元夕白鄂');
  expect(render('view=bans&record=unknown')).toContain('没有匹配的记录');
});
it('shows sourced season rewards with a real pet link and keeps missing dates explicit',()=>{
  const html=render('view=seasons&season=42');
  expect(html).toContain('2026-09-11');expect(html).toContain('href="/pets/3432/"');
  expect(html).toContain('尚未收录');expect(html).toContain('来源与记录范围');
  expect(render('view=seasons&season=9999')).toContain('没有找到这一届');
});
it('keeps a capture-day observation distinct from a dated announcement link',()=>{
  const html=render('view=bans&date=2026-10-22');
  expect(html).toContain('配置采集');expect(html).toContain('回到对战页核对这份档案');
  expect(html).toContain('mode=ladder&amp;date=2026-10-22&amp;record=xml-');
});
