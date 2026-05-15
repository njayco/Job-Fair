import React from "react";
import { 
  Briefcase, 
  ChevronRight, 
  LayoutDashboard, 
  LogOut, 
  Search, 
  Settings, 
  Star, 
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Plus
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function MidnightClarity() {
  return (
    <div 
      className="min-h-screen text-[#F0F4FF] font-sans selection:bg-[#3B82F6] selection:text-white"
      style={{ backgroundColor: "#0A0F1E", fontFamily: "'Inter', sans-serif" }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
        
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        .glow-hover { transition: all 0.2s ease; }
        .glow-hover:hover {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.5);
        }
        
        .bg-gradient-radial {
          background: radial-gradient(circle at top, rgba(59, 130, 246, 0.08) 0%, rgba(10, 15, 30, 0) 50%);
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #0A0F1E; }
        ::-webkit-scrollbar-thumb { background: #1E293B; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #3B82F6; }
      `}} />

      {/* Hero Radial Gradient */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-radial pointer-events-none" />

      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-[#1E293B] bg-[#0A0F1E]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-[#F0F4FF]">
            <div className="bg-[#3B82F6] p-1.5 rounded-lg">
              <TrendingUp size={20} className="text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Career Ops</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-[#94A3B8]">
            <a href="#" className="text-[#F0F4FF] border-b-2 border-[#3B82F6] py-1">Dashboard</a>
            <a href="#" className="hover:text-[#F0F4FF] transition-colors py-1">Pipeline</a>
            <a href="#" className="hover:text-[#F0F4FF] transition-colors py-1">Matches</a>
            <a href="#" className="hover:text-[#F0F4FF] transition-colors py-1">Companies</a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-[#0F172A] border border-[#1E293B] text-[#94A3B8] hover:text-[#F0F4FF] transition-colors">
            <Search size={16} />
          </button>
          
          <button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-4 py-2 rounded-md font-medium text-sm transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] flex items-center gap-2">
            <Plus size={16} />
            Evaluate Job
          </button>
          
          <div className="h-8 w-px bg-[#1E293B] mx-2" />
          
          <Avatar className="h-9 w-9 border border-[#1E293B] cursor-pointer">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback className="bg-[#0F172A] text-[#F0F4FF]">CO</AvatarFallback>
          </Avatar>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        
        {/* Header Section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2 tracking-tight">Welcome back, Alex</h1>
            <p className="text-[#94A3B8]">Here's what's happening with your job search today.</p>
          </div>
          <div className="text-sm font-mono text-[#94A3B8] bg-[#0F172A] px-3 py-1.5 rounded-md border border-[#1E293B]">
            System Status: <span className="text-[#10B981]">Operational</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Stat 1 */}
          <div className="bg-[#0F172A] border border-[#1E293B] border-l-4 border-l-[#3B82F6] rounded-lg p-5 glow-hover group relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Briefcase size={64} />
            </div>
            <div className="text-[#94A3B8] text-sm font-medium mb-1 flex items-center gap-2">
              <Activity size={14} className="text-[#3B82F6]" /> Active Applications
            </div>
            <div className="font-display text-3xl font-bold text-[#F0F4FF]">12</div>
            <div className="text-xs text-[#10B981] mt-2 font-mono flex items-center gap-1">
              <TrendingUp size={12} /> +2 this week
            </div>
          </div>

          {/* Stat 2 */}
          <div className="bg-[#0F172A] border border-[#1E293B] border-l-4 border-l-[#3B82F6] rounded-lg p-5 glow-hover group relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <CheckCircle2 size={64} />
            </div>
            <div className="text-[#94A3B8] text-sm font-medium mb-1 flex items-center gap-2">
              <Clock size={14} className="text-[#3B82F6]" /> Upcoming Interviews
            </div>
            <div className="font-display text-3xl font-bold text-[#F0F4FF]">3</div>
            <div className="text-xs text-[#94A3B8] mt-2 font-mono">Next: Vercel (Tomorrow)</div>
          </div>

          {/* Stat 3 */}
          <div className="bg-[#0F172A] border border-[#1E293B] border-l-4 border-l-[#3B82F6] rounded-lg p-5 glow-hover group relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Star size={64} />
            </div>
            <div className="text-[#94A3B8] text-sm font-medium mb-1 flex items-center gap-2">
              <Activity size={14} className="text-[#3B82F6]" /> Portfolio Grade
            </div>
            <div className="font-display text-3xl font-bold text-[#10B981]">A-</div>
            <div className="text-xs text-[#10B981] mt-2 font-mono">Top 15% of applicants</div>
          </div>

          {/* Stat 4 */}
          <div className="bg-[#0F172A] border border-[#1E293B] border-l-4 border-l-[#3B82F6] rounded-lg p-5 glow-hover group relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingUp size={64} />
            </div>
            <div className="text-[#94A3B8] text-sm font-medium mb-1 flex items-center gap-2">
              <Star size={14} className="text-[#3B82F6]" /> Best Match
            </div>
            <div className="font-display text-3xl font-bold text-[#F0F4FF]">89%</div>
            <div className="text-xs text-[#94A3B8] mt-2 font-mono">Stripe - Senior Engineer</div>
          </div>
        </div>

        {/* Pipeline Table Section */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Application Pipeline</h2>
          <button className="text-sm text-[#3B82F6] hover:text-[#F0F4FF] transition-colors flex items-center gap-1 font-medium">
            View all <ChevronRight size={16} />
          </button>
        </div>

        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0A0F1E] border-b border-[#1E293B] text-[#94A3B8] text-xs uppercase tracking-wider font-semibold">
                  <th className="py-4 px-6 font-medium">Company & Role</th>
                  <th className="py-4 px-6 font-medium">Stage</th>
                  <th className="py-4 px-6 font-medium">Match Score</th>
                  <th className="py-4 px-6 font-medium">Applied</th>
                  <th className="py-4 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {/* Row 1 */}
                <tr className="hover:bg-[#1E293B]/50 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="font-display font-semibold text-[#F0F4FF]">Stripe</div>
                    <div className="text-sm text-[#94A3B8]">Senior Frontend Engineer</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#1E293B] text-[#F0F4FF] border border-[#3B82F6]/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"></div>
                      Technical Interview
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                      A+
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm font-mono text-[#94A3B8]">
                    2023-10-12
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#3B82F6] transition-all px-3 py-1 text-sm font-medium">
                      Details
                    </button>
                  </td>
                </tr>

                {/* Row 2 */}
                <tr className="bg-[#0A0F1E]/30 hover:bg-[#1E293B]/50 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="font-display font-semibold text-[#F0F4FF]">Vercel</div>
                    <div className="text-sm text-[#94A3B8]">Design Engineer</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#1E293B] text-[#F0F4FF] border border-[#3B82F6]/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"></div>
                      Recruiter Call
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                      A
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm font-mono text-[#94A3B8]">
                    2023-10-14
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#3B82F6] transition-all px-3 py-1 text-sm font-medium">
                      Details
                    </button>
                  </td>
                </tr>

                {/* Row 3 */}
                <tr className="hover:bg-[#1E293B]/50 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="font-display font-semibold text-[#F0F4FF]">Linear</div>
                    <div className="text-sm text-[#94A3B8]">Product Engineer</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#1E293B] text-[#F0F4FF] border border-[#F59E0B]/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></div>
                      Application Review
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">
                      B+
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm font-mono text-[#94A3B8]">
                    2023-10-18
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#3B82F6] transition-all px-3 py-1 text-sm font-medium">
                      Details
                    </button>
                  </td>
                </tr>

                {/* Row 4 */}
                <tr className="bg-[#0A0F1E]/30 hover:bg-[#1E293B]/50 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="font-display font-semibold text-[#F0F4FF]">Anthropic</div>
                    <div className="text-sm text-[#94A3B8]">UI Engineer</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#1E293B] text-[#F0F4FF] border border-[#1E293B]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]"></div>
                      Draft
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
                      C
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm font-mono text-[#94A3B8]">
                    --
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#3B82F6] transition-all px-3 py-1 text-sm font-medium">
                      Resume
                    </button>
                  </td>
                </tr>
                
                {/* Row 5 */}
                <tr className="hover:bg-[#1E293B]/50 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="font-display font-semibold text-[#F0F4FF]">Legacy Corp</div>
                    <div className="text-sm text-[#94A3B8]">Web Developer</div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#1E293B] text-[#F0F4FF] border border-[#EF4444]/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></div>
                      Rejected
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20">
                      D
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm font-mono text-[#94A3B8]">
                    2023-09-28
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#3B82F6] transition-all px-3 py-1 text-sm font-medium">
                      Feedback
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </main>
      
      {/* Bottom CTA Strip */}
      <div className="mt-12 bg-gradient-to-t from-[#0A0F1E] to-[#0F172A] border-t border-[#1E293B] py-16 px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl font-bold mb-4">Ready for your next opportunity?</h2>
          <p className="text-[#94A3B8] mb-8 max-w-lg mx-auto">
            Evaluate a new job description against your profile to get a personalized match score and interview preparation guide.
          </p>
          <button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-8 py-3 rounded-lg font-medium transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] inline-flex items-center gap-2">
            Start New Evaluation
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      
    </div>
  );
}
