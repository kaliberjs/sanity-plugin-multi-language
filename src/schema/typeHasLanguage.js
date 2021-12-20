import schema from 'part:@sanity/base/schema'

export function typeHasLanguage(type) {
  return schema.get(type).fields.some(x => x.name === 'language')
}
