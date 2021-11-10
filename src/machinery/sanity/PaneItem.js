import React from 'react'
import { Card, Text } from '@sanity/ui'
import { SanityDefaultPreview } from 'part:@sanity/base/preview'
import { usePaneRouter } from '@sanity/desk-tool'
import { FolderIcon, ChevronRightIcon } from '@sanity/icons'

export function PaneItem({
  icon, schemaType, id, pressed, selected, layout, previewValue
}) {
  const LinkComponent = useLinkComponent({ id })
  const { isSelected, handleClick } = useOptimisticSelect({ selected })

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
        selected={isSelected}
        tone="inherit"
      >
        <SanityDefaultPreview
          status={<Text muted> <ChevronRightIcon /> </Text>}
          icon={getIconWithFallback(icon, schemaType, FolderIcon)}
          layout={layout}
          value={previewValue}
        />
      </Card>
  )
}

function useLinkComponent({ id }) {
  const { ChildLink } = usePaneRouter()

  const LinkComponent = React.useMemo(
    () =>
      React.forwardRef(function LinkComponent(linkProps, ref) {
        return <ChildLink {...linkProps} childId={id} ref={ref} />
      }),
    [ChildLink, id]
  )

  return LinkComponent
}

function useOptimisticSelect({ selected }) {
  const [clicked, setClicked] = React.useState(false)
  const handleClick = React.useCallback(() => setClicked(true), [])
  // Reset `clicked` state when `selected` prop changes
  React.useEffect(() => setClicked(false), [selected])

  return { isSelected: selected || clicked, handleClick }
}

function getIconWithFallback( icon, schemaType, defaultIcon ) {
  if (icon === false) return false

  return icon || (schemaType && schemaType.icon) || defaultIcon || false
}
