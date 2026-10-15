// SPDX-License-Identifier: GPL-3.0-only
import routes from '../../web/content/routes.json';
import documents from '../../web/content/published-docs-v7.json';
import {catalog,contentPath} from '../../../packages/wiki-schema/src/index';
import {canonicalHistoryPage,type HistorySource} from '../../../packages/wiki-schema/src/history';

const data=(id:string,label:string,file:string):HistorySource=>({id,label,path:`apps/web/content/${file}.json`,shared:true});
const source=(path:string,label='页面正文'):HistorySource=>({id:'article',label,path,shared:false});
const moduleSource=(id:string,label:string,file:string):HistorySource=>({id,label,path:`apps/web/src/wiki/${file}`,shared:true});
/** Only repository-owned paths are accepted. A request never becomes a Git file path. */
export function historySources(value:string):HistorySource[] {
  const page=canonicalHistoryPage(value),url=new URL(page,'https://wiki.invalid'),path=url.pathname;
  const registered=catalog.find(row=>path===`/wiki/${row.slug}/`);
  if(registered)return [source(contentPath(registered))];
  const doc=documents.documents.find(row=>row.path===path);
  if(doc)return [source(`apps/web/${doc.sourceFile}`)];
  if(!routes.includes(path))throw new Error('UNKNOWN_HISTORY_PAGE');
  const group=path.split('/')[1];
  if(group==='pets')return [data('pets','宠物基础资料','official-pets'),data('notes','补充资料','pet-metadata-v6'),data('pool','游戏技能池','game-skill-relations'),data('legacy','历史资料','pet-sources'),data('ladder','天梯费用','official-ladder')];
  if(group==='skills')return [data('skills','技能基础资料','official-skills'),data('analysis','效果与条件解析','skill-analysis-notes'),data('pool','游戏学习关系','game-skill-relations'),{id:'legacy',label:'历史整理资料',path:'apps/web/src/wiki/data.js',shared:true}];
  if(group==='bloodlines')return [data('bloodlines','血脉资料','pet-metadata-v6')];
  if(group==='events')return [data('events','活动资料','events-v7'),data('weekly','每周资料','weekly-v5')];
  if(group==='battle')return [data('weekly','赛事规则与禁赛','weekly-v5'),moduleSource('rules','规则补充','world/BattlePages.jsx')];
  if(group==='mechanics')return path==='/mechanics/relations/'?[data('relations','机制关系资料','battle-relations-v5')]:[source('apps/web/src/wiki/MechanicsPages.jsx','机制目录')];
  if(group==='pve')return [data('pve','挑战与攻略资料','pve-v6'),data('seven','七曜圣地资料','seven-sanctuaries-v72'),data('recommendations','推荐宠物','pve-pet-recommendations-v7')];
  if(group==='challenges')return [moduleSource('challenges','挑战资料','world/ChallengePages.jsx')];
  if(group==='tools')return [data('calculator','计算资料','calculator-sources-v7'),data('mappings','公式映射','calculator-mappings-v73')];
  if(group==='places')return [moduleSource('places','地区详细资料','world/placeData.js'),moduleSource('index','地区基础资料','data.js')];
  if(group==='npcs')return [moduleSource('npcs','人物详细资料','npcPresentation.js'),moduleSource('index','人物基础资料','data.js')];
  if(group==='items')return [moduleSource('items','道具资料','world/ItemPages.jsx')];
  if(group==='tasks')return [moduleSource('tasks','任务资料','world/TaskPages.jsx')];
  if(group==='adventure')return [moduleSource('places','地区详细资料','world/placeData.js'),moduleSource('adventure','冒险资料','world/AdventurePage.jsx')];
  if(group==='guides'||group==='help')return [source('apps/web/src/wiki/WikiPage.jsx','目录页面')];
  if(group==='community')return [source('apps/web/src/wiki/community/OverviewPage.jsx','共建页面')];
  if(path==='/')return [source('apps/web/src/wiki/HomePage.jsx','首页')];
  throw new Error('UNKNOWN_HISTORY_PAGE');
}
