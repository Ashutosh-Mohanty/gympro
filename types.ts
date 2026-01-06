
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER'
}

export enum PlanDuration {
  ONE_MONTH = 30,
  TWO_MONTHS = 60,
  THREE_MONTHS = 90,
  SIX_MONTHS = 180,
  TWELVE_MONTHS = 365
}

export interface Supplement {
  id: string;
  productName: string;
  purchaseDate: string;
  endDate?: string;
  price: number;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  joinDate: string; // ISO Date string
  planDurationDays: number;
  expiryDate: string; // ISO Date string
  age: number;
  amountPaid: number;
  
  // New Physical Stats
  height?: string;
  weight?: string;
  address?: string;
  goal?: 'WEIGHT_LOSS' | 'MUSCLE_GAIN' | 'MAINTENANCE' | 'FLEXIBILITY' | 'ATHLETIC_PERFORMANCE';
  registrationPaymentMode?: 'ONLINE' | 'CASH';
  
  // Photos
  profilePhoto?: string; // Base64 string
  beforePhoto?: string; // Base64 string
  afterPhoto?: string; // Base64 string
  idProofPhoto?: string; // Base64 string
  
  gymId: string;
  username: string; // For login
  password?: string; // Optional simple password for demo
  isActive: boolean;
  notes?: string;
  
  paymentHistory: PaymentRecord[];
  supplementHistory: Supplement[];
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: 'ONLINE' | 'OFFLINE';
  recordedBy: string;
}

export interface Gym {
  id: string; // The Gym ID used for login
  name: string;
  managerPassword: string; // Password for the manager
  createdAt: string;
  
  // New Establishment Details
  profilePhoto?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: Member | Gym | { name: string, role: UserRole.SUPER_ADMIN } | null;
  role: UserRole | null;
  currentGymId?: string; // To track which gym context we are in
}

export interface GymSettings {
  autoNotifyWhatsApp: boolean;
  gymName: string;
  termsAndConditions?: string;
}
