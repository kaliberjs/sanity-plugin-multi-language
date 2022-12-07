import React from 'react'
import { Flex, Card, Text } from '@sanity/ui'
import { Flag } from './Flag'
import { getCountryFromIcu } from './machinery/getCountryFromIcu'

const LanguageFwd = React.forwardRef(Language)

export { LanguageFwd as Language }

export function languageField(config) {
  return props => <LanguageFwd {...props} languages={config.languages} />
}

function Language({ value = '', languages }, ref) {
  if (!value) return (
    <Card padding={3} tone='critical' shadow={1} radius={2}>
      <input type='hidden' {...{ value, ref }} />
      <Text>This is not right, this document doesn't have a language associated with it.</Text>
    </Card>
  )

  const { icu, title } = languages[value]

  return (
    <Card paddingX={3} paddingY={2} shadow={1} radius={2}>
      <input type='hidden' {...{ value, ref }} />
      <Flex gap={3} align='center'>
        <Flag country={getCountryFromIcu(icu)} />
        <Text size={1} weight='semibold'>{title}</Text>
      </Flex>
    </Card>
  )
}
