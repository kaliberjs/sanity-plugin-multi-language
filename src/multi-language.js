import * as uuid from 'uuid'
import pluginConfig from 'config:@kaliber/sanity-plugin-multi-language'
import { Language } from './Language'

export { Translations, typeHasLanguage } from './Translations'

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
    const result = await (
      typeof schema.initialValue === 'function'
        ? schema.initialValue(...args)
        : schema.initialValue
    )

    return {
      ...result,
      language: pluginConfig.defaultLanguage,
      translationId: uuid.v4()
    }
  }
}
