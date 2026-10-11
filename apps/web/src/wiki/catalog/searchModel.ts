export interface SearchRecord {title:string;kind:string;to:string;meta:string;keywords:string;}
export function searchRecords(records:readonly SearchRecord[],term:string,kind=''):SearchRecord[] {
  const needle=term.trim().toLowerCase();
  const matches=records.filter(record=>(!kind||record.kind===kind)&&(!needle||`${record.title} ${record.keywords} ${record.meta}`.toLowerCase().includes(needle)));
  const rank=(record:SearchRecord)=>{
    const title=record.title.toLowerCase();
    return title===needle?0:title.startsWith(needle)?1:title.includes(needle)?2:3;
  };
  if(needle)matches.sort((a,b)=>rank(a)-rank(b));
  return matches;
}
export function matchedExcerpt(text:string,term:string):string {
  const value=text.replace(/\s+/g,' ').trim(),position=value.toLowerCase().indexOf(term.trim().toLowerCase());
  const start=Math.max(0,position-40),end=Math.min(value.length,start+156);
  return `${start?'…':''}${value.slice(start,end)}${end<value.length?'…':''}`;
}
