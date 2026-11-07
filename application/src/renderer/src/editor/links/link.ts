import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { useLinkStore } from './linkStore'

function interceptLinkClick(event: MouseEvent): boolean {
  const target = event.target
  if (!(target instanceof Element)) return false
  const anchor = target.closest('a[href]')
  if (!anchor) return false
  event.preventDefault()
  useLinkStore.getState().requestOpen(anchor.getAttribute('href') ?? '')
  return true
}

// The DOM click, not ProseMirror's handleClick (a mouseup), so preventDefault also stops a native navigation
export const linkGuardPlugin = (): Plugin =>
  new Plugin({
    key: new PluginKey('linkGuard'),
    props: {
      handleDOMEvents: {
        click: (_view, event) => interceptLinkClick(event),
        auxclick: (_view, event) => event.button === 1 && interceptLinkClick(event)
      }
    }
  })

// buildExtensions turns off the link's openOnClick, so no click opens a URL past the store
export const linkGuard = Extension.create({
  name: 'linkGuard',
  addProseMirrorPlugins: () => [linkGuardPlugin()]
})
