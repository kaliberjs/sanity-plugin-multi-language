import React from 'react'
import { Flex } from '@sanity/ui'
import { TranslationMenu } from './TranslationMenu'

export function DocumentTitle({ children, document$, language, schemaTypeName, translationId }) {
  return (
    <Flex gap={4} align='center'>
      <div>{children}</div>
      <TranslationMenu {...{ children, document$, language, schemaTypeName, translationId }} />
    </Flex>
  )
}

