import { useNotebookStore } from './store/notebookStore'
import Sidebar from './components/Sidebar/Sidebar'
import CanvasView from './components/Canvas/CanvasView'
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen'

export default function App(): JSX.Element {
  const { dataRoot, activePageId } = useNotebookStore()

  if (!dataRoot) {
    return <WelcomeScreen />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        {activePageId ? (
          <CanvasView />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 text-lg select-none">
            Select or create a page to start
          </div>
        )}
      </main>
    </div>
  )
}
