import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import { filterSlashItems, type SlashItem } from '../feature'
import { SlashMenu, type SlashMenuHandle, type SlashMenuProps } from './SlashMenu'

const SlashCommandPluginKey = new PluginKey('slashCommand')

export interface SlashCommandOptions {
  items: SlashItem[]
}

// The `/` menu: Suggestion mounts a React menu at the caret and positions it with Floating UI. See documentation/software/renderer/editor/slash-command.drawio.svg
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return { items: [] }
  },

  addProseMirrorPlugins() {
    const { items } = this.options

    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        pluginKey: SlashCommandPluginKey,
        items: ({ query }) => filterSlashItems(items, query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null
          let unmount: (() => void) | null = null

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, {
                editor: props.editor,
                props: { items: props.items, command: props.command },
                className: 'z-50'
              })
              unmount = props.mount(renderer.element)
            },

            onUpdate: (props) => renderer?.updateProps({ items: props.items, command: props.command }),

            onKeyDown: (props) => renderer?.ref?.onKeyDown(props) ?? false,

            onExit: () => {
              unmount?.()
              renderer?.destroy()
              unmount = null
              renderer = null
            }
          }
        }
      })
    ]
  }
})
