import React from 'react'
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from 'react-query'
import * as uuid from 'uuid'
import groq from 'groq'
import { validateDocument } from '@sanity/validation'
import sanityClient from 'part:@sanity/base/client'
import Preview from 'part:@sanity/base/preview'
import { IntentLink } from 'part:@sanity/base/router'
import schema from 'part:@sanity/base/schema'
import Dialog from 'part:@sanity/components/dialogs/confirm'
import pluginConfig from 'config:@kaliber/sanity-plugin-multi-language'

import { Button, MenuButton, Menu, MenuItem, Container, Stack, Flex, Card, Text, Select } from '@sanity/ui'
import { ComposeIcon, CopyIcon } from '@sanity/icons'

// Ik denk dat we hier een plugin voor moeten hebben (misschien ook niet en denk ik wel te moeilijk)
// import { reportError } from '../../../machinery/reportError'
import styles from './Translations.css'

function reportError(e) {
  console.error(e)
  // TODO: report to rollbar
}

const queryClient = new QueryClient()

export { TranslationsWithQueryClient as Translations }
function TranslationsWithQueryClient({ document }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Translations {...{ document }} />
    </QueryClientProvider>
  )
}

export function typeHasLanguage(type) {
  return schema.get(type).fields.some(x => x.name === 'language')
}

function Translations({ document: { displayed: document, draft, published } }) {
  const [modal, setModal] = React.useState(null)
  const schemaType = schema.get(document._type)

  const queryClient = useQueryClient()
  const { data, isLoading, isSuccess, isError } = useQuery({
    queryKey: ['translations', { document }],
    queryFn: getTranslations,
    onError: onQueryError
  })
  const translations = data ?? []

  // TODO: Show toast on error

  const { mutate: addFreshTranslation } = useMutation({
    mutationFn: translateFresh,
    onSuccess() { queryClient.invalidateQueries(['translations']) },
    onError: onQueryError
  })

  const { mutate: addDuplicateTranslation } = useMutation({
    mutationFn: translateDuplicate,
    onSuccess({ status, data }) {
      if (status === 'success') queryClient.invalidateQueries(['translations'])
      else if (status === 'untranslatedReferencesFound') showUntranslatedReferences(data)
    },
    onError: onQueryError
  })

  const { mutate: addDuplicateTranslationsWithoutReferences } = useMutation({
    mutationFn: translateDuplicateWithoutReferences,
    onSuccess() { queryClient.invalidateQueries(['translations']) },
    onError: onQueryError,
    onSettled() { setModal(null) },
  })

  return (
    <Container width={1}>
      <Card paddingX={4} paddingY={2}>
        {isLoading && <p>Laden...</p>}
        {isError && <p>Er ging iets mis...</p>}
        {isSuccess && (
          (published || draft)
            ? <Languages
                original={document}
                {...{ translations, schemaType }}
                onTranslateFresh={language => {
                  addFreshTranslation({ original: document, language })
                }}
                onTranslateDuplicate={language => {
                  addDuplicateTranslation({ original: document, language })
                }}
              />
            : <Text>Het lijkt erop dat er nog niets is om te vertalen!</Text>
        )}

        {modal && (
          <MissingTranslationsDialog
            documents={modal.references}
            onClose={() => setModal(null)}
            canContinueWithoutReferences={modal.cleanDuplicate}
            onContinue={() => {
              addDuplicateTranslationsWithoutReferences({ original: modal.cleanDuplicate, language: modal.language })
            }}
          />
        )}
      </Card>
    </Container>
  )

  function showUntranslatedReferences(data) {
    const { references, cleanDuplicate, language } = data
    setModal({ references, cleanDuplicate, language })
  }

  function onQueryError(e) {
    reportError(e)
    alert('Er iets mis, probeer het nog eens')
  }
}

