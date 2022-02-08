// TODO: @Peeke, hier meer sanity ui gebruiken?

import React from 'react'
import * as uuid from 'uuid'
import groq from 'groq'
import Preview from 'part:@sanity/base/preview'
import { IntentLink } from 'part:@sanity/base/router'
import schema from 'part:@sanity/base/schema'
import { typeHasLanguage } from '../schema/typeHasLanguage'
import pluginConfig from 'config:@kaliber/sanity-plugin-multi-language'
// Ik denk dat we hier een plugin voor moeten hebben (misschien ook niet en denk ik wel te moeilijk)
// import { reportError } from '../../../machinery/reportError'
import { Dialog, Stack, Card, Flex, Grid, Box, Text, Menu, MenuButton, MenuItem, Button } from '@sanity/ui'
import { AddIcon } from '@sanity/icons'
import { SelectIcon } from '@sanity/icons'
import Flags from 'country-flag-icons/react/3x2'
import sanityClient from 'part:@sanity/base/client'
import { liveDocuments } from '@kaliber/sanity-live-documents'

const knownLanguages = Object.keys(pluginConfig.languages)

function reportError(e) {
  console.error(e)
  // TODO: report to rollbar
}

export function TranslationMenu({ document$, language, schemaTypeName, translationId }) {
  const config = pluginConfig.languages[language]
  const [languagePart, countryPart] = config ? config.icu.split('_') : []
  const Flag = Flags[countryPart]

  const translationLookup = useTranslationLookup({ translationId })
  const [modalMissingTranslations, setModalMissingTranslations] = React.useState(null)
  const [modalTranslationMode, setModalTranslationMode] = React.useState(null)

  console.log({ translationLookup })
  if (!config) return null

  return (
    <>
      <MenuButton
        id="language-switch"
        button={
          <Button
            fontSize={1}
            padding={2}
            mode='bleed'
            icon={() => <Flag style={{ width: '1em', margin: '0.2em 0', display: 'block' }} />}
            iconRight={SelectIcon}
            text={pluginConfig.languages[language].title}
          />
        }
        menu={(
          <Menu>
            {knownLanguages.map(language => {
              const translation = translationLookup[language]
              return translation
                ? (// TODO: we willen deze variant ook tonen wanneer we een nieuwe aan het maken zijn in de huidige taal. Onclick mag dan uitgezet worden
                  <FlagMenuItem
                    key={language}
                    determineTitle={x => x.title}
                    {...{ language }}
                    onClick={_ => document$.next(translation)}
                  />
                )
                : (
                  <FlagMenuItem
                    determineTitle={x => <>{x.title} <AddIcon /></>}
                    onClick={() => setModalTranslationMode({ language })}
                    muted
                    {...{ language }}
                  />
                )
            })}
          </Menu>
        )}
        placement='bottom'
        popover={{portal: true}}
      />

      {modalTranslationMode && (
        <TranslationModeDialog
          language={modalTranslationMode.language}
          onClose={() => setModalTranslationMode(null)}
          onDuplicate={language => {
            translateDuplicate({ original: document$.getValue(), language })
              .then(({ status, data }) => {
                if (status === 'success') return
                if (status === 'untranslatedReferencesFound')
                  return showUntranslatedReferences(data)
              })
              .catch(reportError)
          }}
          onNewDocument={language => {
            createNewDocumentAndSetActive({ language }).catch(reportError)
          }}
        />
      )}

      {modalMissingTranslations && (
        <MissingTranslationsDialog
          documents={modalMissingTranslations.references}
          onClose={() => setModalMissingTranslations(null)}
          canContinueWithoutReferences={modalMissingTranslations.cleanDuplicate}
          onContinue={() => {
            translateDuplicateWithoutReferences({ original: modalMissingTranslations.cleanDuplicate, language: modalMissingTranslations.language })
              .catch(reportError)
              .then(_ => setModalMissingTranslations(null))
          }}
        />
      )}
    </>
  )

  async function createNewDocumentAndSetActive({ language }) {
    const schemaType = schema.get(schemaTypeName)
    const newDoc = {
      _type: schemaTypeName,
      _id: `drafts.${uuid.v4()}`,
      ...(await schemaType.initialValue({ language, translationId }))
    }
    console.log({ newDoc })

    document$.next(newDoc)
  }

  function showUntranslatedReferences(data) {
    const { references, cleanDuplicate, language } = data
    setModalMissingTranslations({ references, cleanDuplicate, language })
  }
}

