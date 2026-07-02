import { useEffect } from 'react'
import { useNotebookStore } from './store/notebookStore'
import Sidebar from './components/Sidebar/Sidebar'
import CanvasView from './components/Canvas/CanvasView'
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen'

export default function App(): JSX.Element {
  const { dataRoot, activeContentId, isDarkMode } = useNotebookStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  if (!dataRoot) {
    return <WelcomeScreen />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        {activeContentId ? (
          <CanvasView />
        ) : (
          <div className="flex h-full items-center justify-center text-lg text-gray-400 select-none dark:text-gray-500">
            Select or create a page to start
          </div>
        )}
      </main>
    </div>
  )
}
