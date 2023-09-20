import { Flex, Card, Text } from '@sanity/ui'
import { Flag } from './Flag'
import { getCountryFromIcu } from '../machinery/getCountryFromIcu'

/** @param {import('../types').Config} config */
export function createLanguageFieldComponent(config) {
  return function LanguageFieldComponent(props) {
    return <Language {...props} languages={config.multiLanguage.languages} />
  }
}

/** @param {{ value:string, languages: import('../types').Config['multiLanguage']['languages']}} props */
export function Language({ value = '', languages }) {
  if (!value) return <NoLanguagePresent />
    
  const { icu, title } = languages[value]

  return (
    <Card paddingX={3} paddingY={2} shadow={1} radius={2}>
      <Flex gap={3} align='center'>
        <Flag country={getCountryFromIcu(icu)} />
        <Text size={1} weight='semibold'>{title}</Text>
      </Flex>
    </Card>
  )
}

function NoLanguagePresent() {
  return (
    <Card padding={3} tone='critical' shadow={1} radius={2}>
      <Text>This is not right, this document doesn't have a language associated with it.</Text>
    </Card>
  )
} 
