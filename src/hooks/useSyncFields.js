import { useSchema } from 'sanity'
import { findSyncFields } from '../utils/fieldDetection'

/**
 * Hook to get sync fields for a document type
 * @param {string} documentType - The document type name
 * @returns {Array<any>} Array of fields marked with syncAcrossTranslations: true
 */
export function useSyncFields(documentType) {
  const schema = useSchema()
  const schemaType = schema.get(documentType)

  return findSyncFields(schemaType)
}
