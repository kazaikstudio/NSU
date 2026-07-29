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
