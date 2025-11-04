import { useDocumentOperation, useSchema, useClient } from 'sanity'
import apiVersion from '../apiVersion'

export function publishAndSyncAction(props) {
  const { type, id, draft } = props
  const operation = useDocumentOperation(id, type)
  const schema = useSchema()
  const client = useClient({apiVersion})
  const schemaType = schema.get(type)
  const syncFieldNames = schemaType?.options?.kaliber?.syncFieldNames ?? []
  
  if (syncFieldNames.length === 0)
    return null

  return {
    label: 'Publish & Sync',
    onHandle: async () => {
      try {
        const siblings = await querySiblings(type, draft.translationId, draft.language, client)

        if (siblings.length > 0) {
          const syncPayload = buildSyncPayload(draft, syncFieldNames)

          await syncToSiblings(siblings, syncPayload, client)
        }

        await operation.publish.execute()
      } catch (err) {
        throw new Error(`Failed to publish and sync: ${err.message}`)
      }
    },
    disabled: !draft
  }
}

/**
 * Query all sibling translations of a document
 * @param {string} documentType - Document type
 * @param {string} translationId - Translation ID to find siblings for
 * @param {string} currentLanguage - Current document's language
 * @param {any} sanityClient - Sanity client
 * @returns {Promise<Array<any>>} Array of sibling documents
 */
export async function querySiblings(documentType, translationId, currentLanguage, sanityClient) {
  try {
    if (!translationId) {
      return []
    }

    const siblings = await sanityClient.fetch(
      `*[
        _type == $type &&
        translationId == $translationId &&
        language != $currentLanguage &&
        !(_id in path("drafts.**"))
      ]`,
      {
        type: documentType,
        translationId,
        currentLanguage
      }
    )

    return siblings || []
  } catch (error) {
    throw new Error(`Failed to query sibling translations: ${error.message}`)
  }
}

/**
 * Build sync payload from fields
 * @param {any} document - Current document state
 * @param {Array<string>} syncFieldNames - Field names marked for syncing
 * @returns {Object} Payload with field values
 */
export function buildSyncPayload(document, syncFieldNames) {
  return Object.fromEntries(
    syncFieldNames.map(fieldName => [fieldName, document[fieldName]])
  )
}

/**
 * Patch all siblings with sync payload in a single transaction
 * @param {Array<any>} siblings - Array of sibling documents
 * @param {Object} payload - Payload to patch
 * @param {any} sanityClient - Sanity client
 * @returns {Promise<void>}
 */
export async function syncToSiblings(siblings, payload, sanityClient) {
  if (siblings.length === 0)
    return

  const transaction = sanityClient.transaction()

  siblings.forEach(sibling => {
    transaction.patch(sibling._id, patch => patch.set(payload))
  })

  await transaction.commit()
}
