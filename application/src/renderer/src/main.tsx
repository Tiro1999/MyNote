import React from 'react'
import ReactDOM from 'react-dom/client'
import { startContentSync } from '@renderer/canvas'
import { applyThemeBeforeFirstPaint } from '@renderer/settings'
import App from './app/App'
import { ErrorBoundary } from './app/ErrorBoundary'
import './app/global.css'

applyThemeBeforeFirstPaint()
startContentSync()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
