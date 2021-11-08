import S from '@sanity/desk-tool/structure-builder'
import { liveDocuments } from '@kaliber/sanity-live-documents'
import { map, shareReplay } from 'rxjs/operators'
import {FolderIcon, ChevronRightIcon, DocumentIcon} from '@sanity/icons'
import React from 'react'
import * as rxjs from 'rxjs'
import { Title } from './Title'
import schema from 'part:@sanity/base/schema'
import {ComposeIcon} from '@sanity/icons'
import { PaneContent, usePane, usePaneLayout } from '@sanity/desk-tool/lib/components'
import { usePaneRouter } from '@sanity/desk-tool'
import {collate, getPublishedId} from 'part:@sanity/base/util/draft-utils'
import {
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
  VirtualList,
} from '@sanity/ui'
import { SanityDefaultPreview } from 'part:@sanity/base/preview'

import {SyncIcon} from '@sanity/icons'


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
      map(doc => getDocumentNode({ schemaType: doc._type, documentId: doc._id }).id(doc.translationId || 'unknown'))
    )
  }
}

const FULL_LIST_LIMIT = 2000
const emptyArray = []
const defaultOrdering = {by: [{field: '_createdAt', direction: 'desc'}]}

function MultiLanguageDocumentList(props, ref) {
  console.log('render')
  console.log(props)
  const { isActive, childItemId, schemaTypeName, displayOptions, defaultLayout = 'default', document$ } = props

  console.log(usePane())
  console.log(usePaneRouter())
  console.log(usePaneLayout())

  // const {childItemId, index, isActive, isSelected, pane, paneKey} = props
  // const {
  //   defaultLayout = 'default',
  //   displayOptions,
  //   initialValueTemplates = emptyArray,
  //   menuItems,
  //   menuItemGroups,
  //   options,
  //   schemaTypeName,
  //   title,
  // } = pane

  React.useEffect(
    () => {
      console.log('mount')
      return () => console.log('unmount')
    },
    []
  )

  React.useImperativeHandle(
    ref,
    () => ({
      actionHandlers: {
        // ...
      }
    }),
    []
  )

  const layout = defaultLayout
  // const [layout, setLayout] = useDeskToolSetting<Layout>(typeName, 'layout', defaultLayout)

  const sortOrder = defaultOrdering
  // const [sortOrderRaw, setSortOrder] = useDeskToolSetting<SortOrder>(
  //   typeName,
  //   'sortOrder',
  //   DEFAULT_ORDERING
  // )
  // const sortOrder = useUnique(sortOrderRaw)

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
  const {collapsed: layoutCollapsed} = usePaneLayout()
  const shouldRender = useShouldRender()

  const renderItem = React.useCallback(
    (item) => {
      const isSelected = childItemId === item.translationId
      const pressed = !isActive && isSelected
      const selected = isActive && isSelected

      return (
        <PaneItem
          {...{ document$ }}
          icon={displayOptions.showIcons === false ? false : undefined}
          id={item.translationId}
          pressed={pressed}
          selected={selected}
          layout={layout}
          schemaType={schema.get(item._type)}
          value={item}
        />
      )
    },
    [childItemId, isActive, layout, displayOptions.showIcons, document$]
  )

  return (
    <PaneContent overflow={layoutCollapsed ? undefined : 'auto'}>
      {
        !shouldRender ? null :
        error ? <Error {...{ error, onRetry: handleRetry }} /> :
        items === null ? <LoadingDocuments /> :
        !items.length ? <NoDocuments /> :
        <List {...{ items, renderItem, onListChange: handleListChange, getDocumentKey }} />
      }
    </PaneContent>
  )

  function handleListChange(...args) {
    console.log('handleListChange')
    console.log(args)
  }

  function handleRetry(...args) {
    console.log('handleRetry')
    console.log(args)
  }
}

function getDocumentKey(value, index) {
  return value._id ? getPublishedId(value._id) : `item-${index}`
}

function PaneItem({ icon, schemaType, id, pressed, selected, layout, value, document$}) {
  const {ChildLink} = usePaneRouter()

  const LinkComponent = React.useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-shadow
      React.forwardRef(function LinkComponent(linkProps, ref) {
        return <ChildLink {...linkProps} childId={id} ref={ref} />
      }),
    [ChildLink, id]
  )
  const [clicked, setClicked] = React.useState(false)
  const handleClick = React.useCallback(() => setClicked(true), [])
  // Reset `clicked` state when `selected` prop changes
  React.useEffect(() => setClicked(false), [selected])

  const [first] = value.translations
  const [document, setDocument] = React.useState(first)

  React.useEffect(
    () => {
      if (!selected) return

      document$.next(first)
    },
    [selected, first]
  )

  return (
    <Card
        __unstable_focusRing
        as={LinkComponent}
        data-as="a"
        data-ui="PaneItem"
        padding={2}
        radius={2}
        onClick={handleClick}
        pressed={pressed}
        selected={selected || clicked}
        tone="inherit"
      >
        <SanityDefaultPreview
          status={
            <Text muted>
              <ChevronRightIcon />
            </Text>
          }
          icon={getIconWithFallback(icon, schemaType, FolderIcon)}
          layout={layout}
          value={{
            title: (
              <Title
                {...{ titleField: 'titel', document }}
                translations={value.translations}
                onDocumentClick={doc => {
                  setDocument(doc)
                  document$.next(doc)
                }}
              />
            )
          }}
        />
      </Card>
  )
}

