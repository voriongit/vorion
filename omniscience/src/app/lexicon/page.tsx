'use client';

import { useState } from 'react';
import { Navbar, LexiconBrowser, NexusChat } from '@/components/nexus';

export default function LexiconPage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <Navbar onActivateChat={() => setChatOpen(true)} />
      <main className="flex-grow pt-24 pb-12 px-4 max-w-7xl mx-auto w-full">
        <LexiconBrowser />
      </main>
      <NexusChat isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
    </>
  );
}
