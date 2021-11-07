import React from 'react'

export function useRxjsValue(rxjs$) {
  const [value, setValue] = React.useState(() => rxjs$.value)
  React.useEffect(
    () => {
      setValue(() => rxjs$.value)
      const subscription = rxjs$.subscribe(setValue)
      return () => subscription.unsubscribe()
    },
    [rxjs$]
  )

  return value
}
