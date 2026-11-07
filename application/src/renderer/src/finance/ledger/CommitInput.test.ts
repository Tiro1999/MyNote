import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import CommitInput, {
  activeEdit,
  beginEdit,
  positiveAmount,
  resolveCommit,
  settleEdit,
  signedAmount,
  tagList,
  typeText,
  unloadCommit,
  watchUnload
} from './CommitInput'
import type { Validate } from './CommitInput'

describe('resolveCommit without a validator', () => {
  it('commits changed text as it is', () => {
    expect(resolveCommit('Lunch', 'Dinner')).toEqual({ kind: 'commit', value: 'Lunch' })
  })
  it('commits an emptied text', () => {
    expect(resolveCommit('', 'Dinner')).toEqual({ kind: 'commit', value: '' })
  })
  it('does nothing when the text equals the stored value', () => {
    expect(resolveCommit('Dinner', 'Dinner')).toEqual({ kind: 'unchanged' })
    expect(resolveCommit('', '')).toEqual({ kind: 'unchanged' })
  })
  it('keeps surrounding spaces, which are data', () => {
    expect(resolveCommit('Dinner ', 'Dinner')).toEqual({ kind: 'commit', value: 'Dinner ' })
  })
})

describe('resolveCommit with a validator', () => {
  const upper: Validate = (raw) => (raw === '' ? { error: 'Required' } : { value: raw.toUpperCase() })

  it('commits the normalized value, not the typed text', () => {
    expect(resolveCommit('abc', 'x', upper)).toEqual({ kind: 'commit', value: 'ABC' })
  })
  it('reports the message and commits nothing for an invalid text', () => {
    expect(resolveCommit('', 'x', upper)).toEqual({ kind: 'invalid', message: 'Required' })
  })
  it('is unchanged when the normalized value equals the stored one', () => {
    expect(resolveCommit('abc', 'ABC', upper)).toEqual({ kind: 'unchanged' })
  })
  it('does not run the validator when the text equals the stored value', () => {
    const validate = vi.fn<Validate>(() => ({ error: 'never' }))
    expect(resolveCommit('12,5', '12,5', validate)).toEqual({ kind: 'unchanged' })
    expect(validate).not.toHaveBeenCalled()
  })
})

describe('positiveAmount', () => {
  it('normalizes a valid amount', () => {
    expect(resolveCommit('12,5', '', positiveAmount)).toEqual({ kind: 'commit', value: '12.50' })
    expect(resolveCommit(' 3 ', '', positiveAmount)).toEqual({ kind: 'commit', value: '3.00' })
    expect(resolveCommit('1.005', '', positiveAmount)).toEqual({ kind: 'commit', value: '1.01' })
  })
  it('is unchanged when the typed amount means the stored one', () => {
    expect(resolveCommit('12,5', '12.50', positiveAmount)).toEqual({ kind: 'unchanged' })
  })
  it.each(['1.234,56', '-3', 'abc', '', '0', '0,00', '1e3', '12.5.1', '1 000'])(
    'refuses %j and stores nothing',
    (raw) => {
      const result = resolveCommit(raw, '5.00', positiveAmount)
      expect(result.kind).toBe('invalid')
      expect(result).toHaveProperty('message', expect.stringContaining('amount'))
    }
  )
  it('leaves a legacy stored value alone until it is edited', () => {
    expect(resolveCommit('1.234,56', '1.234,56', positiveAmount)).toEqual({ kind: 'unchanged' })
  })
})

describe('signedAmount', () => {
  it('accepts negatives and zero', () => {
    expect(resolveCommit('-120,5', '0', signedAmount)).toEqual({ kind: 'commit', value: '-120.50' })
    expect(resolveCommit('0', '5.00', signedAmount)).toEqual({ kind: 'commit', value: '0.00' })
  })
  it.each(['abc', '', '1.234,56', '--1'])('refuses %j', (raw) => {
    const result = resolveCommit(raw, '0', signedAmount)
    expect(result.kind).toBe('invalid')
    expect(result).toHaveProperty('message', expect.stringContaining('number'))
  })
})

describe('tagList', () => {
  it('commits the tags as clean text', () => {
    expect(resolveCommit('work, trip;', 'work', tagList)).toEqual({ kind: 'commit', value: 'work, trip' })
    expect(resolveCommit('a,,b ,', '', tagList)).toEqual({ kind: 'commit', value: 'a, b' })
  })
  it('keeps a trailing comma while typing and drops it on commit', () => {
    expect(resolveCommit('work, trip,', 'work, trip', tagList)).toEqual({ kind: 'unchanged' })
  })
  it('commits an emptied field as no tags', () => {
    expect(resolveCommit('', 'work', tagList)).toEqual({ kind: 'commit', value: '' })
    expect(resolveCommit(' , ', 'work', tagList)).toEqual({ kind: 'commit', value: '' })
  })
})

