import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AccountPage from './pages/AccountPage';
import EvaluatePage from './pages/EvaluatePage';
import ResultsPage from './pages/ResultsPage';
import PipelinePage from './pages/PipelinePage';
import ReportPage from './pages/ReportPage';
import DonatePage from './pages/DonatePage';
import CareerMatchPage from './pages/CareerMatchPage';
import JobFinderPage from './pages/JobFinderPage';
import EmployerDashboardPage from './pages/EmployerDashboardPage';
import EmployerSearchPage from './pages/EmployerSearchPage';
import EmployerCandidateProfilePage from './pages/EmployerCandidateProfilePage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/donate" element={<DonatePage />} />

          {/* Employee-side protected routes */}
          <Route path="/evaluate" element={<ProtectedRoute><EvaluatePage /></ProtectedRoute>} />
          <Route path="/results/:id" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
          <Route path="/pipeline" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
          <Route path="/report/:id" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="/career-match" element={<ProtectedRoute><CareerMatchPage /></ProtectedRoute>} />
          <Route path="/job-finder" element={<ProtectedRoute><JobFinderPage /></ProtectedRoute>} />

          {/* Employer-side protected routes */}
          <Route path="/employer" element={<ProtectedRoute><EmployerDashboardPage /></ProtectedRoute>} />
          <Route path="/employer/search" element={<ProtectedRoute><EmployerSearchPage /></ProtectedRoute>} />
          <Route path="/employer/jobs/:id" element={<ProtectedRoute><EmployerSearchPage /></ProtectedRoute>} />
          <Route path="/employer/jobs/:id/candidates/:candidateId" element={<ProtectedRoute><EmployerCandidateProfilePage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
