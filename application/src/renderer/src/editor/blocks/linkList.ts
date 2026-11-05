import './linkList.css'

export const JUMP_LINK_CLASS = 'jump-link'
export const UNTITLED_LABEL = 'Untitled'

export interface LinkListItem {
  label: string
  depth: number
  onClick(): void
}

interface LinkListBlockContent {
  title: string
  emptyText: string
  items: LinkListItem[]
}

export function renderLinkList(container: HTMLElement, items: LinkListItem[]): void {
  const list = document.createElement('ul')
  list.className = 'link-list'
  for (const item of items) {
    const entry = document.createElement('li')
    entry.className = 'link-list-item'
    entry.style.marginLeft = `${item.depth}rem`
    const link = document.createElement('span')
    link.className = JUMP_LINK_CLASS
    link.textContent = item.label || UNTITLED_LABEL
    link.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      item.onClick()
    })
    entry.append(link)
    list.append(entry)
  }
  container.replaceChildren(list)
}

// Title plus the list, or the empty text when there is nothing to list
export function renderLinkListBlock(dom: HTMLElement, { title, emptyText, items }: LinkListBlockContent): void {
  const heading = document.createElement('div')
  heading.className = 'link-list-title'
  heading.textContent = title
  const body = document.createElement('div')
  dom.replaceChildren(heading, body)
  if (items.length > 0) {
    renderLinkList(body, items)
    return
  }
  body.className = 'link-list-empty'
  body.textContent = emptyText
}
