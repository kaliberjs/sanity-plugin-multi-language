import React from 'react'
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from 'react-query'
import * as uuid from 'uuid'
import groq from 'groq'
import { useEditState, useSchema, useClient, Preview as SanityPreview, SanityClient } from 'sanity'
import { useRouter } from 'sanity/router'
import { usePaneRouter } from 'sanity/desk'
import { Container, Stack, Flex, Box, Inline, Card, Dialog, Grid, Text, Spinner, Button, Tooltip } from '@sanity/ui'
import { DocumentsIcon, ComposeIcon, EditIcon, PublishIcon } from '@sanity/icons'
import { Flag } from './Flag'
import { getCountryFromIcu } from './machinery/getCountryFromIcu'
import { typeHasLanguage } from './index'

// Ik denk dat we hier een plugin voor moeten hebben (misschien ook niet en denk ik wel te moeilijk)
// import { reportError } from '../../../machinery/reportError'
import styles from './Translations.css'

const apiVersion = '2023-08-28'

/** @typedef {{ references: any, cleanDuplicate: any, language: string }} UntranslatedReferenceInfo */

export { TranslationsWithQueryClient as Translations }

function reportError(e) {
  console.error(e)
  // TODO: report to rollbar
}

const queryClient = new QueryClient()

function TranslationsWithQueryClient({ document, config }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Translations {...{ document, config }} />
    </QueryClientProvider>
  )
}


function Translations({ document: { displayed: document, draft, published }, config }) {
  const translationId = document?.translationId

  const { translations, isLoading, isSuccess, isError, reloadTranslations } = 
    useTranslations(translationId, config)
  
  const [untranslatedReferenceInfo, setUntranslatedReferenceInfo] = 
    React.useState(/** @type {UntranslatedReferenceInfo | null} */ (null))
  
  const navigateToDocument = useNavigateToDocument()
  
  const {
    addFreshTranslation,
    addDuplicateTranslation,
    addDuplicateTranslationsWithoutReferences,
  } = useTranslationHandling({
    onTranslationCreated(document) {
      reloadTranslations()
      navigateToDocument(document)  
    }, 
    onUntranslatedReferencesFound(untranslatedReferenceInfo) {
      setUntranslatedReferenceInfo(untranslatedReferenceInfo)
    }, 
    onError(e) {
      reportError(e)
      alert('Something went wrong, please try again')
    },
  })
  
  const closeChildPanes = useCloseChildPanes()

  useOnChildDocumentDeletedHack(() => {
    closeChildPanes()
    reloadTranslations()
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
        <Text weight='semibold'>Translations</Text>

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
            <Text>Something went wrong...</Text>
          </Card>
        )}

        {isSuccess && (
          (published || draft)
            ? <Languages
                original={document}
                languages={config.languages}
                {...{ translations }}
                onTranslateFresh={language => {
                  addFreshTranslation(document, language)
                }}
                onTranslateDuplicate={language => {
                  addDuplicateTranslation(document, language)
                }}
              />
            : <Text>It seems there isn't anything to translate yet!</Text>
        )}
      </Stack>

      {untranslatedReferenceInfo && (
        <MissingTranslationsDialog
          documents={untranslatedReferenceInfo.references}
          onClose={() => setUntranslatedReferenceInfo(null)}
          onContinue={async () => {
            await addDuplicateTranslationsWithoutReferences(
              untranslatedReferenceInfo.cleanDuplicate,
              untranslatedReferenceInfo.language,
            )
            setUntranslatedReferenceInfo(null)
          }}
        />
      )}
    </Container>
  )
}

function useNavigateToDocument() {
  const paneRouter = usePaneRouter()
  const router = useRouter()

  return document => {
    router.navigate({
      panes: [
        ...paneRouter.routerPanesState,
        [{ id: document._id, params: { type: document._type } }],
      ]
    })
  }
}

