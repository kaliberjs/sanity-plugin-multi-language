/**
 * Query all sibling translations of a document
 * @param {string} documentType - Document type
 * @param {string} translationId - Translation ID to find siblings for
 * @param {string} currentLanguage - Current document's language
 * @param {any} client - Sanity client
 * @returns {Promise<Array<any>>} Array of sibling documents
 */
export async function querySiblings(documentType, translationId, currentLanguage, client) {
  try {
    if (!translationId) {
      return []
    }

    const siblings = await client.fetch(
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
