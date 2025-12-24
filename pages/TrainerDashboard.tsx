import React, { useState } from 'react';
import { Card, Input, Button, Select } from '../components/UI';
import { useAuth } from '../App';

const TrainerDashboard: React.FC = () => {
  const { authState } = useAuth();
  
  // States for forms
  const [requestStatus, setRequestStatus] = useState<'IDLE' | 'SUCCESS'>('IDLE');
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'SUCCESS'>('IDLE');

  const handleMemberRequest = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this sends an API request. Here we simulate success.
    setRequestStatus('SUCCESS');
    setTimeout(() => setRequestStatus('IDLE'), 3000);
  };

  const handlePaymentRecord = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate recording payment
    setPaymentStatus('SUCCESS');
    setTimeout(() => setPaymentStatus('IDLE'), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Welcome Section */}
      <div className="lg:col-span-2">
         <h1 className="text-2xl font-bold text-white mb-2">Trainer Dashboard</h1>
         <p className="text-slate-400">Welcome, {(authState.user as any)?.name}. Manage requests and payments below.</p>
      </div>

      {/* New Member Request Form */}
      <Card title="Request New Member Joining">
        <form onSubmit={handleMemberRequest} className="space-y-4">
           <Input label="Prospective Member Name" required />
           <Input label="Phone Number" required />
           <Input label="Proposed Plan (Days)" type="number" defaultValue={30} />
           <Input label="Email Address (for notification)" type="email" />
           
           <div className="p-3 bg-slate-800 rounded-lg text-sm text-slate-400 border border-slate-700">
              <i className="fas fa-info-circle mr-2 text-gym-accent"></i>
              Submitting this will send an email request to the Manager for approval.
           </div>

           <Button type="submit" className="w-full" variant={requestStatus === 'SUCCESS' ? 'success' : 'primary'}>
             {requestStatus === 'SUCCESS' ? 'Request Sent!' : 'Send Request to Manager'}
           </Button>
        </form>
      </Card>

      {/* Payment Received Form */}
      <Card title="Record Payment Received">
        <form onSubmit={handlePaymentRecord} className="space-y-4">
           <Input label="Member Name / ID" required placeholder="Search member..." />
           <Input label="Phone Number" required />
           <Input label="Amount Received" type="number" required />
           <Select 
             label="Mode of Payment"
             options={[
                 { label: 'Cash (Offline)', value: 'OFFLINE' },
                 { label: 'Online / UPI', value: 'ONLINE' }
             ]}
           />
           <Input label="Duration (Days Extended)" type="number" placeholder="Optional" />

           <Button type="submit" className="w-full" variant={paymentStatus === 'SUCCESS' ? 'success' : 'secondary'}>
             {paymentStatus === 'SUCCESS' ? 'Payment Recorded!' : 'Submit Payment Record'}
           </Button>
        </form>
      </Card>
    </div>
  );
};

export default TrainerDashboard;