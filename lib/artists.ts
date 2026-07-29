export interface Artist {
  id: string;
  name: string;
  genre: string;
  tracksCount: number;
  status: string;
  bio: string;
  followers: number;
  featuredTrack: string;
  monthlyListeners: number;
  bannerUrl?: string;
  profileUrl?: string;
}

export const artistsSeed: Artist[] = [
  {
    id: '1',
    name: 'Eddy Kenzo',
    genre: 'Afrobeats',
    tracksCount: 14,
    status: 'Active',
    bio: 'Eddy Kenzo is a Ugandan Afrobeat performer known for energetic live shows and crossover hits.',
    followers: 182000,
    featuredTrack: 'Sitya Loss',
    monthlyListeners: 540000,
  },
  {
    id: '2',
    name: 'Azawi',
    genre: 'Afropop',
    tracksCount: 8,
    status: 'Active',
    bio: 'Azawi blends contemporary Afropop with personal storytelling and powerful vocal delivery.',
    followers: 94000,
    featuredTrack: 'Never Again',
    monthlyListeners: 310000,
  },
  {
    id: '3',
    name: 'Vinka',
    genre: 'Dancehall',
    status: 'Pending',
    tracksCount: 11,
    bio: 'Vinka brings a fresh dancehall edge with bold performances and growing national recognition.',
    followers: 67000,
    featuredTrack: 'Bam Bam',
    monthlyListeners: 210000,
  },
];

export const nollArtistsStorageKey = 'noll-artists';

export function persistArtists(artists: Artist[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(nollArtistsStorageKey, JSON.stringify(artists));
}

export function getArtistById(id: string | null | undefined) {
  if (!id) {
    return undefined;
  }

  if (typeof window === 'undefined') {
    return artistsSeed.find((artist) => artist.id === id);
  }

  try {
    const storedArtists = window.localStorage.getItem(nollArtistsStorageKey);
    if (storedArtists) {
      const parsedArtists = JSON.parse(storedArtists) as Artist[];
      if (Array.isArray(parsedArtists)) {
        const mergedArtists = [
          ...artistsSeed,
          ...parsedArtists.filter((artist) => !artistsSeed.some((seedArtist) => seedArtist.id === artist.id)),
        ];

        return mergedArtists.find((artist) => artist.id === id);
      }
    }
  } catch (error) {
    console.error('Failed to read saved artists', error);
  }

  return artistsSeed.find((artist) => artist.id === id);
}
