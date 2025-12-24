import { Member, Gym, GymSettings, Supplement } from '../types';

const MEMBERS_KEY = 'gym_members';
const SETTINGS_KEY = 'gym_settings';
const GYMS_KEY = 'gym_list';

// --- Gym Data ---
const INITIAL_GYMS: Gym[] = [
  {
    id: 'GYM001',
    name: 'Iron Paradise',
    managerPassword: 'admin',
    createdAt: new Date().toISOString()
  }
];

// --- Member Data ---
const INITIAL_MEMBERS: Member[] = [
  {
    id: '1',
    name: 'John Doe',
    phone: '1234567890',
    joinDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 25).toISOString(),
    planDurationDays: 30,
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
    age: 28,
    amountPaid: 50,
    gymId: 'GYM001',
    username: 'john',
    isActive: true,
    paymentHistory: [{ id: 'p1', date: new Date().toISOString(), amount: 50, method: 'ONLINE', recordedBy: 'Manager' }],
    supplementHistory: [
      { id: 's1', productName: 'Whey Protein', purchaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), price: 60, endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString() }
    ]
  }
];

const INITIAL_SETTINGS: GymSettings = {
  autoNotifyWhatsApp: false,
  gymName: 'Iron Paradise'
};

// --- Gym Management ---
export const getGyms = (): Gym[] => {
  const data = localStorage.getItem(GYMS_KEY);
  return data ? JSON.parse(data) : INITIAL_GYMS;
};

export const addGym = (gym: Gym) => {
  const gyms = getGyms();
  gyms.push(gym);
  localStorage.setItem(GYMS_KEY, JSON.stringify(gyms));
};

export const deleteGym = (id: string) => {
  const gyms = getGyms();
  const filtered = gyms.filter(g => g.id !== id);
  localStorage.setItem(GYMS_KEY, JSON.stringify(filtered));
};

// --- Member Management ---
export const getMembers = (): Member[] => {
  const data = localStorage.getItem(MEMBERS_KEY);
  return data ? JSON.parse(data) : INITIAL_MEMBERS;
};

export const saveMembers = (members: Member[]) => {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
};

export const addMember = (member: Member) => {
  const members = getMembers();
  members.push(member);
  saveMembers(members);
};

export const updateMember = (updatedMember: Member) => {
  const members = getMembers();
  const index = members.findIndex(m => m.id === updatedMember.id);
  if (index !== -1) {
    members[index] = updatedMember;
    saveMembers(members);
  }
};

export const getMemberStatus = (expiryDate: string): 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON' => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= 5) return 'EXPIRING_SOON';
  return 'ACTIVE';
};

// --- Settings ---
export const getSettings = (): GymSettings => {
  const data = localStorage.getItem(SETTINGS_KEY);
  return data ? JSON.parse(data) : INITIAL_SETTINGS;
};

export const saveSettings = (settings: GymSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// --- Helper for Files ---
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};