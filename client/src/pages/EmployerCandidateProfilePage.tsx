import { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Briefcase, Construction, ArrowLeft } from 'lucide-react';

export default function EmployerCandidateProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: jobId } = useParams<{ id?: string }>();

  useEffect(() => {
    if (user && user.account_type !== 'employer') navigate('/', { replace: true });
  }, [user, navigate]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          to={jobId ? `/employer/jobs/${jobId}` : '/employer'}
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors font-mono"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to results
        </Link>

        <div className="py-16 text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <Briefcase className="w-8 h-8 text-[var(--color-accent)]" />
            <Construction className="w-8 h-8 text-[var(--color-yellow-indicator)]" />
          </div>
          <h1 className="text-2xl font-bold font-mono">Candidate Profile</h1>
          <p className="text-[var(--color-text-muted)] max-w-lg mx-auto">
            Full candidate profiles with AI-generated interview questions, strengths breakdown,
            and pipeline notes are coming in Phase 3.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-yellow-indicator)]/10 border border-[var(--color-yellow-indicator)]/30 text-[var(--color-yellow-indicator)] text-sm font-mono">
            Phase 3 — Coming Soon
          </div>
        </div>
      </div>
    </Layout>
  );
}
