import React from 'react';
import { 
  Terminal, 
  LayoutDashboard, 
  Search, 
  Briefcase, 
  CheckSquare, 
  User, 
  Plus,
  ChevronRight
} from 'lucide-react';

export function CurrentTheme() {
  const jobs = [
    { company: 'Acme Corp', role: 'Senior Frontend Engineer', score: 'A+', status: 'Interviewing', date: '2023-10-24' },
    { company: 'Globex Inc', role: 'Full Stack Developer', score: 'B', status: 'Applied', date: '2023-10-22' },
    { company: 'Initech', role: 'Software Engineer', score: 'A-', status: 'Offer', date: '2023-10-15' },
    { company: 'Stark Industries', role: 'Systems Architect', score: 'C+', status: 'Rejected', date: '2023-10-10' },
    { company: 'Wayne Enterprises', role: 'Backend Engineer', score: 'A', status: 'Applied', date: '2023-10-25' },
  ];

  const getScoreColor = (score: string) => {
    if (score.startsWith('A')) return 'hsl(187, 74%, 32%)'; // Primary
    if (score.startsWith('B')) return 'hsl(270, 70%, 45%)'; // Accent
    return 'hsl(220, 10%, 60%)'; // Muted
  };

  return (
    <div 
      className="min-h-screen flex flex-col w-full"
      style={{
        backgroundColor: 'hsl(220, 30%, 8%)',
        color: 'hsl(0, 0%, 95%)',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        .font-mono { font-family: 'Space Mono', monospace; }
        
        * {
          box-sizing: border-box;
        }
      `}</style>
      
      {/* Navigation */}
      <header 
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ 
          backgroundColor: 'hsl(220, 20%, 12%)',
          borderColor: 'hsl(220, 20%, 20%)'
        }}
      >
        <div className="flex items-center gap-2">
          <Terminal size={24} style={{ color: 'hsl(187, 74%, 32%)' }} />
          <span className="font-bold text-lg tracking-tight">Career-Ops</span>
        </div>
        
        <nav className="flex items-center gap-6 text-sm font-medium" style={{ color: 'hsl(220, 10%, 60%)' }}>
          <a href="#" className="flex items-center gap-2 transition-colors hover:text-white" style={{ color: 'hsl(0, 0%, 95%)' }}>
            <LayoutDashboard size={16} /> Pipeline
          </a>
          <a href="#" className="flex items-center gap-2 transition-colors hover:text-white">
            <Search size={16} /> Job Finder
          </a>
          <a href="#" className="flex items-center gap-2 transition-colors hover:text-white">
            <Briefcase size={16} /> Career Match
          </a>
          <a href="#" className="flex items-center gap-2 transition-colors hover:text-white">
            <CheckSquare size={16} /> Evaluate
          </a>
          <a href="#" className="flex items-center gap-2 transition-colors hover:text-white">
            <User size={16} /> Account
          </a>
        </nav>
      </header>

      <main className="flex-1 p-8 max-w-6xl mx-auto w-full flex flex-col gap-8">
        
        {/* Header Area */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Job Pipeline</h1>
            <p style={{ color: 'hsl(220, 10%, 60%)' }}>Track and manage your active applications.</p>
          </div>
          <button 
            className="flex items-center gap-2 px-4 py-2 rounded font-medium transition-opacity hover:opacity-90"
            style={{ 
              backgroundColor: 'hsl(187, 74%, 32%)',
              color: 'hsl(0, 0%, 95%)'
            }}
          >
            <Plus size={18} />
            Evaluate New Job
          </button>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active Applications', value: '12' },
            { label: 'Upcoming Interviews', value: '3' },
            { label: 'Avg Match Score', value: 'A-' },
            { label: 'Profile Fit', value: '85%' },
          ].map((stat, i) => (
            <div 
              key={i} 
              className="p-5 rounded border"
              style={{ 
                backgroundColor: 'hsl(220, 20%, 12%)',
                borderColor: 'hsl(220, 20%, 20%)'
              }}
            >
              <div className="text-sm font-medium mb-2" style={{ color: 'hsl(220, 10%, 60%)' }}>
                {stat.label}
              </div>
              <div className="text-3xl font-bold font-mono">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline Table */}
        <div 
          className="rounded border overflow-hidden"
          style={{ 
            backgroundColor: 'hsl(220, 20%, 12%)',
            borderColor: 'hsl(220, 20%, 20%)'
          }}
        >
          <table className="w-full text-sm text-left border-collapse">
            <thead 
              className="border-b"
              style={{ 
                borderColor: 'hsl(220, 20%, 20%)',
                backgroundColor: 'rgba(255,255,255,0.02)'
              }}
            >
              <tr>
                <th className="px-6 py-4 font-medium" style={{ color: 'hsl(220, 10%, 60%)' }}>Company</th>
                <th className="px-6 py-4 font-medium" style={{ color: 'hsl(220, 10%, 60%)' }}>Role</th>
                <th className="px-6 py-4 font-medium" style={{ color: 'hsl(220, 10%, 60%)' }}>Score</th>
                <th className="px-6 py-4 font-medium" style={{ color: 'hsl(220, 10%, 60%)' }}>Status</th>
                <th className="px-6 py-4 font-medium" style={{ color: 'hsl(220, 10%, 60%)' }}>Date Added</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ divideColor: 'hsl(220, 20%, 20%)' }}>
              {jobs.map((job, i) => (
                <tr 
                  key={i} 
                  className="transition-colors hover:bg-white/5 border-b last:border-0"
                  style={{ borderColor: 'hsl(220, 20%, 20%)' }}
                >
                  <td className="px-6 py-4 font-medium">{job.company}</td>
                  <td className="px-6 py-4" style={{ color: 'hsl(220, 10%, 60%)' }}>{job.role}</td>
                  <td className="px-6 py-4">
                    <span 
                      className="inline-flex items-center justify-center font-mono font-bold text-xs px-2 py-1 rounded"
                      style={{ 
                        backgroundColor: 'hsl(220, 30%, 8%)',
                        color: getScoreColor(job.score),
                        border: '1px solid',
                        borderColor: 'hsl(220, 20%, 20%)'
                      }}
                    >
                      {job.score}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ 
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        color: 'hsl(0, 0%, 95%)'
                      }}
                    >
                      <span 
                        className="w-1.5 h-1.5 rounded-full" 
                        style={{ 
                          backgroundColor: job.status === 'Applied' ? 'hsl(220, 10%, 60%)' : 
                                           job.status === 'Interviewing' ? 'hsl(187, 74%, 32%)' : 
                                           job.status === 'Offer' ? 'hsl(120, 60%, 50%)' : 'hsl(0, 80%, 50%)'
                        }}
                      />
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs" style={{ color: 'hsl(220, 10%, 60%)' }}>
                    {job.date}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'hsl(220, 10%, 60%)' }}>
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
