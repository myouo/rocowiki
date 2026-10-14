// SPDX-License-Identifier: GPL-3.0-only
import type { ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  keywords?: string;
  group?: string;
}
export default function Select(props: {
  value?: string | number;
  onChange: (value: string) => void;
  options?: (string | SelectOption)[];
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
}): ReactNode;