function useTranslationHandling({ onTranslationCreated, onUntranslatedReferencesFound, onError }) {
  const client = useClient({ apiVersion })
  const schema = useSchema()

  return {
    async addFreshTranslation(document, language) {
      await withErrorHandling(async () => {
        const { data } = await translateFresh({ client, original: document, language })
        onTranslationCreated(data)
      })
    },
    async addDuplicateTranslation(document, language) {
      await withErrorHandling(async () => {
        const { status, data } = await translateDuplicate({ client, original: document, language, schema })
        if (status === 'success') onTranslationCreated(data)
        else if (status === 'untranslatedReferencesFound') onUntranslatedReferencesFound(data)
      })
    },
    async addDuplicateTranslationsWithoutReferences(document, language) {
      await withErrorHandling(async () => {
        const { data } = await translateDuplicateWithoutReferences({ client, original: document, language, schema })
        onTranslationCreated(data)
      })
    }
  }

  async function withErrorHandling(f) {
    try { return f() } catch (e) { onError(e) }
  }
}

function useTranslations(translationId, config) {
  const client = useClient({ apiVersion })
  const queryClient = useQueryClient()

  const { data, isLoading, isSuccess, isError } = useQuery({
    queryKey: ['translations', { translationId }],
    queryFn: getTranslations,
    onError: handleQueryError,
    enabled: Boolean(translationId),
    initialData: [],
  })
  const translations = data ?? []

  return { translations, isLoading, isSuccess, isError, reloadTranslations }

  function reloadTranslations() {
    queryClient.invalidateQueries(['translations'])
  }

  async function getTranslations() {
    const translations = await client.fetch(
      groq`*[translationId == $translationId]`,
      { translationId }
    )
  
    return Object.fromEntries(
      translations.map(translation => [translation.language ?? config.defaultLanguage, translation])
    )
  }
}

function handleQueryError(e) {
  reportError(e)
  alert('Something went wrong, please try again')
}

function useCloseChildPanes() {
  const paneRouter = usePaneRouter()
  const router = useRouter()

  return () => {
    router.navigate({ panes: paneRouter.routerPanesState.slice(0, paneRouter.groupIndex + 1) })
  }
}

