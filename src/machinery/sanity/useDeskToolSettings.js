import {Observable} from 'rxjs'
import settings from 'part:@sanity/base/settings'
import React from 'react'

const deskToolSettings = settings.forNamespace('desk-tool')

export function useDeskToolSettings(namespace, key, defaultValue) {
  const [value, setValue] = React.useState(defaultValue)

  const settings = React.useMemo(
    () => deskToolSettings.forNamespace(namespace).forKey(key),
    [key, namespace]
  )
  const settingRef = React.useRef(null)
  settingRef.current = settings

  React.useEffect(
    () => {
      const subscription = settings.listen(defaultValue).subscribe(setValue)
      return () => subscription.unsubscribe()
    },
    [settings, defaultValue]
  )

  const set = React.useCallback(
    newValue => {
      setValue(newValue)
      settingRef.current.set(newValue)
    },
    []
  )

  return [value, set]
}
