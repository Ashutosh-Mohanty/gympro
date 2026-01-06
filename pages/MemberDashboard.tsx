
import React, { useEffect, useState } from 'react';
import { useAuth } from '../App.tsx';
import { Member, GymSettings } from '../types.ts';
import { Card, Badge, Button } from '../components/UI.tsx';
import { getMemberStatus, getSettings } from '../services/storage.ts';
import { getAIWorkoutTip } from '../services/geminiService.ts';

const MemberDashboard: React.FC = () => {
  const { authState } = useAuth();
  const member = authState.user as Member;
  const status = getMemberStatus(member.expiryDate);
  // Fix: getSettings() returns a Promise, so we must store the resolved value in state
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [tip, setTip] = useState<string>('');

  useEffect(() => {
    const fetchMemberData = async () => {
        const daysActive = Math.ceil((new Date().getTime() - new Date(member.joinDate).getTime()) / (1000 * 3600 * 24));
        // Fetch both tip and settings in parallel to optimize loading
        const [t, s] = await Promise.all([
          getAIWorkoutTip(daysActive),
          getSettings()
        ]);
        setTip(t);
        setSettings(s);
    };
    fetchMemberData();
  }, [member.joinDate]);

  if (!member) return <div className="p-20 text-center text-slate-500 font-bold uppercase tracking-widest">Retrieving Member Profile...</div>;

  const daysLeft = Math.ceil((new Date(member.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Profile Header */}
      <Card className="flex flex-col md:flex-row gap-6 items-center md:items-start bg-gradient-to-br from-slate-800 to-slate-900 border-gym-accent/20 shadow-2xl">
        <div className="w-32 h-32 rounded-3xl bg-slate-800 flex items-center justify-center overflow-hidden border-4 border-slate-700 shadow-2xl shadow-black/50">
           {member.profilePhoto ? <img src={member.profilePhoto} className="w-full h-full object-cover" /> : <span className="text-5xl font-black text-slate-600">{member.name.charAt(0)}</span>}
        </div>
        <div className="flex-1 text-center md:text-left">
           <div className="flex flex-col md:flex-row items-center md:items-start justify-between">
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">{member.name}</h1>
                <p className="text-slate-500 font-medium">Training Focus: <span className="text-gym-accent font-black uppercase tracking-widest text-xs ml-1">{member.goal?.replace('_', ' ') || 'GENERAL FITNESS'}</span></p>
              </div>
              <div className="mt-2 md:mt-0 shadow-lg"><Badge status={status} /></div>
           </div>
           
           <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-center shadow-inner">
                 <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Access Dues</div>
                 <div className={`text-xl font-black ${daysLeft < 5 ? 'text-red-400' : 'text-gym-accent'}`}>{daysLeft > 0 ? daysLeft : 0} Days</div>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-center shadow-inner">
                 <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Plan Tenure</div>
                 <div className="text-xl font-black text-white">{member.planDurationDays}D</div>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-center shadow-inner">
                 <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Identity Height</div>
                 <div className="text-xl font-black text-white">{member.height || 'N/A'}</div>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-center shadow-inner">
                 <div className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Identity Weight</div>
                 <div className="text-xl font-black text-white">{member.weight || 'N/A'}</div>
              </div>
           </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="AI Wellness Insight" className="border-gym-accent/10 shadow-xl">
             <div className="flex items-start gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-gym-accent/10 flex items-center justify-center text-gym-accent flex-shrink-0 shadow-inner">
                    <i className="fas fa-magic text-xl"></i>
                 </div>
                 <p className="text-slate-300 italic text-sm font-medium leading-relaxed mt-1">"{tip || 'Analyzing your training evolution...'}"</p>
             </div>
        </Card>

        <Card title="Gym Establishment Policy" className="h-64 flex flex-col shadow-xl">
            <div className="flex-1 overflow-y-auto custom-scrollbar text-xs text-slate-400 leading-relaxed pr-2 font-medium">
                {/* Fix: safely access termsAndConditions from the resolved settings state */}
                {settings?.termsAndConditions || 'Policies for this establishment have not been published yet.'}
            </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Transformation Track" className="shadow-xl">
              <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                      <div className="aspect-[3/4] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                          {member.beforePhoto ? <img src={member.beforePhoto} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-700 text-[10px] font-black uppercase text-center p-4">Baseline Phase Missing</div>}
                      </div>
                      <p className="text-[9px] text-center font-black text-slate-500 uppercase tracking-widest">Enrollment Phase</p>
                  </div>
                  <div className="space-y-3">
                      <div className="aspect-[3/4] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                          {member.afterPhoto ? <img src={member.afterPhoto} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-700 text-[10px] font-black uppercase text-center p-4">Result Phase Missing</div>}
                      </div>
                      <p className="text-[9px] text-center font-black text-gym-accent uppercase tracking-widest">Current Evolution</p>
                  </div>
              </div>
          </Card>

          <Card title="Retail & Supplement History" className="shadow-xl">
              <div className="max-h-80 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                  {member.supplementHistory && member.supplementHistory.length > 0 ? (
                      member.supplementHistory.slice().reverse().map(s => (
                          <div key={s.id} className="bg-slate-900/40 p-3 rounded-xl border border-slate-800 flex justify-between items-center hover:bg-slate-900/60 transition-colors shadow-inner">
                              <div>
                                  <div className="text-xs font-black text-white uppercase">{s.productName}</div>
                                  <div className="text-[9px] text-slate-500 font-bold">{new Date(s.purchaseDate).toLocaleDateString()}</div>
                              </div>
                              <div className="text-purple-400 font-black tracking-tight">$ {s.price}</div>
                          </div>
                      ))
                  ) : (
                      <div className="py-20 text-center text-slate-700 font-black uppercase tracking-widest text-[10px] border border-dashed border-slate-800 rounded-2xl">
                          No Retail Logs found
                      </div>
                  )}
              </div>
          </Card>
      </div>
    </div>
  );
};

export default MemberDashboard;
