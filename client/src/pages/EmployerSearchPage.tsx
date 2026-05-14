import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Briefcase, Construction } from 'lucide-react';

export default function EmployerSearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.account_type !== 'employer') {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-20 text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
          <Briefcase className="w-8 h-8 text-[var(--color-accent)]" />
          <Construction className="w-8 h-8 text-[var(--color-yellow-indicator)]" />
        </div>
        <h1 className="text-3xl font-bold font-mono">New Candidate Search</h1>
        <p className="text-[var(--color-text-muted)] max-w-lg mx-auto">
          Resume upload, AI evaluation, and candidate ranking are coming in Phase 2.
          This page will let you upload resumes, paste a job description, and instantly rank every applicant by fit.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-yellow-indicator)]/10 border border-[var(--color-yellow-indicator)]/30 text-[var(--color-yellow-indicator)] text-sm font-mono">
          Phase 2 — Coming Soon
        </div>
      </div>
    </Layout>
  );
}
