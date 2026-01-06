
import React, { useState, useEffect, useRef } from 'react';
import { Gym } from '../types.ts';
import { getGyms, addGym, deleteGym, updateGym, fileToBase64 } from '../services/storage.ts';
import { Button, Input, Card, Modal } from '../components/UI.tsx';

const SuperAdminDashboard: React.FC = () => {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [oldGymId, setOldGymId] = useState('');
  const [formData, setFormData] = useState({ 
    name: '', id: '', password: '', 
    email: '', phone: '', city: '', state: '', 
    profilePhoto: '' 
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGyms();
  }, []);

  const fetchGyms = async () => {
    setIsLoading(true);
    try {
      const data = await getGyms();
      setGyms(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setIsEditMode(false);
    setFormData({ name: '', id: '', password: '', email: '', phone: '', city: '', state: '', profilePhoto: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (gym: Gym) => {
    setIsEditMode(true);
    setOldGymId(gym.id);
    setFormData({ 
      name: gym.name, id: gym.id, password: gym.managerPassword, 
      email: gym.email || '', phone: gym.phone || '', 
      city: gym.city || '', state: gym.state || '',
      profilePhoto: gym.profilePhoto || ''
    });
    setIsModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      setFormData({ ...formData, profilePhoto: base64 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    const gymData: Gym = {
      id: formData.id || `GYM${Math.floor(Math.random() * 10000)}`,
      name: formData.name,
      managerPassword: formData.password,
      createdAt: isEditMode ? gyms.find(g => g.id === oldGymId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      email: formData.email,
      phone: formData.phone,
      city: formData.city,
      state: formData.state,
      profilePhoto: formData.profilePhoto
    };

    if (isEditMode) {
      await updateGym(gymData, oldGymId);
    } else {
      await addGym(gymData);
    }
    
    await fetchGyms();
    setIsSyncing(false);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if(window.confirm('DANGER: This will permanently delete the gym and all manager access. Are you sure?')) {
        setIsSyncing(true);
        await deleteGym(id);
        await fetchGyms();
        setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-gym-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Querying Cloud Registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isSyncing && (
        <div className="fixed top-20 right-8 z-50 bg-gym-accent text-white px-4 py-2 rounded-lg shadow-2xl flex items-center gap-2 animate-fade-in">
          <i className="fas fa-spinner fa-spin"></i>
          <span className="text-[10px] font-black uppercase tracking-widest">Syncing with DB...</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-white">Super Admin Dashboard</h1>
           <p className="text-slate-400">Establishment Oversight & Control</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <i className="fas fa-plus mr-2"></i> Register New Gym
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {gyms.map(gym => (
          <Card key={gym.id} className="relative group border-slate-700/50 hover:border-gym-accent transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-gym-accent text-xl">
                 {gym.profilePhoto ? <img src={gym.profilePhoto} className="w-full h-full object-cover" /> : <i className="fas fa-building"></i>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenEdit(gym)} className="text-slate-400 hover:text-gym-accent p-1 transition-colors">
                   <i className="fas fa-edit"></i>
                </button>
                <button onClick={() => handleDelete(gym.id)} className="text-slate-400 hover:text-red-500 p-1 transition-colors">
                   <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-1">{gym.name}</h3>
            <div className="bg-slate-900/50 p-3 rounded-lg space-y-2 text-xs border border-slate-800">
               <div className="flex justify-between items-center">
                 <span className="text-slate-500 font-medium uppercase tracking-tighter">Establishment ID:</span>
                 <span className="font-mono text-white select-all">{gym.id}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-slate-500 font-medium uppercase tracking-tighter">Manager Key:</span>
                 <span className="font-mono text-white select-all">{gym.managerPassword}</span>
               </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditMode ? "Edit Gym Details" : "Register New Gym"}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Gym Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <Input label="Gym ID / Login" required value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} />
            <Input label="Manager Password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <Button type="submit" className="w-full mt-4 h-11" isLoading={isSyncing}>
                {isEditMode ? "Update Establishment" : "Confirm Registration"}
            </Button>
        </form>
      </Modal>
    </div>
  );
};

export default SuperAdminDashboard;
