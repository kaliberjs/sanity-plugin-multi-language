import React from 'react'
import { usePane } from '@sanity/desk-tool/lib/components'

export function useShouldRender() {
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
