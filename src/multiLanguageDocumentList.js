import S from '@sanity/desk-tool/structure-builder'
import { Flex, Box, Menu, MenuButton, MenuItem, Button } from '@sanity/ui'
import { SelectIcon } from '@sanity/icons'
import { liveDocuments } from '@kaliber/sanity-live-documents'
import { map } from 'rxjs/operators'
import React from 'react'
import Flags from 'country-flag-icons/react/3x2'
import * as rxjs from 'rxjs'
import { Title } from './Title'
import schema from 'part:@sanity/base/schema'
import { usePane, usePaneLayout } from '@sanity/desk-tool/lib/components'
import { usePaneRouter } from '@sanity/desk-tool'
import { ListPaneContent } from './machinery/sanity/ListPaneContent'
import { PaneItem } from './machinery/sanity/PaneItem'
import { useDeskToolSettings } from './machinery/sanity/useDeskToolSettings'
import pluginConfig from 'config:@kaliber/sanity-plugin-multi-language'
import * as uuid from 'uuid'

const knownLanguages = Object.keys(pluginConfig.languages)

export function multiLanguageDocumentList(listBuilder) {
  const serializedListBuilder = listBuilder.serialize()

  const emptyDoc = { _type: serializedListBuilder.schemaTypeName }
  const document$ = new rxjs.BehaviorSubject(emptyDoc)
  const component = React.memo(React.forwardRef(MultiLanguageDocumentList))
  console.log('-->', serializedListBuilder)
  return {
    ...serializedListBuilder,
    type: 'component',
    component,
    key: serializedListBuilder.id, // override the key to prevent an unmount / mount cycle
    menuItems: [
      ...serializedListBuilder.menuItems,
      {
        action: () => console.log('NL'),
        group: 'layout',
        icon: () => <div style={{ width: '1rem' }}><Flags.NL /></div>,
        showAsAction: true,
        title: 'Nederlands'
      }
    ],
    document$,
    child: translationId => document$.pipe(
      map(_doc => {
        const docValid = _doc.translationId && _doc.translationId === translationId
        const doc = docValid ? _doc : emptyDoc

        const r = getDocumentNode({ schemaType: doc._type, documentId: doc._id || uuid.v4() })
          .id(doc.translationId || translationId)
          .initialValueTemplate(serializedListBuilder.schemaTypeName, { translationId })

        return {
          ...r.serialize(),
          title: <DocumentTitle language={doc.language}>{doc.title}</DocumentTitle> // TODO: ophalen op basis van preview
        }
      })
    )
    // Ik denk dat we in de actiebalk vlaggetjes moeten plaatsen waarmee je kunt switchen voor de display van de taal (tenzij een document niet beschikbaar is in die taal)
  }
}

const defaultOrdering = { by: [{ field: '_createdAt', direction: 'desc' }] }

function MultiLanguageDocumentList(props, ref) {
  const { isActive, childItemId, schemaTypeName, displayOptions, defaultLayout = 'default', document$ } = props

  console.log('== render ==')
  console.log('props', props)
  console.log('usePane', usePane())
  console.log('usePaneRouter', usePaneRouter())
  console.log('usePaneLayout', usePaneLayout())
  console.log('== ==')

  // React.useImperativeHandle(
  //   ref,
  //   () => ({
  //     actionHandlers: {
  //       create(...args) {
  //         console.log('CREATE', args)
  //       }
  //     }
  //   }),
  //   []
  // )

  const [layout, setLayout] = useDeskToolSettings(schemaTypeName, 'layout', defaultLayout)
  const [sortOrder, setSortOrder] = useDeskToolSettings(schemaTypeName, 'sortOrder', defaultOrdering)

  // const actionHandlers: Record<string, DeskToolPaneActionHandler> = useMemo(
  //   () => ({
  //     setLayout: ({layout: value}: {layout: Layout}) => {
  //       setLayout(value)
  //     },
  //     setSortOrder: (sort: SortOrder) => {
  //       setSortOrder(sort)
  //     },
  //   }),
  //   [setLayout, setSortOrder]
  // )

  const error = null
  const documents = useLiveDocuments({ schemaType: schemaTypeName })
  const items = React.useMemo(
    () => toTranslationGroups(documents || []),
    [documents]
  )
  const renderItem = React.useCallback(
    (item) => (
      <TranslationPaneItem
        {...{ item, document$, isActive, layout }}
        icon={displayOptions.showIcons === false ? false : undefined}
        isSelected={childItemId === item.translationId}
        schemaType={schema.get(schemaTypeName)}
      />
    ),
    [childItemId, isActive, layout, displayOptions.showIcons, document$]
  )

  return <ListPaneContent
    {...{ items, error, renderItem, getItemKey }}
    onRetry={handleRetry}
    onListChange={handleListChange}
  />

  function handleListChange(...args) {
    console.log('handleListChange', args)
  }

  function handleRetry(...args) {
    console.log('handleRetry', args)
  }
}

