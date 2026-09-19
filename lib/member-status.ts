export const MEMBER_STATUSES = ['Active', 'Inactive', 'Pending', 'Suspended'] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export interface MemberStatusOption {
  value: MemberStatus;
  dotClass: string;
  pillClass: string;
}

export const MEMBER_STATUS_OPTIONS: MemberStatusOption[] = [
  { value: 'Active', dotClass: 'bg-emerald-400', pillClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' },
  { value: 'Inactive', dotClass: 'bg-slate-400', pillClass: 'border-slate-500/20 bg-slate-500/10 text-slate-400' },
  { value: 'Pending', dotClass: 'bg-sky-400', pillClass: 'border-sky-500/20 bg-sky-500/10 text-sky-400' },
  { value: 'Suspended', dotClass: 'bg-red-400', pillClass: 'border-red-500/20 bg-red-500/10 text-red-400' },
];

export function getMemberStatusStyle(value: string | null | undefined): MemberStatusOption {
  return MEMBER_STATUS_OPTIONS.find((option) => option.value === value) || MEMBER_STATUS_OPTIONS[0];
}