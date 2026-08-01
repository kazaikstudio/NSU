'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Pillar {
  id: string;
  title: string;
  description: string;
  accentClass: string;
  icon: React.ReactNode;
}

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  imageSrc: string;
}

const PILLARS: Pillar[] = [
  {
    id: 'visuals',
    title: 'NOLL VISUALS',
    description:
      'Elite cinematic video shooting, multi-cam frameworks, master color grading, and pristine production editing built frame-by-frame.',
    accentClass: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 7a2 2 0 0 0-2.45-1.45L16 7V5a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2l4.55 1.45A2 2 0 0 0 23 17V7z" />
      </svg>
    ),
  },
  {
    id: 'music',
    title: 'NOLL MUSIC',
    description:
      'A premium collective of recording artists, producers, and sonic creators pushing the boundaries of local and international soundscapes.',
    accentClass: 'border-orange-500/20 bg-orange-500/10 text-orange-400',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    id: 'dancers',
    title: 'NOLL DANCERS',
    description:
      'The high-energy, elite movement team of Noll Studio Uganda, bringing rhythm, visual storytelling, and choreography to life.',
    accentClass: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 21a6 6 0 0 0-12 0" />
        <circle cx="12" cy="10" r="4" />
        <path d="M12 2v2" />
      </svg>
    ),
  },
  {
    id: 'djs',
    title: "NOLL DJ'Z",
    description:
      'Masters of the mix and live transition architecture, curation experts setting the dynamic vibe for exclusive drops and live events.',
    accentClass: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="12" r="3" />
        <path d="M6 9h12" />
        <path d="M6 15h12" />
      </svg>
    ),
  },
];

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Dir KAZAIIK 3D',
    role: 'Visuals Director',
    bio: 'Master of multi-cam setups, cinematic framing tracks, and expert color grading workflows.',
    imageSrc: '/Features/trainer1.jpeg',
  },
  {
    name: 'Pro SONYERICK',
    role: 'Audio Coach',
    bio: 'Vocal coach and arrangement architect specializing in pristine studio recording and native tracking mixes.',
    imageSrc: '/Features/trainer2.jpeg',
  },
  {
    name: 'NIXI NIX',
    role: 'Lead Dance Trainer',
    bio: 'High-energy dance trainer dedicated to teaching rhythmic storytelling, technical precision, and complex synchronization.',
    imageSrc: '/Features/trainer3.jpeg',
  },
  {
    name: 'Steady B',
    role: 'Artistic Dance Trainer',
    bio: 'Master dance educator overseeing technical training curriculum, performance concepts, and multi-style routine development.',
    imageSrc: '/Features/trainer4.jpeg',
  },
  {
    name: 'DJ SNIPE UG',
    role: 'DJ Team Lead',
    bio: 'Master of sequence architectures, live drops, and acoustic room tuning transitions.',
    imageSrc: '/Features/trainer5.jpeg',
  },
];

