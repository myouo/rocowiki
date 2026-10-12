// SPDX-License-Identifier: GPL-3.0-only
export function learningLabel(method: string | null | undefined, level: number | null | undefined): string {
  const label = method?.trim() || '';
  if (level === 0) return label && label !== '初始' ? `${label} · 初始` : '初始';
  const validLevel = typeof level === 'number' && Number.isInteger(level) && level > 0 && level <= 100;
  return `${label || '学习方式待补'}${validLevel ? ` · ${level} 级` : ''}`;
}
