import { useDocumentOperation, useSchema, useClient } from 'sanity'
import { buildSyncPayload } from '../utils/sync'
import { querySiblings } from '../utils/sibling'
import { syncToSiblings } from '../utils/sync'
import apiVersion from '../apiVersion'

/**
 * Document action component for "Publish & Sync"
 * Syncs shared fields to all sibling translations, then publishes the document
 */
export function publishAndSyncAction(props) {
  const { type, id, draft } = props
  const operation = useDocumentOperation(id, type)
  const schema = useSchema()
  const client = useClient(apiVersion)
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
