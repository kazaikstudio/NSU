import React from 'react'
import Link from 'next/link'
import Switchbutton from '../../../components/Switchbutton'

const Music = () => {
  return (
    <main>
      <Switchbutton />

      <div className="mt-5 p-10 text-start">
        <p className="w-50 rounded-[10px] p-3 bg-amber-300 text-center">Your Vision, Our Craft.</p>
        <h1 className="text-5xl mt-2">NOLL VISUALS</h1>
        <h3 className="text-yellow-500">“If you can dream it, Noll can design, shoot, and store it.”</h3>

        {/* Navigation Link Button */}
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
          >
            <span>Go to Dashboard</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>

        </div>
      </div>
    </main>
  );
};

export default Music;