function TranslationPaneItem({ schemaType, item, document$, isSelected, isActive, icon, layout }) {
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

      document$.next(first)
    },
    [selected, first]
  )
}

function useTranslationPreviewValue({ item, onDocumentClick, getTitle }) {
  const [first] = item.translations
  const [document, setDocument] = React.useState(first)

  const currentDocument = item.translations.find(x => x._id === document._id)
  if (currentDocument && currentDocument !== document) console.log('updating document', currentDocument) || setDocument(currentDocument)

  const onDocumentClickRef = React.useRef(null)
  onDocumentClickRef.current = onDocumentClick

  const getTitleRef = React.useRef(null)
  getTitleRef.current = getTitle
  const stableGetTitle = React.useCallback((...args) => getTitleRef.current(...args), [])

  const value = React.useMemo(
    () => ({
      title: (
        <Title
          {...{ document }}
          title={stableGetTitle(document)}
          translations={item.translations}
          onDocumentClick={doc => {
            setDocument(doc)
            onDocumentClickRef.current(doc)
          }}
        />
      ),
      // media, subtitle, description
    }),
    [document, item, onDocumentClick]
  )
  return value
}

function getItemKey(x) { return x.translationId }

function useLiveDocuments({ schemaType }) {
  const [documents, setDocuments] = React.useState(null)

  React.useEffect(
    () => {
      const documents$ = liveDocuments({ schemaType })
      const subscription = documents$.subscribe(setDocuments)
      return () => subscription.unsubscribe()
    },
    [schemaType]
  )

  return documents
}

function getDocumentNode({ schemaType, documentId }) {
  const deskToolStructure = require('part:@sanity/desk-tool/structure?') // we can not import because we are part of the desk structure

  const userNode = deskToolStructure?.getDefaultDocumentNode({ schemaType, documentId })
  const userBuilder = userNode ?? (
    typeof userNode.serialize === 'function' ? userNode : S.document(userNode)
  )

  const builder = userBuilder ?? S.document()

  const builderWithDocumentId = documentId ? builder.documentId(documentId) : builder
  return builderWithDocumentId.schemaType(schemaType)
}

function toTranslationGroups(a) {
  const byTranslationId = groupBy(a, x => x.translationId)

  const translationGroups = Object.entries(byTranslationId).map(
    ([translationId, unsortedTranslations]) => {
      const translations = filterAndSort(unsortedTranslations)

      return { translationId, translations }
    }
  )

  return translationGroups

}

function filterAndSort(translations) {
  const byLanguage = groupBy(translations, x => x.language)

  return Object.values(byLanguage)
    .map(translations => {
      const [lastUpdated] = translations.sort(lastUpdatedFirst)
      return lastUpdated
    })
    .sort(lastUpdatedFirst)
}

function lastUpdatedFirst(a, b) {
  const result = new Date(b._updatedAt).getTime() - new Date(a._updatedAt).getTime()
  return result
}

function groupBy(a, getGroupByValue) {
  return a.reduce(
    (result, x) => {
      const groupByValue = getGroupByValue(x)
      const target = result[groupByValue] || (result[groupByValue] = [])
      target.push(x)
      return result
    },
    {}
  )
}

function DocumentTitle({ children, language }) {
  const config = pluginConfig.languages[language]
  const [languagePart, countryPart] = config.icu.split('_')
  const Flag = Flags[countryPart]

  return (
    <Flex gap={4} align='center'>
      <div>{children}</div>

      <MenuButton
        id="language-switch"
        button={
          <Button
            fontSize={1}
            padding={2}
            mode='bleed'
            icon={() => <Flag style={{ width: '1em', margin: '0.2em 0', display: 'block' }} />}
            iconRight={SelectIcon}
            text={pluginConfig.languages[language].title}
          />
        }
        menu={(
          <Menu>
            {knownLanguages.map(x => {
              const config = pluginConfig.languages[x]
              const [languagePart, countryPart] = config.icu.split('_')
              const Flag = Flags[countryPart]
              return <MenuItem text={
                <Flex gap={2}>
                  <Flag style={{ width: '1em', margin: '0.2em 0', display: 'block' }} />
                  <Box>{config.title}</Box>
                </Flex>
              } />
            })}
          </Menu>
        )}
        placement='bottom'
        popover={{portal: true}}
      />
    </Flex>
  )
}