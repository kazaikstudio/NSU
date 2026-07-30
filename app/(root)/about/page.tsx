'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type TabType = 'spark' | 'moment';

interface Founder {
  name: string;
  role: string;
  imageSrc: string;
  description: string;
}

interface StorageItem {
  icon: string;
  title: string;
  description: string;
}

interface Testimonial {
  id: string;
  tabLabel: string;
  name: string;
  imageSrc: string;
  text: string;
}

// Data Sets
const FOUNDERS: Founder[] = [
  {
    name: 'KAZAIK 3D',
    role: 'Lead Producer & Director',
    imageSrc: '/Pic/founder1.jpg',
    description:
      'By afternoon, the studio completely transforms. The lights go up, the camera lenses are polished, and the recorders start rolling.',
  },
  {
    name: 'PRO SONYERICK',
    role: 'Chief Audio Engineer',
    imageSrc: '/Pic/founder2.jpg',
    description:
      'The real magic happens in the editing suite. Frame by frame, we stitch stories together, adding precise rhythm and master visual color trims.',
  },
  {
    name: 'DJ LONELY 256',
    role: 'Visual & Lighting Specialist',
    imageSrc: '/Pic/founder3.jpg',
    description:
      'Managing high-energy music video productions and professional corporate layouts to ensure "good enough" is never the standard.',
  },
  {
    name: 'YUSUF KOMAKECH',
    role: 'Investor & Executive Producer',
    imageSrc: '/Pic/founder4.jpg',
    description:
      'Providing the strategic funding and resources needed to elevate production value, fuel creative innovation, and drive expansion.',
  },
];

const STORAGE_ITEMS: StorageItem[] = [
  {
    icon: '💾',
    title: 'Fastest Flash Disks',
    description:
      'Need to move a large project file safely? We have highest speed transfer drives ready for instant deployment.',
  },
  {
    icon: '⚡',
    title: 'High-Capacity Memory Cards',
    description:
      'Need more room for your memories? Our shelves are fully stocked with high-performance media storage arrays.',
  },
];

const PORTFOLIO_ITEMS = [
  {
    type: 'image',
    src: '/Pic/logo1.jpg',
    alt: '2D Minimalist Brand Identity',
    title: 'Modern Flat Identity',
    tag: '2D Vector Asset',
  },
  {
    type: 'image',
    src: '/Pic/logo2.jpg',
    alt: '3D Embossed Logo Presentation',
    title: '3D Dimensional Mockup',
    tag: 'Social Media Depth File',
  },
  {
    type: 'image',
    src: '/Pic/logo3.jpg',
    alt: 'Corporate Branding Asset',
    title: 'Corporate Typography',
    tag: 'Print & Digital Master',
  },
  {
    type: 'video',
    src: '/Pic/logo4_preview.mp4',
    poster: '/Pic/logo4.jpg',
    alt: '3D Textured Emblem',
    title: '3D Textured Emblem',
    tag: 'Vibrant Motion Graphics Ready',
  },
];

const PRODUCTION_TOOLS = [
  { name: 'FreeCAD', category: 'Advanced CAD 3D Modeling', icon: 'F' },
  { name: 'Blender', category: '3D Animation & VFX Rendering', icon: '🟠' },
  { name: 'DaVinci Resolve', category: 'Editing & Master Color Grading', icon: '🎨' },
  { name: 'Premiere Pro', category: 'Timeline Post-Production Video Cuts', icon: 'PR' },
  { name: 'After Effects', category: 'Motion Graphics & Compositing Spatial Pipeline', icon: 'AE' },
  { name: 'Nuke', category: 'Motion Graphics & Compositing Spatial Pipeline', icon: 'N' },
  { name: 'Adobe Photoshop', category: 'Raster Asset Manipulation', icon: '📷' },
  { name: 'Inkscape', category: 'Vector Graphic & Illustration', icon: '✒️' },
];

