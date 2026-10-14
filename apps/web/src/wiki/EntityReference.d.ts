// SPDX-License-Identifier: GPL-3.0-only
import type { ReactNode, AnchorHTMLAttributes } from 'react';
export function EntityText(props: { text?: string; path?: string; className?: string; renderText?: (text: string) => ReactNode }): ReactNode;
export default function EntityReference(props: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }): ReactNode;
