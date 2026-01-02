/** @import { Schema } from 'sanity' */

/** @arg {{ schema: Schema, schemaType: string }} props */
export function typeHasLanguage({ schema, schemaType }) {
  const actualSchema = schema.get(schemaType)
  if (!actualSchema)
    return false

  if (!('fields' in actualSchema))
    return false

  const fields = actualSchema.fields
  return (
    fields.some((x) => x.name === 'language') &&
    fields.some((x) => x.name === 'translationId')
  )
}
