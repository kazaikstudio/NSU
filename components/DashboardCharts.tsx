'use client';

interface ChartThemeProps {
  isDarkMode: boolean;
}

interface DashboardChartsProps extends ChartThemeProps {
  artists: Array<{ name: string; totalDownloads?: number }>;
  downloadRegions?: Array<{ name: string; downloads: number }>;
}

interface RegionChartProps extends ChartThemeProps {
  downloadRegions?: Array<{ name: string; downloads: number }>;
}

interface ChartDefinition {
  title: string;
  labels: string[];
  values: number[];
  color: string;
}

function ChartCard({ chart, isDarkMode }: { chart: ChartDefinition; isDarkMode: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
      <h3 className="mb-4 text-base font-semibold">{chart.title}</h3>
      <div className="flex h-40 items-end justify-between gap-2 pt-2">
        {chart.labels.map((label, index) => {
          const value = chart.values[index] ?? 0;

          return (
          <div key={label} className="flex h-full flex-1 items-end justify-end">
            <div
              className={`w-full min-h-2 rounded-t-md transition-all ${chart.color}`}
              style={{ height: `${Math.max(0, Math.min(100, value))}%` }}
              title={`${label}: ${value}`}
              aria-label={`${label}: ${value}`}
            />
          </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-2">
        {chart.labels.map((label) => (
          <span key={label} className={`min-w-0 flex-1 truncate text-center text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Graph1({ isDarkMode }: ChartThemeProps) {
  return (
    <ChartCard
      isDarkMode={isDarkMode}
      chart={{
        title: 'Streams Over Time',
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        values: [50, 67, 33, 83, 75, 100, 92],
        color: 'bg-indigo-600 hover:bg-indigo-500',
      }}
    />
  );
}

function Graph2({ isDarkMode }: ChartThemeProps) {
  return (
    <ChartCard
      isDarkMode={isDarkMode}
      chart={{
        title: 'Revenue Analytics',
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
        values: [42, 58, 75, 63, 88, 100, 83],
        color: 'bg-emerald-500 hover:bg-emerald-400',
      }}
    />
  );
}

function Graph3({ isDarkMode, artists }: DashboardChartsProps) {
  const colors = ['#f59e0b', '#f97316', '#eab308', '#84cc16', '#14b8a6'];
  const topArtists = artists
    .map((artist) => ({ ...artist, totalDownloads: Number(artist.totalDownloads || 0) }))
    .sort((first, second) => second.totalDownloads - first.totalDownloads)
    .slice(0, 5);
  const totalDownloads = topArtists.reduce((total, artist) => total + artist.totalDownloads, 0);
  const pieStops = topArtists.reduce<{ stops: string[]; end: number }>((result, artist, index) => {
    const percentage = totalDownloads > 0 ? (artist.totalDownloads / totalDownloads) * 100 : 0;
    const nextEnd = result.end + percentage;
    return {
      stops: [...result.stops, `${colors[index]} ${result.end}% ${nextEnd}%`],
      end: nextEnd,
    };
  }, { stops: [], end: 0 }).stops;

  return (
    <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
      <h3 className="mb-4 text-base font-semibold">Top 5 Artists by Downloads</h3>
      {topArtists.length > 0 && totalDownloads > 0 ? (
        <div className="flex items-center gap-6">
          <div
            className="h-36 w-36 shrink-0 rounded-full"
            style={{ background: `conic-gradient(${pieStops.join(', ')})` }}
            role="img"
            aria-label="Top five artists by downloads"
          >
            <div className={`m-6 flex h-24 w-24 items-center justify-center rounded-full text-center text-xs font-semibold ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600'}`}>
              {totalDownloads.toLocaleString()} total
            </div>
          </div>
          <div className="min-w-0 space-y-2">
            {topArtists.map((artist, index) => (
              <div key={artist.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index] }} />
                <span className={`min-w-0 truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{artist.name}</span>
                <span className={`ml-auto shrink-0 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{artist.totalDownloads.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`flex h-36 items-center justify-center text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          No artist downloads yet
        </div>
      )}
    </div>
  );
}

function Graph4({ isDarkMode, downloadRegions = [] }: RegionChartProps) {
  const regionNames = ['Northern', 'Central', 'Eastern', 'Western', 'Kampala'];
  const regions = regionNames.map((name) => ({
    name,
    downloads: Math.max(0, Number(downloadRegions.find((region) => region.name === name)?.downloads || 0)),
  }));
  const maxDownloads = Math.max(...regions.map((region) => region.downloads), 1);

  return (
    <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
      <h3 className="text-base font-semibold">Downloads by Region</h3>
      <p className={`mt-1 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Music downloads across Uganda</p>
      <div className="mt-5 space-y-3">
        {regions.map((region) => (
          <div key={region.name} className="flex items-center gap-3">
            <span className={`w-20 shrink-0 text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{region.name}</span>
            <div className={`h-2 flex-1 overflow-hidden rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
              <div
                className="h-full rounded-full bg-cyan-500 transition-all"
                style={{ width: `${(region.downloads / maxDownloads) * 100}%` }}
                aria-label={`${region.name}: ${region.downloads} downloads`}
              />
            </div>
            <span className={`w-10 text-right text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{region.downloads}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardCharts({ isDarkMode, artists, downloadRegions }: DashboardChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Graph1 isDarkMode={isDarkMode} />
      <Graph2 isDarkMode={isDarkMode} />
      <Graph3 isDarkMode={isDarkMode} artists={artists} />
      <Graph4 isDarkMode={isDarkMode} downloadRegions={downloadRegions} />
    </div>
  );
}