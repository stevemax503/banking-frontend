import { BrowserRouter } from 'react-router-dom'
import AppRouter from '@/router/AppRouter'
import TawkToWidget from '@/components/layout/TawkToWidget'
import { GoogleTranslateBootstrap } from '@/components/layout/GoogleTranslateControl'
import { LiveChatProvider } from '@/contexts/LiveChatContext'

export default function App() {
  return (
    <BrowserRouter>
      <LiveChatProvider>
        <GoogleTranslateBootstrap />
        <TawkToWidget />
        <AppRouter />
      </LiveChatProvider>
    </BrowserRouter>
  )
}
