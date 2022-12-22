import {definePlugin} from 'sanity'
import {v4 as uuid} from 'uuid'
import {translations} from './Translations'
import {languageField} from './Language'

export {translations}

export function addFields(config) {
  const languageCount = Object.values(config.languages ?? {}).length

  return type => {
    if (!type.options?.multiLanguage) return type
    if (type.fields.some(x => ['language', 'translationId'].includes(x.name))) {
      throw new Error(`Your '${type.name}' schema already contains a \`language\` or \`translationId\` field. Remove these fields before enabling multiLanguage.`)
    }

    return {
      ...type,
      fields: [
        {
          title: 'Taal',
          name: 'language',
          type: 'string',
          readOnly: true,
          components: {
            field: languageField(config)
          },
          hidden: languageCount <= 1,
          initialValue: async (_, context) => {
            return (await getParentRefLanguageHack(context.getClient({ apiVersion: '2022-12-05' }))) ?? config.defaultLanguage
          },
        },
        {
          title: 'Vertalings ID',
          name: 'translationId',
          type: 'string',
          of: [{type: 'string'}],
          readOnly: true,
          hidden: ({currentUser}) => !currentUser.roles.some((x) => x.name === 'administrator'),
          initialValue: uuid()
        },
        ...type.fields ?? []
      ]
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

