export default function ErrorBox({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      role="alert"
      className="mb-2 rounded-sm bg-red-50 p-2 text-xs text-red-700 wrap-anywhere dark:bg-red-950 dark:text-red-200"
    >
      {children}
    </div>
  )
}
