import React, { useId } from "react";
import { Sprout, Cloud, Star, Sun, Moon, Feather, CalendarCheck2, BookOpen, Award } from "lucide-react";

export default function HonorSymbol({ item, size = 24, className = "" }) {
  const id = `honor-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const Icon = { sprout: Sprout, cloud: Cloud, star: Star, sun: Sun, moon: Moon, quill: Feather, calendar: CalendarCheck2, book: BookOpen }[item?.icon] || Award;
  if (item?.kind === "achievement") return <span className={`rw-honor-symbol-v72 rw-earned-medallion-v73 ${item?.tone || "sky"} ${className}`} aria-hidden="true">
    <svg viewBox="0 0 64 64" width={size * 1.75} height={size * 1.75} role="presentation">
      <defs><linearGradient id={`${id}-edge`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fff7dc" /><stop offset=".3" stopColor="#e4c486" /><stop offset=".65" stopColor="#b48a46" /><stop offset="1" stopColor="#f7dfab" /></linearGradient><linearGradient id={`${id}-enamel`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--honor-enamel-light, #d8edf8)" /><stop offset="1" stopColor="var(--honor-enamel-dark, #7399bc)" /></linearGradient><linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
      <path d="m18 43-4 16 9-4 5 6 4-18m14 0 4 16-9-4-5 6-4-18" fill="var(--honor-ribbon, #7d9dc8)" stroke="var(--honor-ribbon-edge, #6a87b0)" strokeWidth="1" />
      <path d="m32 3 7 3 7 1 4 6 6 4 1 7 3 7-3 7-1 7-6 4-4 6-7 1-7 3-7-3-7-1-4-6-6-4-1-7-3-7 3-7 1-7 6-4 4-6 7-1Z" fill={`url(#${id}-edge)`} stroke="#ba9655" strokeWidth=".8" />
      <circle cx="32" cy="31" r="21" fill={`url(#${id}-enamel)`} stroke="#fff0cd" strokeWidth="1.8" />
      <path d="M17 28a17 17 0 0 1 30-6c-8 9-22 10-30 6Z" fill={`url(#${id}-shine)`} />
      {item.icon === "quill" ? <g fill="none" stroke="#fff9e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 40c4-10 5-18 18-23 3 10-3 19-13 18m-6 9 16-23m-10 8 7 1m-10 5 6 1" /><path d="M22 44h17" stroke="#d0e4f0" /></g> : item.icon === "calendar" ? <g fill="none" stroke="#fff9e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="20" y="21" width="24" height="22" rx="4" /><path d="M26 18v6m12-6v6m-18 4h24m-16 5h8l-6 7" /></g> : <g fill="none" stroke="#fff9e8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M32 26c-5-4-10-4-15-2v17c5-2 10-2 15 2 5-4 10-4 15-2V24c-5-2-10-2-15 2Zm0 0v17m-11-14c3-.5 5 0 7 1m-7 5c3-.5 5 0 7 1m8-6c2-1 4-1.5 7-1m-7 7c2-1 4-1.5 7-1" /><path d="m32 13 1.6 3.8 4.1.3-3.2 2.7 1 4-3.5-2.1-3.5 2.1 1-4-3.2-2.7 4.1-.3Z" fill="#fff2c5" stroke="none" /></g>}
      <circle cx="14" cy="16" r="1.2" fill="#fffbe8" /><circle cx="48" cy="45" r="1" fill="#fffbe8" />
    </svg>
  </span>;
  return <span className={`rw-honor-symbol-v72 ${item?.tone || "sky"} ${className}`} aria-hidden="true"><Icon size={size} /></span>;
}
