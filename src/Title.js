import React from 'react'
import { Box } from '@sanity/ui'
import pluginConfig from 'config:@kaliber/sanity-plugin-multi-language'

const knownLanguages = Object.keys(pluginConfig.languages)

export function Title({ title }) {
  return (
    <Box style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {title}
    </Box>
  )
}
