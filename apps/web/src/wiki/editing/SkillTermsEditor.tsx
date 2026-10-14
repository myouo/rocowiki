// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { SkillTerm } from '../skillTerms';

export default function SkillTermsEditor({ terms = [], onChange, errors = {} }: {
  terms?: SkillTerm[];
  onChange: (terms: SkillTerm[]) => void;
  errors?: Record<string, string>;
}) {
  return <section className="ev7-repeater" aria-label="技能内名词定义">
    <h3>技能内名词定义</h3>
    <p className="ev7-muted">先说明标记、数值等名词；条件和效果中的同名引用会自动链接到这里。游戏术语自动链接到战斗机制。</p>
    {terms.map((term, index) => <div className="ev7-record" key={index}>
      <label className="ev71-branch-field"><span>名词 {index + 1}</span><input aria-label={`名词名称 · ${index + 1}`} value={term.name} maxLength={100} onChange={event => onChange(terms.map((old, i) => i === index ? { ...old, name: event.target.value } : old))} aria-invalid={!!errors[`terms.${index}.name`]} /></label>
      <label className="ev71-branch-field"><span>定义</span><textarea aria-label={`名词定义 · ${index + 1}`} value={term.description} rows={2} maxLength={4000} onChange={event => onChange(terms.map((old, i) => i === index ? { ...old, description: event.target.value } : old))} aria-invalid={!!errors[`terms.${index}.description`]} /></label>
      {[errors[`terms.${index}.name`], errors[`terms.${index}.description`]].filter(Boolean).map((error, i) => <p className="ev7-error" role="alert" key={i}>{error}</p>)}
      <button type="button" className="ev71-small-action" aria-label={`移除名词 · ${index + 1}`} onClick={() => onChange(terms.filter((_, i) => i !== index))}><Trash2 size={13} />移除名词</button>
    </div>)}
    {errors.terms && <p className="ev7-error" role="alert">{errors.terms}</p>}
    <button type="button" className="ev71-small-action" onClick={() => onChange([...terms, { name: '', description: '' }])}><Plus size={13} />添加名词定义</button>
  </section>;
}
