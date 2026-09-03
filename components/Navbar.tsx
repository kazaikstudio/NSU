"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download } from 'lucide-react';
import { useClickOutside } from "./useClickOutside";
import { usePathname } from 'next/navigation';

interface DownloadEntry {
  id: string;
  title: string;
  status: 'downloading' | 'done' | 'error';
  progress?: number;
  sourceVideoId?: string;
  sourceItag?: number;
  sourceExtension?: string;
  sourceOutputBitrate?: number;
  createdAt: string;
  updatedAt: string;
}

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [downloadEntries, setDownloadEntries] = useState<DownloadEntry[]>([]);
  const navRef = useRef<HTMLHeadingElement>(null);
  const pathname = usePathname();

  useClickOutside(navRef, () => {
    if (isOpen) setIsOpen(false);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const restoreEntries = () => {
      try {
        const storedEntries = window.localStorage.getItem('nsu-download-history');
        if (storedEntries) {
          const parsedEntries = JSON.parse(storedEntries) as DownloadEntry[];
          if (Array.isArray(parsedEntries)) setDownloadEntries(parsedEntries);
        }
      } catch {
        // Ignore malformed storage values and fall back to an empty list.
      }
    };

    restoreEntries();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleDownloadStatus = (event: Event) => {
      const detail = (event as CustomEvent<DownloadEntry>).detail;
      if (!detail) return;

      setDownloadEntries((previousEntries) => {
        const previousEntry = previousEntries.find((entry) => entry.title === detail.title);
        const nextEntries = previousEntries.filter((entry) => entry.title !== detail.title);
        const now = new Date().toISOString();
        const updatedEntry: DownloadEntry = {
          id: previousEntry?.id ?? `${detail.title}-${now}`,
          title: detail.title,
          status: detail.status,
          progress: detail.progress,
          sourceVideoId: detail.sourceVideoId ?? previousEntry?.sourceVideoId,
          sourceItag: detail.sourceItag ?? previousEntry?.sourceItag,
          sourceExtension: detail.sourceExtension ?? previousEntry?.sourceExtension,
          sourceOutputBitrate: detail.sourceOutputBitrate ?? previousEntry?.sourceOutputBitrate,
          createdAt: previousEntry?.createdAt ?? now,
          updatedAt: now,
        };

        const mergedEntries = [updatedEntry, ...nextEntries].slice(0, 12);
        window.localStorage.setItem('nsu-download-history', JSON.stringify(mergedEntries));
        return mergedEntries;
      });

    };

    window.addEventListener('nsu-download-status', handleDownloadStatus as EventListener);
    return () => {
      window.removeEventListener('nsu-download-status', handleDownloadStatus as EventListener);
    };
  }, []);

  const handleThemeToggle = () => {
    const root = document.documentElement;
    const isDark = root.classList.toggle('dark');
    window.localStorage.setItem('nsu-theme', isDark ? 'dark' : 'light');
  };

  const activeDownloads = downloadEntries.filter((entry) => entry.status === 'downloading');

  return (
    <header
      ref={navRef}
      className="sticky top-1 z-50 w-[97%] mx-auto rounded-xl border-b border-slate-500 bg-backnav/80
      text-primary shadow-2xl shadow-zinc-300/20 backdrop-blur-xl
      dark:border-zinc-800/80 dark:shadow-zinc-950/50"
    >
      <nav className="flex h-12 items-center justify-between px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Logo & Brand Name */}
        <Link
          href="#"
          onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2 text-base sm:text-lg font-bold min-w-0 hover:text-gray-300 transition-colors"
          >
          {/* Your Original SVG Logo */}
          <svg
            viewBox="0 0 710 710"
            width="32"
            height="32"
            aria-hidden="true"
            version="1.1"
            id="svg1"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
          >
            <defs id="defs1" />
            <g
              transform="matrix(0.86124224,0,0,0.86124224,1242.0795,-105.62585)"
              id="g1"
              >
              <circle
                style={{
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 78.5,
                  strokeDasharray: "none",
                }}
                cx="-1030"
                cy="536"
                r="354"
                id="circle1"
              />
              <path
                style={{ fill: "currentColor", strokeWidth: 8.18 }}
                d="m -852.45618,315.52688 c -23.40287,0 -42.6138,19.21094 -42.6138,42.61379 0,19.80844 13.78142,36.56143 32.20008,41.25216 -0.27091,-0.0689 -0.55575,-0.0988 -0.82461,-0.17255 l 0.0386,328.48304 h -65.66619 l -120.7072,-181.75123 h 16.2247 c 0,0 89.33494,141.09078 112.20523,169.16614 h 44.65269 V 448.06692 l -9.33975,-9.51234 -9.33974,-9.51236 0.44105,-0.78629 h 0.0189 c 5.23964,-3.36633 8.72601,-9.25541 8.72605,-15.89867 0,-10.35709 -8.49503,-18.85209 -18.85211,-18.85209 -10.35709,0 -18.87127,8.495 -18.87127,18.85209 0,7.90132 4.96113,14.7347 11.90961,17.52881 1.6215,1.77195 3.42675,3.6784 5.42741,5.73425 l 16.68496,17.12609 v 83.88757 l -13.4055,0.217 V 455.9815 l -19.38908,-19.38305 -18.27678,-19.60006 v -30.4357 c 0,-20.17207 0.0719,-27.07008 1.84111,-31.1261 6.63298,-2.76285 11.33427,-9.32197 11.33427,-16.91511 0,-10.05921 -8.25591,-18.31511 -18.31511,-18.31511 -10.05922,0 -18.31511,8.2559 -18.31511,18.31511 0,7.40156 4.46659,13.82569 10.83563,16.70415 -0.0568,-0.025 -0.11569,-0.0507 -0.17255,-0.0771 1.65531,4.20181 1.70685,12.04698 1.70685,34.88501 v 34.69323 l 17.72059,18.46856 16.64662,19.12059 c 0,0 1.17648,64.63757 -0.15355,97.48245 h -14.0384 l -0.23018,-78.13171 -29.91789,-31.58639 -29.91788,-31.60556 V 406.3925 c 0,-5.82071 0.42553,-9.54285 1.57261,-12.21647 6.19425,-3.04204 10.49043,-9.41995 10.49043,-16.74251 0,-10.23794 -8.40321,-18.64114 -18.64114,-18.64113 -10.23787,0 -18.64107,8.40319 -18.64107,18.64113 0,7.15459 4.1025,13.41072 10.0685,16.53155 1.4529,2.85787 1.8603,7.18864 1.8603,15.87949 v 15.2658 l 29.91782,30.37815 29.91787,30.39734 v 73.91252 h -16.62995 C -1008.6363,487.8419 -1055.1525,415.94831 -1101.3304,343.87224 l -14.959,-23.37814 h -104.1372 v 351.9187 c -17.2107,5.64201 -29.7645,21.91549 -29.7645,40.92612 0,23.64095 19.4139,43.05491 43.0549,43.05491 23.641,0 43.0549,-19.41396 43.0549,-43.05491 0,-19.59729 -13.3451,-36.27303 -31.3754,-41.40558 h -0.019 l -0.326,-0.23018 -0.2302,-326.8337 h 65.8961 l 117.7495,177.59334 h -14.6651 l -109.4715,-166.52755 h -45.5289 l -0.4217,266.6143 c 0,0 5.8913,8.41726 10.0685,12.79181 3.9571,4.1435 5.7313,6.28503 5.9069,7.86303 -6.7381,7.71754 -6.9694,9.83804 -7.3069,14.93977 -0.6884,10.40537 8.5582,19.00554 18.9864,19.00552 10.4281,0 18.9863,-8.57741 18.9863,-19.00552 1.4617,-8.91133 -11.1813,-17.12277 -11.8904,-17.60552 -7.072,-7.51637 -13.6417,-14.90191 -20.9608,-22.17594 0,0 -0.052,-54.59763 0.3443,-81.94574 h 11.085 c 0.389,26.29343 -0.4091,51.62031 0,77.91345 11.7744,12.28102 24.7684,25.63607 36.5535,37.90688 v 31.56721 c 0,19.39571 -0.094,27.00574 -1.5343,31.60555 -5.9752,3.20569 -10.0685,9.51415 -10.0685,16.72333 0,10.41666 8.5505,18.96719 18.9672,18.96717 10.4166,0 18.9671,-8.55051 18.9672,-18.96717 0,-7.752 -4.7334,-14.46456 -11.4494,-17.39456 -1.5433,-4.36605 -1.5918,-12.25838 -1.5918,-33.94529 v -33.92611 c -11.8382,-12.66458 -22.7415,-25.10136 -34.5906,-37.75573 l 0.2426,-98.33038 14.4028,-0.002 v 77.93992 l 59.7015,63.03852 0.058,11.25756 c 0.053,8.90161 -0.8855,12.00026 -5.063,16.0521 -4.4086,3.38994 -7.2685,8.7093 -7.2685,14.65208 0,10.15431 8.3526,18.5069 18.5069,18.5069 10.1543,0 18.4877,-8.35258 18.4877,-18.5069 0,-6.87719 -3.8329,-12.90695 -9.4548,-16.09044 0.022,0.009 0.072,0.0288 0.096,0.0386 0.011,0.005 0.029,0.0136 0.039,0.0189 -1.3486,-2.27948 -1.9753,-7.45133 -1.9753,-16.1288 v -15.45757 c -18.1378,-21.28079 -59.2796,-61.60016 -59.2796,-61.60016 0.7123,-24.0387 0.2306,-73.71922 0.2306,-73.71922 h 7.5556 l 162.00272,241.65682 h 104.65561 c 0,0 -0.10842,-235.8217 -0.0447,-353.85032 -0.15522,0.0507 -0.32315,0.0844 -0.47951,0.13424 17.17496,-5.5004 29.74529,-21.66177 29.74529,-40.58093 0,-23.40285 -19.21095,-42.61379 -42.61381,-42.61379 z m -93.89613,14.30688 c 4.8556,0 8.6877,3.83208 8.6877,8.68768 0,4.8556 -3.8321,8.68771 -8.6877,8.68771 -4.8556,0 -8.68769,-3.83211 -8.68769,-8.68771 0,-4.8556 3.83209,-8.68768 8.68769,-8.68768 z m 93.89613,8.07399 c 11.29659,0 20.23293,8.93634 20.23293,20.23292 0,11.2966 -8.93634,20.21376 -20.23293,20.21376 -11.29659,0 -20.21375,-8.91716 -20.21375,-20.21376 0,-11.29658 8.91716,-20.23292 20.21375,-20.23292 z m -146.30995,30.685 c 4.94185,0 8.84111,3.89926 8.84111,8.84113 0,4.94187 -3.89926,8.84112 -8.84111,8.84112 -4.94187,0 -8.84117,-3.89925 -8.84117,-8.84112 0,-4.94187 3.8993,-8.84113 8.84117,-8.84113 z m 93.47421,34.82749 c 4.99938,0 8.937,3.93765 8.937,8.93702 0,4.99938 -3.93762,8.937 -8.937,8.937 -4.99939,0 -8.95619,-3.93762 -8.95619,-8.937 0,-4.99937 3.9568,-8.93702 8.95619,-8.93702 z m -187.15938,55.04124 c 5.1731,-0.003 9.3703,4.18587 9.3781,9.35892 0,5.18055 -4.1976,9.38092 -9.3781,9.37811 -5.1731,-0.008 -9.3617,-4.20504 -9.3589,-9.37811 0.01,-5.16557 4.1933,-9.35115 9.3589,-9.35892 z m 19.811,29.53432 c 5.1805,-0.003 9.3809,4.19756 9.3781,9.37811 0,5.18054 -4.1976,9.38091 -9.3781,9.37811 -5.1805,0.003 -9.3809,-4.19757 -9.3781,-9.37811 0,-5.18055 4.1976,-9.38092 9.3781,-9.37811 z m -90.1564,7.57537 c 5.1731,0.008 9.3617,4.20504 9.3589,9.3781 0,5.17306 -4.1858,9.37032 -9.3589,9.3781 -5.1805,0.003 -9.3809,-4.19756 -9.3781,-9.3781 0,-5.18055 4.1976,-9.38091 9.3781,-9.3781 z m 108.6058,19.54251 c 5.173,0.008 9.3617,4.20505 9.3589,9.37811 0,5.17306 -4.1859,9.37032 -9.3589,9.37811 -5.1806,0.003 -9.3809,-4.19757 -9.3781,-9.37811 0,-5.18055 4.1975,-9.38092 9.3781,-9.37811 z m 47.8686,23.53156 c 5.173,-0.003 9.3703,4.18587 9.37809,9.35894 0.003,5.18054 -4.19759,9.38091 -9.37809,9.3781 -5.1731,-0.008 -9.3618,-4.20504 -9.3589,-9.3781 0.01,-5.16559 4.1933,-9.35117 9.3589,-9.35894 z m 110.77287,18.10416 c 5.17305,-0.003 9.37032,4.18587 9.3781,9.35892 0.003,5.18055 -4.19756,9.38092 -9.3781,9.37811 -5.17307,-0.008 -9.36175,-4.20504 -9.35894,-9.37811 0.008,-5.16557 4.19335,-9.35115 9.35894,-9.35892 z m -90.96188,11.43017 c 5.18055,-0.003 9.38092,4.19756 9.37811,9.37809 0.003,5.18054 -4.19756,9.38092 -9.37811,9.37811 -5.18054,0.003 -9.38091,-4.19757 -9.37811,-9.37811 -0.003,-5.18053 4.19757,-9.3809 9.37811,-9.37809 z m 18.44936,27.11787 c 5.17306,0.008 9.36174,4.20504 9.35893,9.37811 0.003,5.17305 -4.18587,9.37031 -9.35893,9.3781 -5.18055,0.003 -9.38092,-4.19755 -9.37811,-9.3781 -0.003,-5.18056 4.19756,-9.38093 9.37811,-9.37811 z m -186.75665,53.85219 c 5.0337,0 9.0137,3.96088 9.0137,8.99455 0,5.03366 -3.98,9.01371 -9.0137,9.01371 -5.0337,0 -8.9945,-3.98005 -8.9945,-9.01371 0,-5.03367 3.9608,-8.99455 8.9945,-8.99455 z m 93.3975,35.80557 c 4.9015,0 8.7644,3.86293 8.7644,8.7644 0,4.9015 -3.8629,8.78359 -8.7644,8.78359 -4.9015,0 -8.7836,-3.88205 -8.7836,-8.78359 0,-4.90147 3.8821,-8.7644 8.7836,-8.7644 z m -145.7154,7.95893 c 11.4115,0 20.4055,9.01317 20.4055,20.4247 0,11.41152 -8.994,20.42473 -20.4055,20.42473 -11.4116,0 -20.4247,-9.01321 -20.4247,-20.42473 0,-11.41153 9.0131,-20.4247 20.4247,-20.4247 z m 93.8002,30.22473 c 5.0282,0 8.9946,3.96641 8.9946,8.99454 0,5.02813 -3.9664,8.99455 -8.9946,8.99455 -5.0281,0 -8.9945,-3.96642 -8.9945,-8.99455 0,-5.02813 3.9664,-8.99454 8.9945,-8.99454 z"
                id="path1"
              />
            </g>
          </svg>

          <span className="text-primary transition-colors text-xs font-bold tracking-tight min-[380px]:text-sm sm:text-xl md:text-xl whitespace-nowrap">
            <span className="sm:hidden">NOLL STUDIO UG</span>
            <span className="hidden sm:inline">NOLL STUDIO UGANDA</span>
          </span>

        </Link>

        {/* Desktop Links & Theme Toggle */}
        <div className="hidden md:flex min-w-0 flex-1 items-center justify-end">
          <div className="relative mr-4">
            <Link
              href="/downloads"
              className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/20"
              aria-label="Open downloads"
            >
              <Download size={16} />
              {activeDownloads.length > 0 ? (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                  {activeDownloads.length}
                </span>
              ) : null}
            </Link>
          </div>
          <ul className="flex items-center gap-6 text-sm font-medium">
          <li>
            <Link
              href="/"
              className={`transition-colors py-2 relative ${
                pathname === '/'
                  ? 'text-navlink font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5'
                  : 'text-primary hover:text-amber-900'
              }`}
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              href="/Feature"
              className={`transition-colors py-2 relative ${
                pathname === '/Feature'
                  ? 'text-navlink font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5'
                  : 'text-primary hover:text-amber-900'
              }`}
            >
              Features
            </Link>
          </li>
          <li>
            <Link
              href="/about"
              className={`transition-colors py-2 relative ${
                pathname === '/about'
                  ? 'text-navlink font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5'
                  : 'text-primary hover:text-amber-900'
              }`}
            >
              About NSU
            </Link>
          </li>
          <li>
            {/* Desktop Theme Toggle Button */}
            <button
              onClick={handleThemeToggle}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-primary hover:bg-gray-700/10 dark:hover:bg-zinc-800"
              aria-label="Toggle Theme"
            >
              <svg className="w-4 h-4 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg className="w-4 h-4 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>
          </li>
          </ul>
        </div>

        {/* Mobile Actions Container: Theme Toggle + Hamburger Menu */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="relative">
            <Link
              href="/downloads"
              className="rounded-lg p-2 text-primary transition hover:bg-gray-700/10 dark:hover:bg-zinc-800"
              aria-label="Open downloads"
            >
              <Download size={18} />
              {activeDownloads.length > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-slate-950">
                  {activeDownloads.length}
                </span>
              ) : null}
            </Link>
          </div>
          {/* Mobile Theme Toggle Button (Always Visible) */}
          <button
            onClick={handleThemeToggle}
            className="p-2 text-primary hover:bg-gray-700/10 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Toggle Theme"
          >
            <svg className="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg className="w-5 h-5 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>

          {/* Hamburger Menu Button */}
          <button
            onClick={() => setIsOpen((prev) => !prev)}
            type="button"
            className="shrink-0 p-2 text-primary hover:bg-gray-700/10 dark:hover:bg-zinc-800 rounded-lg focus:outline-none transition-colors"
            aria-controls="mobile-menu"
            aria-expanded={isOpen}
            aria-label="Toggle navigation menu"
          >
            <svg
              className="w-6 h-6 transform transition-transform duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Dropdown Menu */}
      {isOpen && (
        <div
          id="mobile-menu"
          className="absolute top-full left-4 right-4 mt-2 rounded-2xl border border-zinc-800 bg-backnav p-3 shadow-2xl backdrop-blur-xl md:hidden space-y-1 z-50"
        >
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors ${
              pathname === '/'
                ? 'text-navlink bg-amber-500/10 font-semibold'
                : 'text-primary hover:text-amber-400 hover:bg-zinc-800/80'
            }`}
          >
            Home
          </Link>
          <Link
            href="/Feature"
            onClick={() => setIsOpen(false)}
            className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors ${
              pathname === '/Feature'
                ? 'text-navlink bg-amber-500/10 font-semibold'
                : 'text-primary hover:text-amber-400 hover:bg-zinc-800/80'
            }`}
          >
            Features
          </Link>
          <Link
            href="/about"
            onClick={() => setIsOpen(false)}
            className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors ${
              pathname === '/about'
                ? 'text-navlink bg-amber-500/10 font-semibold'
                : 'text-primary hover:text-amber-400 hover:bg-zinc-800/80'
            }`}
          >
            About NSU
          </Link>
        </div>
      )}
    </header>
  );
};

export default Navbar;
