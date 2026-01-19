/**
 * Router Configuration
 * Defines all routes for the multi-page dashboard
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ConsolePage } from './pages/ConsolePage';
import { AgentsPage } from './pages/AgentsPage';
import { TasksPage } from './pages/TasksPage';
import { CouncilPage } from './pages/CouncilPage';
import { MetricsPage } from './pages/MetricsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ArtifactsPage } from './pages/ArtifactsPage';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <AppLayout />,
        children: [
            {
                index: true,
                element: <Navigate to="/console" replace />,
            },
            {
                path: 'console',
                element: <ConsolePage />,
            },
            {
                path: 'agents',
                element: <AgentsPage />,
            },
            {
                path: 'tasks',
                element: <TasksPage />,
            },
            {
                path: 'council',
                element: <CouncilPage />,
            },
            {
                path: 'metrics',
                element: <MetricsPage />,
            },
            {
                path: 'settings',
                element: <SettingsPage />,
            },
            {
                path: 'artifacts',
                element: <ArtifactsPage />,
            },
        ],
    },
]);