function FlagMenuItem({ language, onClick, determineTitle, muted }) {
  const config = pluginConfig.languages[language]
  const [languagePart, countryPart] = config ? config.icu.split('_') : []
  const Flag = Flags[countryPart]

  return (
    <MenuItem
      {...{ onClick }}
      text={
        <Flex gap={2} align='center' paddingRight={2}>
          <Flag style={{ width: '1em', margin: '0.2em 0', display: 'block' }} />
          <Text {...{ muted }}>{determineTitle(config)}</Text>
        </Flex>
      }
    />
  )
}

function useLiveDocuments({ filter }) {
  const [documents, setDocuments] = React.useState(null)

  React.useEffect(
    () => {
      const documents$ = liveDocuments({ filter })
      const subscription = documents$.subscribe(setDocuments)
      return () => subscription.unsubscribe()
    },
    [filter]
  )

  return documents
}

function useTranslationLookup({ translationId }) {
  const translations = useLiveDocuments({ filter: `translationId == '${translationId}'` })
  if (!translations) return {}

  return translationsAsLookup(translations)
}

function translationsAsLookup(translations) {
  return translations.reduce(
    (result, translation) => {
      if (!translation.language) throw new Error(`Found translation without a language:\n${JSON.stringify(translation, null, 2)}`)
      return { ...result, [translation.language]: translation }
    },
    {}
  )
}

function EditLink({ document, schemaType }) {

  return (
    <IntentLink
      intent='edit'
      params={{ id: document.translationId, type: document._type }}
      style={{ textDecoration: 'none' }}
    >
      <Button as='span' mode='ghost' paddingY={2} radius={2} shadow={1} paddingRight={4}>
        <Preview value={document} type={schemaType} />
      </Button>
    </IntentLink>
  )
}

function TranslationModeDialog({ language, onClose, onDuplicate, onNewDocument }) {
  const { title, adjective } = pluginConfig.languages[language]
  return (
    <Dialog 
      width={1}
      header='Vertaling aanmaken' 
      children={
        <Box padding={4}>
          <Text>Dit document is nog niet vertaald in het <strong>{title}</strong>. Wil je een <strong>{adjective}</strong> kopie maken op basis van dit document, of begin je liever met een schone lei?</Text>
        </Box>
      }
      footer={
        <Grid columns={2} gap={2} paddingX={4} paddingY={3}>
          <Button flex={1} onClick={_ => onNewDocument(language)} mode='bleed' style={{ textAlign: 'center' }}>Nieuw document</Button>
          <Button flex={1} onClick={_ => onDuplicate(language)} tone='positive' style={{ textAlign: 'center' }}>Kopie</Button>
        </Grid>
      } 
      {...{ onClose }}
    />
  )
}

function MissingTranslationsDialog({ documents, onClose, canContinueWithoutReferences, onContinue }) {
  return (
    <Dialog
      width={1}
      header='Let op!'
      footer={
        <Grid columns={2} gap={2} paddingX={4} paddingY={3}>
          <Button onClick={onClose} mode='ghost' style={{ textAlign: 'center' }}>Cancel</Button>
          {canContinueWithoutReferences && <Button tone='critical' onClick={onContinue} style={{ textAlign: 'center' }}>Continue</Button>}
        </Grid>
      }
      {...{ onClose }}
    >
      <Box padding={4}>
        <Stack space={4}>
          <Text>
            Niet alle gekoppelde documenten hebben een gepubliceerde vertaling:
          </Text>
          <ul style={{ listStyleType: 'none', margin: 0, padding: 0 }}>
            {documents.map(document => (
              <li key={document._id}>
                <EditLink {...{ document }} schemaType={schema.get(document._type)} />
              </li>
            ))}
          </ul>

          {canContinueWithoutReferences && (
            <Text>De missende documentvertalingen zijn niet verplicht. Kies voor <strong>toch doorgaan</strong> om een vertaling van dit document aan te maken zonder deze gekoppelde documenten.</Text>
          )}

          <Text size={1} muted>
            Als je te maken hebt met te veel (of circulaire) koppelingen kun je er ook voor kiezen om een nieuw document aan te maken.
          </Text>
        </Stack>
      </Box>
    </Dialog>
  )
}

async function translateDuplicate({ original, language }) {
  const { status, data } = await addDuplicatedTranslation({ original, language })
  if (['success', 'untranslatedReferencesFound'].includes(status)) return { status, data }
  throw new Error(`Failed to create duplicate translation (${status})`)
}

