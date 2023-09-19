import { v4 as uuid } from 'uuid'
import { createLanguageFieldComponent } from './components/Language'
import apiVersion from './apiVersion'

/** @param {import('./types').Config} config */
export function addFields(config) {
  const languageCount = Object.values(config.multiLanguage.languages ?? {}).length

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
            field: createLanguageFieldComponent(config)
          },
          hidden: languageCount <= 1,
          initialValue: async (_, context) => {
            const client = context.getClient({ apiVersion })
            return (
              (await getParentRefLanguageHack(client)) ?? 
              (await config.getDefaultLanguage?.({ sanityClient: client })) ??
              config.multiLanguage.defaultLanguage
            )
          },
        },
        {
          title: 'Vertalings ID',
          name: 'translationId',
          type: 'string',
          of: [{ type: 'string' }],
          readOnly: true,
          hidden: ({ currentUser }) => !currentUser.roles.some((x) => x.name === 'administrator'),
          initialValue: () => uuid(),
          kaliberOptions: { // TODO: this seems to come from @kaliber/sanity-plugin-duplicate, I don't tink introducing new keys on types is a good idea. Especially since Sanity is moving towards more strictly typed code
            duplicate: () => uuid()
          }
        },
        ...type.fields ?? []
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
