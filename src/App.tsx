import { BrowserRouter } from 'react-router-dom'
import AppRouter from '@/router/AppRouter'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import TawkToWidget from '@/components/layout/TawkToWidget'
import { GoogleTranslateBootstrap } from '@/components/layout/GoogleTranslateControl'
import { LiveChatProvider } from '@/contexts/LiveChatContext'

export default function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <LiveChatProvider>
          <GoogleTranslateBootstrap />
          <TawkToWidget />
          <AppRouter />
        </LiveChatProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  )
}
