const base = 'rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed'

// The look of the dialog buttons; ghost is secondary without the border
export const buttonClass = {
  primary: `${base} bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300`,
  secondary: `${base} border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800`,
  danger: `${base} bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300`,
  ghost: `${base} text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800`
}
