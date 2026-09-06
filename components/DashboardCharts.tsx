'use client';

import { useState, useRef, useEffect } from 'react';

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


function Graph1({ isDarkMode }: ChartThemeProps) {
  const [timeframe, setTimeframe] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [isOpen, setIsOpen] = useState(false);
  const [showClicks, setShowClicks] = useState(true);
  const [showImpressions, setShowImpressions] = useState(true);
  const [showCtr, setShowCtr] = useState(false);
  const [showPosition, setShowPosition] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const dataPoints = [
    { date: '7/20/26', dayName: 'Monday, Jul 20', clicks: 0, impressions: 0 },
    { date: '7/25/26', dayName: 'Saturday, Jul 25', clicks: 2, impressions: 4 },
    { date: '7/30/26', dayName: 'Thursday, Jul 30', clicks: 6, impressions: 15 },
    { date: '8/4/26', dayName: 'Tuesday, Aug 4', clicks: 0, impressions: 1 },
    { date: '8/9/26', dayName: 'Sunday, Aug 9', clicks: 1, impressions: 3 },
    { date: '8/14/26', dayName: 'Friday, Aug 14', clicks: 1, impressions: 3 },
    { date: '8/19/26', dayName: 'Wednesday, Aug 19', clicks: 1, impressions: 3 },
    { date: '8/24/26', dayName: 'Monday, Aug 24', clicks: 0, impressions: 0 },
    { date: '8/29/26', dayName: 'Saturday, Aug 29', clicks: 0, impressions: 0 },
    { date: '9/3/26', dayName: 'Thursday, Sep 3', clicks: 3, impressions: 8 },
  ];

  const maxClicks = 6;
  const maxImpressions = 15;

  const getSmoothPath = (points: { value: number; max: number }[]) => {
    return points.map((pt, i, arr) => {
      const x = (i / (arr.length - 1)) * 100;
      const y = 100 - (pt.value / pt.max) * 100;
      if (i === 0) return `M ${x},${y}`;

      const prevX = ((i - 1) / (arr.length - 1)) * 100;
      const prevY = 100 - (arr[i - 1].value / pt.max) * 100;
      const cpX = (x + prevX) / 2;

      return `C ${cpX},${prevY} ${cpX},${y} ${x},${y}`;
    }).join(' ');
  };

  const clicksArray = dataPoints.map(p => ({ value: p.clicks, max: maxClicks }));
  const impressionsArray = dataPoints.map(p => ({ value: p.impressions, max: maxImpressions }));

  const clicksPath = getSmoothPath(clicksArray);
  const impressionsPath = getSmoothPath(impressionsArray);

  const clicksAreaPath = `${clicksPath} L 100,100 L 0,100 Z`;
  const impressionsAreaPath = `${impressionsPath} L 100,100 L 0,100 Z`;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`p-6 sm:p-8 rounded-2xl border transition-all duration-300 shadow-xl backdrop-blur-xl ${
      isDarkMode
        ? 'bg-gray-950/80 border-gray-800/80 text-white shadow-black/40'
        : 'bg-white/90 border-gray-100 text-gray-900 shadow-gray-200/50'
    }`}>
      {/* Metric Cards Header & Timeframe Dropdown */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-1.5 rounded-2xl border flex-1 ${
          isDarkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-100 bg-gray-50/80'
        }`}>
          {/* Total Clicks */}
          <div
            onClick={() => setShowClicks(!showClicks)}
            className={`p-4 rounded-xl cursor-pointer relative transition-all duration-200 border ${
              showClicks
                ? isDarkMode
                  ? 'bg-blue-950/30 border-blue-500/30 shadow-lg shadow-blue-950/50'
                  : 'bg-white border-blue-200 shadow-md shadow-blue-500/5'
                : isDarkMode
                  ? 'bg-gray-900/20 border-transparent opacity-60 hover:opacity-100'
                  : 'bg-transparent border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className={`w-3 h-3 rounded-full transition-transform ${showClicks ? 'bg-blue-500 scale-110 shadow-sm shadow-blue-500' : 'bg-gray-400'}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${showClicks ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') : 'text-gray-400'}`}>
                  Total clicks
                </span>
              </div>
              <span className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">ⓘ</span>
            </div>
            <div className="text-3xl font-bold tracking-tight">32</div>
          </div>

          {/* Total Impressions */}
          <div
            onClick={() => setShowImpressions(!showImpressions)}
            className={`p-4 rounded-xl cursor-pointer relative transition-all duration-200 border ${
              showImpressions
                ? isDarkMode
                  ? 'bg-indigo-950/30 border-indigo-500/30 shadow-lg shadow-indigo-950/50'
                  : 'bg-white border-indigo-200 shadow-md shadow-indigo-500/5'
                : isDarkMode
                  ? 'bg-gray-900/20 border-transparent opacity-60 hover:opacity-100'
                  : 'bg-transparent border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className={`w-3 h-3 rounded-full transition-transform ${showImpressions ? 'bg-indigo-500 scale-110 shadow-sm shadow-indigo-500' : 'bg-gray-400'}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${showImpressions ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : 'text-gray-400'}`}>
                  Impressions
                </span>
              </div>
              <span className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">ⓘ</span>
            </div>
            <div className="text-3xl font-bold tracking-tight">72</div>
          </div>

          {/* Average CTR */}
          <div
            onClick={() => setShowCtr(!showCtr)}
            className={`p-4 rounded-xl cursor-pointer relative transition-all duration-200 border ${
              showCtr
                ? isDarkMode
                  ? 'bg-emerald-950/30 border-emerald-500/30 shadow-lg shadow-emerald-950/50'
                  : 'bg-white border-emerald-200 shadow-md shadow-emerald-500/5'
                : isDarkMode
                  ? 'bg-gray-900/20 border-transparent opacity-60 hover:opacity-100'
                  : 'bg-transparent border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className={`w-3 h-3 rounded-full transition-transform ${showCtr ? 'bg-emerald-500 scale-110 shadow-sm shadow-emerald-500' : 'bg-gray-400'}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${showCtr ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : 'text-gray-400'}`}>
                  Average CTR
                </span>
              </div>
              <span className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">ⓘ</span>
            </div>
            <div className="text-3xl font-bold tracking-tight">44.4%</div>
          </div>

          {/* Average Position */}
          <div
            onClick={() => setShowPosition(!showPosition)}
            className={`p-4 rounded-xl cursor-pointer relative transition-all duration-200 border ${
              showPosition
                ? isDarkMode
                  ? 'bg-amber-950/30 border-amber-500/30 shadow-lg shadow-amber-950/50'
                  : 'bg-white border-amber-200 shadow-md shadow-amber-500/5'
                : isDarkMode
                  ? 'bg-gray-900/20 border-transparent opacity-60 hover:opacity-100'
                  : 'bg-transparent border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className={`w-3 h-3 rounded-full transition-transform ${showPosition ? 'bg-amber-500 scale-110 shadow-sm shadow-amber-500' : 'bg-gray-400'}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${showPosition ? (isDarkMode ? 'text-amber-400' : 'text-amber-600') : 'text-gray-400'}`}>
                  Position
                </span>
              </div>
              <span className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">ⓘ</span>
            </div>
            <div className="text-3xl font-bold tracking-tight">2.0</div>
          </div>
        </div>

        {/* Interactive Dropdown */}
        <div className="relative self-end xl:self-center shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`text-xs font-semibold px-4 py-2.5 rounded-xl border flex items-center space-x-3 transition-all shadow-sm ${
              isDarkMode
                ? 'bg-gray-900 border-gray-800 text-gray-200 hover:bg-gray-800'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>{timeframe}</span>
            <span className={`text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {isOpen && (
            <div className={`absolute right-0 mt-2 w-32 rounded-xl shadow-xl border z-30 overflow-hidden py-1 backdrop-blur-xl ${
              isDarkMode ? 'bg-gray-900/95 border-gray-800 text-white' : 'bg-white/95 border-gray-100 text-gray-900'
            }`}>
              {(['Daily', 'Weekly', 'Monthly'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setTimeframe(item);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                    timeframe === item
                      ? isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600 font-semibold'
                      : isDarkMode ? 'hover:bg-gray-800/60 text-gray-300' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart Area */}
      <div className="relative pt-2">
        <div className="h-72 w-full relative flex items-end justify-between">
          {/* Background Grid Lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-full border-t ${isDarkMode ? 'border-gray-800/60' : 'border-gray-100'}`}
              />
            ))}
          </div>

          {/* SVG Canvas for Gradients, Area Fills, and Spline Curves */}
          <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="indigoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Impressions Area & Smooth Line */}
            {showImpressions && (
              <g className="transition-all duration-300">
                <path d={impressionsAreaPath} fill="url(#indigoGradient)" />
                <path
                  d={impressionsPath}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}

            {/* Clicks Area & Smooth Line */}
            {showClicks && (
              <g className="transition-all duration-300">
                <path d={clicksAreaPath} fill="url(#blueGradient)" />
                <path
                  d={clicksPath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}
          </svg>

          {/* Hover Overlay Columns & Data Dots */}
          <div className="absolute inset-0 flex justify-between">
            {dataPoints.map((pt, idx) => {
              const clickYPercent = 100 - (pt.clicks / maxClicks) * 100;
              const impressionYPercent = 100 - (pt.impressions / maxImpressions) * 100;

              return (
                <div
                  key={pt.date}
                  className="h-full relative flex-1 cursor-pointer group"
                  onMouseEnter={() => setHoverIndex(idx)}
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  {/* Vertical Guide Line on Hover */}
                  {hoverIndex === idx && (
                    <div
                      className={`absolute top-0 bottom-0 w-px z-10 pointer-events-none border-l border-dashed ${
                        isDarkMode ? 'border-gray-600' : 'border-gray-300'
                      }`}
                      style={{ left: '50%' }}
                    />
                  )}

                  {/* Active Data Points on Line */}
                  {hoverIndex === idx && (
                    <div className="absolute inset-0 pointer-events-none">
                      {showClicks && (
                        <div
                          className="absolute w-3.5 h-3.5 bg-blue-500 border-2 border-white dark:border-gray-900 rounded-full shadow-md -translate-x-1/2 -translate-y-1/2 z-20 transition-all"
                          style={{ left: '50%', top: `${clickYPercent}%` }}
                        />
                      )}
                      {showImpressions && (
                        <div
                          className="absolute w-3.5 h-3.5 bg-indigo-500 border-2 border-white dark:border-gray-900 rounded-full shadow-md -translate-x-1/2 -translate-y-1/2 z-20 transition-all"
                          style={{ left: '50%', top: `${impressionYPercent}%` }}
                        />
                      )}
                    </div>
                  )}

                  {/* Floating Tooltip Box */}
                  {hoverIndex === idx && (
                    <div
                      className={`absolute bottom-full mb-4 z-30 w-56 p-4 rounded-xl shadow-2xl border text-xs pointer-events-none backdrop-blur-xl transition-all animate-in fade-in zoom-in-95 duration-150 ${
                        isDarkMode
                          ? 'bg-gray-900/95 border-gray-800 text-white shadow-black/50'
                          : 'bg-white/95 border-gray-100 text-gray-900 shadow-xl'
                      }`}
                      style={{
                        left: idx > 6 ? 'auto' : '50%',
                        right: idx > 6 ? '0px' : 'auto',
                        transform: idx > 6 ? 'none' : 'translateX(-50%)'
                      }}
                    >
                      <div className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mb-2.5 pb-1.5 border-b border-gray-100 dark:border-gray-800">
                        {pt.dayName}
                      </div>

                      <div className="space-y-2">
                        {showClicks && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center font-medium">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2 shadow-sm shadow-blue-500" />
                              Clicks
                            </span>
                            <span className="font-bold text-sm">{pt.clicks}</span>
                          </div>
                        )}
                        {showImpressions && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center font-medium">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 mr-2 shadow-sm shadow-indigo-500" />
                              Impressions
                            </span>
                            <span className="font-bold text-sm">{pt.impressions}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] text-gray-400/80 border-t border-gray-100 dark:border-gray-800 pt-2 mt-2.5 flex items-center justify-between">
                        <span>Annotation shortcut</span>
                        <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[9px]">Ctrl + ↵</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* X-Axis Labels */}
        <div className="flex justify-between text-[11px] font-medium text-gray-400 pt-4 px-1">
          {dataPoints.map((pt, index) => (
            <span
              key={pt.date}
              className={`transition-colors duration-200 ${hoverIndex === index ? (isDarkMode ? 'text-white font-bold' : 'text-gray-900 font-bold') : ''}`}
            >
              {pt.date}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Graph2({ isDarkMode, artists }: DashboardChartsProps) {
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

function Graph3({ isDarkMode, downloadRegions = [] }: RegionChartProps) {
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
    <div className="grid grid-cols-1 gap-4">
      {/* Row 1: Full-width Graph1 */}
      <div className="w-full">
        <Graph1 isDarkMode={isDarkMode} />
      </div>

      {/* Row 2: Graph2 and Graph3 side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Graph2 isDarkMode={isDarkMode} artists={artists} />
        <Graph3 isDarkMode={isDarkMode} downloadRegions={downloadRegions} />
      </div>
    </div>
  );
}
