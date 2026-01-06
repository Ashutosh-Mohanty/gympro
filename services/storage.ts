
import { Member, Gym, GymSettings } from '../types.ts';

const MEMBERS_KEY = 'gym_members';
const SETTINGS_KEY = 'gym_settings';
const GYMS_KEY = 'gym_list';

// Internal delay to simulate network latency on Vercel
const networkDelay = () => new Promise(resolve => setTimeout(resolve, 300));

// --- Gym Management ---
export const getGyms = async (): Promise<Gym[]> => {
  await networkDelay();
  const data = localStorage.getItem(GYMS_KEY);
  if (!data) {
    // Initial Seed if empty
    const initial: Gym[] = [{
      id: 'GYM001',
      name: 'Iron Paradise',
      managerPassword: 'admin',
      createdAt: new Date().toISOString(),
      email: 'contact@ironparadise.com',
      phone: '9876543210',
      city: 'Metropolis',
      state: 'NY'
    }];
    localStorage.setItem(GYMS_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

export const addGym = async (gym: Gym): Promise<void> => {
  await networkDelay();
  const gyms = await getGyms();
  gyms.push(gym);
  localStorage.setItem(GYMS_KEY, JSON.stringify(gyms));
};

export const updateGym = async (updatedGym: Gym, oldId: string): Promise<void> => {
  await networkDelay();
  const gyms = await getGyms();
  const index = gyms.findIndex(g => g.id === oldId);
  if (index !== -1) {
    gyms[index] = updatedGym;
    localStorage.setItem(GYMS_KEY, JSON.stringify(gyms));
  }
};

export const deleteGym = async (id: string): Promise<void> => {
  await networkDelay();
  const gyms = await getGyms();
  const filtered = gyms.filter(g => g.id !== id);
  localStorage.setItem(GYMS_KEY, JSON.stringify(filtered));
};

// --- Member Management ---
export const getMembers = async (): Promise<Member[]> => {
  await networkDelay();
  const data = localStorage.getItem(MEMBERS_KEY);
  if (!data) {
    const initial: Member[] = [{
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
      password: '123',
      isActive: true,
      paymentHistory: [{ id: 'p1', date: new Date().toISOString(), amount: 50, method: 'ONLINE', recordedBy: 'Initial Joining Fee' }],
      supplementHistory: [],
      height: "180cm",
      weight: "75kg",
      goal: "MUSCLE_GAIN"
    }];
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

export const addMember = async (member: Member): Promise<void> => {
  await networkDelay();
  const members = await getMembers();
  members.push(member);
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
};

export const updateMember = async (updatedMember: Member): Promise<void> => {
  await networkDelay();
  const members = await getMembers();
  const index = members.findIndex(m => m.id === updatedMember.id);
  if (index !== -1) {
    members[index] = updatedMember;
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
  }
};

// --- Settings ---
export const getSettings = async (): Promise<GymSettings> => {
  await networkDelay();
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) {
    const initial: GymSettings = {
      autoNotifyWhatsApp: false,
      gymName: 'Iron Paradise',
      termsAndConditions: '1. No outside weights. 2. Re-rack weights after use.'
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

export const saveSettings = async (settings: GymSettings): Promise<void> => {
  await networkDelay();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
