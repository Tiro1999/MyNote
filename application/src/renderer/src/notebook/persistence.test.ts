import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { messageOf } from '@shared/errors'
import { parseNotebooks } from './persistence'
import { NOW } from './testFixtures'

const SCHEMA = new URL('../../../../../documentation/software/file-format/notebooks.schema.json', import.meta.url)
const BACKFILLED = ['sections', 'pages', 'children']

// Exactly the fields notebooks.schema.json requires, minus the backfilled arrays (pinned below)
const notebookFields = { id: 'nb1', name: 'Work', color: '#0078D4' }
const sectionFields = { id: 's1', notebookId: 'nb1', name: 'Projects', color: '#E3008C' }
const pageFields = { id: 'p1', sectionId: 's1', title: 'Plan', createdAt: NOW, updatedAt: NOW }

const withNotebook = (fields: object): unknown[] => [{ ...notebookFields, sections: [], ...fields }]
const withSection = (fields: object): unknown[] =>
  withNotebook({ sections: [{ ...sectionFields, pages: [], ...fields }] })
const withPage = (fields: object): unknown[] =>
  withSection({ pages: [{ ...pageFields, children: [], ...fields }] })

describe('parseNotebooks', () => {
  it('backfills a v0.1.x manifest and keeps its unknown fields', () => {
    const legacy = [
      {
        ...notebookFields,
        legacyFlag: 1,
        sections: [{ ...sectionFields, legacyFlag: 1, pages: [{ ...pageFields, legacyFlag: 1 }] }]
      }
    ]
    expect(parseNotebooks(legacy)).toStrictEqual([
      {
        ...notebookFields,
        legacyFlag: 1,
        sections: [{ ...sectionFields, legacyFlag: 1, pages: [{ ...pageFields, legacyFlag: 1, children: [] }] }]
      }
    ])
  })

  it.each([
    ['notebook', notebookFields],
    ['section', sectionFields],
    ['pageMeta', pageFields]
  ])('the %s fixture holds exactly the fields the schema requires, minus the arrays', (def, fields) => {
    const { $defs } = JSON.parse(readFileSync(SCHEMA, 'utf-8')) as {
      $defs: Record<string, { required: string[] }>
    }
    const required = $defs[def].required.filter((key) => !BACKFILLED.includes(key))
    expect(Object.keys(fields).sort()).toEqual(required.sort())
  })

  it('loads a minimal v0.1.x manifest that has none of the optional fields', () => {
    const minimal = [
      { ...notebookFields, sections: [{ ...sectionFields, pages: [pageFields] }, { ...sectionFields, id: 's2' }] },
      { ...notebookFields, id: 'nb2' }
    ]
    expect(parseNotebooks(minimal)).toStrictEqual([
      {
        ...notebookFields,
        sections: [
          { ...sectionFields, pages: [{ ...pageFields, children: [] }] },
          { ...sectionFields, id: 's2', pages: [] }
        ]
      },
      { ...notebookFields, id: 'nb2', sections: [] }
    ])
  })

  it('backfills missing sections and pages', () => {
    expect(parseNotebooks([notebookFields])[0].sections).toEqual([])
    expect(parseNotebooks([{ ...notebookFields, sections: [sectionFields] }])[0].sections[0].pages).toEqual([])
  })

  it('returns a current manifest unchanged', () => {
    const current = withSection({
      collapsed: true,
      pages: [{ ...pageFields, collapsed: false, children: [{ ...pageFields, id: 'p2', children: [] }] }]
    })
    expect(parseNotebooks(structuredClone(current))).toStrictEqual(current)
  })

  describe.each([
    ['notebook', (id: string) => withNotebook({ id })],
    ['chapter', (id: string) => withSection({ id })],
    ['page', (id: string) => withPage({ id })]
  ])('with an invalid %s id', (_level, manifestWith) => {
    it.each(['..', 'a/b', ''])('%j throws a message that contains the id', (id) => {
      expect(() => parseNotebooks(manifestWith(id))).toThrow(JSON.stringify(id))
    })
  })

  it.each([
    ['notebook', [...withNotebook({}), ...withNotebook({ name: 'Copy' })]],
    ['chapter', withNotebook({ sections: [{ ...sectionFields, pages: [] }, { ...sectionFields, pages: [] }] })],
    ['page', withPage({ children: [{ ...pageFields, children: [] }] })]
  ])('throws for a repeated %s id, which would let one entry act on the folder of another', (noun, manifest) => {
    expect(() => parseNotebooks(manifest)).toThrow(`Duplicate ${noun} id "`)
  })

  it.each([
    ['notebook', [...withNotebook({}), ...withNotebook({ id: 'NB1', name: 'Copy' })], 'NB1'],
    ['chapter', withNotebook({ sections: [{ ...sectionFields, pages: [] }, { ...sectionFields, id: 'S1', pages: [] }] }), 'S1'],
    ['page', withPage({ children: [{ ...pageFields, id: 'P1', children: [] }] }), 'P1']
  ])('throws for %s ids that differ only in case, as Windows and macOS folder names ignore case', (noun, manifest, id) => {
    expect(() => parseNotebooks(manifest)).toThrow(`Duplicate ${noun} id "${id}"`)
  })

  it.each(['finance', 'Finance', 'FINANCE'])('rejects the notebook id %j, because the finance data has that folder', (id) => {
    expect(() => parseNotebooks(withNotebook({ id }))).toThrow(`Notebook id "${id}" is reserved`)
  })

  it('allows finance as a chapter or page id, because those folders sit inside a notebook', () => {
    expect(() => parseNotebooks(withSection({ id: 'finance' }))).not.toThrow()
    expect(() => parseNotebooks(withPage({ id: 'Finance' }))).not.toThrow()
  })

  it('allows a chapter and a page to share an id, because they are looked up apart', () => {
    expect(() => parseNotebooks(withPage({ id: 's1' }))).not.toThrow()
  })

  it.each([
    ['sections', withNotebook({ sections: 'x' })],
    ['pages', withSection({ pages: 'x' })],
    ['children', withPage({ children: 'x' })]
  ])('throws when %s is not an array', (key, manifest) => {
    expect(() => parseNotebooks(manifest)).toThrow(`${key} must be an array, got "x"`)
  })

  it.each([
    ['name', withNotebook({ name: 5 }), '5'],
    ['color', withSection({ color: null }), 'null'],
    ['title', withPage({ title: { text: 'Plan' } }), '{"text":"Plan"}'],
    ['updatedAt', withPage({ updatedAt: 1 }), '1']
  ])('throws when %s is not a string and names the value', (key, manifest, shown) => {
    expect(() => parseNotebooks(manifest)).toThrow(`${key} must be a string, got ${shown}`)
  })

  it('throws when collapsed is not true or false', () => {
    expect(() => parseNotebooks(withPage({ collapsed: 'yes' }))).toThrow(
      'collapsed must be true or false, got "yes"'
    )
  })

  it.each([{ sections: 'x' }, {}, null, 'notebooks', 42])('throws for the non-array root %j', (root) => {
    expect(() => parseNotebooks(root)).toThrow(`got ${JSON.stringify(root)}`)
  })

  it.each([[5], [[]], [null]])('throws for the notebook entry %j', (entry) => {
    expect(() => parseNotebooks([entry])).toThrow('must be an object')
  })

  it('shortens a long offending value in the message', () => {
    const message = thrownMessage(() => parseNotebooks(withPage({ id: 'x'.repeat(500) })))
    expect(message).toContain(`"${'x'.repeat(39)}…`)
    expect(message.length).toBeLessThan(150)
  })
})

function thrownMessage(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    return messageOf(error)
  }
  throw new Error('Expected an error')
}
