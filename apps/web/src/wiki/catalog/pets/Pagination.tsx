// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';

export default function PetPagination({ page, count, onPage }: { page: number; count: number; onPage: (page: number) => void }) {
  if (count <= 1) return null;
  return <nav className="rw-pet-pagination" aria-label="宠物列表分页">
    <button className="rw-button" disabled={page === 1} onClick={() => onPage(page - 1)}>上一页</button>
    <span aria-live="polite">第 {page} / {count} 页</span>
    <button className="rw-button" disabled={page === count} onClick={() => onPage(page + 1)}>下一页</button>
  </nav>;
}
