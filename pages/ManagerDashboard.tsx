
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Member, PlanDuration, GymSettings, Supplement, PaymentRecord } from '../types';
import { getMembers, saveMembers, getSettings, saveSettings, addMember, getMemberStatus, updateMember, fileToBase64 } from '../services/storage';
import { Button, Input, Card, Modal, Select, Badge } from '../components/UI';
import { generateWhatsAppMessage } from '../services/geminiService';
import { useAuth } from '../App';

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

  // Tabs: Members vs Sales
  const [currentView, setCurrentView] = useState<'MEMBERS' | 'SALES'>('MEMBERS');

  // Member State
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON'>('ALL');
  const [filterDuration, setFilterDuration] = useState<number | 'ALL'>('ALL');
  
  // Sales State
  const [salesFilter, setSalesFilter] = useState<SalesFilter>('WEEKLY');
  const [salesDate, setSalesDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [salesRangeStart, setSalesRangeStart] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [salesRangeEnd, setSalesRangeEnd] = useState<string>(new Date().toISOString().split('T')[0]);

  // UI Modals & Active Tabs
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'PHOTOS' | 'BILLING'>('DETAILS');
  
  // AI
  const [aiMessage, setAiMessage] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Forms
  const [formData, setFormData] = useState({ name: '', phone: '', age: '', planDurationDays: 30, amountPaid: '', username: '', notes: '', profilePhoto: '' });
  const [suppForm, setSuppForm] = useState({ productName: '', price: '', endDate: '' });

  // Refs
  const profileInputRef = useRef<HTMLInputElement>(null);
  const editProfileInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const allMembers = getMembers();
    setMembers(allMembers.filter(m => m.gymId === currentGymId));
  }, [currentGymId]);

  // --- Computed Metrics ---
  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter(m => getMemberStatus(m.expiryDate) === 'ACTIVE').length;
    const expiring = members.filter(m => getMemberStatus(m.expiryDate) === 'EXPIRING_SOON').length;
    const expired = members.filter(m => getMemberStatus(m.expiryDate) === 'EXPIRED').length;
    return { total, active, expiring, expired };
  }, [members]);

  const allSales = useMemo(() => {
    let sales: SaleItem[] = [];
    members.forEach(m => {
        if(m.paymentHistory) {
            m.paymentHistory.forEach(p => {
                sales.push({ id: p.id, date: new Date(p.date), amount: p.amount, type: 'MEMBERSHIP', description: 'Membership Fee', memberName: m.name });
            });
        }
        if(m.supplementHistory) {
            m.supplementHistory.forEach(s => {
                sales.push({ id: s.id, date: new Date(s.purchaseDate), amount: s.price, type: 'SUPPLEMENT', description: s.productName, memberName: m.name });
            });
        }
    });
    return sales.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [members]);

  const parseLocalYMD = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

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
      if (salesFilter === 'DATE') return isSameDay(sale.date, parseLocalYMD(salesDate));
      if (salesFilter === 'RANGE') {
        const start = parseLocalYMD(salesRangeStart);
        const end = parseLocalYMD(salesRangeEnd);
        end.setHours(23, 59, 59, 999);
        return sale.date >= start && sale.date <= end;
      }
      return true;
    });
  }, [allSales, salesFilter, salesDate, salesRangeStart, salesRangeEnd]);

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.amount, 0);
  const supplementSales = filteredSales.filter(s => s.type === 'SUPPLEMENT');
  const totalSupplementRevenue = supplementSales.reduce((sum, s) => sum + s.amount, 0);

  const productBreakdown = useMemo(() => {
    const counts: Record<string, { count: number, revenue: number }> = {};
    supplementSales.forEach(s => {
      if (!counts[s.description]) counts[s.description] = { count: 0, revenue: 0 };
      counts[s.description].count += 1;
      counts[s.description].revenue += s.amount;
    });
    return Object.entries(counts).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [supplementSales]);

  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    const now = new Date();

    if (salesFilter === 'WEEKLY') {
      for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        data[d.toLocaleDateString('en-US', { weekday: 'short' })] = 0;
      }
      filteredSales.forEach(s => {
        const key = s.date.toLocaleDateString('en-US', { weekday: 'short' });
        if(data[key] !== undefined) data[key] += s.amount;
      });
    } else if (salesFilter === 'MONTHLY' || (salesFilter === 'RANGE' && filteredSales.length > 0)) {
        filteredSales.forEach(s => {
          const key = s.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if(!data[key]) data[key] = 0;
          data[key] += s.amount;
        });
    } else {
        data['Membership'] = filteredSales.filter(s => s.type === 'MEMBERSHIP').reduce((sum, s) => sum + s.amount, 0);
        data['Supplements'] = filteredSales.filter(s => s.type === 'SUPPLEMENT').reduce((sum, s) => sum + s.amount, 0);
    }
    return Object.entries(data).map(([label, value]) => ({ label, value }));
  }, [filteredSales, salesFilter]);

  // --- Handlers ---
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      if (field === 'formData') setFormData({ ...formData, profilePhoto: base64 });
      else if (selectedMember) {
        const updated = { ...selectedMember, [field]: base64 };
        updateMember(updated);
        setSelectedMember(updated);
        setMembers(getMembers().filter(m => m.gymId === currentGymId));
      }
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
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
      isActive: true, notes: formData.notes, profilePhoto: formData.profilePhoto,
      supplementHistory: [],
      paymentHistory: [{ id: Date.now().toString(), date: new Date().toISOString(), amount: Number(formData.amountPaid), method: 'OFFLINE', recordedBy: 'Manager' }]
    };
    addMember(newMember);
    setMembers(getMembers().filter(m => m.gymId === currentGymId));
    setIsAddModalOpen(false);
    setFormData({ name: '', phone: '', age: '', planDurationDays: 30, amountPaid: '', username: '', notes: '', profilePhoto: '' });
  };

  const handleExtendPlan = (days: number) => {
    if (!selectedMember) return;
    const currentExpiry = new Date(selectedMember.expiryDate).getTime();
    const now = new Date().getTime();
    const baseTime = Math.max(currentExpiry, now);
    const newExpiry = new Date(baseTime + (days * 24 * 60 * 60 * 1000));
    
    const updated: Member = { 
      ...selectedMember, 
      expiryDate: newExpiry.toISOString(), 
      isActive: true,
      paymentHistory: [...(selectedMember.paymentHistory || []), { id: Date.now().toString(), date: new Date().toISOString(), amount: 0, method: 'OFFLINE', recordedBy: 'Manager (Extension)' }]
    };
    updateMember(updated);
    setSelectedMember(updated);
    setMembers(getMembers().filter(m => m.gymId === currentGymId));
  };

  const handleAddSupplement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    const newSupp: Supplement = {
      id: Date.now().toString(), productName: suppForm.productName,
      price: Number(suppForm.price), purchaseDate: new Date().toISOString(),
      endDate: suppForm.endDate ? new Date(suppForm.endDate).toISOString() : undefined
    };
    const updated = { ...selectedMember, supplementHistory: [...(selectedMember.supplementHistory || []), newSupp] };
    updateMember(updated);
    setSelectedMember(updated);
    setMembers(getMembers().filter(m => m.gymId === currentGymId));
    setSuppForm({ productName: '', price: '', endDate: '' });
  };

  const handleGenerateAi = async (type: 'REMINDER' | 'WELCOME' | 'OFFER') => {
    if(!selectedMember) return;
    setLoadingAi(true);
    const msg = await generateWhatsAppMessage(selectedMember.name, selectedMember.expiryDate, type);
    setAiMessage(msg);
    setLoadingAi(false);
  };

  const renderGraph = () => {
    const maxVal = Math.max(...chartData.map(d => d.value), 1);
    return (
      <div className="h-56 flex items-end justify-between gap-2 mt-8 px-2 overflow-x-auto custom-scrollbar pb-2">
        {chartData.map((d, i) => (
          <div key={i} className="flex flex-col items-center flex-1 min-w-[40px] group">
            <div className="text-[10px] text-gym-accent font-bold opacity-0 group-hover:opacity-100 transition-opacity mb-1">${d.value}</div>
            <div className="w-full bg-gym-accent/40 group-hover:bg-gym-accent rounded-t transition-all" style={{ height: `${(d.value / maxVal) * 100}%`, minHeight: '4px' }}></div>
            <div className="text-[9px] text-slate-500 mt-2 truncate w-full text-center font-medium uppercase tracking-tighter">{d.label}</div>
          </div>
        ))}
      </div>
    );
  };

  const filteredMembers = members.filter(m => {
    const status = getMemberStatus(m.expiryDate);
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.phone.includes(searchTerm);
    const matchesStatus = filterStatus === 'ALL' ? true : filterStatus === 'ACTIVE' ? (status === 'ACTIVE' || status === 'EXPIRING_SOON') : status === filterStatus;
    const matchesDuration = filterDuration === 'ALL' ? true : m.planDurationDays === filterDuration;
    return matchesSearch && matchesStatus && matchesDuration;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View Switcher */}
      <div className="flex justify-center">
        <div className="bg-slate-800 p-1 rounded-xl shadow-2xl border border-slate-700">
          <button onClick={() => setCurrentView('MEMBERS')} className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-all ${currentView === 'MEMBERS' ? 'bg-gym-accent text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Member List</button>
          <button onClick={() => setCurrentView('SALES')} className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-all ${currentView === 'SALES' ? 'bg-gym-accent text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Financial Reports</button>
        </div>
      </div>

      {currentView === 'MEMBERS' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-800 border-l-4 border-l-blue-500 p-4"><div className="text-slate-400 text-xs font-bold uppercase">Total</div><div className="text-2xl font-black text-white">{stats.total}</div></Card>
            <Card className="bg-slate-800 border-l-4 border-l-emerald-500 p-4"><div className="text-slate-400 text-xs font-bold uppercase">Active</div><div className="text-2xl font-black text-white">{stats.active}</div></Card>
            <Card className="bg-slate-800 border-l-4 border-l-yellow-500 p-4"><div className="text-slate-400 text-xs font-bold uppercase">Due</div><div className="text-2xl font-black text-white">{stats.expiring}</div></Card>
            <Card className="bg-slate-800 border-l-4 border-l-red-500 p-4"><div className="text-slate-400 text-xs font-bold uppercase">Expired</div><div className="text-2xl font-black text-white">{stats.expired}</div></Card>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-between bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
            <Input placeholder="Search name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="md:w-72" />
            <div className="flex flex-wrap gap-2">
              <select className="bg-slate-800 text-white rounded-lg px-3 text-sm border border-slate-700" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                <option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="EXPIRING_SOON">Due Soon</option><option value="EXPIRED">Expired</option>
              </select>
              <select className="bg-slate-800 text-white rounded-lg px-3 text-sm border border-slate-700" value={filterDuration} onChange={e => setFilterDuration(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}>
                <option value="ALL">All Plans</option><option value={30}>1 Month</option><option value={90}>3 Months</option><option value={180}>6 Months</option><option value={365}>1 Year</option>
              </select>
              <Button onClick={() => setIsAddModalOpen(true)}><i className="fas fa-plus mr-2"></i> Add Member</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map(m => (
              <Card key={m.id} className="hover:border-gym-accent/50 transition-all cursor-pointer relative group" onClick={() => { setSelectedMember(m); setIsEditModalOpen(true); }}>
                <div className="absolute top-4 right-4"><Badge status={getMemberStatus(m.expiryDate)} /></div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600">
                    {m.profilePhoto ? <img src={m.profilePhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold">{m.name.charAt(0)}</div>}
                  </div>
                  <div><h3 className="font-bold text-white">{m.name}</h3><p className="text-slate-400 text-xs">{m.phone}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                  <div>Joined: <span className="text-white block">{new Date(m.joinDate).toLocaleDateString()}</span></div>
                  <div>Expiry: <span className="text-white block">{new Date(m.expiryDate).toLocaleDateString()}</span></div>
                </div>
                <div className="bg-slate-800/50 p-2 rounded text-xs text-center border border-slate-700 group-hover:bg-gym-accent group-hover:text-white transition-colors">Manage Member Details</div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <Card className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-800/30 border-slate-700/50">
            <div className="flex flex-wrap gap-2">
              {(['DAILY', 'WEEKLY', 'MONTHLY', 'DATE', 'RANGE'] as SalesFilter[]).map(f => (
                <button key={f} onClick={() => setSalesFilter(f)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${salesFilter === f ? 'bg-gym-accent text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>{f.replace('DATE', 'Specific Date').replace('RANGE', 'Custom Range')}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {salesFilter === 'DATE' && <input type="date" value={salesDate} onChange={e => setSalesDate(e.target.value)} className="bg-slate-800 border border-slate-700 text-white text-xs p-2 rounded" />}
              {salesFilter === 'RANGE' && (
                <>
                  <input type="date" value={salesRangeStart} onChange={e => setSalesRangeStart(e.target.value)} className="bg-slate-800 border border-slate-700 text-white text-xs p-2 rounded" />
                  <span className="text-slate-500">to</span>
                  <input type="date" value={salesRangeEnd} onChange={e => setSalesRangeEnd(e.target.value)} className="bg-slate-800 border border-slate-700 text-white text-xs p-2 rounded" />
                </>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-b-2 border-gym-accent">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Total Revenue</div>
                  <div className="text-3xl font-black text-white mt-1">${totalRevenue.toLocaleString()}</div>
                </Card>
                <Card className="bg-slate-800/50">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Supplement Sales</div>
                  <div className="text-3xl font-black text-purple-400 mt-1">${totalSupplementRevenue.toLocaleString()}</div>
                </Card>
                <Card className="bg-slate-800/50">
                  <div className="text-slate-400 text-[10px] font-bold uppercase">Transactions</div>
                  <div className="text-3xl font-black text-white mt-1">{filteredSales.length}</div>
                </Card>
              </div>

              <Card title="Revenue Trend Overview">{renderGraph()}</Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Product Analytics" className="border border-purple-500/10">
                  <div className="space-y-4">
                    {productBreakdown.map(([name, stat], idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs"><span className="text-white font-bold">{name}</span><span className="text-purple-400 font-bold">${stat.revenue}</span></div>
                        <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-purple-500" style={{ width: `${(stat.revenue / totalSupplementRevenue) * 100}%` }}></div></div>
                        <div className="text-[9px] text-slate-500">{stat.count} items sold</div>
                      </div>
                    ))}
                    {productBreakdown.length === 0 && <div className="text-center text-slate-500 py-10 text-sm">No supplement sales data.</div>}
                  </div>
                </Card>
                <Card title="Supplement Audit" className="h-[350px] flex flex-col">
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {supplementSales.map((s, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50 flex justify-between items-center text-xs">
                        <div><div className="text-white font-medium">{s.description}</div><div className="text-[10px] text-slate-500">{s.memberName} • {s.date.toLocaleDateString()}</div></div>
                        <div className="text-purple-400 font-bold">${s.amount}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            <Card title="Recent Transactions" className="h-full flex flex-col max-h-[1000px]">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {filteredSales.map((s, idx) => (
                  <div key={idx} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${s.type === 'MEMBERSHIP' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}><i className={`fas ${s.type === 'MEMBERSHIP' ? 'fa-user' : 'fa-box'}`}></i></div>
                      <div><div className="text-xs font-bold text-white">{s.memberName}</div><div className="text-[10px] text-slate-500">{s.description}</div></div>
                    </div>
                    <div className="text-right"><div className={`text-xs font-black ${s.type === 'MEMBERSHIP' ? 'text-gym-accent' : 'text-purple-400'}`}>+${s.amount}</div><div className="text-[9px] text-slate-600">{s.date.toLocaleDateString()}</div></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Member">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div className="flex justify-center mb-4"><div onClick={() => profileInputRef.current?.click()} className="w-24 h-24 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden">{formData.profilePhoto ? <img src={formData.profilePhoto} className="w-full h-full object-cover" /> : <div className="text-center"><i className="fas fa-camera text-slate-500 text-xl"></i><div className="text-[10px] text-slate-500 mt-1">Photo</div></div>}<input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={e => handlePhotoUpload(e, 'formData')} /></div></div>
          <Input label="Name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4"><Input label="Phone" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /><Input label="Age" type="number" required value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} /></div>
          <Select label="Plan Duration" options={[{ label: '1 Month', value: 30 }, { label: '3 Months', value: 90 }, { label: '6 Months', value: 180 }, { label: '1 Year', value: 365 }]} value={formData.planDurationDays} onChange={e => setFormData({ ...formData, planDurationDays: Number(e.target.value) })} />
          <Input label="Amount Paid" type="number" required value={formData.amountPaid} onChange={e => setFormData({ ...formData, amountPaid: e.target.value })} />
          <Button type="submit" className="w-full">Create Profile</Button>
        </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Member Management">
        {selectedMember && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-slate-800 overflow-hidden border-2 border-gym-accent cursor-pointer" onClick={() => editProfileInputRef.current?.click()}>{selectedMember.profilePhoto ? <img src={selectedMember.profilePhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{selectedMember.name.charAt(0)}</div>}<input type="file" ref={editProfileInputRef} className="hidden" accept="image/*" onChange={e => handlePhotoUpload(e, 'profilePhoto')} /></div>
              <div><h2 className="text-xl font-bold text-white">{selectedMember.name}</h2><Badge status={getMemberStatus(selectedMember.expiryDate)} /></div>
            </div>
            <div className="flex border-b border-slate-800"><button onClick={() => setActiveTab('DETAILS')} className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider ${activeTab === 'DETAILS' ? 'text-gym-accent border-b-2 border-gym-accent' : 'text-slate-500'}`}>Plans</button><button onClick={() => setActiveTab('PHOTOS')} className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider ${activeTab === 'PHOTOS' ? 'text-gym-accent border-b-2 border-gym-accent' : 'text-slate-500'}`}>Photos</button><button onClick={() => setActiveTab('BILLING')} className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider ${activeTab === 'BILLING' ? 'text-gym-accent border-b-2 border-gym-accent' : 'text-slate-500'}`}>Shop</button></div>
            
            {activeTab === 'DETAILS' && (
              <div className="space-y-4">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Extend Membership</h4>
                  <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => handleExtendPlan(30)}>+1 Month</Button><Button size="sm" variant="outline" onClick={() => handleExtendPlan(90)}>+3 Months</Button><Button size="sm" variant="outline" onClick={() => handleExtendPlan(180)}>+6 Months</Button><Button size="sm" variant="outline" onClick={() => handleExtendPlan(365)}>+1 Year</Button></div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">AI Notifications</h4>
                  <div className="flex gap-2 mb-3"><Button size="sm" variant="secondary" onClick={() => handleGenerateAi('REMINDER')}>Renewal</Button><Button size="sm" variant="secondary" onClick={() => handleGenerateAi('WELCOME')}>Welcome</Button><Button size="sm" variant="secondary" onClick={() => handleGenerateAi('OFFER')}>Discount</Button></div>
                  {aiMessage && <textarea className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white h-24 mb-2" value={aiMessage} readOnly />}
                  {aiMessage && <Button className="w-full bg-[#25D366]" size="sm" onClick={() => window.open(`https://wa.me/${selectedMember.phone}?text=${encodeURIComponent(aiMessage)}`, '_blank')}><i className="fab fa-whatsapp mr-2"></i> Send to Client</Button>}
                </div>
              </div>
            )}

            {activeTab === 'PHOTOS' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><div onClick={() => beforeInputRef.current?.click()} className="aspect-[3/4] bg-slate-800 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center cursor-pointer overflow-hidden">{selectedMember.beforePhoto ? <img src={selectedMember.beforePhoto} className="w-full h-full object-cover" /> : <div className="text-center text-slate-500 text-[10px] uppercase font-bold">Upload Before</div>}</div><input type="file" ref={beforeInputRef} className="hidden" accept="image/*" onChange={e => handlePhotoUpload(e, 'beforePhoto')} /></div>
                <div className="space-y-2"><div onClick={() => afterInputRef.current?.click()} className="aspect-[3/4] bg-slate-800 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center cursor-pointer overflow-hidden">{selectedMember.afterPhoto ? <img src={selectedMember.afterPhoto} className="w-full h-full object-cover" /> : <div className="text-center text-slate-500 text-[10px] uppercase font-bold">Upload After</div>}</div><input type="file" ref={afterInputRef} className="hidden" accept="image/*" onChange={e => handlePhotoUpload(e, 'afterPhoto')} /></div>
              </div>
            )}

            {activeTab === 'BILLING' && (
              <div className="space-y-4">
                <form onSubmit={handleAddSupplement} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">New Sale</h4>
                  <div className="grid grid-cols-2 gap-2"><Input placeholder="Product" value={suppForm.productName} onChange={e => setSuppForm({ ...suppForm, productName: e.target.value })} /><Input type="number" placeholder="Price" value={suppForm.price} onChange={e => setSuppForm({ ...suppForm, price: e.target.value })} /></div>
                  <Button type="submit" size="sm" className="w-full" disabled={!suppForm.productName || !suppForm.price}>Record Sale</Button>
                </form>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedMember.supplementHistory?.slice().reverse().map(s => (
                    <div key={s.id} className="flex justify-between items-center p-2 bg-slate-800 rounded text-xs">
                      <div><div className="font-bold text-white">{s.productName}</div><div className="text-[10px] text-slate-500">{new Date(s.purchaseDate).toLocaleDateString()}</div></div>
                      <div className="text-purple-400 font-black">${s.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ManagerDashboard;
