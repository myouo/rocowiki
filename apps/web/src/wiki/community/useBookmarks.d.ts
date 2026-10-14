// SPDX-License-Identifier: GPL-3.0-only
export interface BookmarkItem {id: string; title: string; href: string; kind: string;}
export function useBookmarks(): {bookmarks: BookmarkItem[]; remove: (id: string) => void; error: string};