const DEV_SERVICES = [
  {
    icon: '🌐',
    title: 'Web Design & Systems',
    description:
      'Architecting lightning-fast, secure, and modern websites. Responsive user experiences built cleanly with highly optimized interactive components.',
    tech: 'HTML5 / CSS Grid / JS Module Architecture',
    highlighted: false,
  },
  {
    icon: '👣',
    title: 'Linux GNOME App Development',
    description:
      'Building specialized, high-performance desktop apps. Pure C engineering layered natively within the modern GTK4 and libadwaita ecosystems.',
    tech: 'C Language / GTK4 / Libadwaita / GObject',
    highlighted: true,
  },
  {
    icon: '🪟',
    title: 'Windows Applications',
    description:
      'Custom desktop program compilation optimized for Windows OS pipelines, designed to manage high-efficiency backend local data workflows.',
    tech: 'Desktop Tooling & Native Frameworks',
    highlighted: false,
  },
  {
    icon: '🛠️',
    title: 'Software Deployments',
    description:
      'Advanced operating system installations, local software stack environment updates, environment debugging, and system configurations.',
    tech: 'OS Provisioning / Sandboxing / Environment Setup',
    highlighted: false,
  },
];

const TESTIMONIALS: Testimonial[] = [
  {
    id: 'tpl-business',
    tabLabel: 'Business Opening',
    name: 'SILVANO MICHEAL',
    imageSrc: '/Pic/client1.jpg',
    text: 'Big shoutout to the team behind my new look! 🎉 If you need someone to turn a simple idea into absolute magic, you have to check out this space in Atiak. From gorgeous 2D branding to mind-blowing 3D logos, they completely brought my vision to life. The creativity here is unmatched! Go show them some love! 📍✨ #CreativeSanctuary #SupportLocal #UgandaCreatives #BrandingGenius',
  },
  {
    id: 'tpl-birthday',
    tabLabel: 'Birthday Blast',
    name: 'AHMED, Birthday Event Organizer',
    imageSrc: '/Pic/client2.jpg',
    text: 'Leveling up today! 🎉 Level up your visual footprints with high-energy birthday reels, customized event portrait graphics, and pristine cinematic highlight cuts compiled frame-by-frame. Captured, masterfully color-graded, and saved securely. Stop scrolling and start celebrating! ✨🎂 #BirthdayReels #VFXRendering #CinematicEdits #KampalaVibe',
  },
  {
    id: 'tpl-invite',
    tabLabel: 'Event Invitation',
    name: 'Boy Labz, Event Coordinator',
    imageSrc: '/Pic/client3.jpg',
    text: 'You are cordially invited to witness creativity in motion. ✉️🎬 Join the inner circle at NOLL STUDIO for an exclusive preview of high-end asset workflows, advanced 3D motion simulations, and pure native desktop system demonstrations. Secure your space, save the date, and bring your raw sketches. 📩 DM us to reserve your pass! #ExclusiveInvite #NollStudio #CreativeCommunity #DesignThinking',
  },
];

