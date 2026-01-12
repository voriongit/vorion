'use client';

import { useState } from 'react';
import { Navbar, NeuralLink, NexusChat } from '@/components/nexus';

export default function NeuralPage() {
  const [chatOpen, setChatOpen] = useState(false);

  const handleSubmit = (data: { term: string; definition: string; level: string }) => {
    console.log('Submitted:', data);
    // TODO: Connect to Firebase
  };

  return (
    <>
      <Navbar onActivateChat={() => setChatOpen(true)} />
      <main className="flex-grow pt-24 pb-12 px-4 max-w-7xl mx-auto w-full">
        <NeuralLink onSubmit={handleSubmit} />
      </main>
      <NexusChat isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
    </>
  );
}
