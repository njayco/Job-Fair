import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import EvaluatePage from './pages/EvaluatePage'
import ResultsPage from './pages/ResultsPage'
import PipelinePage from './pages/PipelinePage'
import ReportPage from './pages/ReportPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/evaluate" element={<EvaluatePage />} />
        <Route path="/results/:id" element={<ResultsPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/report/:id" element={<ReportPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
