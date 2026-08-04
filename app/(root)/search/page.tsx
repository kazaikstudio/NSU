import { Suspense } from 'react'
import SearchClient from './SearchClient'

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pb-28 px-4 py-6 text-primary mx-auto max-w-7xl">Loading search…</div>}>
      <SearchClient />
    </Suspense>
  )
}
