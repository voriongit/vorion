import type { Preview } from '@storybook/react'
import '../app/globals.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#1a1a2e',
        },
        {
          name: 'gray',
          value: '#f5f5f5',
        },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
      },
    },
    a11y: {
      config: {
        rules: [
          {
            // WCAG 2.1 AA compliance
            id: 'color-contrast',
            enabled: true,
          },
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Theme switcher',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark', 'system'],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      // Apply theme class based on global type
      const theme = context.globals.theme
      const isDark = theme === 'dark'

      return (
        <div className={isDark ? 'dark' : ''}>
          <div className="min-h-screen bg-white dark:bg-gray-900 p-6">
            <Story />
          </div>
        </div>
      )
    },
  ],
}

export default preview
