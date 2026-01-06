
import React, { useState, useEffect, createContext, useContext } from 'react';
import { AuthState, UserRole } from './types.ts';
import Login from './pages/Login.tsx';
import ManagerDashboard from './pages/ManagerDashboard.tsx';
import MemberDashboard from './pages/MemberDashboard.tsx';
import SuperAdminDashboard from './pages/SuperAdminDashboard.tsx';

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

export default function App() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    role: null,
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log("App checking session...");
    try {
      const savedAuth = localStorage.getItem('gym_auth');
      if (savedAuth) {
        setAuthState(JSON.parse(savedAuth));
      }
    } catch (e) {
      console.error("Auth hydration failed", e);
    } finally {
      setIsReady(true);
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

  if (!isReady) return null;

  const renderView = () => {
    if (!authState.isAuthenticated) {
      return <Login onLogin={login} />;
    }

    switch (authState.role) {
      case UserRole.SUPER_ADMIN:
        return <SuperAdminDashboard />;
      case UserRole.MANAGER:
        return <ManagerDashboard />;
      case UserRole.MEMBER:
        return <MemberDashboard />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20">
            <h2 className="text-xl font-bold text-white mb-4">Unauthorized or Invalid Role</h2>
            <button onClick={logout} className="bg-gym-accent px-6 py-2 rounded-lg font-bold">Back to Login</button>
          </div>
        );
    }
  };

  return (
    <AuthContext.Provider value={{ authState, login, logout }}>
      <div className="min-h-screen w-full bg-gym-dark text-gym-text flex flex-col overflow-x-hidden">
        {authState.isAuthenticated && (
           <nav className="border-b border-slate-800 bg-gym-dark/95 backdrop-blur-xl sticky top-0 z-40 shadow-xl">
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
               <div className="flex justify-between h-16 items-center">
                 <div className="flex items-center gap-3 group">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gym-accent to-emerald-700 flex items-center justify-center shadow-lg shadow-gym-accent/20">
                     <i className="fas fa-dumbbell text-white text-lg"></i>
                   </div>
                   <span className="font-extrabold text-2xl tracking-tight text-white">GymPro<span className="text-gym-accent">Plus</span></span>
                 </div>
                 <div className="flex items-center gap-4">
                   <div className="text-right hidden sm:block">
                     <div className="text-sm font-bold text-white leading-none mb-1">
                        {authState.role === UserRole.SUPER_ADMIN ? 'System Admin' : 
                         authState.role === UserRole.MANAGER ? `Manager` : 
                         (authState.user as any)?.name}
                     </div>
                     <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                       {authState.role?.replace('_', ' ')} {authState.currentGymId && `• ${authState.currentGymId}`}
                     </div>
                   </div>
                   <div className="h-8 w-px bg-slate-800 mx-2"></div>
                   <button 
                    onClick={logout}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    title="Logout"
                   >
                     <i className="fas fa-sign-out-alt"></i>
                   </button>
                 </div>
               </div>
             </div>
           </nav>
        )}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {renderView()}
        </main>
      </div>
    </AuthContext.Provider>
  );
}