async function translateDuplicateWithoutReferences({ original, language }) {
  const { status, data } = await addDuplicatedTranslation({ original, language })
  if (status === 'success') return { status, data }
  throw new Error(`Failed to create duplicate translation without references (${status})`)
}

async function addDuplicatedTranslation({ original, language }) {
  const untranslatedReferences = await findUntranslatedReferences({ document: original, language })

  if (untranslatedReferences.length) return untranslatedReferencesFound(untranslatedReferences)

  return {
    status: 'success',
    data: await createDuplicateTranslation({ original, language })
  }

  async function untranslatedReferencesFound(untranslatedReferences) {
    const duplicate = removeExcludedReferences(original, untranslatedReferences.map(x => x._id))
    // @peeke dit gaf 1 of andere asset error, alsof `validateDocument` niet goed wordt aangeroepen, dit was de error:
    // content[_key==\"34d3889b69ce\"].slides[_key==\"0dcf19edabae\"].asset: Exception occurred while validating value: `getDocumentExists` was not provided in validation context
    // const valid = (await validateDocument(duplicate, schema)).every(x => console.log(x) || x.level !== 'error')

    return {
      status: 'untranslatedReferencesFound',
      data: {
        references: untranslatedReferences,
        cleanDuplicate: duplicate,
        language
      }
    }
  }
}

async function createDuplicateTranslation({ original, language }) {
  const { _id, _createdAt, _rev, _updatedAt, ...document } = original
  const { translationId } = document

  const [, duplicate] = await Promise.all([
    sanityClient.patch(_id).setIfMissing({ translationId }).commit(), // TODO: kan dit echt gebeuren?
    sanityClient.create({
      ...(await pointReferencesToTranslatedDocument(document, language)),
      _id: 'drafts.' + uuid.v5([language, original._id].join('.'), uuid.v5.URL),
      translationId,
      language
    })
  ])

  return duplicate
}

async function findUntranslatedReferences({ document, language }) {
  const referenceIds = getReferences(document).map(x => x._ref)
  const references = await sanityClient.fetch(
    groq`*[_id in $ids] { title, translationId, _type, _id }`,
    { ids: referenceIds }
  )

  const untranslatedReferences = (
    await Promise.all(
      references
        .filter(x => typeHasLanguage(x._type))
        .map(async x => {
          const count = await sanityClient.fetch(
            groq`count(*[translationId == $translationId && language == $language])`,
            { translationId: x.translationId, language }
          )

          return count > 0 ? null : x
        })
    )
  ).filter(Boolean)

  return untranslatedReferences
}

function getReferences(data) {
  if (!data || typeof data !== 'object') return []
  if (isReference(data)) return [data]

  return Object.values(data).flatMap(getReferences)
}

async function pointReferencesToTranslatedDocument(data, language) {
  if (!data || typeof data !== 'object') return data
  if (isReference(data)) return pointToTranslatedDocument(data, language)

  if (Array.isArray(data))
    return Promise.all(data.map(x => pointReferencesToTranslatedDocument(x, language)))

  return sequentialMapValuesAsync(
    data,
    async value => pointReferencesToTranslatedDocument(value, language)
  )
}

async function pointToTranslatedDocument(reference, language) {
  const { _type, translationId } = await sanityClient.fetch(
    groq`*[_id == $ref][0] { _type, translationId }`,
    { ref: reference._ref }
  )

  if (!typeHasLanguage(_type)) return reference // This document is not translatable (e.g.: images)

  const id = await sanityClient.fetch(
    groq`*[translationId == $translationId && language == $language][0]._id`,
    { translationId, language }
  )

  if (!id) throw new Error('Cannot translate reference with id ' + reference._ref)

  return { ...reference, _ref: id }
}

function isReference(x) { return Boolean(x) && typeof x === 'object' && x._ref }

async function sequentialMapValuesAsync(obj, asyncMapFn) {
  return Object.entries(obj).reduce(
    async (resultPromise, [key, value], ...rest) => {
      const result = await resultPromise
      result[key] = await asyncMapFn(value, ...rest)
      return result
    },
    Promise.resolve({})
  )
}

function mapValues(o, f) {
  return Object.entries(o).reduce(
    (result, [k, v]) => (result[k] = f(v, k, o), result),
    {}
  )
}

function removeExcludedReferences(data, exclude) {
  if (!data || typeof data !== 'object') return data
  if (isReference(data) && exclude.includes(data._ref)) return { _type: data._type }

  return Array.isArray(data)
    ? data.map(x => removeExcludedReferences(x, exclude)).filter(Boolean)
    : mapValues(data, x => removeExcludedReferences(x, exclude))
}
