'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Book, Shield, Activity, Bell, Key, Code2 } from 'lucide-react';

export default function Phase6DocsPage() {
  const [activeTab, setActiveTab] = useState<'swagger' | 'redoc' | 'scalar'>('scalar');

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="sticky top-0 z-50 bg-neutral-900/95 backdrop-blur border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/phase6"
              className="flex items-center gap-2 text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Trust Engine
            </Link>
            <div className="h-6 w-px bg-neutral-700" />
            <div className="flex items-center gap-2">
              <Book className="w-5 h-5 text-blue-500" />
              <h1 className="text-lg font-semibold text-neutral-100">Phase 6 API Documentation</h1>
              <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded">
                v1.0
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-neutral-800 rounded-lg p-1">
              {(['scalar', 'swagger', 'redoc'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                    activeTab === tab
                      ? 'bg-neutral-700 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <a
              href="/api/phase6/docs?format=yaml"
              download="phase6-openapi.yaml"
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-300 hover:text-white border border-neutral-700 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <Code2 className="w-4 h-4" />
              Download Spec
            </a>
          </div>
        </div>
      </header>

      <div className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid gap-4 md:grid-cols-4">
            <QuickLink
              icon={Shield}
              title="Role Gates"
              description="Evaluate trust-based access control"
              href="#role-gates"
              color="blue"
            />
            <QuickLink
              icon={Activity}
              title="Ceiling"
              description="Check capability limits"
              href="#ceiling"
              color="green"
            />
            <QuickLink
              icon={Book}
              title="Provenance"
              description="Track decision history"
              href="#provenance"
              color="purple"
            />
            <QuickLink
              icon={Bell}
              title="Alerts"
              description="Monitor gaming detection"
              href="#alerts"
              color="red"
            />
          </div>
        </div>
      </div>

      <div className="bg-neutral-900/50 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
            Quick Example - Role Gate Evaluation
          </h2>
          <div className="bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border-b border-neutral-800">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <span className="ml-2 text-xs text-neutral-500">cURL</span>
            </div>
            <pre className="p-4 text-sm text-neutral-300 overflow-x-auto">
              <code>{`curl -X POST "https://api.vorion.dev/v1/phase6/role-gates/evaluate" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent_123",
    "role": "DATA_ANALYST",
    "tier": "VERIFIED",
    "context": {
      "resourceId": "dataset_001",
      "action": "read"
    }
  }'`}</code>
            </pre>
          </div>
        </div>
      </div>

      <main className="h-[calc(100vh-280px)]">
        {activeTab === 'scalar' && <ScalarViewer />}
        {activeTab === 'swagger' && <SwaggerViewer />}
        {activeTab === 'redoc' && <RedocViewer />}
      </main>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  title,
  description,
  href,
  color,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
  href: string;
  color: 'blue' | 'green' | 'purple' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    purple: 'bg-purple-500/20 text-purple-400',
    red: 'bg-red-500/20 text-red-400',
  };

  return (
    <a
      href={href}
      className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700 hover:border-neutral-600 transition-colors group"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-lg ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-medium text-neutral-100 group-hover:text-white">{title}</h3>
      </div>
      <p className="text-sm text-neutral-400">{description}</p>
    </a>
  );
}

function ScalarViewer() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
    script.async = true;
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return (
    <div>
      <script
        id="api-reference"
        data-url="/api/phase6/docs?format=json"
        data-configuration={JSON.stringify({
          theme: 'kepler',
          layout: 'modern',
          showSidebar: true,
          customCss: `
            .dark-mode {
              --scalar-background-1: #0a0a0a;
              --scalar-background-2: #171717;
              --scalar-background-3: #262626;
            }
          `,
        })}
      />
    </div>
  );
}

function SwaggerViewer() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js';
    script.onload = () => {
      // @ts-ignore
      window.SwaggerUIBundle({
        url: '/api/phase6/docs?format=json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          // @ts-ignore
          window.SwaggerUIBundle.presets.apis,
          // @ts-ignore
          window.SwaggerUIBundle.SwaggerUIStandalonePreset,
        ],
        layout: 'StandaloneLayout',
      });
    };
    document.body.appendChild(script);

    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  return <div id="swagger-ui" className="h-full bg-white" />;
}

function RedocViewer() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js';
    script.onload = () => {
      // @ts-ignore
      window.Redoc.init('/api/phase6/docs?format=json', {
        scrollYOffset: 65,
        theme: {
          colors: { primary: { main: '#3b82f6' } },
          sidebar: { backgroundColor: '#171717' },
        },
      }, document.getElementById('redoc-container'));
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  return <div id="redoc-container" className="h-full" />;
}
