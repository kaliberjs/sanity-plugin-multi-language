import {definePlugin} from 'sanity'
import {v4 as uuid} from 'uuid'
import {translations} from './Translations'

export {translations}

export const multiLanguage = definePlugin((config = {}) => ({
  name: 'sanity-plugin-multi-language',
  schema: {
    types: prevTypes => {
      if (!config.languages?.length) return prevTypes

      return prevTypes.map((schema) => {
        const schemaHasLanguage = schema.fields.some((x) => x.name === 'language')
        const schemaHasTranslationId = schema.fields.some((x) => x.name === 'translationId')

        if (schemaHasLanguage !== schemaHasTranslationId)
          throw new Error('A schema cannot have only one of `language` and `translationID`.')
        if (schemaHasLanguage && schemaHasTranslationId) return schema

        return addFieldsToSchema(schema, {config})
      })
    }
  },
}))

function addFieldsToSchema(schema, {config}) {
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

  async function newInitialValue(_, context, ...rest) {
    const result = await (typeof schema.initialValue === 'function'
      ? schema.initialValue(_, context, ...rest)
      : schema.initialValue)

    return {
      ...result,
      language: (await getParentRefLanguageHack(context.getClient({ apiVersion: '2022-12-05' }))) ?? config.defaultLanguage,
      translationId: uuid(),
    }
  }
}

async function getParentRefLanguageHack(client) {
  const segments = decodeURIComponent(window.location.pathname).split(';')
  const [id] = segments.slice(-1).shift()?.split(',')

  return client.fetch(
    `*[references($id)][0].language`,
    { id }
  )
}

export function typeHasLanguage({schema, schemaType}) {
  const fields = schema.get(schemaType)?.fields ?? []
  return (
    fields.some((x) => x.name === 'language') && fields.some((x) => x.name === 'translationId')
  )
}

