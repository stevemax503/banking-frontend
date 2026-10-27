import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { queryClient } from './queryClient'
import { installGoogleTranslateDomGuard } from './lib/domTranslateGuard'
import './styles/globals.css'

installGoogleTranslateDomGuard()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px' },
          success: { iconTheme: { primary: '#C8F000', secondary: '#152A1E' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
)
