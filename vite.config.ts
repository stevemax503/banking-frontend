import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const DEFAULT_TAWK_PROPERTY_ID = '6a19a97f2951b91c34153174'
const DEFAULT_TAWK_WIDGET_ID = '1jpq3s7dj'

function tawkEmbedPlugin(env: Record<string, string>): Plugin {
  const propertyId = (env.VITE_TAWK_PROPERTY_ID || '').trim() || DEFAULT_TAWK_PROPERTY_ID
  const widgetId = (env.VITE_TAWK_WIDGET_ID || '').trim() || DEFAULT_TAWK_WIDGET_ID
  const enabled = env.VITE_TAWK_ENABLED !== 'false' && env.VITE_TAWK_ENABLED !== '0'

  return {
    name: 'tawk-embed',
    transformIndexHtml(html) {
      if (!enabled) return html

      const snippet = `
    <!-- Tawk.to live chat (official embed — loads before React) -->
    <script type="text/javascript">
      var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
      (function(){
        var previousOnLoad=Tawk_API.onLoad;
        Tawk_API.onLoad=function(){
          if(typeof Tawk_API.showWidget==='function'){Tawk_API.showWidget();}
          if(typeof previousOnLoad==='function'){previousOnLoad();}
        };
        var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
        s1.async=true;
        s1.src='https://embed.tawk.to/${propertyId}/${widgetId}';
        s1.charset='UTF-8';
        s1.setAttribute('crossorigin','*');
        s0.parentNode.insertBefore(s1,s0);
      })();
    </script>`

      return html.replace('</body>', `${snippet}\n  </body>`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
  plugins: [react(), tawkEmbedPlugin(env)],
  test: {
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
  }
})
