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
 * @param {any} client - Sanity client
 * @returns {Promise<void>}
 */
export async function syncToSiblings(siblings, payload, client) {
  if (siblings.length === 0) {
    return // No siblings to sync
  }

  const transaction = client.transaction()

  siblings.forEach(sibling => {
    transaction.patch(sibling._id, patch => patch.set(payload))
  })

  await transaction.commit()
}
