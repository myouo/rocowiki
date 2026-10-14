// SPDX-License-Identifier: GPL-3.0-only
import type {ComponentType} from 'react';
export interface CalendarState {
  checkins:{actorId:string;day:string;at:string;amount?:number;dailyReward?:number;streakBonus?:number}[];
  ledger:{actorId:string;kind:string;ref?:string;amount:number}[];
}
export const CheckinWeekStrip:ComponentType<{state:CalendarState;actorId:string;now:Date}>;
declare const CommunityCheckinCalendar:ComponentType<{state:CalendarState;actorId:string;now:Date;query?:URLSearchParams}>;
export default CommunityCheckinCalendar;
