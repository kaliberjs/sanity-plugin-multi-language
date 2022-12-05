import React from 'react'
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from 'react-query'
import * as uuid from 'uuid'
import groq from 'groq'
import { useEditState, useSchema, useClient, SanityPreview } from 'sanity'
import { useRouter } from 'sanity/router'
import { usePaneRouter } from 'sanity/desk'
import { Container, Stack, Flex, Box, Inline, Card, Dialog, Grid, Text, Spinner, Button, Tooltip } from '@sanity/ui'
import { DocumentsIcon, ComposeIcon, EditIcon, PublishIcon } from '@sanity/icons'
import { Flag } from './Flag'
import { getCountryFromIcu } from './machinery/getCountryFromIcu'


// Ik denk dat we hier een plugin voor moeten hebben (misschien ook niet en denk ik wel te moeilijk)
// import { reportError } from '../../../machinery/reportError'
import styles from './Translations.module.css'

console.log(styles)

function reportError(e) {
  console.error(e)
  // TODO: report to rollbar
}

const queryClient = new QueryClient()

export { TranslationsWithQueryClient as Translations }

function TranslationsWithQueryClient({ document, config }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Translations {...{ document, config }} />
    </QueryClientProvider>
  )
}

export function translations(S, context, config) {
  return S.view.component(x => <TranslationsWithQueryClient {...x} {...{ config }} />).title(config?.title ?? 'Translations')
}

function Translations({ document: { displayed: document, draft, published }, config }) {
  const schema = useSchema()
  const client = useClient()
  const schemaType = schema.get(document._type)
  const [modal, setModal] = React.useState(null)
  const queryClient = useQueryClient()
  const { data, isLoading, isSuccess, isError } = useQuery({
    queryKey: ['translations', { document }],
    queryFn: getTranslations,
    onError: handleQueryError
  })
  const translations = data ?? []
  const paneRouter = usePaneRouter()
  const router = useRouter()

  useOnChildDocumentDeletedHack(() => {
    closeChildPanes()
    queryClient.invalidateQueries(['translations'])
  })

  // TODO: Show toast on error

  const addFreshTranslationMutation = useMutation({
    mutationFn: translateFresh,
    onSuccess: handleTranslationCreated,
    onError: handleQueryError
  })

  const addDuplicateTranslationMutation = useMutation({
    mutationFn: translateDuplicate,
    onSuccess({ status, data }) {
      if (status === 'success') handleTranslationCreated({ data })
      else if (status === 'untranslatedReferencesFound') showUntranslatedReferences(data)
    },
    onError: handleQueryError
  })

  const addDuplicateTranslationsWithoutReferencesMutation = useMutation({
    mutationFn: translateDuplicateWithoutReferences,
    onSuccess: handleTranslationCreated,
    onError: handleQueryError,
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
                {...{ translations, schemaType }}
                onTranslateFresh={language => {
                  addFreshTranslationMutation.mutate({ original: document, language })
                }}
                onTranslateDuplicate={language => {
                  addDuplicateTranslationMutation.mutate({ original: document, language })
                }}
              />
            : <Text>It seems there isn't anything to translate yet!</Text>
        )}
      </Stack>

      {modal && (
        <MissingTranslationsDialog
          documents={modal.references}
          onClose={() => setModal(null)}
          onContinue={() => {
            addDuplicateTranslationsWithoutReferencesMutation.mutate({ original: modal.cleanDuplicate, language: modal.language })
          }}
        />
      )}
    </Container>
  )

  function handleTranslationCreated({ data }) {
    queryClient.invalidateQueries(['translations'])

    router.navigate({
      panes: [
        ...paneRouter.routerPanesState,
        [{ id: data._id, params: { type: data._type } }],
      ]
    })
  }

  function showUntranslatedReferences(data) {
    const { references, cleanDuplicate, language } = data
    setModal({ references, cleanDuplicate, language })
  }

  function handleQueryError(e) {
    reportError(e)
    alert('Something went wrong, please try again')
  }

  function closeChildPanes() {
    router.navigate({ panes: paneRouter.routerPanesState.slice(0, paneRouter.groupIndex + 1) })
  }

  async function getTranslations(context) {
    const { queryKey: [, { document }] } = context
    if (!document) return null

    const { translationId } = document

    if (!translationId) return null

    const translations = await client.fetch(
      groq`*[translationId == $translationId]`,
      { translationId }
    )

    return translations.reduce(
      (result, translation) => {
        const language = translation.language ?? config.defaultLanguage
        return { ...result, [language]: translation }
      },
      {}
    )
  }

  async function addFreshTranslation({ original, language }) {
    const duplicateId = 'drafts.' + uuid.v5([language, original._id].join('.'), uuid.v5.URL)

    const result = await client.create({
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
      client.patch(_id).setIfMissing({ translationId }).commit(), // TODO: kan dit echt gebeuren?
      client.create({
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
    const references = await client.fetch(
      groq`*[_id in $ids] { title, translationId, _type, _id }`,
      { ids: referenceIds }
    )

    const untranslatedReferences = (
      await Promise.all(
        references
          .filter(x => x.language && x.translationId)
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
    const { translationId } = await client.fetch(
      groq`*[_id == $ref][0] { _type, translationId }`,
      { ref: reference._ref }
    )

    if (!(document.language && document.translationId)) return reference // This document is not translatable (e.g.: images)

    const id = await client.fetch(
      groq`*[translationId == $translationId && language == $language][0]._id`,
      { translationId, language }
    )

    if (!id) throw new Error('Cannot translate reference with id ' + reference._ref)

    return { ...reference, _ref: id }
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

function getReferences(data) {
  if (!data || typeof data !== 'object') return []
  if (isReference(data)) return [data]

  return Object.values(data).flatMap(getReferences)
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

