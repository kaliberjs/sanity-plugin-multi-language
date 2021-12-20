import React from 'react'
import { PaneItem } from '../machinery/sanity/PaneItem'
import { Box } from '@sanity/ui'
import pluginConfig from 'config:@kaliber/sanity-plugin-multi-language'

export function TranslationPaneItem({ schemaType, item, document$, isSelected, isActive, icon, layout }) {
  const pressed = !isActive && isSelected
  const selected = isActive && isSelected

  useSetDocumentOnSelect({ selected, item, document$ })
  const previewValue = useTranslationPreviewValue({
    item,
    getTitle: doc => doc.title, // determine title field using schema preview
    onDocumentClick: doc => document$.next(doc)
  })
  return (
    <PaneItem
      {...{ schemaType, icon, pressed, selected, layout, previewValue }}
      id={item.translationId}
    />
  )
}

function useSetDocumentOnSelect({ item, selected, document$ }) {
  const [first] = item.translations

  React.useEffect(
    () => {
      if (!selected) return
      console.log('setting document as effect')
      document$.next(first)
    },
    [selected, first]
  )
}

function useTranslationPreviewValue({ item, onDocumentClick, getTitle }) {
  // if we want to be able to select another preview language this needs to change
  const document = item.translations.find(x => x.language === pluginConfig.defaultLanguage)
  const getTitleRef = React.useRef(null)
  getTitleRef.current = getTitle
  const stableGetTitle = React.useCallback((...args) => getTitleRef.current(...args), [])

  const value = React.useMemo(
    () => ({
      title: <Title title={stableGetTitle(document)} />,
      // media, subtitle, description
    }),
    [document, item, onDocumentClick]
  )
  return value
}

function Title({ title }) {
  return (
    <Box style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {title}
    </Box>
  )
}
