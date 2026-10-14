// SPDX-License-Identifier: GPL-3.0-only
import React, { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Eye, GitBranch, Layers3, Plus, RotateCcw, Trash2 } from 'lucide-react';
import SkillBranchNavigator from '../SkillBranchNavigator';
import Select from '../Select';
import { SkillConditionView, MermaidCopy } from '../SkillBranchView';
import SkillRuleReading, { type SkillRuleData } from '../SkillRuleReading';
import { branchTitle, changeSkillBranchSiblings, focusSkillBranch, replaceSkillBranch, skillBranchLocations, type NavigableBranch } from '../skillBranchNavigation';
import { branchMoveError, editableBranchAlternate, MAX_BRANCH_DEPTH, moveSkillBranch, wrapSkillBranch, type BranchDestination, type BranchEdit } from './skillBranchEditing';
import './SkillBranchWorkspace.css';

interface DestinationOption { value: string; label: string; target: BranchDestination }

export default function SkillBranchWorkspace({ branches, onChange, errors, rootIndex, renderFields, createBranch, flowData = {} }: {
  branches: NavigableBranch[];
  onChange: (branches: NavigableBranch[]) => void;
  errors: Record<string, string>;
  rootIndex?: number;
  createBranch: () => NavigableBranch;
  flowData?: SkillRuleData;
  renderFields: (props: { branch: NavigableBranch; path: string; depth: number; onChange: (branch: NavigableBranch) => void; onAddChild: (route: BranchDestination['route'], parent: NavigableBranch) => void }) => ReactNode;
}) {
  const id = useId();
  const locations = useMemo(() => skillBranchLocations(branches), [branches]);
  const available = rootIndex === undefined ? locations : locations.filter(row => row.rootIndex === rootIndex);
  const [selection, setSelection] = useState(available[0]?.path || '');
  // Authored IDs survive reordering; old records without IDs use occurrence paths.
  const [selectedId, setSelectedId] = useState(available[0]?.branch.id);
  const [previewMode, setPreviewMode] = useState<'all' | 'path'>('all');
  const [destination, setDestination] = useState('');
  const history = useRef<{ branches: NavigableBranch[]; path: string; selectedId?: string }[]>([]);
  const undoGroup = useRef({ key: '', time: 0 });
  const lastWrite = useRef(branches);
  const [, refresh] = useState(0);
  useEffect(() => {
    if (branches !== lastWrite.current) { history.current = []; undoGroup.current.key = ''; lastWrite.current = branches; refresh(n => n + 1); }
  }, [branches]);
  const current = available.find(row => selectedId ? row.branch.id === selectedId : row.path === selection) || available[0];
  const preview = useMemo(() => current ? focusSkillBranch(branches, current.path) : [], [branches, current?.path]);
  function select(path: string) {
    undoGroup.current.key = '';
    setDestination('');
    setSelection(path); setSelectedId(available.find(row => row.path === path)?.branch.id);
  }
  function write(next: NavigableBranch[], group = '') {
    const now = Date.now();
    if (!group || undoGroup.current.key !== group || now - undoGroup.current.time > 1500) {
      history.current.push({ branches, path: current?.path || '', selectedId: current?.branch.id });
      if (history.current.length > 30) history.current.shift();
    }
    undoGroup.current = { key: group, time: now };
    lastWrite.current = next;
    onChange(next);
  }
  function undo() {
    undoGroup.current.key = '';
    setDestination('');
    const previous = history.current.pop();
    if (previous) { lastWrite.current = previous.branches; onChange(previous.branches); setSelection(previous.path); setSelectedId(previous.selectedId); refresh(n => n + 1); }
  }
  function move(step: number) {
    if (!current) return;
    const index = Number(current.path.split('.').at(-1));
    write(changeSkillBranchSiblings(branches, current.path, rows => {
      const next = [...rows]; [next[index], next[index + step]] = [next[index + step], next[index]]; return next;
    }));
    setSelection(current.path.replace(/\d+$/u, String(index + step)));
  }
  function apply(edit: BranchEdit | null) {
    if (!edit) return;
    write(edit.branches);
    setSelection(edit.path);
    setSelectedId(skillBranchLocations(edit.branches).find(row => row.path === edit.path)?.branch.id);
    setDestination('');
  }
  function addChild(route: BranchDestination['route'], parent: NavigableBranch) {
    if (!current || current.depth >= MAX_BRANCH_DEPTH) return;
    const branch = createBranch();
    const rows = route === 'children' ? parent.children || [] : parent.otherwiseBranch?.children || [];
    if (route === 'otherwise' && !parent.otherwiseBranch) return;
    const next = route === 'children' ? { ...parent, children: [...rows, branch] }
      : { ...parent, otherwiseBranch: { ...parent.otherwiseBranch!, children: [...rows, branch] } };
    apply({ branches: replaceSkillBranch(branches, current.path, next), path: `${current.path}.${route === 'children' ? 'children' : 'otherwiseBranch.children'}.${rows.length}` });
  }
  function addRoot() {
    if (rootIndex !== undefined) return;
    apply({ branches: [...branches, createBranch()], path: String(branches.length) });
  }
  const siblings = current ? available.filter(row => row.path.replace(/\d+$/u, '') === current.path.replace(/\d+$/u, '')) : [];
  const siblingIndex = siblings.findIndex(row => row.path === current?.path);
  const exportData = { ...flowData, phases: branches };
  const destinations: DestinationOption[] = [
    { value: 'root', label: '顶层 · 与其他根分支并列', target: { parentPath: null, route: 'children' as const } },
    ...available.flatMap(row => {
      const number = (row.path.match(/\d+/gu) || []).map(n => Number(n) + 1).join('.');
      const alternate = editableBranchAlternate(row.branch);
      return ([{ value: `${row.path}|children`, label: `${number}. ${branchTitle(row.branch)} · 成立后`, target: { parentPath: row.path, route: 'children' } },
        ...(alternate ? [{ value: `${row.path}|otherwise`, label: `${number}. ${branchTitle(row.branch)} · ${alternate.conditionTree ? '另一条件路径' : '不成立时'}`, target: { parentPath: row.path, route: 'otherwise' } }] : [])] as DestinationOption[]);
    }),
  ].filter(row => current && !(current.depth === 0 && row.target.parentPath === null) && !branchMoveError(branches, current.path, row.target, rootIndex));
  const wrapAllowed = current && wrapSkillBranch(branches, current.path, {}) !== null;
  if (!current) return <div className="rw-branch-workspace"><div className="rw-branch-workspace-toolbar"><span>尚未保留条件分支，可添加分支或撤销移除。</span><button type="button" className="ev71-small-action" disabled={!history.current.length} onClick={undo}><RotateCcw size={13} />撤销</button><MermaidCopy data={exportData} concise groupEffects /></div>{rootIndex === undefined && <button type="button" className="cm-button ev7-add-record" onClick={addRoot}><Plus size={15} />添加条件与效果分支</button>}</div>;
  return <div className="rw-branch-workspace">
    <div className="rw-branch-workspace-toolbar"><span><GitBranch size={14} aria-hidden="true" />选择一个分支，修改条件与结果</span><button type="button" className="ev71-small-action" disabled={!history.current.length} onClick={undo}><RotateCcw size={13} aria-hidden="true" />撤销</button><MermaidCopy data={exportData} concise groupEffects /></div>
    <div className="rw-branch-workspace-layout">
      <SkillBranchNavigator locations={available} selected={current.path} onSelect={select} allowAll={false} errors={errors} />
      <section className="rw-branch-workspace-fields" aria-labelledby={`${id}-title`}>
        <div className="rw-branch-workspace-breadcrumb" aria-label="当前分支的父条件">{current.ancestors.map(ancestor => <div key={ancestor.path}><button type="button" onClick={() => select(ancestor.path)} aria-label={`返回父条件：${ancestor.label}`}>{ancestor.label} · {ancestor.route}</button>{(ancestor.conditionTree || ancestor.when) && <div className="rw-branch-parent-condition">{ancestor.conditionTree ? <SkillConditionView condition={ancestor.conditionTree} /> : ancestor.when}</div>}</div>)}</div>
        <h4 id={`${id}-title`}>{branchTitle(current.branch)}</h4>
        <div className="rw-branch-workspace-actions">
          <button type="button" className="ev71-small-action" disabled={siblingIndex <= 0 || (rootIndex !== undefined && current.depth === 0)} onClick={() => move(-1)}><ArrowUp size={13} />上移</button>
          <button type="button" className="ev71-small-action" disabled={siblingIndex === siblings.length - 1 || (rootIndex !== undefined && current.depth === 0)} onClick={() => move(1)}><ArrowDown size={13} />下移</button>
          <button type="button" className="ev71-small-action" disabled={!wrapAllowed} onClick={() => apply(wrapSkillBranch(branches, current.path, createBranch()))}><Layers3 size={13} />添加父条件</button>
          {(rootIndex === undefined || current.depth > 0) && <>
            <button type="button" className="ev71-small-action" onClick={() => { const branch = createBranch(); write(changeSkillBranchSiblings(branches, current.path, (rows, index) => [...rows.slice(0, index + 1), branch, ...rows.slice(index + 1)])); setSelection(current.path.replace(/\d+$/u, String(Number(current.path.split('.').at(-1)) + 1))); setSelectedId(branch.id); }}><Plus size={13} />同级分支</button>
            <button type="button" className="ev71-small-action" onClick={() => { write(changeSkillBranchSiblings(branches, current.path, (rows, index) => rows.filter((_, i) => i !== index))); setSelectedId(undefined); setSelection(''); }}><Trash2 size={13} />移除分支</button>
          </>}
        </div>
        {destinations.length > 0 && <details className="rw-branch-workspace-reparent" key={`move-${current.path}`}><summary>调整父子关系</summary><p>分支及其下级一起移动，目标路径成为新的前提。</p><div><Select ariaLabel="移动到哪个父条件" value={destination} onChange={setDestination} options={destinations} placeholder="选择新的父条件或顶层" searchable /><button type="button" className="ev71-small-action" disabled={!destination} onClick={() => { const target = destinations.find(row => row.value === destination)?.target; if (target) apply(moveSkillBranch(branches, current.path, target, rootIndex)); }}>移动到此处</button></div></details>}
        <div key={current.branch.id || current.path}>{renderFields({ branch: current.branch, path: `phases.${current.path}`, depth: current.depth, onAddChild: addChild, onChange: branch => {
          const field = branch.label !== current.branch.label ? 'label' : branch.effect !== current.branch.effect ? 'effect' : branch.conditionTree?.kind === 'clause' && branch.conditionTree.text !== current.branch.conditionTree?.text ? 'condition' : '';
          write(replaceSkillBranch(branches, current.path, branch), field ? `${current.path}:${field}` : '');
        } })}</div>
      </section>
    </div>
    {rootIndex === undefined && <button type="button" className="cm-button ev7-add-record" onClick={addRoot}><Plus size={15} />添加条件与效果分支</button>}
    <section className="rw-branch-workspace-preview" aria-label="技能结构即时预览">
      <div className="rw-branch-workspace-preview-heading"><h4><Eye size={14} aria-hidden="true" />即时预览</h4><div role="group" aria-label="预览范围"><button type="button" aria-pressed={previewMode === 'all'} onClick={() => setPreviewMode('all')}>完整结构</button><button type="button" aria-pressed={previewMode === 'path'} onClick={() => setPreviewMode('path')}>当前路径</button></div></div>
      <p className="rw-branch-workspace-preview-note">{previewMode === 'all' ? '对照所有同级分支与父子层级；样式与阅读页一致。' : '只查看选中分支及其父条件；复制 Mermaid 仍包含完整草稿。'}</p>
      <SkillRuleReading data={{ ...flowData, phases: previewMode === 'all' ? branches : preview }} showDescription={false} showExport={false} showNavigation={false} />
    </section>
  </div>;
}
