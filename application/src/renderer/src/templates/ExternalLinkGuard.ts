import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { useExternalLinkStore } from '../store/externalLinkStore'

/**
 * Intercepts clicks on `<a>` links inside the editor and routes them through
 * `useExternalLinkStore` instead of navigating immediately. Replaces the
 * `Link` extension's own `openOnClick` click handler (which calls
 * `window.open` directly) — `Link` must be configured with
 * `openOnClick: false` alongside this extension so both don't fire.
 */
export const ExternalLinkGuard = Extension.create({
  name: 'externalLinkGuard',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('externalLinkGuard'),
        props: {
          handleClick: (view, _pos, event) => {
            if (event.button !== 0) return false
            const target = event.target
            if (!(target instanceof Element)) return false
            const anchor = target.closest('a[href]') as HTMLAnchorElement | null
            if (!anchor) return false
            event.preventDefault()
            useExternalLinkStore.getState().requestOpen(anchor.href)
            return true
          }
        }
      })
    ]
  }
})

export default ExternalLinkGuard
