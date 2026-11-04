// Main could not open the link in a browser and has copied it to the clipboard
export function onLinkOpenFailed(callback: (url: string) => void): () => void {
  return window.api.links.onOpenFailed(callback)
}
