// TODO: @Peeke, hier meer sanity ui gebruiken?

import React from 'react'
import Flags from 'country-flag-icons/react/3x2'
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from 'react-query'
import * as uuid from 'uuid'
import groq from 'groq'
import sanityClient from 'part:@sanity/base/client'
import schema from 'part:@sanity/base/schema'
import pluginConfig from 'config:@kaliber/sanity-plugin-multi-language'
import { usePaneRouter } from '@sanity/desk-tool'
import { PublishedStatus } from '@sanity/desk-tool/lib/components/PublishedStatus'
import { DraftStatus } from '@sanity/desk-tool/lib/components/DraftStatus'
import { useEditState } from '@sanity/react-hooks'
import { Container, Stack, Flex, Box, Inline, Card, Dialog, Grid, Text, Spinner, Button } from '@sanity/ui'
import { SanityPreview } from '@sanity/base/preview'
import { DocumentsIcon, ComposeIcon } from '@sanity/icons'

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
    <Container
      paddingBottom={9}
      paddingTop={5}
      paddingX={4}
      sizing='border'
      width={1}
    >
      <Stack space={2}>
        <Text weight='semibold'>Vertalingen</Text>
        
        {isLoading && (
          <Flex justify="center">
            <Spinner muted />
          </Flex>
        )}
        
        {isError && (
          <Card padding={[3, 3, 4]}
            radius={2}
            shadow={1}
            tone='critical'
          >
            <Text>Er ging iets mis...</Text>
          </Card>
        )}

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
      </Stack>

      {modal && (
        <MissingTranslationsDialog
          documents={modal.references}
          onClose={() => setModal(null)}
          onContinue={() => {
            addDuplicateTranslationsWithoutReferences({ original: modal.cleanDuplicate, language: modal.language })
          }}
        />
      )}
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

function Languages({ original, translations, onTranslateFresh, onTranslateDuplicate }) {
  return (
    <ul className={styles.languages}>
      {Object.keys(pluginConfig.languages)
        .filter(x => x !== original.language)
        .map(language => {
          const document = translations[language]
          return (
            <Language
              key={language}
              title={pluginConfig.languages[language].title}
            >
              {document ? (
                <EditLink {...{ document }}>
                  <PreviewWithFlag {...{ document }} />
                </EditLink> 
              ) : (
                <TranslateActions
                  {...{ language } }
                  onClickDuplicate={() => onTranslateDuplicate(language)}
                  onClickFresh={() => onTranslateFresh(language)}
                />
              )}
            </Language>
          )
        })
      }
    </ul>
  )
}

function Language({ title, children }) {
  return (
    <li className={styles.componentLanguage}>
      <div className={styles.languageTitle}>
        <Text size={1}>{title}</Text>
      </div>

      {children}
    </li>
  )
}

function EditLink({ document, children }) {
  const { ChildLink, routerPanesState, index } = usePaneRouter()

  return (
    <ChildLink key={document._id} childId={document._id} childParameters={{ type: document._type }} style={{ color: 'inherit', textDecoration: 'none' }}>
      {children}
    </ChildLink>
  )
}

function TranslateActions({ onClickDuplicate, onClickFresh, language }) {
  const icu = pluginConfig.languages[language]?.icu
  if (!icu) return null

  const [, country] = icu.split('_')
  const Flag = Flags[country]

  return (
    <Card shadow={1} paddingY={2} paddingLeft={3} paddingRight={2} radius={2}>
      <Flex gap={3} align='center'> 
        <Flag style={{ width: '1.5em', height: '1em', borderRadius: '2px', flexShrink: '0' }} />
        <Button onClick={onClickFresh} icon={ComposeIcon} tone='primary' mode='ghost' text='Blanco vertaling aanmaken' style={{ width: '100%'}} />
        <Button onClick={onClickDuplicate} icon={DocumentsIcon} tone='primary' text={`${pluginConfig.languages[language].adjective} kopie maken`} style={{ width: '100%'}} />
      </Flex>
    </Card>
  )
}

function MissingTranslationsDialog({ documents, onClose, onContinue }) {
  return (
    <Dialog
      width={1}
      header='Let op!'
      footer={
        <Grid columns={2} gap={2} paddingX={4} paddingY={3}>
          <Button onClick={onClose} mode='ghost' style={{ textAlign: 'center' }}>Cancel</Button>
          <Button tone='critical' onClick={onContinue} style={{ textAlign: 'center' }}>Continue</Button>
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
                <EditLink {...{ document }}>
                  <Preview {...{ document }} />
                </EditLink>
              </li>
            ))}
          </ul>

          <Text size={1} muted>
            Als je te maken hebt met te veel (of circulaire) koppelingen kun je er ook voor kiezen om een nieuw document aan te maken.
          </Text>
        </Stack>
      </Box>
    </Dialog>
  )
}

function Preview({ document, muted = undefined }) {
  return <PreviewBase {...{ document, muted }} />
}

function PreviewWithFlag({ document, muted = undefined }) {
  return <PreviewBase flag={<DocumentFlag language={document.language} style={{ width: '1.5em' }} />} {...{ document, muted }} />
}

function PreviewBase({ document, flag = undefined, muted }) {
  const schemaType = React.useMemo(() => schema.get(document._type), [document._type])
  const editState = useEditState(document._id.replace(/^drafts\./, ''), document._type)
  const { published, draft } = editState ?? {}

  return (
    <Card
      shadow={muted ? 0 : 1} 
      tone={muted ? 'transparent' : 'default'} 
      padding={2} 
      radius={2}
    >
      <Flex gap={2} paddingX={2} align='center'>
        {flag}
        <Box flex={1}>
          <SanityPreview type={schemaType} value={document} layout='default' />
        </Box>
        <Box>
          <Inline space={4}>
            <PublishedStatus document={published} />
            <DraftStatus document={draft} />
          </Inline>
        </Box>
      </Flex>
    </Card>
  )
}

function DocumentFlag({ language: languageCode, style = undefined }) {
  const language = pluginConfig.languages[languageCode]
  if (!language) return null
  
  const [, country] = language.icu.split('_')
  const Flag = Flags[country]

  return <Flag {...{ style }} />
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
  if (isReference(data) && exclude.includes(data._ref)) return

  return Array.isArray(data)
    ? data.map(x => removeExcludedReferences(x, exclude)).filter(Boolean)
    : mapValues(data, x => removeExcludedReferences(x, exclude))
}
