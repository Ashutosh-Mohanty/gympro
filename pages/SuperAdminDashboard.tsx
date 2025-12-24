import React, { useState, useEffect } from 'react';
import { Gym } from '../types';
import { getGyms, addGym, deleteGym } from '../services/storage';
import { Button, Input, Card, Modal } from '../components/UI';

const SuperAdminDashboard: React.FC = () => {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', id: '', password: '' });

  useEffect(() => {
    setGyms(getGyms());
  }, []);

  const handleCreateGym = (e: React.FormEvent) => {
    e.preventDefault();
    const newGym: Gym = {
      id: formData.id || `GYM${Math.floor(Math.random() * 10000)}`, // Auto generate if empty
      name: formData.name,
      managerPassword: formData.password,
      createdAt: new Date().toISOString()
    };
    addGym(newGym);
    setGyms(getGyms());
    setIsModalOpen(false);
    setFormData({ name: '', id: '', password: '' });
  };

  const handleDelete = (id: string) => {
    if(window.confirm('Are you sure? This will remove access for this gym manager.')) {
        deleteGym(id);
        setGyms(getGyms());
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-white">Super Admin Dashboard</h1>
           <p className="text-slate-400">Manage Gym Establishments</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <i className="fas fa-plus mr-2"></i> Create New Gym
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {gyms.map(gym => (
          <Card key={gym.id} className="relative group hover:border-gym-accent transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded bg-gym-accent/20 flex items-center justify-center text-gym-accent text-xl">
                 <i className="fas fa-building"></i>
              </div>
              <button onClick={() => handleDelete(gym.id)} className="text-slate-500 hover:text-red-500 transition-colors">
                 <i className="fas fa-trash"></i>
              </button>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-1">{gym.name}</h3>
            <div className="text-sm text-slate-400 mb-4">Created: {new Date(gym.createdAt).toLocaleDateString()}</div>
            
            <div className="bg-slate-800 p-3 rounded-lg space-y-2 text-sm">
               <div className="flex justify-between">
                 <span className="text-slate-500">Gym ID:</span>
                 <span className="font-mono text-white bg-slate-700 px-2 py-0.5 rounded select-all">{gym.id}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-slate-500">Manager Pass:</span>
                 <span className="font-mono text-white bg-slate-700 px-2 py-0.5 rounded select-all">{gym.managerPassword}</span>
               </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Gym">
        <form onSubmit={handleCreateGym} className="space-y-4">
            <Input 
                label="Gym Name" 
                required 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
            />
            <Input 
                label="Custom Gym ID (Optional)" 
                placeholder="Leave empty to auto-generate" 
                value={formData.id} 
                onChange={e => setFormData({...formData, id: e.target.value})} 
            />
            <Input 
                label="Manager Password" 
                required 
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})} 
            />
            <Button type="submit" className="w-full">Create Gym</Button>
        </form>
      </Modal>
    </div>
  );
};

export default SuperAdminDashboard;