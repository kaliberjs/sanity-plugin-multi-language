import React from 'react'
import { Box, Tooltip, Text } from '@sanity/ui'

/**
 * Component to display sync indicator for fields marked with syncAcrossTranslations
 * @param {Object} props
 * @param {boolean} props.isSyncField - Whether this field is marked for syncing
 * @returns {React.ReactNode} Sync icon with tooltip, or null if not a sync field
 */
export function SyncFieldIndicator({ isSyncField }) {
  if (!isSyncField) {
    return null
  }

  return (
    <Tooltip
      content={
        <Box padding={2}>
          <Text size={1} muted>
            Synced across all translations
          </Text>
        </Box>
      }
      placement="top"
      portal
    >
      <Box display="inline-block" paddingLeft={2} style={{ fontSize: '20px' }}>
        ⟳
      </Box>
    </Tooltip>
  )
}
