import S from '@sanity/desk-tool/structure-builder'
import { liveDocuments } from '@kaliber/sanity-live-documents'
import { map } from 'rxjs/operators'
import React from 'react'
import * as rxjs from 'rxjs'
import { Title } from './Title'
import schema from 'part:@sanity/base/schema'
import { usePane, usePaneLayout } from '@sanity/desk-tool/lib/components'
import { usePaneRouter } from '@sanity/desk-tool'
import { ListPaneContent } from './machinery/sanity/ListPaneContent'
import { PaneItem } from './machinery/sanity/PaneItem'
import { useDeskToolSettings } from './machinery/sanity/useDeskToolSettings'

export function multiLanguageDocumentList(listBuilder) {
  const serializedListBuilder = listBuilder.serialize()

  const document$ = new rxjs.BehaviorSubject({ _type: serializedListBuilder.schemaTypeName })
  const component = React.memo(React.forwardRef(MultiLanguageDocumentList))
  return {
    ...serializedListBuilder,
    type: 'component', component,
    key: serializedListBuilder.id, // override the key to prevent an unmount / mount cycle
    document$,
    child: document$.pipe(
      map(doc =>
        getDocumentNode({ schemaType: doc._type, documentId: doc._id })
          .id(doc.translationId || 'unknown')
      )
    )
    // Ik denk dat we in de actiebalk vlaggetjes moeten plaatsen waarmee je kunt switchen voor de display van de taal (tenzij een document niet beschikbaar is in die taal)
  }
}

const defaultOrdering = {by: [{field: '_createdAt', direction: 'desc'}]}

function MultiLanguageDocumentList(props, ref) {
  console.log('render')
  console.log(props)
  const { isActive, childItemId, schemaTypeName, displayOptions, defaultLayout = 'default', document$ } = props

  console.log(usePane())
  console.log(usePaneRouter())
  console.log(usePaneLayout())

  React.useImperativeHandle(
    ref,
    () => ({
      actionHandlers: {
        // ...
      }
    }),
    []
  )

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
    console.log('handleListChange')
    console.log(args)
  }

  function handleRetry(...args) {
    console.log('handleRetry')
    console.log(args)
  }
}

function TranslationPaneItem({ schemaType, item, document$, isSelected, isActive, icon, layout }) {
  const pressed = !isActive && isSelected
  const selected = isActive && isSelected

  useSetDocumentOnSelect({ selected, item, document$})
  const previewValue = useTranslationPreviewValue({
    item,
    getTitle: doc => doc.titel, // determine title field using schema preview
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
