import React, { useState } from 'react';
import { UserRole } from '../types';
import { Input, Button, Card } from '../components/UI';
import { getMembers, getGyms } from '../services/storage';

interface LoginProps {
  onLogin: (role: UserRole, data: any, gymId?: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>(UserRole.MANAGER);
  const [gymId, setGymId] = useState('');
  const [username, setUsername] = useState(''); // Used as User ID for super admin
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (role === UserRole.SUPER_ADMIN) {
        if (username === 'superadmin' && password === 'password') {
            onLogin(UserRole.SUPER_ADMIN, { name: 'Super Admin', role: UserRole.SUPER_ADMIN });
        } else {
            setError('Invalid Super Admin credentials (try superadmin/password)');
        }
    } else if (role === UserRole.MANAGER) {
      const gyms = getGyms();
      const gym = gyms.find(g => g.id === gymId);
      
      if (gym && gym.managerPassword === password) {
        onLogin(UserRole.MANAGER, gym, gym.id);
      } else {
        setError('Invalid Gym ID or Password. Contact Super Admin.');
      }
    } else if (role === UserRole.MEMBER) {
      const members = getMembers();
      const member = members.find(m => m.gymId === gymId && m.username === username);
      // Mock password check - assuming '1234' for simplicity if not set, or a real check
      if (member && password === '1234') {
        onLogin(UserRole.MEMBER, member, gymId);
      } else {
        setError('Invalid credentials (try john/1234)');
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="mb-8 text-center animate-bounce-slow">
        <div className="w-16 h-16 bg-gym-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gym-accent/20">
            <i className="fas fa-dumbbell text-3xl text-white"></i>
        </div>
        <h1 className="text-3xl font-bold text-white">GymPro</h1>
        <p className="text-slate-400 mt-2">Management System</p>
      </div>

      <Card className="w-full max-w-md backdrop-blur-sm bg-gym-card/90">
        <form onSubmit={handleLogin} className="space-y-6">
          
          <div className="bg-slate-800/50 p-1 rounded-lg flex text-sm mb-4">
            <button
              type="button"
              onClick={() => setRole(UserRole.SUPER_ADMIN)}
              className={`flex-1 py-2 rounded-md transition-all ${role === UserRole.SUPER_ADMIN ? 'bg-gym-accent text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setRole(UserRole.MANAGER)}
              className={`flex-1 py-2 rounded-md transition-all ${role === UserRole.MANAGER ? 'bg-gym-accent text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Manager
            </button>
            <button
               type="button"
              onClick={() => setRole(UserRole.MEMBER)}
              className={`flex-1 py-2 rounded-md transition-all ${role === UserRole.MEMBER ? 'bg-gym-accent text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Member
            </button>
          </div>

          {/* Conditional Inputs */}
          
          {role !== UserRole.SUPER_ADMIN && (
             <Input 
                label="Gym ID" 
                placeholder="e.g. GYM001" 
                value={gymId} 
                onChange={e => setGymId(e.target.value)}
            />
          )}

          {role !== UserRole.MANAGER && (
            <Input 
                label={role === UserRole.SUPER_ADMIN ? "Admin Username" : "Member Username"} 
                placeholder={role === UserRole.SUPER_ADMIN ? "superadmin" : "username"}
                value={username} 
                onChange={e => setUsername(e.target.value)}
            />
          )}

          <Input 
            label="Password" 
            type="password" 
            placeholder="Enter password"
            value={password} 
            onChange={e => setPassword(e.target.value)}
          />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i> {error}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg">
            Login
          </Button>
          
          <div className="text-center text-xs text-slate-500 mt-4">
             Demo Credentials:<br/>
             Super Admin: superadmin / password<br/>
             Manager: GYM001 / admin<br/>
             Member: GYM001 / john / 1234
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Login;