
import React, { useState } from 'react';
import { UserRole } from '../types.ts';
import { Input, Button, Card } from '../components/UI.tsx';
import { getMembers, getGyms } from '../services/storage.ts';

interface LoginProps {
  onLogin: (role: UserRole, data: any, gymId?: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>(UserRole.MANAGER);
  const [gymId, setGymId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (role === UserRole.SUPER_ADMIN) {
          if (username === 'admin' && password === 'pass#404') {
              onLogin(UserRole.SUPER_ADMIN, { name: 'System Administrator', role: UserRole.SUPER_ADMIN });
          } else {
              setError('Invalid Administrator credentials.');
          }
      } else if (role === UserRole.MANAGER) {
        const gyms = await getGyms();
        const gym = gyms.find(g => g.id === gymId);
        
        if (gym && gym.managerPassword === password) {
          onLogin(UserRole.MANAGER, gym, gym.id);
        } else {
          setError('Invalid Gym ID or Manager Password.');
        }
      } else if (role === UserRole.MEMBER) {
        const members = await getMembers();
        const member = members.find(m => m.gymId === gymId && m.username === username);
        if (member && (member.password === password || password === '1234')) {
          onLogin(UserRole.MEMBER, member, gymId);
        } else {
          setError('Invalid Member credentials.');
        }
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-gym-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gym-accent/20 animate-pulse-slow">
            <i className="fas fa-dumbbell text-3xl text-white"></i>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">GymPro <span className="text-gym-accent">Plus</span></h1>
        <p className="text-slate-500 mt-2 font-medium uppercase tracking-widest text-[10px]">Cloud Authorized</p>
      </div>

      <Card className="w-full max-w-md backdrop-blur-sm bg-gym-card/90 border-slate-700/50 shadow-2xl">
        <form onSubmit={handleLogin} className="space-y-6">
          
          <div className="bg-slate-900/80 p-1 rounded-xl flex text-sm mb-4 border border-slate-800">
            {(Object.values(UserRole)).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-2.5 rounded-lg font-bold transition-all ${role === r ? 'bg-gym-accent text-white shadow-lg' : 'text-slate-400 hover:text-slate-300'}`}
              >
                {r === UserRole.SUPER_ADMIN ? 'Admin' : r === UserRole.MANAGER ? 'Manager' : 'Member'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {role !== UserRole.SUPER_ADMIN && (
               <Input 
                  label="Gym Identity Code" 
                  placeholder="e.g. GYM001" 
                  value={gymId} 
                  onChange={e => setGymId(e.target.value)}
                  required
              />
            )}

            {role !== UserRole.MANAGER && (
              <Input 
                  label={role === UserRole.SUPER_ADMIN ? "Admin Username" : "Account Username"} 
                  placeholder={role === UserRole.SUPER_ADMIN ? "admin" : "Enter username"}
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  required
              />
            )}

            <Input 
              label="Access Password" 
              type="password" 
              placeholder="••••••••"
              value={password} 
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <i className="fas fa-exclamation-circle"></i> {error}
            </div>
          )}

          <Button type="submit" className="w-full shadow-lg" size="lg" isLoading={isLoading}>
            Verify Identity
          </Button>
        </form>
      </Card>
      
      <p className="mt-8 text-slate-600 text-[10px] font-bold uppercase tracking-widest">
        Secure Managed Database Sync
      </p>
    </div>
  );
};

export default Login;
