import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { Member } from '../types';
import { Card, Badge, Button } from '../components/UI';
import { getMemberStatus } from '../services/storage';
import { getAIWorkoutTip } from '../services/geminiService';

const MemberDashboard: React.FC = () => {
  const { authState } = useAuth();
  const member = authState.user as Member;
  const status = getMemberStatus(member.expiryDate);
  const [tip, setTip] = useState<string>('');

  useEffect(() => {
    // Generate a quick AI tip on load
    const fetchTip = async () => {
        const daysActive = Math.ceil((new Date().getTime() - new Date(member.joinDate).getTime()) / (1000 * 3600 * 24));
        const t = await getAIWorkoutTip(daysActive);
        setTip(t);
    };
    fetchTip();
  }, [member.joinDate]);

  if (!member) return <div>Loading...</div>;

  const daysLeft = Math.ceil((new Date(member.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card className="flex flex-col md:flex-row gap-6 items-center md:items-start bg-gradient-to-r from-slate-800 to-slate-900">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-4 border-slate-600 shadow-xl">
           {member.profilePhoto ? (
               <img src={member.profilePhoto} className="w-full h-full object-cover" />
           ) : (
               <span className="text-4xl font-bold text-slate-400">{member.name.charAt(0)}</span>
           )}
        </div>
        <div className="flex-1 text-center md:text-left w-full">
           <div className="flex flex-col md:flex-row items-center md:items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">{member.name}</h1>
                <p className="text-slate-400">Member since {new Date(member.joinDate).getFullYear()}</p>
              </div>
              <div className="mt-2 md:mt-0">
                 <Badge status={status} />
              </div>
           </div>
           
           <div className="mt-6 grid grid-cols-2 gap-4 text-center md:text-left">
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                 <div className="text-xs text-slate-500 uppercase">Plan Expiry</div>
                 <div className={`text-lg font-bold ${daysLeft < 5 ? 'text-red-400' : 'text-gym-accent'}`}>
                    {new Date(member.expiryDate).toLocaleDateString()}
                 </div>
                 <div className="text-xs text-slate-400">{daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                 <div className="text-xs text-slate-500 uppercase">Current Plan</div>
                 <div className="text-lg font-bold text-white">{member.planDurationDays} Days</div>
              </div>
           </div>
        </div>
      </Card>

      {/* Progress Photos */}
      {(member.beforePhoto || member.afterPhoto) && (
          <Card title="My Progress">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2 text-center">Before</h4>
                      <div className="aspect-[3/4] bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                          {member.beforePhoto ? <img src={member.beforePhoto} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-600">No Photo</div>}
                      </div>
                  </div>
                  <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2 text-center">After</h4>
                      <div className="aspect-[3/4] bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                          {member.afterPhoto ? <img src={member.afterPhoto} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-600">No Photo</div>}
                      </div>
                  </div>
              </div>
          </Card>
      )}

      {/* Supplements & Billing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Supplement History">
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {member.supplementHistory && member.supplementHistory.length > 0 ? (
                    member.supplementHistory.map(supp => (
                        <div key={supp.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 flex justify-between items-center">
                            <div>
                                <div className="font-medium text-white">{supp.productName}</div>
                                <div className="text-xs text-slate-400">Date: {new Date(supp.purchaseDate).toLocaleDateString()}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-gym-accent font-bold">${supp.price}</div>
                                {supp.endDate && <div className="text-[10px] text-slate-500">Ends: {new Date(supp.endDate).toLocaleDateString()}</div>}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-slate-500 text-sm">No supplement purchases recorded.</div>
                )}
            </div>
        </Card>

        <Card title="AI Trainer Tip">
             <div className="flex items-start gap-3">
                 <i className="fas fa-robot text-2xl text-gym-accent mt-1"></i>
                 <div>
                     <p className="text-slate-300 italic">"{tip || 'Loading your personalized tip...'}"</p>
                 </div>
             </div>
        </Card>
      </div>

      <Card title="Contact Gym">
         <div className="space-y-4">
            <p className="text-sm text-slate-400">Need to extend your plan or have a question? Contact the manager.</p>
            <Button className="w-full bg-[#25D366] hover:bg-[#20bd5a]" onClick={() => window.open('https://wa.me/1234567890', '_blank')}>
               <i className="fab fa-whatsapp mr-2"></i> Chat with Manager
            </Button>
         </div>
      </Card>
    </div>
  );
};

export default MemberDashboard;