function Languages({ original, translations, languages, onTranslateFresh, onTranslateDuplicate }) {
  return (
    <ul className={styles.languages}>
      {Object.keys(languages)
        .filter(x => x !== original.language)
        .map(language => {
          const document = translations[language]
          return (
            <Language
              key={language}
              title={languages[language].title}
              country={getCountryFromIcu(languages[language].icu)}
            >
              {document ? (
                <EditLink {...{ document }}>
                  <Preview {...{ document }} />
                </EditLink>
              ) : (
                <TranslateActions
                  {...{ language, languages } }
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

function Language({ country, title, children }) {
  return (
    <Stack as='li' space={2}>
      <Flex align='center' gap={2}>
        <div style={{ fontSize: '0.66em' }}>
          <Flag {...{ country }} />
        </div>

        <div className={styles.languageTitle}>
          <Text size={1}>{title}</Text>
        </div>
      </Flex>

      {children}
    </Stack>
  )
}

function EditLink({ document, children }) {
  const { ChildLink } = usePaneRouter()

  return (
    <ChildLink key={document._id} childId={document._id} childParameters={{ type: document._type }} style={{ color: 'inherit', textDecoration: 'none' }}>
      {children}
    </ChildLink>
  )
}

function TranslateActions({ onClickDuplicate, onClickFresh, language, languages }) {
  return (
    <Flex gap={3} align='center'>
      <Button onClick={onClickFresh} icon={ComposeIcon} tone='primary' mode='ghost' text='Create empty translation' style={{ width: '100%'}} />
      <Button onClick={onClickDuplicate} icon={DocumentsIcon} tone='primary' text={`Duplicate in ${languages[language].title.toLowerCase()}`} style={{ width: '100%'}} />
    </Flex>
  )
}

function MissingTranslationsDialog({ documents, onClose, onContinue }) {
  return (
    <Dialog
      width={1}
      header='Caution'
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
            There are references to untranslated documents:
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

          <Text>Translate all references before creating a duplicate is not required. Choose <strong>continue</strong> to create a clone without the untranslated references.</Text>
          <Text size={1} muted>
            If you're dealing with a lot (or even circular) references, you should create an empty translation instead.
          </Text>
        </Stack>
      </Box>
    </Dialog>
  )
}

function Preview({ document, muted }) {
  const schema = useSchema()
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
        <Box flex={1}>
          <SanityPreview value={document} {...{ schemaType }} />
        </Box>
        <Box>
          <Inline space={4}>
            <StatusPublished {...{ published }} />
            <StatusEdited edited={draft} />
          </Inline>
        </Box>
      </Flex>
    </Card>
  )
}

function StatusPublished ({ published }) {
  return (
    <StatusBase
      tooltip={published ? 'Published' : 'Not published'}
      dimmed={!published}
      tone={published ? 'positive' : 'default'}
      icon={PublishIcon}
    />
  )
}

function StatusEdited({ edited }) {
  return (
    <StatusBase
      tooltip={edited ? 'Edited' : 'No unpublished edits'}
      dimmed={!edited}
      tone={edited ? 'caution' : 'default'}
      icon={EditIcon}
    />
  )
}

function StatusBase({ tooltip, tone, dimmed, status, icon: Icon }) {
  return (
    <Tooltip
      content={
        <Box padding={2}>
          <Text muted size={1}>
            {tooltip}
          </Text>
        </Box>
      }
      fallbackPlacements={['right', 'left']}
      placement="top"
      portal
    >
      <Card className={styles.iconCard} data-dimmed={dimmed} style={{ background: 'transparent' }} {...{ tone }}>
        <Text size={1}>
          <Icon/>
        </Text>
      </Card>
    </Tooltip>
  )
}

function useOnChildDocumentDeletedHack(onDelete) {
  const paneRouter = usePaneRouter()
  const callbackRef = React.useRef(null)
  callbackRef.current = onDelete

  const [lastPane] = paneRouter.routerPanesState[paneRouter.groupIndex + 1] ?? [{ id: 'no-doc', params: {} }]
  const editState = useEditState(lastPane.id.replace(/^drafts\./, ''), lastPane.params.type)
  const previousDocRef = React.useRef(editState.draft ?? editState.published)

  React.useEffect(
    () => {
      const doc = editState.draft ?? editState.published

      if (previousDocRef.current && !doc) {
        callbackRef.current()
      }

      previousDocRef.current = doc
    },
    [editState]
  )
}

async function addFreshTranslation({ client, original, language }) {
  const duplicateId = 'drafts.' + uuid.v4()

  const result = await client.create({
    _type: original._type, _id: duplicateId, translationId: original.translationId, language
  })

  return { status: 'success', data: result }
}

async function translateFresh({ client, original, language }) {
  const { status, data } = await addFreshTranslation({ client, original, language })
  if (status === 'success') return { status, data }
  throw new Error(`Failed to create fresh translation (${status})`)
}

async function translateDuplicate({ client, original, language, schema }) {
  const { status, data } = await addDuplicatedTranslation({ client, original, language, schema })
  if (['success', 'untranslatedReferencesFound'].includes(status)) return { status, data }
  throw new Error(`Failed to create duplicate translation (${status})`)
}

async function translateDuplicateWithoutReferences({ client, original, language, schema }) {
  const { status, data } = await addDuplicatedTranslation({ client, original, language, schema })
  if (status === 'success') return { status, data }
  throw new Error(`Failed to create duplicate translation without references (${status})`)
}

async function addDuplicatedTranslation({ client, original, language, schema }) {
  const untranslatedReferences = await findUntranslatedReferences({ client, document: original, language, schema })

  if (untranslatedReferences.length) return untranslatedReferencesFound(untranslatedReferences)

  return {
    status: 'success',
    data: await createDuplicateTranslation({ client, original, language, schema })
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

/** @param {{ client: SanityClient, original: any, language: string, schema:any }} props */
async function createDuplicateTranslation({ client, original, language, schema }) {
  const { _id, _createdAt, _rev, _updatedAt, ...document } = original
  const { translationId } = document

  const [, duplicate] = await Promise.all([
    client.patch(_id).setIfMissing({ translationId }).commit(), // TODO: kan dit echt gebeuren? misschien als we van untranslated naar translated zouden gaan, is denk ik niet de bedoeling
    client.create({
      ...(await cloneAndPointReferencesToTranslatedDocument(document, language, { client, schema })),
      _id: 'drafts.' + uuid.v4(),
      translationId,
      language
    })
  ])

  return duplicate
}

async function findUntranslatedReferences({ client, document, language, schema }) {
  // Because the referenceIds are _id's, read from their respective documents,
  // it's possible that they are prefixed with 'drafts.' and do not have a
  // published version (if they were created inline).
  const referenceIds = getReferences(document).map(x => x._ref)
    .flatMap(x => x.startsWith('drafts.') ? x : [x, 'drafts.' + x])

  const references = await client.fetch(
    groq`*[_id in $ids] { title, translationId, _type, _id }`,
    { ids: referenceIds }
  )

  const untranslatedReferences = (
    await Promise.all(
      references
        .filter(x => typeHasLanguage({ schema, schemaType: x._type }))
        .map(async x => {
          const count = await client.fetch(
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

async function cloneAndPointReferencesToTranslatedDocument(data, language, { client, schema }) {
  if (!data || typeof data !== 'object') 
    return data

  if (isReference(data)) 
    return pointToTranslatedDocument(data, language, { client, schema })
  
  if (Array.isArray(data))
    return Promise.all(data.map(x => cloneAndPointReferencesToTranslatedDocument(x, language, { client, schema })))

  return mapValuesAsync(
    data,
    async value => cloneAndPointReferencesToTranslatedDocument(value, language, { client, schema })
  )
}

async function pointToTranslatedDocument(reference, language, { client, schema }) {
  const referencedDoc = await client.fetch(
    groq`*[_id == $ref || _id == 'drafts.' + $ref][0] { _type, translationId }`,
    { ref: reference._ref }
  )

  if (!referencedDoc && reference._strengthenOnPublish) 
    return { ...reference, _ref: uuid.v4() } // This document is created inline, but doesn't exist yet
  
  if (!typeHasLanguage({ schema, schemaType: referencedDoc._type })) 
    return reference // This document is not translatable (e.g.: images)

  const ids = await client.fetch(
    groq`*[translationId == $translationId && language == $language]._id`,
    { translationId: referencedDoc.translationId, language }
  )

  if (!ids.length) throw new Error('Cannot translate reference with id ' + reference._ref)

  const isDraft = ids.every(id => id.startsWith('drafts.'))
  const [firstId] = ids

  return { 
    ...reference, 
    _ref: firstId.replace(/^drafts\./, ''),
    // If the only translation is an unpublished draft we need to create a special reference
    ...(isDraft && { 
      _weak: true, 
      _strengthenOnPublish: { 
        _type: referencedDoc._type 
      } 
    }) 
  }
}

function isReference(x) { return Boolean(x) && typeof x === 'object' && x._ref }

async function mapValuesAsync(obj, asyncMapFn) {
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
  if (isReference(data)) console.log(data)
  if (isReference(data) && exclude.map(_id => _id.replace(/^drafts\./, '')).includes(data._ref)) return

  return Array.isArray(data)
    ? data.map(x => removeExcludedReferences(x, exclude)).filter(Boolean)
    : mapValues(data, x => removeExcludedReferences(x, exclude))
}
