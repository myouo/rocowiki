// SPDX-License-Identifier: GPL-3.0-only
import type {ComponentType,TextareaHTMLAttributes} from 'react';
declare const EntityTextarea:ComponentType<Omit<TextareaHTMLAttributes<HTMLTextAreaElement>,'value'|'onChange'> & {value?:string;onChange:(value:string)=>void;ariaLabel?:string}>;
export default EntityTextarea;
