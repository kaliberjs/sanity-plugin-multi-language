import React from 'react'
import { Box, Tooltip, Text } from '@sanity/ui'
import { SyncIcon } from '@sanity/icons'

/**
 * Create a field wrapper that adds the sync indicator
 * @param {React.ComponentType} BaseComponent - The input component to wrap
 * @returns {React.ComponentType} Wrapped component with sync indicator
 */
export function createSyncFieldWrapper(BaseComponent) {
  return function SyncFieldWrapper(props) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <BaseComponent {...props} />
        </div>
        <SyncFieldIndicator />
      </div>
    )
  }
}

/**
 * Component to display sync indicator for fields marked with syncAcrossTranslations
 * @returns {React.ReactNode} Sync icon with tooltip
 */
export function SyncFieldIndicator() {
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
        <SyncIcon />
      </Box>
    </Tooltip>
  )
}
