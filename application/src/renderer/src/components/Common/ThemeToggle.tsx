import { useNotebookStore } from '../../store/notebookStore'

export default function ThemeToggle(): JSX.Element {
  const { isDarkMode, toggleDarkMode } = useNotebookStore()

  return (
    <button
      type="button"
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
      onClick={toggleDarkMode}
    >
      <span aria-hidden="true">{isDarkMode ? '☀️' : '🌙'}</span>
      <span>{isDarkMode ? 'Light' : 'Dark'}</span>
    </button>
  )
}
