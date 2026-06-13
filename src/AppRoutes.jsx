import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Landing from './components/Landing.jsx'

// Lazy-load the dashboard so Recharts + Leaflet only ship on /dashboard,
// keeping the landing page's initial bundle small.
const App = lazy(() => import('./App.jsx'))

const dashboardFallback = (
  <div className="max-w-[1100px] mx-auto px-6 py-8">
    <div className="border-[3px] border-ink bg-white p-16 text-center shadow-[6px_6px_0_#111111]">
      <div className="text-neutral-400 font-extrabold text-lg animate-pulse">
        ⏳ Loading dashboard…
      </div>
    </div>
  </div>
)

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/dashboard"
        element={<Suspense fallback={dashboardFallback}><App /></Suspense>}
      />
    </Routes>
  )
}
