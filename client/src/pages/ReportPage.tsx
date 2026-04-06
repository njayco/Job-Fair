import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { getApplicationReport } from '../api';
import ReactMarkdown from 'react-markdown';
import { ChevronLeft } from 'lucide-react';

export default function ReportPage() {
  const { id } = useParams();
  const [data, setData] = useState<{ id: number; company: string; role: string; report_md: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      getApplicationReport(Number(id))
        .then(setData)
        .catch(e => setError(e instanceof Error ? e.message : 'Not found'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <Layout><div className="py-24 text-center font-mono text-[var(--color-text-muted)] animate-pulse">Loading report...</div></Layout>;
  if (error || !data) return <Layout><div className="py-24 text-center font-mono text-[var(--color-red-indicator)]">Error: {error || 'Not found'}</div></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link to={`/results/${id}`} className="inline-flex items-center text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Results
        </Link>
        
        <div className="prose prose-invert max-w-none bg-[var(--color-surface)] p-8 rounded-xl border border-[var(--color-border)] shadow-xl">
          <ReactMarkdown>{data.report_md}</ReactMarkdown>
        </div>
      </div>
    </Layout>
  );
}