function Languages({ original, translations, schemaType, onTranslateFresh, onTranslateDuplicate }) {
  return (
    <ul className={styles.languages}>
      {Object.keys(pluginConfig.languages).map(language => {
        const document = translations[language]
        const isCurrentDocument = document?._id === original._id
        return (
          <li className={styles.language} key={language}>
            <Card paddingY={2}>
              <Language
                title={pluginConfig.languages[language].title}
                {...{ isCurrentDocument }}
              >
                {document
                  ? <EditLink {...{ document, schemaType }} />
                  : <TranslateActions
                      {...{ language } }
                      onClickDuplicate={() => onTranslateDuplicate(language)}
                      onClickFresh={() => onTranslateFresh(language)}
                    />
                }
              </Language>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

function Language({ title, isCurrentDocument, children }) {
  return (
    <Flex align='center'>
      <Card flex={1}>
        <Stack space={1}>
          <Text weight='bold'>{title}</Text>
          {isCurrentDocument && <Text muted size={1}>Huidig document</Text>}
        </Stack>
      </Card>

      <Card flex={3}>
        {children}
      </Card>
    </Flex>
  )
}

function EditLink({ document, schemaType }) {
  return (
    <IntentLink
      className={styles.componentEditLink}
      intent="edit"
      params={{ id: document._id, type: document._type }}
    >
      <Preview fontSize={1} value={document} type={schemaType} />
    </IntentLink>
  )
}

function TranslateActions({ onClickDuplicate, onClickFresh, language }) {
  return (
    <Stack space={1}>
      <Flex padding={[2, 0]} justify='space-between' align='center'>
        <Card marginLeft={2}>
          <Text>Geen vertaling</Text>
        </Card>

        <MenuButton
          button={<Button text='Vertalen' />}
          tone='positive'
          id={`translate-${language}`}
          menu={(
            <Menu>
              <MenuItem icon={CopyIcon} tone='positive' text='Kopie maken van dit document' onClick={onClickDuplicate} />
              <MenuItem icon={ComposeIcon} tone='caution' text='Blanco vertaling starten' onClick={onClickFresh} />
            </Menu>
          )}
          placement='left'
          popover={{portal: true}}
        />
      </Flex>
    </Stack>
  )
}

function MissingTranslationsDialog({ documents, onClose, canContinueWithoutReferences, onContinue }) {
  return (
    <Dialog
      title='Niet alle gekoppelde documenten hebben een gepubliceerde vertaling'
      cancelButtonText='Annuleren'
      cancelColor='success'
      onConfirm={canContinueWithoutReferences ? onContinue : null}
      confirmButtonText={canContinueWithoutReferences ? 'Toch doorgaan' : null}
      confirmColor={canContinueWithoutReferences ? 'danger' : null}
      onEscape={onClose} onClickOutside={onClose} onCancel={onClose}
      {...{ onClose }}
    >
      <div className={styles.componentMissingTranslationsDialog}>
        <ul className={styles.missingTranslationsList}>
          {documents.map(document => (
            <li key={document._id}>
              <EditLink {...{ document }} schemaType={schema.get(document._type)} />
            </li>
          ))}
        </ul>

        {canContinueWithoutReferences && (
          <p>De missende documentvertalingen zijn niet verplicht. Kies voor <strong>toch doorgaan</strong> om een vertaling van dit document aan te maken zonder deze gekoppelde documenten.</p>
        )}

        <footer className={styles.footer}>
          Als je te maken hebt met te veel (of circulaire) koppelingen kun je er ook voor kiezen om een nieuw document aan te maken.
        </footer>
      </div>
    </Dialog>
  )
}

async function getTranslations(context) {
  const { queryKey: [, { document }] } = context
  if (!document) return null

  const { translationId } = document

  if (!translationId) return null

  const translations = await sanityClient.fetch(
    groq`*[translationId == $translationId]`,
    { translationId }
  )

  return translations.reduce(
    (result, translation) => {
      const language = translation.language ?? pluginConfig.defaultLanguage
      return { ...result, [language]: translation }
    },
    {}
  )
}

async function addFreshTranslation({ original, language }) {
  const duplicateId = 'drafts.' + uuid.v5([language, original._id].join('.'), uuid.v5.URL)

  const result = await sanityClient.create({
    _type: original._type, _id: duplicateId, translationId: original.translationId, language
  })

  return { status: 'success', data: result }
}

async function translateFresh({ original, language }) {
  const { status, data } = await addFreshTranslation({ original, language })
  if (status === 'success') return { status, data }
  throw new Error(`Failed to create fresh translation (${status})`)
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
    const valid = (await validateDocument(duplicate, schema)).every(x => x.level !== 'error')

    return {
      status: 'untranslatedReferencesFound',
      data: {
        references: untranslatedReferences,
        cleanDuplicate: valid ? duplicate : null,
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
  if (isReference(data) && exclude.includes(data._ref)) return null

  return Array.isArray(data)
    ? data.map(x => removeExcludedReferences(x, exclude)).filter(Boolean)
    : mapValues(data, x => removeExcludedReferences(x, exclude))
}
