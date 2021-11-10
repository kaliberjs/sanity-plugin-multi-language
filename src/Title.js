import React from 'react'
import Flags from 'country-flag-icons/react/3x2'
import { Flex, Box } from '@sanity/ui'
import pluginConfig from 'config:@kaliber/sanity-plugin-multi-language'
import { useRxjsValue } from './machinery/useRxjsValue'
import {usePaneRouter} from '@sanity/desk-tool'

const knownLanguages = Object.keys(pluginConfig.languages)

export function Title({ title, document, translations, onDocumentClick }) {
  return (
    <Flex gap={4} justify='space-between'>
      <Box flex='1 1' style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </Box>

      <Box flex='0 0 auto'>
        <Languages {...{ translations, onDocumentClick }} selectedLanguage={document.language} />
      </Box>
    </Flex>
  )
}

function Languages({ translations, onDocumentClick, selectedLanguage }) {
  const documentsByLanguage = translations.reduce(
    (result, document) => {
      return { ...result, [document.language]: document }
    },
    {}
  )

  const documentsWithKnownLanguage = knownLanguages
    .map(x => documentsByLanguage[x])
    .filter(Boolean)

  return (
    <Flex gap={1}>
      {documentsWithKnownLanguage.map(document =>
        <Language
          key={document._id}
          isDraft={document._id?.startsWith('drafts.')}
          isSelected={selectedLanguage === document.language}
          language={document.language}
          onClick={() => { onDocumentClick(document) }}
        />
      )}
    </Flex>
  )
}

function Language({ language, onClick, isDraft, isSelected }) {
  const config = pluginConfig.languages[language]
  const [languagePart, countryPart] = config.icu.split('_')
  const Flag = Flags[countryPart]

  return (
    <Box>
      <button type='button' {...{ onClick }} style={{ appearance: 'none', border: !isSelected && 0, background: 'transparent', padding: 0, width: '1.5rem', opacity: isDraft ? 0.33 : 1 }}>
        <Flag title={language} />
      </button>
    </Box>
  )
}
