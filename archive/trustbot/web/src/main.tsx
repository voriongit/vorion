import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ToastProvider } from './components/ui'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ToastProvider maxToasts={5} defaultDuration={5000}>
            <RouterProvider router={router} />
        </ToastProvider>
    </React.StrictMode>,
)
