import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import AppLayout from './layouts/AppLayout'
import DashboardPage from './pages/DashboardPage'
import RealtimePage from './pages/RealtimePage'
import AnalysisPage from './pages/AnalysisPage'
import ComparePage from './pages/ComparePage'
import MapPage from './pages/MapPage'
import ManagePage from './pages/ManagePage'
import ExportPage from './pages/ExportPage'
import ThemeInitializer from './components/ThemeInitializer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeInitializer />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/realtime" element={<RealtimePage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/manage" element={<ManagePage />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
