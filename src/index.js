import {createPlugin} from 'sanity'
import {v4 as uuid} from 'uuid'

export const multiLanguage = createPlugin((config = {}) => {
  return {
    name: 'sanity-plugin-multi-language',
    schema: {
      types: (prevTypes, {client}) =>
        prevTypes.map((schema) => {
          const schemaHasLanguage = schema.fields.some((x) => x.name === 'language')
          const schemaHasTranslationId = schema.fields.some((x) => x.name === 'translationId')

          if (schemaHasLanguage !== schemaHasTranslationId)
            throw new Error('A schema cannot have only one of `language` and `translationID`.')
          if (schemaHasLanguage && schemaHasTranslationId) return schema

          return addFieldsToSchema(schema, {config, client})
        }),
    },
  }
})

function addFieldsToSchema(schema, {config, client}) {
  const language = {
    title: 'Taal',
    name: 'language',
    type: 'string',
    readOnly: true,
    // hidden: import.meta.env.NODE_ENV === 'production',
    // inputComponent: Language
  }

  const translationId = {
    title: 'Vertalings ID',
    name: 'translationId',
    type: 'string',
    of: [{type: 'string'}],
    readOnly: true,
    hidden: ({currentUser}) => !currentUser.roles.some((x) => x.name === 'administrator'),
  }

  return {
    ...schema,
    fields: [language, translationId, ...schema.fields],
    initialValue: newInitialValue,
  }

  async function newInitialValue(...args) {
    const result = await (typeof schema.initialValue === 'function'
      ? schema.initialValue(...args)
      : schema.initialValue)

    return {
      ...result,
      language: (await getParentRefLanguageHack(client)) ?? config.defaultLanguage,
      translationId: uuid(),
    }
  }
}

function getParentRefLanguageHack(client) {
  const segments = decodeURIComponent(window.location.pathname).split(';')
  const currentSegment = segments.slice(-1).shift()
  const [parentId] = segments.slice(-2).shift()?.split(',')

  return currentSegment?.includes('parentRefPath') && parentId
    ? client.fetch(`*[_id in [$parentId, 'drafts.' + $parentId]][0].language`, {
        parentId,
      })
    : null
}