describe('an edit from focus to blur', () => {
  it('starts with the stored value as the raw text', () => {
    expect(beginEdit('12.50')).toEqual({ text: '12.50', base: '12.50', error: null })
  })

  it('keeps every typed character as it is, including a trailing comma', () => {
    const edit = typeText('work', 'work, trip,')
    expect(edit).toEqual({ text: 'work, trip,', base: 'work', error: null })
  })

  it('commits once, on blur, and ends the edit', () => {
    const typed = typeText('', '12,5')
    expect(settleEdit(typed, '', positiveAmount)).toEqual({ edit: null, commit: '12.50' })
  })

  it('does nothing when the text equals the stored value', () => {
    expect(settleEdit(beginEdit('Lunch'), 'Lunch')).toEqual({ edit: null, commit: null })
  })

  it('does nothing when no edit is running', () => {
    expect(settleEdit(null, 'Lunch')).toEqual({ edit: null, commit: null })
  })

  it('keeps an invalid text visible with its message and commits nothing', () => {
    const settled = settleEdit(typeText('5.00', '1.234,56'), '5.00', positiveAmount)
    expect(settled.commit).toBeNull()
    expect(settled.edit).toEqual({
      text: '1.234,56',
      base: '5.00',
      error: 'Enter an amount above 0, e.g. 12.50'
    })
  })

  it('keeps the message through another blur until the user edits', () => {
    const invalid = settleEdit(typeText('5.00', 'abc'), '5.00', positiveAmount).edit
    expect(settleEdit(invalid, '5.00', positiveAmount).edit).toMatchObject({ text: 'abc', error: expect.any(String) })
  })

  it('clears the message when the user edits again', () => {
    expect(typeText('5.00', 'abc1').error).toBeNull()
  })

  it('drops an edit whose stored value has changed since', () => {
    const invalid = settleEdit(typeText('5.00', 'abc'), '5.00', positiveAmount).edit
    expect(activeEdit(invalid, '5.00')).toBe(invalid)
    expect(activeEdit(invalid, '7.00')).toBeNull()
    expect(activeEdit(null, '7.00')).toBeNull()
  })
})

describe('closing the window while a field is being edited', () => {
  it('commits a valid, changed text', () => {
    expect(unloadCommit(typeText('Lunch', 'Dinner'), 'Lunch')).toBe('Dinner')
    expect(unloadCommit(typeText('', '12,5'), '', positiveAmount)).toBe('12.50')
  })

  it('commits nothing for an invalid text', () => {
    expect(unloadCommit(typeText('5.00', 'abc'), '5.00', positiveAmount)).toBeNull()
    const invalid = settleEdit(typeText('5.00', 'abc'), '5.00', positiveAmount).edit
    expect(unloadCommit(invalid, '5.00', positiveAmount)).toBeNull()
  })

  it('commits nothing when the text equals the stored value or no edit is running', () => {
    expect(unloadCommit(beginEdit('Lunch'), 'Lunch')).toBeNull()
    expect(unloadCommit(typeText('5.00', '5,00'), '5.00', positiveAmount)).toBeNull()
    expect(unloadCommit(null, 'Lunch')).toBeNull()
  })

  it('commits nothing for an edit that started from an older stored value', () => {
    expect(unloadCommit(activeEdit(typeText('Lunch', 'Dinner'), 'Brunch'), 'Brunch')).toBeNull()
  })
})

describe('watchUnload', () => {
  it('calls the function on beforeunload until it is removed', () => {
    const target = new EventTarget()
    const onUnload = vi.fn()
    const stop = watchUnload(target, onUnload)
    target.dispatchEvent(new Event('beforeunload'))
    expect(onUnload).toHaveBeenCalledTimes(1)
    stop()
    target.dispatchEvent(new Event('beforeunload'))
    expect(onUnload).toHaveBeenCalledTimes(1)
  })

  it('listens in the capture phase, so it runs before the listeners that check for unsent writes', () => {
    const target = new EventTarget()
    const add = vi.spyOn(target, 'addEventListener')
    const remove = vi.spyOn(target, 'removeEventListener')
    const onUnload = vi.fn()
    watchUnload(target, onUnload)()
    expect(add).toHaveBeenCalledWith('beforeunload', onUnload, { capture: true })
    expect(remove).toHaveBeenCalledWith('beforeunload', onUnload, { capture: true })
  })
})

describe('CommitInput markup', () => {
  const render = (props: Partial<Parameters<typeof CommitInput>[0]> = {}): string =>
    renderToString(createElement(CommitInput, { value: '12.50', label: 'Amount', onCommit: vi.fn(), ...props }))

  it('shows the stored value while the field is not focused', () => {
    expect(render()).toContain('value="12.50"')
  })
  it('shows the formatted stored value while the field is not focused', () => {
    expect(render({ format: (stored) => `${stored} €` })).toContain('value="12.50 €"')
  })
  it('labels the input for assistive technology', () => {
    expect(render()).toContain('aria-label="Amount"')
  })
  it('shows a placeholder and passes the class on', () => {
    const html = render({ value: '', placeholder: '0,00', className: 'field' })
    expect(html).toContain('placeholder="0,00"')
    expect(html).toContain('class="field')
  })
  it('shows no error at the start', () => {
    expect(render()).not.toContain('role="alert"')
    expect(render()).not.toContain('aria-invalid="true"')
  })
})
