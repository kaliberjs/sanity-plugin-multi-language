import * as uuid from 'uuid'
import pluginConfig from 'config:@kaliber/sanity-plugin-multi-language'
import { Language } from './Language'
import client from 'part:@sanity/base/client'

export { Translations, typeHasLanguage } from './Translations'

const sanityClient = client.withConfig({ apiVersion: '2022-03-16' })

export function withMultipleLanguages({ fieldset = undefined } = {}) {
  return schema => {
    const schemaHasLanguage = schema.fields.some(x => x.name === 'language')
    const schemaHasTranslationId = schema.fields.some(x => x.name === 'translationId')

    if (schemaHasLanguage !== schemaHasTranslationId) throw new Error('A schema cannot have only one of `language` and `translationID`.')
    if (schemaHasLanguage && schemaHasTranslationId) return schema

    return addFieldsToSchema(schema, { fieldset })
  }
}

function addFieldsToSchema(schema, { fieldset }) {
  const language = {
    title: 'Taal',
    name: 'language',
    type: 'string',
    fieldset,
    readOnly: true,
    hidden: process.env.NODE_ENV === 'production',
    inputComponent: Language
  }

  const translationId = {
    title: 'Vertalings ID',
    name: 'translationId',
    type: 'string',
    fieldset,
    of: [{ type: 'string' }],
    readOnly: true,
    hidden: ({ currentUser }) => !currentUser.roles.some(x => x.name === 'administrator')
  }

  return {
    ...schema,
    fields: [language, translationId, ...schema.fields],
    initialValue: newInitialValue
  }

  async function newInitialValue(...args) {
    const segments = decodeURIComponent(window.location.pathname).split(';')
    const currentSegment = segments.slice(-1).shift()
    const [parentId] = segments.slice(-1).shift()?.split(',')
    const parent = currentSegment?.includes('parentRefPath') 
      ? await sanityClient.fetch('*[_id == $parentId][0] { language }', { parentId })
      : null
    
    const result = await (
      typeof schema.initialValue === 'function'
        ? schema.initialValue(...args)
        : schema.initialValue
    )

    return {
      ...result,
      language: parent?.language ?? pluginConfig.defaultLanguage,
      translationId: uuid.v4()
    }
  }
}
