import path from 'path'

function isSafeSegment(segment: string): boolean {
  return segment !== '' && segment !== '.' && segment !== '..' && !/[\\:\0]/.test(segment)
}

export function resolveInRoot(root: string, relPath: string, p: typeof path = path): string {
  const segments = relPath.split('/')
  if (!segments.every(isSafeSegment)) {
    throw new Error('Path outside the notebook folder: ' + relPath)
  }
  return p.join(root, ...segments)
}
