
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Member, GymSettings, Supplement } from '../types.ts';
import { getMembers, addMember, getMemberStatus, updateMember, fileToBase64, getSettings, saveSettings } from '../services/storage.ts';
import { Button, Input, Card, Modal, Select, Badge } from '../components/UI.tsx';
import { generateWhatsAppMessage } from '../services/geminiService.ts';
import { useAuth } from '../App.tsx';

type SalesFilter = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'DATE' | 'RANGE';

interface SaleItem {
  id: string;
  date: Date;
  amount: number;
  type: 'MEMBERSHIP' | 'SUPPLEMENT';
  description: string;
  memberName: string;
}

const ManagerDashboard: React.FC = () => {
  const { authState } = useAuth();
  const currentGymId = authState.currentGymId;

  const [currentView, setCurrentView] = useState<'MEMBERS' | 'SALES' | 'ALERTS' | 'SETTINGS'>('MEMBERS');
  const [members, setMembers] = useState<Member[]>([]);
  const [gymSettings, setGymSettings] = useState<GymSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON'>('ALL');
  
  const [salesFilter, setSalesFilter] = useState<SalesFilter>('WEEKLY');
  const [salesDate, setSalesDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [salesRangeStart, setSalesRangeStart] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [salesRangeEnd, setSalesRangeEnd] = useState<string>(new Date().toISOString().split('T')[0]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState<'EDIT' | 'PLANS' | 'PHOTOS' | 'BILLING'>('EDIT');
  
  const [aiMessage, setAiMessage] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Form states
  const [formData, setFormData] = useState({ 
    name: '', phone: '', age: '', planDurationDays: 30, amountPaid: '', 
    username: '', password: '', notes: '', profilePhoto: '',
    height: '', weight: '', address: '', goal: 'MUSCLE_GAIN' as any,
    paymentMode: 'CASH' as any, idProofPhoto: ''
  });
  
  const [editFormData, setEditFormData] = useState({ name: '', phone: '', age: '', username: '', password: '', notes: '', height: '', weight: '', address: '', goal: '' });
  const [suppForm, setSuppForm] = useState({ productName: '', price: '' });
  const [extensionAmount, setExtensionAmount] = useState<string>('');
  const [customExtensionDays, setCustomExtensionDays] = useState<string>('30');

  const profileInputRef = useRef<HTMLInputElement>(null);
  const idProofInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInitialData();
  }, [currentGymId]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [allMembers, settings] = await Promise.all([getMembers(), getSettings()]);
      const gymMembers = allMembers.filter(m => m.gymId === currentGymId);
      setMembers(gymMembers);
      setGymSettings(settings);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    setIsSyncing(true);
    try {
      const allMembers = await getMembers();
      const gymMembers = allMembers.filter(m => m.gymId === currentGymId);
      setMembers(gymMembers);
      
      if (selectedMember) {
        const updated = gymMembers.find(m => m.id === selectedMember.id);
        if (updated) setSelectedMember(updated);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter(m => getMemberStatus(m.expiryDate) === 'ACTIVE').length;
    const expiring = members.filter(m => getMemberStatus(m.expiryDate) === 'EXPIRING_SOON').length;
    const expired = members.filter(m => getMemberStatus(m.expiryDate) === 'EXPIRED').length;
    return { total, active, expiring, expired };
  }, [members]);

  const urgentAlerts = useMemo(() => {
    return members.filter(m => {
        const s = getMemberStatus(m.expiryDate);
        return s === 'EXPIRED' || s === 'EXPIRING_SOON';
    });
  }, [members]);

  const allSales = useMemo(() => {
    let sales: SaleItem[] = [];
    members.forEach(m => {
        if(m.paymentHistory) {
            m.paymentHistory.forEach(p => {
                sales.push({ id: p.id, date: new Date(p.date), amount: Number(p.amount), type: 'MEMBERSHIP', description: p.recordedBy || 'Membership Fee', memberName: m.name });
            });
        }
        if(m.supplementHistory) {
            m.supplementHistory.forEach(s => {
                sales.push({ id: s.id, date: new Date(s.purchaseDate), amount: Number(s.price), type: 'SUPPLEMENT', description: s.productName, memberName: m.name });
            });
        }
    });
    return sales.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [members]);

  const filteredSales = useMemo(() => {
    const now = new Date();
    const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();

    return allSales.filter(sale => {
      if (salesFilter === 'DAILY') return isSameDay(sale.date, now);
      if (salesFilter === 'WEEKLY') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return sale.date >= weekAgo;
      }
      if (salesFilter === 'MONTHLY') return sale.date.getMonth() === now.getMonth() && sale.date.getFullYear() === now.getFullYear();
      if (salesFilter === 'DATE') {
        const selected = new Date(salesDate);
        return isSameDay(sale.date, selected);
      }
      if (salesFilter === 'RANGE') {
        const start = new Date(salesRangeStart);
        const end = new Date(salesRangeEnd);
        end.setHours(23, 59, 59, 999);
        return sale.date >= start && sale.date <= end;
      }
      return true;
    });
  }, [allSales, salesFilter, salesDate, salesRangeStart, salesRangeEnd]);

  const totals = useMemo(() => {
    const membership = filteredSales.filter(s => s.type === 'MEMBERSHIP').reduce((sum, s) => sum + s.amount, 0);
    const supplements = filteredSales.filter(s => s.type === 'SUPPLEMENT').reduce((sum, s) => sum + s.amount, 0);
    return { membership, supplements, gross: membership + supplements };
  }, [filteredSales]);

  const supplementSummary = useMemo(() => {
    const products: Record<string, { count: number, revenue: number }> = {};
    filteredSales.filter(s => s.type === 'SUPPLEMENT').forEach(s => {
        if (!products[s.description]) products[s.description] = { count: 0, revenue: 0 };
        products[s.description].count += 1;
        products[s.description].revenue += s.amount;
    });
    return Object.entries(products).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [filteredSales]);

  const graphData = useMemo(() => {
    const data: Record<string, number> = {};
    const relevant = filteredSales.slice(0, 30);
    relevant.forEach(s => {
        const label = s.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        data[label] = (data[label] || 0) + s.amount;
    });
    return Object.entries(data).reverse().slice(-7);
  }, [filteredSales]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      if (selectedMember) {
        setIsSyncing(true);
        const updated = { ...selectedMember, [field]: base64 };
        await updateMember(updated);
        await refreshData();
      } else {
        setFormData(prev => ({ ...prev, [field]: base64 }));
      }
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    const joinDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(joinDate.getDate() + Number(formData.planDurationDays));
    
    const newMember: Member = {
      id: Date.now().toString(),
      name: formData.name, phone: formData.phone,
      joinDate: joinDate.toISOString(), planDurationDays: Number(formData.planDurationDays),
      expiryDate: expiryDate.toISOString(), age: Number(formData.age),
      amountPaid: Number(formData.amountPaid), gymId: currentGymId!,
      username: formData.username || formData.name.toLowerCase().replace(/\s/g, ''),
      password: formData.password || '1234',
      isActive: true, notes: formData.notes, profilePhoto: formData.profilePhoto,
      idProofPhoto: formData.idProofPhoto,
      height: formData.height, weight: formData.weight, address: formData.address,
      goal: formData.goal,
      registrationPaymentMode: formData.paymentMode,
      supplementHistory: [],
      paymentHistory: [{ id: Date.now().toString(), date: new Date().toISOString(), amount: Number(formData.amountPaid), method: formData.paymentMode === 'ONLINE' ? 'ONLINE' : 'OFFLINE', recordedBy: 'Initial Joining Fee' }]
    };
    
    await addMember(newMember);
    await refreshData();
    setIsAddModalOpen(false);
    setFormData({ 
      name: '', phone: '', age: '', planDurationDays: 30, amountPaid: '', username: '', password: '', notes: '', profilePhoto: '',
      height: '', weight: '', address: '', goal: 'MUSCLE_GAIN', paymentMode: 'CASH', idProofPhoto: '' 
    });
  };

  const handleOpenOversight = (m: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMember(m);
    setEditFormData({ 
        name: m.name, phone: m.phone, age: m.age.toString(), 
        username: m.username, password: m.password || '1234',
        notes: m.notes || '', height: m.height || '', weight: m.weight || '',
        address: m.address || '', goal: m.goal || ''
    });
    setActiveTab('EDIT');
    setIsEditModalOpen(true);
  };

  const handleEditMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setIsSyncing(true);
    const updated: Member = {
        ...selectedMember,
        name: editFormData.name, phone: editFormData.phone,
        age: Number(editFormData.age), username: editFormData.username,
        password: editFormData.password,
        notes: editFormData.notes, height: editFormData.height, weight: editFormData.weight,
        address: editFormData.address, goal: editFormData.goal as any
    };
    await updateMember(updated);
    await refreshData();
    alert('Member profile updated successfully!');
  };

  const handleExtendPlan = async (days: number | 'custom') => {
    if (!selectedMember) return;
    setIsSyncing(true);
    const actualDays = days === 'custom' ? (Number(customExtensionDays) || 0) : days;
    const amt = Number(extensionAmount) || 0;
    
    const currentExpiry = new Date(selectedMember.expiryDate).getTime();
    const now = new Date().getTime();
    const baseTime = Math.max(currentExpiry, now);
    const newExpiry = new Date(baseTime + (actualDays * 24 * 60 * 60 * 1000));
    
    const updated: Member = { 
      ...selectedMember, expiryDate: newExpiry.toISOString(), isActive: true,
      paymentHistory: [...(selectedMember.paymentHistory || []), { 
        id: Date.now().toString(), 
        date: new Date().toISOString(), 
        amount: amt, 
        method: 'OFFLINE', 
        recordedBy: `Extension Renewal (${actualDays} Days)` 
      }]
    };
    await updateMember(updated);
    await refreshData();
    setExtensionAmount('');
    alert(`Membership access extended by ${actualDays} days.`);
  };

  const handleBillSupplement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setIsSyncing(true);
    const newSupp: Supplement = {
      id: Date.now().toString(), productName: suppForm.productName,
      price: Number(suppForm.price), purchaseDate: new Date().toISOString()
    };
    const updated: Member = { 
        ...selectedMember, 
        supplementHistory: [...(selectedMember.supplementHistory || []), newSupp] 
    };
    await updateMember(updated);
    await refreshData();
    setSuppForm({ productName: '', price: '' });
    alert('Supplement billed successfully.');
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gymSettings) return;
    setIsSyncing(true);
    await saveSettings(gymSettings);
    setIsSyncing(false);
    alert('Settings synchronized with cloud.');
  };

  const handleGenerateAi = async (type: 'REMINDER' | 'WELCOME' | 'OFFER') => {
    if(!selectedMember) return;
    setLoadingAi(true);
    const msg = await generateWhatsAppMessage(selectedMember.name, selectedMember.expiryDate, type);
    setAiMessage(msg);
    setLoadingAi(false);
  };

  const filteredMembers = members.filter(m => {
    const status = getMemberStatus(m.expiryDate);
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.phone.includes(searchTerm);
    const matchesStatus = filterStatus === 'ALL' ? true : filterStatus === 'ACTIVE' ? (status === 'ACTIVE' || status === 'EXPIRING_SOON') : status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-gym-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing with Cloud Registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {isSyncing && (
        <div className="fixed bottom-6 right-6 z-50 bg-gym-accent text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
          <i className="fas fa-cloud-upload-alt"></i>
          <span className="text-xs font-black uppercase tracking-widest">Cloud Syncing...</span>
        </div>
      )}

      {/* View Selector */}
      <div className="flex justify-center flex-wrap gap-2">
        <div className="bg-slate-800 p-1 rounded-xl shadow-2xl border border-slate-700 flex overflow-x-auto">
          <button onClick={() => setCurrentView('MEMBERS')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentView === 'MEMBERS' ? 'bg-gym-accent text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Member Central</button>
          <button onClick={() => setCurrentView('SALES')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentView === 'SALES' ? 'bg-gym-accent text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Financial Audit</button>
          <button onClick={() => setCurrentView('ALERTS')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${currentView === 'ALERTS' ? 'bg-red-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
            Priority Alerts {urgentAlerts.length > 0 && <span className="bg-white text-red-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{urgentAlerts.length}</span>}
          </button>
          <button onClick={() => setCurrentView('SETTINGS')} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${currentView === 'SETTINGS' ? 'bg-gym-accent text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Rules & Policy</button>
        </div>
      </div>

      {currentView === 'MEMBERS' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-800 border-l-4 border-l-blue-500 p-4"><div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Enrollment Total</div><div className="text-2xl font-black text-white">{stats.total}</div></Card>
            <Card className="bg-slate-800 border-l-4 border-l-emerald-500 p-4"><div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Active Plans</div><div className="text-2xl font-black text-white">{stats.active}</div></Card>
            <Card className="bg-slate-800 border-l-4 border-l-yellow-500 p-4"><div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Dues Pending</div><div className="text-2xl font-black text-white">{stats.expiring}</div></Card>
            <Card className="bg-slate-800 border-l-4 border-l-red-500 p-4"><div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Access Expired</div><div className="text-2xl font-black text-white">{stats.expired}</div></Card>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-between bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
            <Input placeholder="Search member database..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="md:w-80" />
            <div className="flex flex-wrap gap-2">
              <Select options={[{ label: 'All Status', value: 'ALL' }, { label: 'Active', value: 'ACTIVE' }, { label: 'Due Soon', value: 'EXPIRING_SOON' }, { label: 'Expired', value: 'EXPIRED' }]} value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="w-32" />
              <Button onClick={() => setIsAddModalOpen(true)}><i className="fas fa-plus mr-2"></i> Register Member</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map(m => (
              <Card key={m.id} className="hover:border-gym-accent transition-all cursor-pointer relative group p-5 border-slate-800" onClick={(e) => handleOpenOversight(m, e)}>
                <div className="absolute top-4 right-4"><Badge status={getMemberStatus(m.expiryDate)} /></div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 shadow-md flex items-center justify-center">
                    {m.profilePhoto ? <img src={m.profilePhoto} className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-slate-500">{m.name.charAt(0)}</span>}
                  </div>
                  <div><h3 className="font-bold text-white text-lg">{m.name}</h3><p className="text-slate-400 text-xs font-medium tracking-tight"><i className="fas fa-phone mr-1"></i> {m.phone}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4 text-center">
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800">Enrollment <span className="text-white block mt-1">{new Date(m.joinDate).toLocaleDateString()}</span></div>
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800">Expiration <span className="text-white block mt-1">{new Date(m.expiryDate).toLocaleDateString()}</span></div>
                </div>
                <Button size="sm" variant="outline" className="w-full text-[10px] font-black uppercase tracking-widest hover:bg-gym-accent hover:text-white transition-all shadow-lg" onClick={(e) => handleOpenOversight(m, e)}>
                   Manage Account & Billing
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}

      {currentView === 'SALES' && (
        <div className="space-y-6">
          <Card className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-800/30 border-slate-700/50 p-4">
            <div className="flex flex-wrap gap-2">
              {(['DAILY', 'WEEKLY', 'MONTHLY', 'DATE', 'RANGE'] as SalesFilter[]).map(f => (
                <button key={f} onClick={() => setSalesFilter(f)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${salesFilter === f ? 'bg-gym-accent text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{f}</button>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-gym-accent"><div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Gross Revenue</div><div className="text-4xl font-black text-white mt-1">${totals.gross.toLocaleString()}</div></Card>
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-blue-500"><div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Membership Fees</div><div className="text-4xl font-black text-blue-400 mt-1">${totals.membership.toLocaleString()}</div></Card>
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-purple-500"><div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Supplement Sales</div><div className="text-4xl font-black text-purple-400 mt-1">${totals.supplements.toLocaleString()}</div></Card>
          </div>

          <Card title="Financial Audit Trail (Full Log)">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="text-slate-500 border-b border-slate-800 text-[10px] font-black uppercase"><th className="pb-3 px-2">Date</th><th className="pb-3 px-2">Customer</th><th className="pb-3 px-2">Item Details</th><th className="pb-3 px-2">Category</th><th className="pb-3 px-2 text-right">Amount</th></tr>
                    </thead>
                    <tbody>
                        {filteredSales.map((s, idx) => (
                            <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="py-3 px-2 text-slate-400 text-xs">{s.date.toLocaleDateString()}</td>
                                <td className="py-3 px-2 font-bold text-white">{s.memberName}</td>
                                <td className="py-3 px-2 text-slate-400 text-xs italic">{s.description}</td>
                                <td className="py-3 px-2"><span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${s.type === 'MEMBERSHIP' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>{s.type}</span></td>
                                <td className={`py-3 px-2 text-right font-black ${s.type === 'MEMBERSHIP' ? 'text-gym-accent' : 'text-purple-400'}`}>${s.amount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </Card>
        </div>
      )}

      {currentView === 'ALERTS' && (
        <Card title="Immediate Renewal Priorities" className="border-red-500/30 bg-red-500/5">
            <div className="space-y-3">
                {urgentAlerts.length > 0 ? urgentAlerts.map(m => (
                    <div key={m.id} className="bg-slate-800 p-4 rounded-xl border border-red-500/20 flex flex-col md:flex-row justify-between items-center gap-4 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-red-500 border border-red-500/30 shadow-inner"><i className="fas fa-exclamation-triangle text-xl"></i></div>
                            <div>
                                <h4 className="text-white font-bold">{m.name}</h4>
                                <p className="text-xs text-slate-400">Membership {getMemberStatus(m.expiryDate) === 'EXPIRED' ? 'is expired' : 'expires soon'} ({new Date(m.expiryDate).toLocaleDateString()})</p>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <Button size="sm" variant="danger" onClick={(e) => handleOpenOversight(m, e)}>Extend Access</Button>
                            <Button size="sm" variant="success" className="bg-[#25D366] hover:bg-[#128C7E]" onClick={() => window.open(`https://wa.me/${m.phone.replace(/[^0-9]/g, '')}`, '_blank')}><i className="fab fa-whatsapp mr-1"></i> Remind</Button>
                        </div>
                    </div>
                )) : <div className="py-20 text-center text-slate-500 uppercase font-black tracking-widest text-xs border border-dashed border-slate-800 rounded-2xl">No pending membership alerts.</div>}
            </div>
        </Card>
      )}

      {currentView === 'SETTINGS' && (
        <Card title="Gym Rules & Policy Management">
            <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2 font-black uppercase tracking-widest text-[10px]">Public Terms & Conditions</label>
                    <textarea 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-white h-64 focus:ring-gym-accent outline-none font-medium leading-relaxed shadow-inner" 
                        placeholder="Define your gym rules..."
                        value={gymSettings?.termsAndConditions || ''}
                        onChange={e => setGymSettings(prev => prev ? {...prev, termsAndConditions: e.target.value} : null)}
                    />
                </div>
                <div className="flex justify-end">
                    <Button type="submit" size="lg" className="font-black" isLoading={isSyncing}>Sync Policies to Cloud</Button>
                </div>
            </form>
        </Card>
      )}

      {/* Member Oversight Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Member Oversight & Audit Control">
        {selectedMember && (
          <div className="space-y-6">
            <div className="flex border-b border-slate-800 bg-slate-900/40 p-1 rounded-xl shadow-inner">
                {(['EDIT', 'PLANS', 'PHOTOS', 'BILLING'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-gym-accent text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{tab}</button>
                ))}
            </div>

            {activeTab === 'EDIT' && (
                <form onSubmit={handleEditMemberSubmit} className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Full Name" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} required />
                        <Input label="Contact Phone" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Member Username" value={editFormData.username} onChange={e => setEditFormData({...editFormData, username: e.target.value})} required />
                        <Input label="Member Password" type="text" value={editFormData.password} onChange={e => setEditFormData({...editFormData, password: e.target.value})} required />
                    </div>
                    <Button type="submit" size="lg" className="w-full shadow-xl" isLoading={isSyncing}>Apply Identity Updates</Button>
                </form>
            )}

            {activeTab === 'PLANS' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-2xl">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fas fa-calendar-plus text-gym-accent"></i> Plan Tenure Extension</h4>
                        <div className="grid grid-cols-1 gap-4 mb-4">
                            <Input label="Renewal Payment Amount ($)" type="number" placeholder="0.00" value={extensionAmount} onChange={e => setExtensionAmount(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <Button size="sm" variant="outline" className="font-bold border-slate-700 hover:bg-gym-accent" onClick={() => handleExtendPlan(30)} isLoading={isSyncing}>+30 DAYS</Button>
                            <Button size="sm" variant="outline" className="font-bold border-slate-700 hover:bg-gym-accent" onClick={() => handleExtendPlan(90)} isLoading={isSyncing}>+90 DAYS</Button>
                            <Button size="sm" variant="outline" className="font-bold border-slate-700 hover:bg-gym-accent" onClick={() => handleExtendPlan(365)} isLoading={isSyncing}>+1 YEAR</Button>
                        </div>
                    </div>
                    <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fab fa-whatsapp text-emerald-500"></i> AI Communication</h4>
                        <div className="flex gap-2 mb-4">
                            <Button size="sm" variant="secondary" onClick={() => handleGenerateAi('REMINDER')}>Renewal Alert</Button>
                        </div>
                        {aiMessage && (
                            <div className="space-y-2 mt-4">
                                <textarea className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white h-24 outline-none font-medium leading-relaxed" value={aiMessage} onChange={e => setAiMessage(e.target.value)} />
                                <Button className="w-full bg-[#25D366] hover:bg-[#128C7E]" size="sm" onClick={() => window.open(`https://wa.me/${selectedMember.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(aiMessage)}`, '_blank')}><i className="fab fa-whatsapp mr-2"></i> Deliver via WhatsApp</Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'BILLING' && (
                <div className="space-y-5 animate-fade-in">
                    <form onSubmit={handleBillSupplement} className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-2xl">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><i className="fas fa-shopping-cart text-purple-400"></i> Register Product Sale</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Input placeholder="Product / Supplement Name" value={suppForm.productName} onChange={e => setSuppForm({...suppForm, productName: e.target.value})} required />
                            <Input type="number" placeholder="Retail Price ($)" value={suppForm.price} onChange={e => setSuppForm({...suppForm, price: e.target.value})} required />
                        </div>
                        <Button type="submit" size="lg" className="w-full bg-purple-600 hover:bg-purple-700 font-black h-12 shadow-lg" isLoading={isSyncing}>Post Retail Transaction</Button>
                    </form>
                </div>
            )}
          </div>
        )}
      </Modal>

      {/* New Member Registration Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Member Enrollment Authority">
        <form onSubmit={handleAddMember} className="space-y-4">
          <Input label="Full Member Name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          <Input label="WhatsApp / Mobile" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Portal Username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
            <Input label="Portal Password" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Plan Tenure" options={[{ label: '1 Month', value: 30 }, { label: '3 Months', value: 90 }, { label: '1 Year', value: 365 }]} value={formData.planDurationDays} onChange={e => setFormData({ ...formData, planDurationDays: Number(e.target.value) })} />
            <Input label="Join Fee Paid ($)" type="number" required value={formData.amountPaid} onChange={e => setFormData({ ...formData, amountPaid: e.target.value })} />
          </div>
          <Button type="submit" className="w-full h-12" isLoading={isSyncing}>Authorize Registration</Button>
        </form>
      </Modal>
    </div>
  );
};

export default ManagerDashboard;