function getIconWithFallback( icon, schemaType, defaultIcon, ) {
  if (icon === false) return false

  return icon || (schemaType && schemaType.icon) || defaultIcon || false
}


function NoDocuments() {
  return (
    <Flex align="center" direction="column" height="fill" justify="center">
      <Container width={1}>
        <Box paddingX={4} paddingY={5}>
          <Text align="center" muted size={2}>
              No matching documents
          </Text>
        </Box>
      </Container>
    </Flex>
  )
}

function useShouldRender() {
  const { collapsed } = usePane()
  const [shouldRender, setShouldRender] = React.useState(false)

  React.useEffect(
    () => {
      if (collapsed) return

      const timer = setTimeout(() => { setShouldRender(true) }, 0)

      return () => { clearTimeout(timer) }
    },
    [collapsed]
  )

  return shouldRender
}

function Error({ error, onRetry }) {
  return (
    <Flex align="center" direction="column" height="fill" justify="center">
      <Container width={1}>
        <Stack paddingX={4} paddingY={5} space={4}>
          <Heading as="h3">Could not fetch list items</Heading>
          <Text as="p">
            Error: <code>{error.message}</code>
          </Text>
          {onRetry && (
            <Box>
              {/* eslint-disable-next-line react/jsx-handler-names */}
              <Button icon={SyncIcon} onClick={onRetry} text="Retry" tone="primary" />
            </Box>
          )}
        </Stack>
      </Container>
    </Flex>
  )
}

function LoadingDocuments() {
  return (
    <Flex align="center" direction="column" height="fill" justify="center">
      <Delay ms={300}>
        <>
          <Spinner muted />
          <Box marginTop={3}>
            <Text align="center" muted size={1}>
              Loading documents…
            </Text>
          </Box>
        </>
      </Delay>
    </Flex>
  )
}

function List({ items, renderItem, onListChange }) {
  const hasMoreItems = items.length === FULL_LIST_LIMIT
  const {collapsed, index} = usePane()
  return (
    <Box padding={2}>
      <VirtualList
        gap={1}
        getItemKey={x => x.translationId}
        items={items}
        renderItem={renderItem}
        onChange={onListChange}
        // prevents bug when panes won't render if first rendered while collapsed
        key={`${index}-${collapsed}`}
      />

      {hasMoreItems && (
        <Card marginTop={1} paddingX={3} paddingY={4} radius={2} tone="transparent">
          <Text align="center" muted size={1}>
            Displaying a maximum of {FULL_LIST_LIMIT} documents
          </Text>
        </Card>
      )}
    </Box>
  )
}

function removePublishedWithDrafts(documents) {
  return collate(documents).map((entry) => {
    const doc = entry.draft || entry.published
    return {
      ...doc,
      hasPublished: !!entry.published,
      hasDraft: !!entry.draft,
    }
  })
}

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

function Delay({ children, ms = 0, }) {
  const [ready, setReady] = React.useState(ms <= 0)

  React.useEffect(
    () => {
      if (ms <= 0) return

      const timeoutId = setTimeout(() => setReady(true), ms)

      return () => { clearTimeout(timeoutId) }
    },
    [ms]
  )

  return (
    !ready || !children ? <></> :
    typeof children === 'function' ? children() :
    children
  )
}


//   const type = schema.get(schemaType)
//   /** @type {rxjs.Observable<any>} - you can remove this in your spare time */
//   const documents$ = liveDocuments({ schemaType })
//   const liveTranslationGroups = documents$
//     .pipe(
//       map(toTranslationGroups),
//       shareReplay({ bufferSize:1, refCount: false })
//     )

//   return liveTranslationGroups.pipe(
//     map(translations =>
//       S.list(spec).id(id)
//         .items(
//           translations.map(({ translations, translationId }) => {
//             const [first] = translations

//             const document$ = new rxjs.BehaviorSubject(first)

//             const title = (
//               <Title
//                 {...{ titleField, document$, translations }}
//                 onDocumentClick={doc => document$.next(doc)}
//               />
//             )
//             const child = document$.pipe(
//               map(doc => getDocumentNode({ schemaType, documentId: doc._id }).id(translationId))
//             )
//             /** @type {any} - you can remove this in your spare time */
//             const listItem = { id: translationId, child, title, type: 'listItem' }
//             return listItem
//           })
//         )
//     ),
//     shareReplay({ bufferSize: 1, refCount: false })
//   )
// }

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
      const [first] = translations

      return {
        translationId,
        translations,
      }
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
