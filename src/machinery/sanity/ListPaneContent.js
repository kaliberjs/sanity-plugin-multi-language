import React from 'react'
import { usePane } from '@sanity/desk-tool/lib/components'
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
import {SyncIcon} from '@sanity/icons'
import { PaneContent } from './PaneContent'
import { useShouldRender } from './useShouldRender'

const FULL_LIST_LIMIT = 2000

export function ListPaneContent({ items, renderItem, error, onRetry, onListChange, getItemKey }) {
  const shouldRender = useShouldRender()

  return (
    <PaneContent>
      {
        !shouldRender ? null :
        error ? <Error {...{ error, onRetry }} /> :
        items === null ? <LoadingDocuments /> :
        !items.length ? <NoDocuments /> :
        <List {...{ items, renderItem, onListChange, getItemKey }} />
      }
    </PaneContent>
  )
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

function List({ items, renderItem, onListChange, getItemKey }) {
  const hasMoreItems = items.length === FULL_LIST_LIMIT
  const { collapsed, index } = usePane()

  const hackRef = useHackToSetMaxWidth('500px')

  return (
    <Box ref={hackRef} padding={2}>
      <VirtualList
        gap={1}
        getItemKey={getItemKey}
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
    !ready || !children ? null :
    typeof children === 'function' ? children() :
    children
  )
}

function useHackToSetMaxWidth(maxWidth) {
  return React.useCallback(
    element => {
      const pane = findPane(element)
      if (pane) pane.style.maxWidth = maxWidth

      function findPane(element) {
        if (!element) return element
        if (element.dataset.testid === 'pane') return element
        const { parentElement } = element
        return parentElement && findPane(parentElement)
      }
    },
    []
  )
}
