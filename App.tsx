import React, { useState, useEffect, createContext, useContext } from 'react';
import { AuthState, UserRole } from './types';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import MemberDashboard from './pages/MemberDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

// --- Auth Context ---
interface AuthContextType {
  authState: AuthState;
  login: (role: UserRole, data: any, gymId?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

// --- Main App ---
export default function App() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    role: null,
  });

  // Check for existing session
  useEffect(() => {
    const savedAuth = localStorage.getItem('gym_auth');
    if (savedAuth) {
      setAuthState(JSON.parse(savedAuth));
    }
  }, []);

  const login = (role: UserRole, data: any, gymId?: string) => {
    const newAuth: AuthState = { isAuthenticated: true, user: data, role, currentGymId: gymId };
    setAuthState(newAuth);
    localStorage.setItem('gym_auth', JSON.stringify(newAuth));
  };

  const logout = () => {
    setAuthState({ isAuthenticated: false, user: null, role: null });
    localStorage.removeItem('gym_auth');
  };

  let CurrentView;
  if (!authState.isAuthenticated) {
    CurrentView = <Login onLogin={login} />;
  } else {
    switch (authState.role) {
      case UserRole.SUPER_ADMIN:
        CurrentView = <SuperAdminDashboard />;
        break;
      case UserRole.MANAGER:
        CurrentView = <ManagerDashboard />;
        break;
      case UserRole.MEMBER:
        CurrentView = <MemberDashboard />;
        break;
      default:
        CurrentView = <Login onLogin={login} />;
    }
  }

  return (
    <AuthContext.Provider value={{ authState, login, logout }}>
      <div className="min-h-screen bg-gym-dark text-gym-text">
        {authState.isAuthenticated && (
           <nav className="border-b border-slate-800 bg-gym-dark/95 backdrop-blur sticky top-0 z-40">
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
               <div className="flex justify-between h-16 items-center">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded bg-gym-accent flex items-center justify-center">
                     <i className="fas fa-dumbbell text-white"></i>
                   </div>
                   <span className="font-bold text-xl tracking-tight text-white">GymPro<span className="text-gym-accent">Manager</span></span>
                 </div>
                 <div className="flex items-center gap-4">
                   <div className="text-right hidden sm:block">
                     <div className="text-sm font-medium text-white">
                        {authState.role === UserRole.SUPER_ADMIN ? 'Super Admin' : 
                         authState.role === UserRole.MANAGER ? `Manager (${authState.currentGymId})` : 
                         (authState.user as any)?.name}
                     </div>
                     <div className="text-xs text-slate-400 capitalize">{authState.role?.toLowerCase().replace('_', ' ')}</div>
                   </div>
                   <button 
                    onClick={logout}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                   >
                     <i className="fas fa-sign-out-alt"></i>
                   </button>
                 </div>
               </div>
             </div>
           </nav>
        )}
        <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {CurrentView}
        </main>
      </div>
    </AuthContext.Provider>
  );
}