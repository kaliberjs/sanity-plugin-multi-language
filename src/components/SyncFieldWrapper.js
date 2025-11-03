import React from 'react'
import { SyncFieldIndicator } from './SyncFieldIndicator'

/**
 * Create a field wrapper that adds the sync indicator
 * @param {React.ComponentType} BaseFieldComponent - The original field component
 * @returns {React.ComponentType} Wrapped field component with sync indicator
 */
export function createSyncFieldWrapper(BaseFieldComponent) {
  return function SyncFieldWrapper(props) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          {BaseFieldComponent ? <BaseFieldComponent {...props} /> : props.renderDefault(props)}
        </div>
        <SyncFieldIndicator isSyncField={true} />
      </div>
    )
  }
}
