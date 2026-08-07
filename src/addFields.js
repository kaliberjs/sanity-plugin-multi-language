import { v4 as uuid } from 'uuid'
import { createLanguageFieldComponent } from './components/Language'
import { createSyncFieldWrapper } from './components/SyncFieldWrapper'
import apiVersion from './apiVersion'

/** @param {import('./types').Config} config */
export function addFields(config) {
  const languageCount = Object.values(config.multiLanguage.languages ?? {}).length

  return type => {
    if (!type.options?.kaliber?.multiLanguage) return type
    if (type.fields.some(x => ['language', 'translationId'].includes(x.name))) {
      throw new Error(`Your '${type.name}' schema already contains a \`language\` or \`translationId\` field. Remove these fields before enabling multiLanguage.`)
    }

    const syncFieldNames = []
    const transformedFields = (type.fields ?? []).map(field => {
      if (field.options?.syncAcrossTranslations) {
        syncFieldNames.push(field.name)
        return {
          ...field,
          components: {
            ...field.components,
            input: createSyncFieldWrapper(field.components?.input)
          }
        }
      }
      return field
    })

    return {
      ...type,
      options: {
        ...type.options,
        kaliber: {
          ...type.options?.kaliber,
          syncFieldNames
        }
      },
      fields: [
        {
          title: config.languageFieldTitle ?? 'Taal',
          name: 'language',
          type: 'string',
          readOnly: true,
          components: {
            field: createLanguageFieldComponent(config)
          },
          hidden: languageCount <= 1,
          initialValue: async (_, context) => {
            const client = context.getClient({ apiVersion })
            return (
              (await getParentRefLanguageHack(client)) ??
              (await config.getDefaultLanguage?.({ sanityClient: client, currentUser: context.currentUser, schema: type })) ??
              config.multiLanguage.defaultLanguage
            )
          },
        },
        {
          title: config.translationIdFieldTitle ?? 'Vertalings ID',
          name: 'translationId',
          type: 'string',
          of: [{ type: 'string' }],
          readOnly: true,
          hidden: ({ currentUser }) => !currentUser.roles.some((x) => x.name === 'administrator'),
          initialValue: () => uuid(),
          options: {
            kaliber: {
              duplicate: () => uuid()
            }
          },
        },
        ...transformedFields
      ]
    }
  }
}


async function getParentRefLanguageHack(client) {
  const segments = decodeURIComponent(window.location.pathname).split(';')
  if (segments.length === 1) return

  const [lastSegment] = segments.slice(-1)
  const [id] = lastSegment.split(',')

  return client.fetch(
    `*[references($id)][0].language`,
    { id }
  )
}
