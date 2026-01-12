import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Omniscience',
  tagline: 'The Agentic AI Knowledge Base',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://learn.vorion.org',
  baseUrl: '/',

  organizationName: 'voriongit',
  projectName: 'omniscience',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/voriongit/omniscience/tree/main/',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/voriongit/omniscience/tree/main/',
          blogTitle: 'Agentic AI Insights',
          blogDescription: 'Deep dives into autonomous agent research and development',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/omniscience-social-card.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    announcementBar: {
      id: 'contribute',
      content: 'Help build the definitive Agentic AI knowledge base. <a href="/contributing">Contribute on GitHub</a>',
      backgroundColor: '#0ea5e9',
      textColor: '#ffffff',
      isCloseable: true,
    },
    navbar: {
      title: 'Omniscience',
      logo: {
        alt: 'Omniscience Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'knowledgeSidebar',
          position: 'left',
          label: 'Knowledge Base',
        },
        {
          to: '/blog',
          label: 'Insights',
          position: 'left',
        },
        {
          to: '/contributing',
          label: 'Contribute',
          position: 'left',
        },
        {
          href: 'https://basis.vorion.org',
          label: 'BASIS Standard',
          position: 'right',
        },
        {
          href: 'https://github.com/voriongit/omniscience',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://discord.gg/basis-protocol',
          label: 'Discord',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            { label: 'Agent Taxonomy', to: '/taxonomy' },
            { label: 'Cognitive Architecture', to: '/architecture' },
            { label: 'Orchestration', to: '/orchestration' },
            { label: 'Protocols', to: '/protocols' },
          ],
        },
        {
          title: 'Vorion Ecosystem',
          items: [
            { label: 'Vorion', href: 'https://vorion.org' },
            { label: 'BASIS Standard', href: 'https://basis.vorion.org' },
            { label: 'Cognigate', href: 'https://cognigate.dev' },
            { label: 'AgentAnchor', href: 'https://agentanchor.ai' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'Discord', href: 'https://discord.gg/basis-protocol' },
            { label: 'GitHub', href: 'https://github.com/voriongit' },
            { label: 'Twitter', href: 'https://twitter.com/BASISprotocol' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Insights Blog', to: '/blog' },
            { label: 'Contribute', to: '/contributing' },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Vorion Risk, LLC. Content licensed under CC BY 4.0.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['python', 'bash', 'yaml', 'json', 'typescript', 'solidity'],
    },
    // Algolia search - configure after deployment
    // algolia: {
    //   appId: 'YOUR_APP_ID',
    //   apiKey: 'YOUR_SEARCH_API_KEY',
    //   indexName: 'omniscience',
    //   contextualSearch: true,
    // },
  } satisfies Preset.ThemeConfig,
};

export default config;