const Features = () => {
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
    <main>
      {/* Pillars Section */}
      <section className="relative mt-20 text-primary">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
              {/* Header */}
              <div className="space-y-4 text-center">
                <h2 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-5xl">
                  OUR CREATIVE{' '}
                  <span className="bg-linear-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                    PILLARS
                  </span>
                </h2>
                <p className="mx-auto max-w-2xl text-base leading-relaxed text-secondry sm:text-lg">
                  Explore the specialized branches driving the digital and artistic pulse of Noll Studio Uganda.
                </p>
              </div>

              {/* Pillars Grid */}
              <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 lg:gap-8">
                {PILLARS.map((pillar) => (
                  <div
                    key={pillar.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-card1/20 bg-cardcl/60 p-6 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-cardcl/90 hover:shadow-xl hover:shadow-amber-500/10 sm:p-8"
                  >
                    <div className="space-y-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border ${pillar.accentClass} transition-transform duration-300 group-hover:scale-110`}
                      >
                        {pillar.icon}
                      </div>

                      <h3 className="text-xl font-bold tracking-wide text-primary transition-colors group-hover:text-amber-400">
                        {pillar.title}
                      </h3>

                      <p className="text-sm leading-relaxed text-secondry sm:text-base">
                        {pillar.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
      </section>

      {/* Team Section */}
      <section className="relative mt-20 text-primary">
              <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
                {/* Header */}
                <div className="space-y-3 text-center">
                  <h2 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-5xl">
                    The Creative Crew &amp; Trainers
                  </h2>
                  <p className="mx-auto max-w-2xl text-base text-secondry sm:text-lg">
                    Meet the visionary mentors and industry elites guiding the raw talent inside our Kampala sanctuary.
                  </p>
                </div>

                {/* Scrollable Container / Responsive Grid */}
                <div className="mt-12">
                  <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-5 sm:gap-6 lg:gap-6"
                  >
                    {TEAM_MEMBERS.map((member, index) => (
                      <div
                        key={index}
                        className="w-full shrink-0 snap-center px-1 sm:w-auto sm:shrink sm:snap-align-none sm:px-0"
                      >
                        <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-card1/20 bg-cardcl/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-cardcl/90 hover:shadow-xl hover:shadow-amber-500/10">
                          {/* Profile Image & Bottom Role Badge Overlay */}
                          <div className="relative aspect-square overflow-hidden bg-cardcl">
                            <Image
                              src={member.imageSrc}
                              alt={member.name}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                              className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-linear-to-t from-cardcl via-cardcl/40 to-transparent opacity-80" />

                            {/* Role Badge positioned at bottom-left inside the picture */}
                            <div className="absolute bottom-3 left-3 z-10">
                              <span className="inline-block rounded-full border border-amber-500/30 bg-cardcl/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400 backdrop-blur-md sm:px-3 sm:py-1 sm:text-xs">
                                {member.role}
                              </span>
                            </div>
                          </div>

                          {/* Profile Info */}
                          <div className="flex flex-1 flex-col justify-between p-5">
                            <div className="space-y-2">
                              <h3 className="text-lg font-bold text-primary transition-colors group-hover:text-amber-400">
                                {member.name}
                              </h3>
                              <p className="text-xs leading-relaxed text-secondry sm:text-sm">
                                {member.bio}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mobile Pagination Dots Indicator */}
                  <div className="mt-6 flex justify-center gap-2 sm:hidden">
                    {TEAM_MEMBERS.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => scrollToCard(index)}
                        aria-label={`Go to team member ${index + 1}`}
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          activeIndex === index
                            ? 'w-7 bg-amber-400'
                            : 'w-2.5 bg-secondry/40 hover:bg-secondry'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
      </section>

      {/* Students Section */}
      <section className="relative mt-20 text-primary">
              <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
                {/* Header */}
                <div className="space-y-4 text-center">
                  <h2 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-5xl">
                    OUR TALENTED{' '}
                    <span className="bg-linear-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                      STUDENTS
                    </span>
                  </h2>
                  <p className="mx-auto max-w-2xl text-base leading-relaxed text-secondry sm:text-lg">
                    The next generation of Ugandan creatives polishing their crafts daily inside our workspaces.
                  </p>
                </div>

                {/* Students Grid */}
                <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-6 lg:gap-8">

                  {/* Student Card 1 */}
                  <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-card1/20 bg-cardcl/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-cardcl/90 hover:shadow-xl hover:shadow-amber-500/10">
                    <div className="relative aspect-4/5 w-full overflow-hidden bg-cardcl">
                      <Image
                        src="/Features/student1.jpg"
                        alt="Noll Studio Student"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-cardcl via-cardcl/40 to-transparent opacity-90 transition-opacity group-hover:opacity-85" />
                      <div className="absolute inset-0 flex flex-col justify-between p-5">
                        <div>
                          <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-400 backdrop-blur-md">
                            Visuals
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold text-primary transition-colors group-hover:text-amber-400">
                            Kato Emmanuel
                          </h3>
                          <p className="text-xs text-secondry sm:text-sm">
                            Focus: Cinematic Editing &amp; VFX
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Card 2 */}
                  <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-card1/20 bg-cardcl/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-cardcl/90 hover:shadow-xl hover:shadow-amber-500/10">
                    <div className="relative aspect-4/5 w-full overflow-hidden bg-cardcl">
                      <Image
                        src="/Features/student2.jpg"
                        alt="Noll Studio Student"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-cardcl via-cardcl/40 to-transparent opacity-90 transition-opacity group-hover:opacity-85" />
                      <div className="absolute inset-0 flex flex-col justify-between p-5">
                        <div>
                          <span className="inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-400 backdrop-blur-md">
                            Noll Music
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold text-primary transition-colors group-hover:text-amber-400">
                            Nalwanga Proscovia
                          </h3>
                          <p className="text-xs text-secondry sm:text-sm">
                            Focus: Vocal Performance &amp; Audio Sync
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Card 3 */}
                  <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-card1/20 bg-cardcl/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-cardcl/90 hover:shadow-xl hover:shadow-amber-500/10">
                    <div className="relative aspect-4/5 w-full overflow-hidden bg-cardcl">
                      <Image
                        src="/Features/student3.jpg"
                        alt="Noll Studio Student"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-cardcl via-cardcl/40 to-transparent opacity-90 transition-opacity group-hover:opacity-85" />
                      <div className="absolute inset-0 flex flex-col justify-between p-5">
                        <div>
                          <span className="inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-yellow-400 backdrop-blur-md">
                            Noll Dancers
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold text-primary transition-colors group-hover:text-amber-400">
                            Ochen David
                          </h3>
                          <p className="text-xs text-secondry sm:text-sm">
                            Focus: Urban Choreography Track
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Card 4 */}
                  <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-card1/20 bg-cardcl/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-cardcl/90 hover:shadow-xl hover:shadow-amber-500/10">
                    <div className="relative aspect-4/5 w-full overflow-hidden bg-cardcl">
                      <Image
                        src="/Features/student4.jpg"
                        alt="Noll Studio Student"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-cardcl via-cardcl/40 to-transparent opacity-90 transition-opacity group-hover:opacity-85" />
                      <div className="absolute inset-0 flex flex-col justify-between p-5">
                        <div>
                          <span className="inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 backdrop-blur-md">
                            Noll DJ&apos;z
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold text-primary transition-colors group-hover:text-amber-400">
                            Ssemwanga Joel
                          </h3>
                          <p className="text-xs text-secondry sm:text-sm">
                            Focus: Live Transition Systems
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Card 5 */}
                  <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-card1/20 bg-cardcl/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-cardcl/90 hover:shadow-xl hover:shadow-amber-500/10">
                    <div className="relative aspect-4/5 w-full overflow-hidden bg-cardcl">
                      <Image
                        src="/Features/student5.jpg"
                        alt="Noll Studio Student"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-cardcl via-cardcl/40 to-transparent opacity-90 transition-opacity group-hover:opacity-85" />
                      <div className="absolute inset-0 flex flex-col justify-between p-5">
                        <div>
                          <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-400 backdrop-blur-md">
                            Visuals
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold text-primary transition-colors group-hover:text-amber-400">
                            Aisha Kemigisa
                          </h3>
                          <p className="text-xs text-secondry sm:text-sm">
                            Focus: Digital Lighting Architecture
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Card 6 */}
                  <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-card1/20 bg-cardcl/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-cardcl/90 hover:shadow-xl hover:shadow-amber-500/10">
                    <div className="relative aspect-4/5 w-full overflow-hidden bg-cardcl">
                      <Image
                        src="/Features/student6.jpg"
                        alt="Noll Studio Student"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-cardcl via-cardcl/40 to-transparent opacity-90 transition-opacity group-hover:opacity-85" />
                      <div className="absolute inset-0 flex flex-col justify-between p-5">
                        <div>
                          <span className="inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-400 backdrop-blur-md">
                            Noll Music
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold text-primary transition-colors group-hover:text-amber-400">
                            Mugisha Brian
                          </h3>
                          <p className="text-xs text-secondry sm:text-sm">
                            Focus: Beats Engineering &amp; Production
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Card 7 */}
                  <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-card1/20 bg-cardcl/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-cardcl/90 hover:shadow-xl hover:shadow-amber-500/10">
                    <div className="relative aspect-4/5 w-full overflow-hidden bg-cardcl">
                      <Image
                        src="/Features/student7.jpg"
                        alt="Noll Studio Student"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-cardcl via-cardcl/40 to-transparent opacity-90 transition-opacity group-hover:opacity-85" />
                      <div className="absolute inset-0 flex flex-col justify-between p-5">
                        <div>
                          <span className="inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-400 backdrop-blur-md">
                            Noll Music
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold text-primary transition-colors group-hover:text-amber-400">
                            Mugisha Brian
                          </h3>
                          <p className="text-xs text-secondry sm:text-sm">
                            Focus: Beats Engineering &amp; Production
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Card 8 */}
                  <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-card1/20 bg-cardcl/60 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-cardcl/90 hover:shadow-xl hover:shadow-amber-500/10">
                    <div className="relative aspect-4/5 w-full overflow-hidden bg-cardcl">
                      <Image
                        src="/Features/student8.jpg"
                        alt="Noll Studio Student"
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-cardcl via-cardcl/40 to-transparent opacity-90 transition-opacity group-hover:opacity-85" />
                      <div className="absolute inset-0 flex flex-col justify-between p-5">
                        <div>
                          <span className="inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-400 backdrop-blur-md">
                            Noll Music
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold text-primary transition-colors group-hover:text-amber-400">
                            Mugisha Brian
                          </h3>
                          <p className="text-xs text-secondry sm:text-sm">
                            Focus: Beats Engineering &amp; Production
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
      </section>

      <section className="relative mt-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
                  {/* Group Hero Frame / Glass Panel */}
                  <div className="group relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/60 shadow-2xl backdrop-blur-sm transition-all duration-500 hover:border-amber-500/40">

                    {/* Background Hero Image */}
                    <div className="relative min-h-[480px] w-full sm:min-h-[520px] lg:min-h-[600px]">
                      <Image
                        src="/Features/everyone.jpg"
                        alt="Noll Studio Uganda - Full Creative Family"
                        fill
                        priority
                        sizes="(max-width: 1280px) 100vw, 1280px"
                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                      />

                      {/* Gradient Overlay for Text Contrast */}
                      <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/20" />

                      {/* Content Overlay */}
                      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 lg:p-14">
                        <div className="max-w-3xl space-y-4">

                          {/* Studio Badge */}
                          <div>
                            <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 backdrop-blur-md sm:text-sm">
                              ONE FAMILY 🇺🇬
                            </span>
                          </div>

                          {/* Title & Description */}
                          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                            United in Creativity, Driven by Passion
                          </h2>
                          <p className="text-base leading-relaxed text-zinc-300 sm:text-lg lg:text-xl">
                            Trainers, students, and artists operating under one roof to build the future of Uganda&apos;s digital art landscape.
                          </p>
                        </div>

                        {/* Stats Row */}
                        <div className="mt-8 pt-8 border-t border-zinc-800/80">
                          <div className="flex flex-wrap items-center justify-between gap-6 sm:justify-start sm:gap-12">

                            {/* Stat Node 1 */}
                            <div className="flex flex-col">
                              <span className="text-3xl font-black text-amber-400 sm:text-4xl lg:text-5xl">
                                5+
                              </span>
                              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 sm:text-sm">
                                Elite Trainers
                              </span>
                            </div>

                            {/* Divider */}
                            <div className="hidden h-10 w-px bg-zinc-800/80 sm:block" />

                            {/* Stat Node 2 */}
                            <div className="flex flex-col">
                              <span className="text-3xl font-black text-amber-400 sm:text-4xl lg:text-5xl">
                                20+
                              </span>
                              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 sm:text-sm">
                                Active Students
                              </span>
                            </div>

                            {/* Divider */}
                            <div className="hidden h-10 w-px bg-zinc-800/80 sm:block" />

                            {/* Stat Node 3 */}
                            <div className="flex flex-col">
                              <span className="text-3xl font-black text-amber-400 sm:text-4xl lg:text-5xl">
                                4
                              </span>
                              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 sm:text-sm">
                                Creative Branches
                              </span>
                            </div>

                          </div>
                        </div>

                      </div>
                    </div>

                  </div>
        </div>
      </section>

      <section className="relative mt-20 mb-5 text-primary">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
                {/* Glass Panel Container with Glow Background */}
                <div className="relative overflow-hidden rounded-3xl border border-card1/20 bg-cardcl/60 p-8 shadow-2xl backdrop-blur-md sm:p-12 lg:p-16">

                  {/* Glow Background Ambient Particles Blend */}
                  <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />

                  {/* CTA Content */}
                  <div className="relative z-10 mx-auto max-w-3xl space-y-6 text-center">
                    {/* Mini Tag */}
                    <div>
                      <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 backdrop-blur-md sm:text-sm">
                        YOUR TIME IS NOW ⚡
                      </span>
                    </div>

                    {/* Heading */}
                    <h2 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-5xl">
                      Ready to Shape Your Creative Future?
                    </h2>

                    {/* Description */}
                    <p className="text-base leading-relaxed text-secondry sm:text-lg lg:text-xl">
                      Whether you want to master cinematic video production, drop hit tracks, dominate the dance floor, or control the mix as a professional DJ—your sanctuary is waiting inside Kampala.
                    </p>

                    {/* Action Buttons Wrapper */}
                    <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row sm:gap-6">
                      <Link
                        href="/about#Contact_Us"
                        className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-base font-bold text-zinc-950 transition-all duration-300 hover:scale-105 hover:from-amber-400 hover:to-orange-400 hover:shadow-lg hover:shadow-amber-500/25 active:scale-95"
                      >
                        Join Noll Studio Uganda
                      </Link>

                      <Link
                        href="/about"
                        className="inline-flex items-center justify-center rounded-xl border border-card1/20 bg-cardcl/50 px-8 py-3.5 text-base font-semibold text-primary backdrop-blur-md transition-all duration-300 hover:border-card1/40 hover:bg-cardcl hover:text-amber-400 active:scale-95"
                      >
                        Learn More
                      </Link>
                    </div>
                  </div>

                </div>
        </div>
      </section>

    </main>
  );
};

export default Features;
