export function typeHasLanguage({ schema, schemaType }) {
  const fields = schema.get(schemaType)?.fields ?? []
  return (
    fields.some((x) => x.name === 'language') && fields.some((x) => x.name === 'translationId')
  )
}
