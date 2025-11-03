/**
 * Detect fields with syncAcrossTranslations flag in a schema type
 * @param {any} schemaType - The schema type definition
 * @returns {Array<any>} Array of fields with syncAcrossTranslations: true
 */
export function findSyncFields(schemaType) {
  if (!schemaType || !schemaType.fields) {
    return []
  }

  return schemaType.fields.filter(field => field.syncAcrossTranslations === true)
}

/**
 * Check if a schema type has any sync fields
 * @param {any} schemaType - The schema type definition
 * @returns {boolean} True if the schema has fields marked for syncing
 */
export function hasSyncFields(schemaType) {
  return findSyncFields(schemaType).length > 0
}

/**
 * Get the names of sync fields
 * @param {any} schemaType - The schema type definition
 * @returns {Array<string>} Array of field names marked for syncing
 */
export function getSyncFieldNames(schemaType) {
  return findSyncFields(schemaType).map(field => field.name)
}
