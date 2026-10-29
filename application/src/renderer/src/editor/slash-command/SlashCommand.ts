import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import SlashCommandMenu, { type SlashCommandMenuHandle } from './SlashMenu'
import { filterTemplateCommands } from './items'
import type { TemplateCommand, TemplateCommandContext } from '../feature'

export const SlashCommandPluginKey = new PluginKey('slashCommand')

export interface SlashCommandOptions {
  /** Identifies the currently open chapter/page, forwarded to structural commands. */
  context: TemplateCommandContext
}

/**
 * Jira/Confluence-style `/` slash-command menu. Wraps `@tiptap/suggestion`
 * and renders `SlashCommandMenu` via a `ReactRenderer`, positioned manually
 * with `clientRect()` — no tippy.js, consistent with the app's other custom
 * popovers (see `Canvas/Toolbar.tsx`).
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      context: { kind: null, id: null }
    }
  },

  addProseMirrorPlugins() {
    const context = this.options.context

    return [
      Suggestion<TemplateCommand>({
        editor: this.editor,
        char: '/',
        pluginKey: SlashCommandPluginKey,
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterTemplateCommands(query).slice(0, 20),
        command: ({ editor, range, props }) => {
          props.action(editor, range, context)
        },
        render: () => {
          let renderer: ReactRenderer<SlashCommandMenuHandle, { items: TemplateCommand[]; command: (item: TemplateCommand) => void }> | null =
            null
          let element: HTMLElement | null = null

          const position = (rect: DOMRect | null): void => {
            if (!element || !rect) return
            element.style.position = 'fixed'
            element.style.left = `${rect.left}px`
            element.style.top = `${rect.bottom + 4}px`
            element.style.zIndex = '1000'
          }

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashCommandMenu, {
                editor: props.editor,
                props: { items: props.items, command: props.command }
              })
              element = renderer.element as HTMLElement
              document.body.appendChild(element)
              position(props.clientRect?.() ?? null)
            },

            onUpdate: (props) => {
              renderer?.updateProps({ items: props.items, command: props.command })
              position(props.clientRect?.() ?? null)
            },

            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                element?.remove()
                renderer?.destroy()
                element = null
                renderer = null
                return true
              }
              return renderer?.ref?.onKeyDown({ event: props.event }) ?? false
            },

            onExit: () => {
              element?.remove()
              renderer?.destroy()
              element = null
              renderer = null
            }
          }
        }
      })
    ]
  }
})

export default SlashCommand