export default function About() {
  const [activeTab, setActiveTab] = useState<TabType>('spark');
  const [activeTestimonialTab, setActiveTestimonialTab] = useState<string>('tpl-business');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Main Container Content */}
      <main className="relative flex-1 overflow-hidden py-12 sm:py-20 lg:py-32">
        {/* Background Glow Accents */}
        <div className="pointer-events-none absolute -top-40 -left-40 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl sm:h-96 sm:w-96" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-72 w-72 rounded-full bg-orange-600/10 blur-3xl sm:h-96 sm:w-96" />

        {/* Main Hero Header Section */}
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
          <header className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-16">
            {/* Hero Visual Container */}
            <div className="relative group lg:col-span-6">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-amber-500 to-orange-600 opacity-30 blur transition duration-500 group-hover:opacity-60" />

              <div className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900 shadow-2xl">
                <Image
                  src="/Pic/Noll visuals.png"
                  alt="Noll Studio Creative Space"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-transparent to-transparent" />
              </div>
            </div>

            {/* Hero Text Content */}
            <div className="flex flex-col justify-center space-y-6 lg:col-span-6 sm:space-y-8">
              <div className="space-y-3 sm:space-y-4">
                <div className="text-center sm:text-left">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    Welcome To Noll Studio Uganda
                  </div>
                </div>

                <h1 className="text-center text-3xl font-extrabold tracking-tight text-white sm:text-left sm:text-5xl lg:text-6xl">
                  OUR CREATIVE{' '}
                  <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                    STORY
                  </span>
                </h1>

                <p className="text-center text-base font-normal leading-relaxed text-zinc-400 sm:text-left sm:text-lg">
                  In the heart of the bustling streets, where creativity meets the digital pulse of the city, lies a sanctuary for creators.
                </p>

              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:gap-4 pt-2">
                <a
                  href="https://wa.me/+256740460220"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-semibold text-zinc-950 transition-all duration-300 hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/20 active:scale-95"
                >
                  <span>Work With Us</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>

                <a
                  href="https://www.youtube.com/@Nollvisuals"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Subscribe on YouTube"
                  className="flex items-center justify-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-6 py-3.5 text-sm font-semibold text-zinc-200 backdrop-blur-sm transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white active:scale-95"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-red-500"
                  >
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
                  </svg>
                  <span>YouTube</span>
                </a>
              </div>
            </div>

          </header>
        </div>

        {/* Tabs & Creative Process Section */}
        <section className="container mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center sm:justify-start">
            <div className="flex w-full flex-wrap justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-1.5 backdrop-blur-md sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab('spark')}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold transition-colors duration-300 sm:flex-none sm:px-6 sm:text-sm ${
                  activeTab === 'spark' ? 'text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {activeTab === 'spark' && (
                  <motion.div
                    layoutId="activeTabBackground"
                    className="absolute inset-0 rounded-xl bg-amber-500 shadow-lg shadow-amber-500/20"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="relative z-10">The Spark of Creation</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('moment')}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold transition-colors duration-300 sm:flex-none sm:px-6 sm:text-sm ${
                  activeTab === 'moment' ? 'text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {activeTab === 'moment' && (
                  <motion.div
                    layoutId="activeTabBackground"
                    className="absolute inset-0 rounded-xl bg-amber-500 shadow-lg shadow-amber-500/20"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="relative z-10">Capturing The Moment</span>
              </button>
            </div>
          </div>

          {/* Dynamic Tab Panes */}
          <div className="mt-2 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-sm sm:p-8 md:p-12">
            <AnimatePresence mode="wait">
              {activeTab === 'spark' ? (
                <motion.div
                  key="spark"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4 sm:space-y-6"
                >
                  <div className="inline-block rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-400">
                    Phase 01 / Design &amp; Branding
                  </div>

                  <h2 className="text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
                    The Spark of Creation
                  </h2>

                  <div className="space-y-4 text-base leading-relaxed text-zinc-300 sm:text-lg">
                    <p>
                      <strong className="text-amber-400">NOLL STUDIO UGANDA</strong> wasn&apos;t built just to be a shop; it was built to be the place where ideas—no matter how big or small—finally get their wings.
                    </p>
                    <p>
                      The day usually begins with the hum of high-powered processors. A local entrepreneur walks in with nothing but a rough sketch on paper. By midday, our team transforms that sketch into a sleek 2D logo for their storefront and a dynamic 3D version that pops off the screen.
                    </p>
                    <p>
                      But we don&apos;t stop at symbols. On our walls, vibrant custom posters capture the eye, proving that color and paper are just as important as digital pixels.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="moment"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4 sm:space-y-6"
                >
                  <div className="inline-block rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-400">
                    Phase 02 / Video &amp; Production
                  </div>

                  <h2 className="text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
                    Capturing The Moment
                  </h2>

                  <div className="space-y-4 text-base leading-relaxed text-zinc-300 sm:text-lg">
                    <p>
                      By afternoon, the studio completely transforms. The lights go up, the camera lenses are polished, and the recorders start rolling. Whether it&apos;s a high-energy music video or a clean corporate shoot, the crew at <strong className="text-amber-400">NOLL STUDIO</strong> knows that &quot;good enough&quot; isn&apos;t an option.
                    </p>
                    <p>
                      The real magic happens in the editing suite. Frame by frame, we stitch stories together, adding precise rhythm, visual cut alignments, and master colors that command attention.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Storage & Hardware Section */}
        <section className="relative overflow-hidden py-12 text-zinc-100 sm:py-16 lg:py-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-4 text-center">

              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                YOUR IDEAS ARE <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">SAFELY STORED</span>
              </h2>

              <p className="mx-auto max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                We know that in this digital age, a masterpiece is only as good as its backup safety pipeline. That&apos;s why Noll remains a highly reliable hardware hub for your media essentials.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {STORAGE_ITEMS.map((item, index) => (
                <div
                  key={index}
                  className="group relative rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 backdrop-blur-sm transition-all duration-300 hover:border-amber-500/50 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-amber-500/10 sm:p-8"
                >
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-2xl">
                      {item.icon}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-white transition-colors group-hover:text-amber-400">
                        {item.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Leadership & Founders Section */}
        <section className="relative overflow-hidden py-16 text-zinc-100 lg:py-24">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
            <div className="space-y-4 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                MEET THE <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">FOUNDERS</span>
              </h2>

              <p className="mx-auto max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                The visionary creative minds steering the visual and audio landscape at Noll Studio Uganda.
              </p>
            </div>

            {/* Component State & Ref Handler */}
            {(() => {
              const [activeIndex, setActiveIndex] = useState(0);
              const scrollRef = useRef<HTMLDivElement>(null);

              const handleScroll = () => {
                if (!scrollRef.current) return;
                const container = scrollRef.current;
                const scrollPosition = container.scrollLeft;
                const cardWidth = container.clientWidth;
                const newIndex = Math.round(scrollPosition / cardWidth);
                setActiveIndex(newIndex);
              };

              const scrollToCard = (index: number) => {
                if (!scrollRef.current) return;
                const container = scrollRef.current;
                const cardWidth = container.clientWidth;
                container.scrollTo({
                  left: cardWidth * index,
                  behavior: 'smooth',
                });
              };

              return (
                <div className="mt-12">
                  {/* Mobile Swipe Container + Desktop Grid */}
                  <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 sm:gap-6 lg:gap-8"
                  >
                    {FOUNDERS.map((founder, index) => (
                      <div
                        key={index}
                        className="w-full shrink-0 snap-center px-1 sm:w-auto sm:shrink sm:snap-align-none sm:px-0"
                      >
                        <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/60 transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-zinc-900/90 hover:shadow-xl hover:shadow-amber-500/10">
                          <div className="relative aspect-[4/5] overflow-hidden bg-zinc-800">
                            <Image
                              src={founder.imageSrc}
                              alt={`${founder.name} - ${founder.role}`}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                              className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />
                          </div>

                          <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
                            <div className="space-y-2">
                              <h3 className="text-lg font-bold tracking-wide text-white transition-colors group-hover:text-amber-400 sm:text-xl">
                                {founder.name}
                              </h3>
                              <span className="block text-xs font-semibold uppercase tracking-wider text-amber-500">
                                {founder.role}
                              </span>
                              <p className="pt-2 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                                {founder.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mobile Pagination Dots (Hidden on sm and above) */}
                  <div className="mt-6 flex justify-center gap-2 sm:hidden">
                    {FOUNDERS.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => scrollToCard(index)}
                        aria-label={`Go to slide ${index + 1}`}
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          activeIndex === index
                            ? 'w-7 bg-amber-400'
                            : 'w-2.5 bg-zinc-700 hover:bg-zinc-500'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* Core Mission */}
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <section className="group relative my-8 overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-6 backdrop-blur-md transition-all duration-300 hover:border-amber-500/30 hover:bg-zinc-900/70 sm:p-8 md:p-12">
            <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl opacity-50 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Our Core Mission
              </div>

              <h3 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
                THE NOLL{' '}
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                  PHILOSOPHY
                </span>
              </h3>

              <p className="text-base leading-relaxed text-zinc-300 sm:text-lg">
                At <strong className="font-semibold text-amber-400">NOLL STUDIO UGANDA</strong>, we believe that every story deserves to be told with world-class quality. We aren&apos;t just selling gadgets or editing clips; we are building the visual identity of our community, one pixel at a time.
              </p>
            </div>
          </section>
        </div>

        {/* Visual Showcase */}
        <section className="relative my-16 text-zinc-100 sm:my-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
            <div className="space-y-3 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                IDENTITY DESIGN <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">PORTFOLIO</span>
              </h2>
              <p className="mx-auto max-w-2xl text-base text-zinc-400 sm:text-lg">
                From flat 2D brand concepts to stunning 3D dimensional showpieces.
              </p>
            </div>

            {(() => {
              const [activeIndex, setActiveIndex] = useState(0);
              const scrollRef = useRef<HTMLDivElement>(null);

              const handleScroll = () => {
                if (!scrollRef.current) return;
                const container = scrollRef.current;
                const scrollPosition = container.scrollLeft;
                const cardWidth = container.clientWidth;
                const newIndex = Math.round(scrollPosition / cardWidth);
                setActiveIndex(newIndex);
              };

              const scrollToCard = (index: number) => {
                if (!scrollRef.current) return;
                const container = scrollRef.current;
                const cardWidth = container.clientWidth;
                container.scrollTo({
                  left: cardWidth * index,
                  behavior: 'smooth',
                });
              };

              return (
                <div className="mt-12">
                  {/* Mobile Swipe Container + Desktop Grid */}
                  <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 sm:gap-6 lg:gap-8"
                  >
                    {PORTFOLIO_ITEMS.map((item, index) => (
                      <div
                        key={index}
                        className="w-full shrink-0 snap-center px-1 sm:w-auto sm:shrink sm:snap-align-none sm:px-0"
                      >
                        <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-zinc-900/90 hover:shadow-xl hover:shadow-amber-500/10">
                          <div className="relative aspect-square overflow-hidden bg-zinc-950">
                            {item.type === 'video' ? (
                              <video
                                autoPlay
                                loop
                                muted
                                playsInline
                                poster={item.poster}
                                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                              >
                                <source src={item.src} type="video/mp4" />
                                Your browser does not support the video tag.
                              </video>
                            ) : (
                              <Image
                                src={item.src}
                                alt={item.alt}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-60" />
                          </div>

                          <div className="flex flex-1 flex-col justify-between p-5">
                            <div className="space-y-1">
                              <h5 className="text-lg font-bold text-white transition-colors group-hover:text-amber-400">
                                {item.title}
                              </h5>
                              <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                {item.tag}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mobile Pagination Dots */}
                  <div className="mt-6 flex justify-center gap-2 sm:hidden">
                    {PORTFOLIO_ITEMS.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => scrollToCard(index)}
                        aria-label={`Go to item ${index + 1}`}
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          activeIndex === index
                            ? 'w-7 bg-amber-400'
                            : 'w-2.5 bg-zinc-700 hover:bg-zinc-500'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* Production Toolkit */}
        <section className="relative my-16 text-zinc-100 sm:my-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
            <div className="space-y-3 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                OUR PRODUCTION <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">TOOLKIT</span>
              </h2>
              <p className="mx-auto max-w-2xl text-base text-zinc-400 sm:text-lg">
                We build with elite, industry-standard systems to ensure flawless audio, 3D dynamics, and visual master-grade cuts.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PRODUCTION_TOOLS.map((tool, index) => (
                <div
                  key={index}
                  className="group relative flex items-center gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 backdrop-blur-sm transition-all duration-300 hover:border-amber-500/50 hover:bg-zinc-900/90 hover:shadow-lg hover:shadow-amber-500/10"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-zinc-950 font-mono text-lg font-bold text-amber-400 transition-colors group-hover:bg-amber-500 group-hover:text-zinc-950">
                    {tool.icon}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    <h4 className="truncate text-base font-bold text-white transition-colors group-hover:text-amber-400">
                      {tool.name}
                    </h4>
                    <span className="block truncate text-xs font-medium text-zinc-400">
                      {tool.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Engineering Services */}
        <section className="relative my-16 text-zinc-100 sm:my-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
            <div className="space-y-3 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                ENGINEERING &amp; DEVELOPMENT <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">SERVICES</span>
              </h2>
              <p className="mx-auto max-w-2xl text-base text-zinc-400 sm:text-lg">
                From modern web platforms to native Linux system apps, we compile robust, pixel-perfect software solutions.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {DEV_SERVICES.map((service, index) => (
                <div
                  key={index}
                  className={`group relative overflow-hidden rounded-2xl border p-6 sm:p-8 backdrop-blur-sm transition-all duration-300 ${
                    service.highlighted
                      ? 'border-amber-500/50 bg-zinc-900/90 shadow-xl shadow-amber-500/10'
                      : 'border-zinc-800/80 bg-zinc-900/60 hover:border-amber-500/40 hover:bg-zinc-900/80'
                  }`}
                >
                  <div
                    className={`absolute left-0 top-0 h-full w-1.5 ${
                      service.highlighted ? 'bg-gradient-to-b from-amber-400 to-orange-500' : 'bg-zinc-800 group-hover:bg-amber-500/50'
                    }`}
                  />

                  <div className="space-y-4 sm:pl-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-2xl">
                      {service.icon}
                    </div>

                    <h3 className="text-xl font-bold text-white transition-colors group-hover:text-amber-400">
                      {service.title}
                    </h3>

                    <p className="text-sm leading-relaxed text-zinc-300">
                      {service.description}
                    </p>

                    <div className="pt-2">
                      <span className="inline-block rounded-md border border-zinc-700/60 bg-zinc-950/80 px-3 py-1 font-mono text-xs font-medium text-amber-400">
                        {service.tech}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social Links Section */}
        <section className="relative my-16 text-zinc-100 sm:my-20">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-6 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                🚀 Connect With Us
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-4 pt-2">
                <a
                  href="http://www.youtube.com/@KAZAIK3D"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Subscribe on YouTube"
                  className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-400 transition-all duration-300 hover:border-red-500/50 hover:bg-red-500/20 hover:scale-105"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
                  </svg>
                  <span>YouTube</span>
                </a>

                <a
                  href="https://www.youtube.com/redirect?event=channel_description&redir_token=QUFFLUhqbXVEUG92SnZGVjBkVXFMNXpKQnAyLWozSW1zZ3xBQ3Jtc0ttNFlIRl9LX2Qxa25TM1E0SHE2T1Zyd2xUVUFYVE9Meno2Uml4bHk1WEozazF5ZTFIV3lYdmhWZkQ2ajVWVU9IenB2N1ZLb21aTUdNNTN0SHZpbzA5a3MyZE5TdHZRM09ZZXF6ZC1DcmgtMGJHdUJJbw&q=https%3A%2F%2Fwww.facebook.com%2Fprofile.php%3Fid%3D100069576258694"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Follow on Facebook"
                  className="flex items-center gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-5 py-3 text-sm font-semibold text-blue-400 transition-all duration-300 hover:border-blue-500/50 hover:bg-blue-500/20 hover:scale-105"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                  </svg>
                  <span>Facebook</span>
                </a>

                <a
                  href="https://wa.me/+256740460220"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Chat on WhatsApp"
                  className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-400 transition-all duration-300 hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:scale-105"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span>WhatsApp</span>
                </a>

                <a
                  href="https://www.youtube.com/redirect?event=channel_description&redir_token=QUFFLUhqbUpmemx3NWlwSHRZS24zazJLd2FhXzd3WEF4Z3xBQ3Jtc0tuOEM4eDFvdTRNUmY4OWVvTEhJM3NGZDFpUWhHN0dWemJ6TFdPUDBVVzFnZmZXcm9yT1NQMXhFMG56WEpKeUdOcG5GNENRZk1vOF8xUXhqeU5CWkZzRFpFc1ZYWTNHMEwwTE1nNlQ2Y2oyaVROSnFlYw&q=https%3A%2F%2Fwww.instagram.com%2Fkazaik3d%2F"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Follow on Instagram"
                  className="flex items-center gap-2.5 rounded-xl border border-pink-500/20 bg-pink-500/10 px-5 py-3 text-sm font-semibold text-pink-400 transition-all duration-300 hover:border-pink-500/50 hover:bg-pink-500/20 hover:scale-105"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                  <span>Instagram</span>
                </a>

                <a
                  href="https://www.youtube.com/redirect?event=channel_description&redir_token=QUFFLUhqbVpEeU1BV3M4Wmg5QmZDQVRMNW80WE52dUNud3xBQ3Jtc0ttOTZXVkJEcnlFTG5QUW9pZkJFYndpNExuT2NCem05THY0X2paZU5sWWxHSy1RUkYxb2dGOEdFT0FQOXR5ZmNZdlk4Zk1XR3pockNSNm4yRHJYMUdndGU1X28wa3JMSTBRUEJUX0xVVGpqcUUwTGhCOA&q=https%3A%2F%2Fkazaik.artstation.com%2F"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View Portfolio on ArtStation"
                  className="flex items-center gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/10 px-5 py-3 text-sm font-semibold text-sky-400 transition-all duration-300 hover:border-sky-500/50 hover:bg-sky-500/20 hover:scale-105"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  <span>ArtStation</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Client Testimonials Section */}
        <section className="relative text-zinc-100">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-3 text-center">
              <h3 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
                📋 Client Testimonials &amp; Success Stories ✨
              </h3>
              <p className="mx-auto max-w-2xl text-base text-zinc-400 sm:text-lg">
                See how we help local creators, brands, and businesses push boundaries and shape the digital landscape:
              </p>
            </div>

            {/* Testimonial Nav Tabs */}
            <div className="mt-8 flex justify-center sm:justify-start">
              <div className="flex w-full flex-wrap justify-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-1.5 backdrop-blur-md sm:w-auto">
                {TESTIMONIALS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTestimonialTab(item.id)}
                    className={`relative flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors duration-300 sm:flex-none sm:px-6 sm:text-sm ${
                      activeTestimonialTab === item.id
                        ? 'text-zinc-950'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {activeTestimonialTab === item.id && (
                      <motion.div
                        layoutId="activeTestimonialBg"
                        className="absolute inset-0 rounded-xl bg-amber-500 shadow-lg shadow-amber-500/20"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{item.tabLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Testimonial Content Box */}
            <div className="mt-2 rounded-3xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-sm sm:p-8">
              <AnimatePresence mode="wait">
                {TESTIMONIALS.filter((t) => t.id === activeTestimonialTab).map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col items-center gap-5 text-center md:flex-row md:items-center md:gap-8 lg:gap-10 md:text-left"
                  >
                    {/* User Avatar - Bumped from h-28/w-28 (112px) to h-36/w-36 (144px) mobile, h-48/w-48 (192px) desktop */}
                    <div className="shrink-0">
                      <div className="relative h-90 w-90 overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-zinc-950 shadow-xl sm:h-48 sm:w-48">
                        <Image
                          src={item.imageSrc}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 144px, 192px"
                          className="object-cover object-center"
                        />
                      </div>
                    </div>

                    {/* Content Block */}
                    <div className="flex-1 space-y-3 pt-1 md:pt-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h5 className="text-xl font-bold tracking-wide text-amber-400 sm:text-2xl">
                          {item.name}
                        </h5>

                        {/* Copy Button - Hidden on Mobile, Visible on SM+ */}
                        <button
                          type="button"
                          onClick={() => handleCopyText(item.id, item.text)}
                          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 active:scale-95 sm:inline-flex"
                        >
                          {copiedId === item.id ? 'Copied! ✓' : 'Copy Text'}
                        </button>
                      </div>

                      <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
                        {item.text}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

          </div>
        </section>

      </main>

      {/* Real Footer Element styled with Tailwind CSS */}
      <footer className="border-t border-zinc-800/80 bg-zinc-900/90 text-zinc-300 backdrop-blur-md">
        <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-12">
          <div className="grid grid-cols-1 gap-10 text-center sm:text-left lg:grid-cols-12">
            {/* Brand Summary */}
            <div className="space-y-4 lg:col-span-6">
              <h3 className="text-xl font-extrabold tracking-wider text-amber-400 sm:text-2xl">
                NOLL STUDIO
              </h3>
              <p className="mx-auto max-w-xl text-sm leading-relaxed text-zinc-400 lg:mx-0">
                To our fans who share the spark of our creations, and our clients who trust us to tell their stories—thank you for being the heartbeat of our studio. We don&apos;t just capture moments or compile lines of code; together, we shape the digital landscape of Uganda. Let&apos;s keep pushing the boundaries of what&apos;s possible.
              </p>
            </div>

            {/* Link & Sanctuary Columns */}
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:col-span-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
                  What We Do
                </h4>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li>
                    <a href="#media" className="transition-colors hover:text-amber-400">
                      Audio &amp; Music Pipelines
                    </a>
                  </li>
                  <li>
                    <a href="#logos" className="transition-colors hover:text-amber-400">
                      3D Identity Mockups
                    </a>
                  </li>
                  <li>
                    <a href="#linux" className="transition-colors hover:text-amber-400">
                      GNOME App Engineering
                    </a>
                  </li>
                  <li>
                    <a href="#deployments" className="transition-colors hover:text-amber-400">
                      System Environments
                    </a>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-white">
                  The Sanctuary
                </h4>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li>📍 Kampala, Uganda, Amuru</li>
                  <li>
                    📧{' '}
                    <a href="mailto:kazaikstudioz@gmail.com" className="transition-colors hover:text-amber-400">
                      kazaikstudioz@gmail.com
                    </a>
                  </li>
                  <li>⏰ Mon - Sat: 9:00 AM - 10:00 PM</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 border-t border-zinc-800/80 pt-6 text-center text-xs text-zinc-500">
            <p>&copy; 2026 Noll Studio Uganda. All Rights Reserved. Engineered with Passion.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
