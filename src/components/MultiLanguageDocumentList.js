import { liveDocuments } from '@kaliber/sanity-live-documents'
import React from 'react'
import schema from 'part:@sanity/base/schema'
import { usePane, usePaneLayout } from '@sanity/desk-tool/lib/components'
import { usePaneRouter } from '@sanity/desk-tool'
import { ListPaneContent } from '../machinery/sanity/ListPaneContent'
import { useDeskToolSettings } from '../machinery/sanity/useDeskToolSettings'
import * as uuid from 'uuid'
import { TranslationPaneItem } from './TranslationPaneItem'

const defaultOrdering = { by: [{ field: '_createdAt', direction: 'desc' }] }

export function MultiLanguageDocumentList(props, ref) {
  const { isActive, childItemId, schemaTypeName, displayOptions, defaultLayout = 'default', document$ } = props

  console.log('== render ==')
  console.log('props', props)
  console.log('usePane', usePane())
  console.log('usePaneRouter', usePaneRouter())
  console.log('usePaneLayout', usePaneLayout())
  console.log('== ==')

  const { layout, sortOrder } = useActionHandlers(ref, { schemaTypeName, defaultLayout, defaultOrdering })

  // { message: string }
  const [error, setError] = React.useState(null)

  const documents = useLiveDocuments({ schemaType: schemaTypeName, sortOrder })
  const items = React.useMemo(() => toTranslationGroups(documents || []), [documents])

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
  const handleRetry = React.useCallback(() => setError(null), [])
  const handleListChange = React.useCallback(() => {/* don't think we need virtual list update */}, [])

  return <ListPaneContent
    {...{ items, error, renderItem, getItemKey }}
    onRetry={handleRetry}
    onListChange={handleListChange}
  />
}

function getItemKey(x) { return x.translationId }

function useActionHandlers(ref, { schemaTypeName, defaultLayout, defaultOrdering }) {
  const { setPayload } = usePaneRouter()
  const [layout, setLayout] = useDeskToolSettings(schemaTypeName, 'layout', defaultLayout)
  const [sortOrder, setSortOrder] = useDeskToolSettings(schemaTypeName, 'sortOrder', defaultOrdering)

  React.useImperativeHandle(
    ref,
    () => {
      // make sure we re-render the pane when providing actionhandlers
      // https://github.com/sanity-io/sanity/issues/3025
      setPayload({ forceRerender: uuid.v4() })
      return {
        actionHandlers: {
          setLayout({layout }) { setLayout(layout) },
          setSortOrder(sort) { setSortOrder(sort) },
        }
      }
    },
    []
  )

  return { layout, sortOrder }
}

function useLiveDocuments({ schemaType, sortOrder }) {
  if (process.env.NODE_ENV !== 'production' && sortOrder.extendedProjection)
    console.warn(`Multilanguage pane does not support 'extendedProjection': ${JSON.stringify(sortOrder.extendedProjection)}`)

  const [documents, setDocuments] = React.useState(null)

  const order = React.useMemo(
    () => toOrderClause(sortOrder.by),
    [sortOrder]
  )

  React.useEffect(
    () => {
      const documents$ = liveDocuments({ filter: `_type == '${schemaType}'`, order })
      const subscription = documents$.subscribe(setDocuments)
      return () => subscription.unsubscribe()
    },
    [schemaType, order]
  )

  return documents

  function toOrderClause(orderBy) {
    return orderBy
      .map(x => [x.field, (x.direction || '').toLowerCase()].filter(Boolean).join(' '))
      .join(',')
  }
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
