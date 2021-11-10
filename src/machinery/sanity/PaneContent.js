/**
 * File copied because it stated: @beta This API will change. DO NOT USE IN PRODUCTION.
 */
import {Card} from '@sanity/ui'
import styled from 'styled-components'
import React from 'react'
import { usePane, usePaneLayout } from '@sanity/desk-tool/lib/components'

const Root = styled(Card)`
  position: relative;
  outline: none;
`
Root.displayName = 'PaneContent__root'

export function PaneContent({ children }) {
  const { collapsed } = usePane()
  const { collapsed: layoutCollapsed } = usePaneLayout()

  return (
    <Root
      data-testid="pane-content"
      flex={1}
      hidden={collapsed}
      overflow={layoutCollapsed ? undefined : 'auto'}
      tone="inherit"
    >
      {children}
    </Root>
  )
}
