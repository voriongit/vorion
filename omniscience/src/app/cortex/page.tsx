'use client';

import { useState } from 'react';
import { Navbar, CortexSettings, NexusChat } from '@/components/nexus';

export default function CortexPage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <Navbar onActivateChat={() => setChatOpen(true)} />
      <main className="flex-grow pt-24 pb-12 px-4 max-w-7xl mx-auto w-full">
        <CortexSettings />
      </main>
      <NexusChat isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
    </>
  );
}
