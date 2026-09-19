export const ARTIST_STATUSES = ['Active', 'Inactive', 'Suspended'] as const;

export type ArtistStatus = (typeof ARTIST_STATUSES)[number];

export interface ArtistStatusOption {
  value: ArtistStatus;
  dotClass: string;
  pillClass: string;
}

export const ARTIST_STATUS_OPTIONS: ArtistStatusOption[] = [
  { value: 'Active', dotClass: 'bg-emerald-400', pillClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' },
  { value: 'Inactive', dotClass: 'bg-slate-400', pillClass: 'border-slate-500/20 bg-slate-500/10 text-slate-400' },
  { value: 'Suspended', dotClass: 'bg-red-400', pillClass: 'border-red-500/20 bg-red-500/10 text-red-400' },
];

export function getArtistStatusStyle(value: string | null | undefined): ArtistStatusOption {
  return ARTIST_STATUS_OPTIONS.find((option) => option.value === value) || ARTIST_STATUS_OPTIONS[0];
}