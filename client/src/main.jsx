import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import './index.css'

// Страницы грузятся по частям (React.lazy), и после каждого деплоя старые
// файлы чанков пропадают с хостинга — вкладка, открытая ДО деплоя, ещё
// ссылается на них и на переходе в такой раздел ловит "Failed to fetch
// dynamically imported module" вместо страницы. Vite шлёт это событие именно
// в такой ситуации; перезагрузка подтягивает свежий index.html с верными
// путями и чинит переход без участия человека. Флаг в sessionStorage не даёт
// уйти в цикл, если файл пропал не из-за устаревшей вкладки, а взаправду —
// сбрасываем его при каждой удачной загрузке, чтобы следующий деплой
// перезагрузил страницу заново, а не молчал из-за старой отметки.
sessionStorage.removeItem('vite-reload-once')
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('vite-reload-once')) return
  sessionStorage.setItem('vite-reload-once', '1')
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
