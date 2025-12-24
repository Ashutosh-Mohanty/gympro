
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Member, PlanDuration, GymSettings, Supplement, PaymentRecord } from '../types';
import { getMembers, saveMembers, getSettings, saveSettings, addMember, getMemberStatus, updateMember, fileToBase64 } from '../services/storage';
import { Button, Input, Card, Modal, Select, Badge } from '../components/UI';
import { generateWhatsAppMessage } from '../services/geminiService';
import { useAuth } from '../App';

// --- Sales Types ---
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

  // View Mode
  const [currentView, setCurrentView] = useState<'MEMBERS' | 'SALES'>('MEMBERS');

  // Member Data
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<GymSettings>(getSettings());
  
  // Member Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON'>('ALL');
  const [filterDuration, setFilterDuration] = useState<number | 'ALL'>('ALL');
  
  // Sales Filters
  const [salesFilter, setSalesFilter] = useState<SalesFilter>('WEEKLY');
  const [salesDate, setSalesDate] = useState<string>(new Date().toISOString().split('T')[0]);
  // Range State
  const [salesRangeStart, setSalesRangeStart] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [salesRangeEnd, setSalesRangeEnd] = useState<string>(new Date().toISOString().split('T')[0]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'PHOTOS' | 'BILLING'>('DETAILS');
  
  // AI
  const [aiMessage, setAiMessage] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  // New Member Form State
  const initialFormState = {
    name: '', phone: '', age: '', planDurationDays: 30, amountPaid: '', username: '', notes: '', profilePhoto: ''
  };
  const [formData, setFormData] = useState(initialFormState);
  
  // Supplement Form
  const [suppForm, setSuppForm] = useState({ productName: '', price: '', endDate: '' });

  // Refs for file inputs
  const profileInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);
  const editProfileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const allMembers = getMembers();
    setMembers(allMembers.filter(m => m.gymId === currentGymId));
  }, [currentGymId]);

  // --- Computed Stats ---
  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter(m => getMemberStatus(m.expiryDate) === 'ACTIVE').length;
    const expiring = members.filter(m => getMemberStatus(m.expiryDate) === 'EXPIRING_SOON').length;
    const expired = members.filter(m => getMemberStatus(m.expiryDate) === 'EXPIRED').length;
    return { total, active, expiring, expired };
  }, [members]);

  // --- Sales Data Aggregation ---
  const allSales = useMemo(() => {
    let sales: SaleItem[] = [];
    members.forEach(m => {
        if(m.paymentHistory) {
            m.paymentHistory.forEach(p => {
                sales.push({
                    id: p.id,
                    date: new Date(p.date),
                    amount: p.amount,
                    type: 'MEMBERSHIP',
                    description: 'Membership Fee',
                    memberName: m.name
                });
            });
        }
        if(m.supplementHistory) {
            m.supplementHistory.forEach(s => {
                sales.push({
                    id: s.id,
                    date: new Date(s.purchaseDate),
                    amount: s.price,
                    type: 'SUPPLEMENT',
                    description: s.productName,
                    memberName: m.name
                });
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
      const isSameDay = (d1: Date, d2: Date) => 
          d1.getFullYear() === d2.getFullYear() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getDate() === d2.getDate();

      return allSales.filter(sale => {
          if (salesFilter === 'DAILY') return isSameDay(sale.date, now);
          if (salesFilter === 'WEEKLY') {
              const weekAgo = new Date(now);
              weekAgo.setDate(now.getDate() - 7);
              weekAgo.setHours(0,0,0,0);
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

  // Supplement Specific Metrics
  const supplementMetrics = useMemo(() => {
      const sales = filteredSales.filter(s => s.type === 'SUPPLEMENT');
      const totalRevenue = sales.reduce((sum, s) => sum + s.amount, 0);
      const productSummary: Record<string, { count: number, revenue: number }> = {};
      
      sales.forEach(s => {
          if (!productSummary[s.description]) {
              productSummary[s.description] = { count: 0, revenue: 0 };
          }
          productSummary[s.description].count += 1;
          productSummary[s.description].revenue += s.amount;
      });

      return {
          sales,
          totalRevenue,
          productBreakdown: Object.entries(productSummary).sort((a, b) => b[1].revenue - a[1].revenue)
      };
  }, [filteredSales]);

  const chartData = useMemo(() => {
      const data: Record<string, number> = {};
      const now = new Date();

      if (salesFilter === 'WEEKLY') {
          for(let i=6; i>=0; i--) {
              const d = new Date();
              d.setDate(now.getDate() - i);
              const key = d.toLocaleDateString('en-US', { weekday: 'short' });
              data[key] = 0;
          }
          filteredSales.forEach(sale => {
              const key = sale.date.toLocaleDateString('en-US', { weekday: 'short' });
              if (data[key] !== undefined) data[key] += sale.amount;
          });
          return Object.entries(data).map(([label, value]) => ({ label, value }));

      } else if (salesFilter === 'MONTHLY') {
           const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
           for(let i=1; i<=daysInMonth; i++) data[i] = 0;
           filteredSales.forEach(sale => {
              const key = sale.date.getDate();
              if (data[key] !== undefined) data[key] += sale.amount;
           });
           return Object.entries(data).map(([label, value]) => ({ label, value }));

      } else if (salesFilter === 'RANGE') {
           const start = parseLocalYMD(salesRangeStart);
           const end = parseLocalYMD(salesRangeEnd);
           const diffTime = Math.abs(end.getTime() - start.getTime());
           const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
           
           if (diffDays > 32) {
               filteredSales.forEach(sale => {
                   const key = sale.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                   if (!data[key]) data[key] = 0;
                   data[key] += sale.amount;
               });
               const sorted = Object.entries(data).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
               return sorted.map(([label, value]) => ({ label, value }));
           } else {
               for(let i=0; i<=diffDays; i++) {
                   const d = new Date(start);
                   d.setDate(start.getDate() + i);
                   const key = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                   data[key] = 0;
               }
               filteredSales.forEach(sale => {
                   const key = sale.date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                   if (data[key] !== undefined) data[key] += sale.amount;
               });
               return Object.entries(data).map(([label, value]) => ({ label, value }));
           }
      } else {
          data['Membership'] = 0;
          data['Supplement'] = 0;
          filteredSales.forEach(sale => {
              const key = sale.type === 'MEMBERSHIP' ? 'Membership' : 'Supplement';
              data[key] += sale.amount;
          });
          return Object.entries(data).map(([label, value]) => ({ label, value }));
      }
  }, [filteredSales, salesFilter, salesRangeStart, salesRangeEnd]);

  const totalRevenue = filteredSales.reduce((sum, item) => sum + item.amount, 0);

  const filteredMembers = members.filter(m => {
    const status = getMemberStatus(m.expiryDate);
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.phone.includes(searchTerm);
    const strictStatusMatch = filterStatus === 'ALL' ? true : filterStatus === 'ACTIVE' ? (status === 'ACTIVE' || status === 'EXPIRING_SOON') : status === filterStatus;
    const durationMatch = filterDuration === 'ALL' ? true : m.planDurationDays === filterDuration;
    return matchesSearch && strictStatusMatch && durationMatch;
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'formDataProfile' | 'editProfile' | 'before' | 'after') => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          try {
              const base64 = await fileToBase64(file);
              if (field === 'formDataProfile') {
                  setFormData(prev => ({ ...prev, profilePhoto: base64 }));
              } else if (selectedMember) {
                  let updated = { ...selectedMember };
                  if (field === 'editProfile') updated.profilePhoto = base64;
                  if (field === 'before') updated.beforePhoto = base64;
                  if (field === 'after') updated.afterPhoto = base64;
                  updateMember(updated);
                  setSelectedMember(updated);
                  setMembers(getMembers().filter(m => m.gymId === currentGymId));
              }
          } catch (err) { alert("Failed to upload image."); }
      }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGymId) return;
    const joinDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(joinDate.getDate() + Number(formData.planDurationDays));
    const newMember: Member = {
      id: Date.now().toString(),
      name: formData.name, phone: formData.phone,
      joinDate: joinDate.toISOString(), planDurationDays: Number(formData.planDurationDays),
      expiryDate: expiryDate.toISOString(), age: Number(formData.age),
      amountPaid: Number(formData.amountPaid), gymId: currentGymId,
      username: formData.username || formData.name.toLowerCase().replace(/\s/g, ''),
      isActive: true, notes: formData.notes, profilePhoto: formData.profilePhoto,
      supplementHistory: [],
      paymentHistory: [{ id: Date.now().toString(), date: new Date().toISOString(), amount: Number(formData.amountPaid), method: 'OFFLINE', recordedBy: 'Manager' }]
    };
    addMember(newMember);
    setMembers(getMembers().filter(m => m.gymId === currentGymId));
    setIsAddModalOpen(false);
    setFormData(initialFormState);
  };

  const handleExtendPlan = (member: Member, days: number) => {
    const currentExpiry = new Date(member.expiryDate).getTime();
    const now = new Date().getTime();
    const baseTime = Math.max(currentExpiry, now);
    const newExpiry = new Date(baseTime + (days * 24 * 60 * 60 * 1000));
    const updatedMember = { ...member, expiryDate: newExpiry.toISOString(), isActive: true };
    updateMember(updatedMember);
    setMembers(getMembers().filter(m => m.gymId === currentGymId));
    setSelectedMember(updatedMember);
  };

  const handleAddSupplement = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedMember) return;
      const newSupp: Supplement = {
          id: Date.now().toString(), productName: suppForm.productName,
          price: Number(suppForm.price), purchaseDate: new Date().toISOString(),
          endDate: suppForm.endDate ? new Date(suppForm.endDate).toISOString() : undefined
      };
      const updatedMember = { ...selectedMember, supplementHistory: [...(selectedMember.supplementHistory || []), newSupp] };
      updateMember(updatedMember);
      setSelectedMember(updatedMember);
      setMembers(getMembers().filter(m => m.gymId === currentGymId));
      setSuppForm({ productName: '', price: '', endDate: '' });
  };

  const handleGenerateAiMessage = async (member: Member, type: 'REMINDER' | 'WELCOME' | 'OFFER') => {
    setLoadingAi(true);
    const msg = await generateWhatsAppMessage(member.name, member.expiryDate, type);
    setAiMessage(msg);
    setLoadingAi(false);
  };

  const openWhatsApp = (phone: string, text: string) => {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const renderGraph = () => {
    const maxVal = Math.max(...chartData.map(d => d.value), 10); 
    return (
        <div className="h-48 flex items-end justify-between gap-1 mt-4 px-2 overflow-x-auto pb-2">
            {chartData.map((d, i) => {
                const heightPercent = (d.value / maxVal) * 100;
                return (
                    <div key={i} className="flex flex-col items-center min-w-[30px] flex-1 group">
                        <div className="text-[10px] text-gym-accent opacity-0 group-hover:opacity-100 transition-opacity mb-1 font-bold">${d.value}</div>
                        <div className="w-full max-w-[40px] bg-gym-accent/50 hover:bg-gym-accent rounded-t transition-all relative" style={{ height: `${Math.max(heightPercent, 2)}%` }}></div>
                        <div className="text-[10px] text-slate-500 mt-1 truncate w-full text-center">{d.label}</div>
                    </div>
                );
            })}
        </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center mb-6">
          <div className="bg-slate-800 p-1 rounded-lg inline-flex shadow-lg">
              <button onClick={() => setCurrentView('MEMBERS')} className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${currentView === 'MEMBERS' ? 'bg-gym-accent text-white shadow' : 'text-slate-400 hover:text-white'}`}>Members Management</button>
              <button onClick={() => setCurrentView('SALES')} className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${currentView === 'SALES' ? 'bg-gym-accent text-white shadow' : 'text-slate-400 hover:text-white'}`}>Sales Reports</button>
          </div>
      </div>

      {currentView === 'MEMBERS' ? (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-blue-500">
            <div className="text-slate-400 text-sm">Total Members</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            </Card>
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-green-500">
            <div className="text-slate-400 text-sm">Active</div>
            <div className="text-2xl font-bold text-white">{stats.active}</div>
            </Card>
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-yellow-500">
            <div className="text-slate-400 text-sm">Expiring Soon</div>
            <div className="text-2xl font-bold text-white">{stats.expiring}</div>
            </Card>
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-l-4 border-l-red-500">
            <div className="text-slate-400 text-sm">Inactive</div>
            <div className="text-2xl font-bold text-white">{stats.expired}</div>
            </Card>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-slate-800/50 p-4 rounded-xl backdrop-blur-sm border border-slate-700/50">
            <Input placeholder="Search by name or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full xl:w-96" />
            <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                <select className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-gym-accent" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="EXPIRING_SOON">Expiring Soon</option>
                    <option value="EXPIRED">Expired</option>
                </select>
                <select className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-gym-accent" value={filterDuration} onChange={(e) => setFilterDuration(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}>
                    <option value="ALL">All Durations</option>
                    <option value={30}>1 Month (30d)</option>
                    <option value={90}>3 Months (90d)</option>
                    <option value={180}>6 Months (180d)</option>
                    <option value={365}>1 Year (365d)</option>
                </select>
                <Button onClick={() => setIsAddModalOpen(true)}><i className="fas fa-plus mr-2"></i> Add Member</Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map(member => (
            <Card key={member.id} className="relative group hover:border-gym-accent/50 transition-all">
                <div className="absolute top-4 right-4 flex flex-col gap-2 items-end"><Badge status={getMemberStatus(member.expiryDate)} /></div>
                <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-slate-600">
                    {member.profilePhoto ? <img src={member.profilePhoto} className="w-full h-full object-cover"/> : <span className="text-xl font-bold text-slate-300">{member.name.charAt(0)}</span>}
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">{member.name}</h3>
                    <p className="text-slate-400 text-sm"><i className="fas fa-phone-alt text-xs mr-1"></i>{member.phone}</p>
                    <p className="text-slate-500 text-xs mt-1">Plan: {member.planDurationDays} Days</p>
                </div>
                </div>
                <div className="space-y-2 text-sm text-slate-300 mb-6 bg-slate-800/50 p-3 rounded-lg">
                <div className="flex justify-between"><span>Joined:</span><span className="text-white">{new Date(member.joinDate).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span>Expires:</span><span className={`${getMemberStatus(member.expiryDate) === 'EXPIRING_SOON' ? 'text-yellow-400 font-bold' : getMemberStatus(member.expiryDate) === 'EXPIRED' ? 'text-red-400' : 'text-white'}`}>{new Date(member.expiryDate).toLocaleDateString()}</span></div>
                </div>
                <div className="flex gap-2 mt-auto">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setSelectedMember(member); setIsEditModalOpen(true); setActiveTab('DETAILS'); setAiMessage(''); }}>Manage</Button>
                <Button size="sm" className="bg-[#25D366] hover:bg-[#20bd5a] text-white" onClick={() => openWhatsApp(member.phone, `Hi ${member.name}, just checking in from GymPro!`)}><i className="fab fa-whatsapp"></i></Button>
                </div>
            </Card>
            ))}
        </div>
      </>
      ) : (
      <div className="space-y-6 animate-fade-in">
          <Card className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-800/50 border-slate-700/50 shadow-inner">
              <div className="flex flex-wrap gap-2 bg-slate-900 p-1 rounded-lg">
                  {(['DAILY', 'WEEKLY', 'MONTHLY', 'DATE', 'RANGE'] as SalesFilter[]).map(f => (
                       <button key={f} onClick={() => setSalesFilter(f)} className={`px-3 py-1.5 rounded text-sm capitalize transition-colors ${salesFilter === f ? 'bg-gym-accent text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>{f === 'DATE' ? 'Custom Date' : f === 'RANGE' ? 'Date Range' : f.toLowerCase()}</button>
                  ))}
              </div>
              {salesFilter === 'DATE' && <input type="date" value={salesDate} onChange={(e) => setSalesDate(e.target.value)} className="bg-slate-700 border border-slate-600 text-white rounded px-3 py-1.5 text-sm focus:ring-gym-accent" />}
              {salesFilter === 'RANGE' && (
                  <div className="flex items-center gap-2">
                      <input type="date" value={salesRangeStart} onChange={(e) => setSalesRangeStart(e.target.value)} className="bg-slate-700 border border-slate-600 text-white rounded px-3 py-1.5 text-sm focus:ring-gym-accent" />
                      <span className="text-slate-500">-</span>
                      <input type="date" value={salesRangeEnd} onChange={(e) => setSalesRangeEnd(e.target.value)} className="bg-slate-700 border border-slate-600 text-white rounded px-3 py-1.5 text-sm focus:ring-gym-accent" />
                  </div>
              )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Card className="bg-gradient-to-r from-gym-accent/20 to-emerald-900/20 border-gym-accent/30">
                          <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Total Revenue</div>
                          <div className="text-3xl font-bold text-white mt-1">${totalRevenue}</div>
                      </Card>
                      <Card className="bg-slate-800/50 border-purple-500/20">
                           <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Supplement Sales</div>
                          <div className="text-3xl font-bold text-purple-400 mt-1">${supplementMetrics.totalRevenue}</div>
                      </Card>
                      <Card className="bg-slate-800/50">
                           <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Orders Count</div>
                          <div className="text-3xl font-bold text-white mt-1">{filteredSales.length}</div>
                      </Card>
                  </div>
                  <Card title="Revenue Trend" className="bg-slate-800/40">{renderGraph()}</Card>

                  {/* New Supplement Sales Details Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card title="Top Selling Supplements" className="bg-slate-800/60 border-purple-500/10">
                          <div className="space-y-4">
                              {supplementMetrics.productBreakdown.length > 0 ? (
                                  supplementMetrics.productBreakdown.map(([name, stats], idx) => (
                                      <div key={idx} className="flex flex-col gap-1">
                                          <div className="flex justify-between text-sm">
                                              <span className="text-white font-medium">{name}</span>
                                              <span className="text-purple-400 font-bold">${stats.revenue}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                  <div 
                                                    className="h-full bg-purple-500 rounded-full" 
                                                    style={{ width: `${(stats.revenue / supplementMetrics.totalRevenue) * 100}%` }}
                                                  ></div>
                                              </div>
                                              <span className="text-[10px] text-slate-500">{stats.count} sold</span>
                                          </div>
                                      </div>
                                  ))
                              ) : (
                                  <div className="text-center py-10 text-slate-500 italic text-sm">No supplement sales for this period.</div>
                              )}
                          </div>
                      </Card>

                      <Card title="Supplement Audit Log" className="bg-slate-800/60 border-purple-500/10 h-[300px] flex flex-col">
                           <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                              {supplementMetrics.sales.length > 0 ? (
                                  supplementMetrics.sales.map((sale, idx) => (
                                      <div key={idx} className="p-2.5 bg-purple-900/10 rounded border border-purple-500/20 flex justify-between items-center text-xs">
                                          <div>
                                              <div className="text-slate-200 font-medium">{sale.description}</div>
                                              <div className="text-[10px] text-slate-500">{sale.memberName} • {sale.date.toLocaleDateString()}</div>
                                          </div>
                                          <div className="text-purple-400 font-bold">${sale.amount}</div>
                                      </div>
                                  ))
                              ) : (
                                  <div className="text-center py-10 text-slate-500 text-xs">No records.</div>
                              )}
                           </div>
                      </Card>
                  </div>
              </div>

              <Card title="All Transactions" className="h-full flex flex-col bg-slate-800/40">
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {filteredSales.length > 0 ? (
                          filteredSales.map((sale, idx) => (
                              <div key={idx} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${sale.type === 'MEMBERSHIP' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                          <i className={`fas ${sale.type === 'MEMBERSHIP' ? 'fa-user' : 'fa-flask'}`}></i>
                                      </div>
                                      <div>
                                          <div className="text-sm font-medium text-white">{sale.memberName}</div>
                                          <div className="text-xs text-slate-500">{sale.description}</div>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <div className={`text-sm font-bold ${sale.type === 'MEMBERSHIP' ? 'text-gym-accent' : 'text-purple-400'}`}>+${sale.amount}</div>
                                      <div className="text-[10px] text-slate-500">{sale.date.toLocaleDateString()}</div>
                                  </div>
                              </div>
                          ))
                      ) : (
                          <div className="text-center text-slate-500 py-10">No transactions found.</div>
                      )}
                  </div>
              </Card>
          </div>
      </div>
      )}

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Member">
        <form onSubmit={handleAddMember} className="space-y-4">
           <div className="flex justify-center mb-4">
               <div className="w-24 h-24 rounded-full bg-slate-700 border-2 border-dashed border-slate-500 flex items-center justify-center cursor-pointer overflow-hidden relative" onClick={() => profileInputRef.current?.click()}>
                   {formData.profilePhoto ? <img src={formData.profilePhoto} className="w-full h-full object-cover" /> : <div className="text-center"><i className="fas fa-camera text-slate-400 mb-1"></i><div className="text-[10px] text-slate-400">Add Photo</div></div>}
                   <input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'formDataProfile')} />
               </div>
           </div>
           <Input label="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
           <Input label="Phone Number" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
           <div className="grid grid-cols-2 gap-4">
             <Input label="Age" type="number" required value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
             <Input label="Amount Paid" type="number" required value={formData.amountPaid} onChange={e => setFormData({...formData, amountPaid: e.target.value})} />
           </div>
           <Select label="Plan Duration" options={[{ label: '1 Month (30 Days)', value: 30 }, { label: '2 Months (60 Days)', value: 60 }, { label: '3 Months (90 Days)', value: 90 }, { label: '6 Months (180 Days)', value: 180 }, { label: '1 Year (365 Days)', value: 365 }]} value={formData.planDurationDays} onChange={e => setFormData({...formData, planDurationDays: Number(e.target.value)})} />
           <Input label="Username (Optional)" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
           <Button type="submit" className="w-full">Add Member</Button>
        </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Manage Member">
        {selectedMember && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-slate-700 overflow-hidden relative group cursor-pointer" onClick={() => editProfileInputRef.current?.click()}>
                    {selectedMember.profilePhoto ? <img src={selectedMember.profilePhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{selectedMember.name.charAt(0)}</div>}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-camera text-white"></i></div>
                    <input type="file" ref={editProfileInputRef} className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'editProfile')} />
                </div>
                <div><h2 className="text-xl font-bold text-white">{selectedMember.name}</h2><Badge status={getMemberStatus(selectedMember.expiryDate)} /></div>
            </div>
            <div className="flex border-b border-slate-700">
                <button className={`flex-1 pb-2 text-sm font-medium ${activeTab === 'DETAILS' ? 'text-gym-accent border-b-2 border-gym-accent' : 'text-slate-400'}`} onClick={() => setActiveTab('DETAILS')}>Details & Plan</button>
                <button className={`flex-1 pb-2 text-sm font-medium ${activeTab === 'PHOTOS' ? 'text-gym-accent border-b-2 border-gym-accent' : 'text-slate-400'}`} onClick={() => setActiveTab('PHOTOS')}>Progress Photos</button>
                <button className={`flex-1 pb-2 text-sm font-medium ${activeTab === 'BILLING' ? 'text-gym-accent border-b-2 border-gym-accent' : 'text-slate-400'}`} onClick={() => setActiveTab('BILLING')}>Billing & Supps</button>
            </div>
            {activeTab === 'DETAILS' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                        <h4 className="text-sm font-medium text-slate-300 mb-3"><i className="fas fa-calendar-plus text-gym-accent mr-2"></i>Extend Membership</h4>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                             <Button size="sm" variant="secondary" onClick={() => handleExtendPlan(selectedMember, 30)}>1 Month</Button>
                             <Button size="sm" variant="secondary" onClick={() => handleExtendPlan(selectedMember, 90)}>3 Months</Button>
                             <Button size="sm" variant="secondary" onClick={() => handleExtendPlan(selectedMember, 180)}>6 Months</Button>
                             <Button size="sm" variant="secondary" onClick={() => handleExtendPlan(selectedMember, 365)}>1 Year</Button>
                        </div>
                        <div className="flex gap-2 items-center pt-2 border-t border-slate-700 mt-2">
                             <div className="text-xs text-slate-400 whitespace-nowrap">Custom Days:</div>
                             <Input type="number" placeholder="Enter days" className="!py-1 text-sm" onKeyDown={(e) => { if(e.key === 'Enter') handleExtendPlan(selectedMember, Number(e.currentTarget.value)); }} />
                             <Button size="sm" onClick={() => { const val = (document.querySelector('input[placeholder="Enter days"]') as HTMLInputElement).value; if(val) handleExtendPlan(selectedMember, Number(val)); }}>Add</Button>
                        </div>
                    </div>
                    <div className="border-t border-slate-700 pt-4">
                        <h4 className="text-sm font-medium text-slate-300 mb-3"><i className="fas fa-magic text-gym-accent"></i> AI Message Assistant</h4>
                        <div className="flex gap-2 mb-3">
                            <Button size="sm" variant="outline" onClick={() => handleGenerateAiMessage(selectedMember, 'REMINDER')}>Expiry</Button>
                            <Button size="sm" variant="outline" onClick={() => handleGenerateAiMessage(selectedMember, 'WELCOME')}>Welcome</Button>
                            <Button size="sm" variant="outline" onClick={() => handleGenerateAiMessage(selectedMember, 'OFFER')}>Offer</Button>
                        </div>
                        <textarea className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 h-20 focus:ring-1 focus:ring-gym-accent" value={aiMessage} onChange={(e) => setAiMessage(e.target.value)} placeholder="Generated message..."></textarea>
                         <Button className="w-full mt-2 bg-[#25D366] hover:bg-[#20bd5a]" disabled={!aiMessage} onClick={() => openWhatsApp(selectedMember.phone, aiMessage)}><i className="fab fa-whatsapp mr-2"></i> Send</Button>
                    </div>
                </div>
            )}
            {activeTab === 'PHOTOS' && (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-slate-300 text-center">Before</h4>
                        <div className="aspect-[3/4] bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center cursor-pointer hover:border-gym-accent overflow-hidden relative" onClick={() => beforeInputRef.current?.click()}>
                            {selectedMember.beforePhoto ? <img src={selectedMember.beforePhoto} className="w-full h-full object-cover" /> : <div className="text-center text-slate-500"><i className="fas fa-plus text-2xl mb-2"></i><p className="text-xs">Upload</p></div>}
                             <input type="file" ref={beforeInputRef} className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'before')} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-slate-300 text-center">After</h4>
                         <div className="aspect-[3/4] bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center cursor-pointer hover:border-gym-accent overflow-hidden relative" onClick={() => afterInputRef.current?.click()}>
                            {selectedMember.afterPhoto ? <img src={selectedMember.afterPhoto} className="w-full h-full object-cover" /> : <div className="text-center text-slate-500"><i className="fas fa-plus text-2xl mb-2"></i><p className="text-xs">Upload</p></div>}
                             <input type="file" ref={afterInputRef} className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'after')} />
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'BILLING' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Add Purchase</h4>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <Input placeholder="Product Name" value={suppForm.productName} onChange={e => setSuppForm({...suppForm, productName: e.target.value})} className="!text-sm" />
                            <Input placeholder="Price" type="number" value={suppForm.price} onChange={e => setSuppForm({...suppForm, price: e.target.value})} className="!text-sm" />
                        </div>
                        <Input type="date" label="End Date (Optional)" value={suppForm.endDate} onChange={e => setSuppForm({...suppForm, endDate: e.target.value})} className="!text-sm mb-2" />
                        <Button size="sm" className="w-full" onClick={handleAddSupplement} disabled={!suppForm.productName || !suppForm.price}>Add Record</Button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedMember.supplementHistory?.slice().reverse().map((supp) => (
                            <div key={supp.id} className="flex justify-between items-center p-2 bg-slate-800/50 rounded border border-slate-700/50">
                                <div><div className="text-sm font-medium text-white">{supp.productName}</div><div className="text-xs text-slate-500">Bought: {new Date(supp.purchaseDate).toLocaleDateString()}</div></div>
                                <div className="text-right"><div className="text-sm font-bold text-gym-accent">${supp.price}</div>{supp.endDate && <div className="text-[10px] text-slate-400">Ends: {new Date(supp.endDate).toLocaleDateString()}</div>}</div>
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
