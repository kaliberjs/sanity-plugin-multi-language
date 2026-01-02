import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as uuid from 'uuid' // eslint-disable-line import/no-unresolved
import groq from 'groq'
import { useEditState, useSchema, useClient, Preview as SanityPreview } from 'sanity'
import { useRouter } from 'sanity/router' // eslint-disable-line import/no-unresolved
import { usePaneRouter } from 'sanity/structure' // eslint-disable-line import/no-unresolved
import { Container, Stack, Flex, Box, Inline, Card, Dialog, Grid, Text, Spinner, Button, Tooltip } from '@sanity/ui'
import { DocumentsIcon, ComposeIcon, EditIcon, PublishIcon } from '@sanity/icons'
import { Flag } from './Flag'
import { getCountryFromIcu } from '../machinery/getCountryFromIcu'
import { typeHasLanguage } from '../typeHasLanguage'
import apiVersion from '../apiVersion'

import styles from './Translations.css'

/** @import { Config, ArrayItem } from '../types.ts' */
/** @import { SanityDocument, SanityClient, Schema } from 'sanity' */
/** @import { CardTone } from '@sanity/ui' */
/** @import { ReactNode } from 'react' */

/** @typedef {{ references: any, cleanDuplicate: any, language: string }} UntranslatedReferenceInfo */
/**
 * @typedef {{
 *   displayed: MultiLanguageDocument,
 *   draft: MultiLanguageDocument,
 *   published: MultiLanguageDocument
 * }} SanityDocumentContainer
 */
/** @typedef {SanityDocument & { translationId: string, language: string }} MultiLanguageDocument */

export { TranslationsWithQueryClient as Translations }

const queryClient = new QueryClient()

/** @arg {{ document: SanityDocumentContainer, options: Config }} props */
function TranslationsWithQueryClient({ document, options }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Translations {...{ document, options }} />
    </QueryClientProvider>
  )
}

/**
 * @arg {{
 *   document: SanityDocumentContainer,
 *   options: Config,
 * }} props
 */
function Translations({ document: { displayed: document, draft, published }, options }) {
  const translationId = document?.translationId

  const { translations, isPending, isSuccess, isError, reloadTranslations } =
    useTranslations({ translationId, options })

  const [untranslatedReferenceInfo, setUntranslatedReferenceInfo] =
    React.useState(/** @type {UntranslatedReferenceInfo | null} */ (null))

  const openDocumentInChildPane = useOpenDocumentInChildPane()
  const closeChildPanes = useCloseChildPanes()

  const {
    addFreshTranslation,
    addDuplicateTranslation,
    addDuplicateTranslationsWithoutReferences,
  } = useTranslationHandling({
    onTranslationCreated(document) {
      reloadTranslations()
      openDocumentInChildPane(document)
    },
    onUntranslatedReferencesFound(untranslatedReferenceInfo) {
      setUntranslatedReferenceInfo(untranslatedReferenceInfo)
    },
    onError: options.reportError,
    additionalFreshTranslationProperties: options.additionalFreshTranslationProperties,
  })

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

        {isPending && (
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
            ? (
              <Languages
                original={document}
                languages={options.multiLanguage.languages}
                {...{ translations }}
                onTranslateFresh={language => {
                  addFreshTranslation(document, language)
                }}
                onTranslateDuplicate={language => {
                  addDuplicateTranslation(document, language)
                }}
              />
            )
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

function useOpenDocumentInChildPane() {
  const paneRouter = usePaneRouter()
  const router = useRouter()

  /** @arg {SanityDocument} document */
  return document => {
    router.navigate({
      panes: [
        ...paneRouter.routerPanesState,
        [{ id: document._id, params: { type: document._type } }],
      ]
    })
  }
}

/**
 * @arg {{
 *   onTranslationCreated(data: MultiLanguageDocument): void,
 *   onUntranslatedReferencesFound(data: {
 *     references: {
 *         title: string,
 *         translationId: string,
 *         _type: string,
 *         _id: string,
 *     }[],
 *     cleanDuplicate: void | MultiLanguageDocument,
 *     language: string
 *   }): void,
 *   additionalFreshTranslationProperties?(doc: SanityDocument): Record<string, any>,
 *   onError(e: unknown): void,
 * }} props
 */
function useTranslationHandling({
  onTranslationCreated,
  onUntranslatedReferencesFound,
  additionalFreshTranslationProperties = doc => ({}),
  onError
}) {
  const client = useClient({ apiVersion })
  const schema = useSchema()

  return {
    /**
     * @arg {SanityDocument} document
     * @arg {string} language
     */
    async addFreshTranslation(document, language) {
      await withErrorHandling(async () => {
        const { status, data } = await addFreshTranslation(document, language, { client, additionalFreshTranslationProperties, schema })

        if (status === 'success') onTranslationCreated(data)
        else throw new Error(`Failed to create fresh translation (${status})`)
      })
    },
    /**
     * @arg {MultiLanguageDocument} document
     * @arg {string} language
     */
    async addDuplicateTranslation(document, language) {
      await withErrorHandling(async () => {
        const { status, data } = await addDuplicatedTranslation(document, language, { client, schema })

        if (status === 'success') onTranslationCreated(data)
        else if (status === 'untranslatedReferencesFound') onUntranslatedReferencesFound(data)
        else throw new Error(`Failed to create duplicate translation (${status})`)
      })
    },
    /**
     * @arg {MultiLanguageDocument} document
     * @arg {string} language
     */
    async addDuplicateTranslationsWithoutReferences(document, language) {
      await withErrorHandling(async () => {
        const { status, data } = await addDuplicatedTranslation(document, language, { client, schema })

        if (status === 'success') onTranslationCreated(data)
        else throw new Error(`Failed to create duplicate translation without references (${status})`)
      })
    }
  }

  /** @arg {() => void} f */
  async function withErrorHandling(f) {
    try { return f() } catch (e) { onError(e) }
  }
}

/** @arg {{ translationId: unknown, options: Config }} props */
function useTranslations({ translationId, options }) {
  const client = useClient({ apiVersion })
  const queryClient = useQueryClient()
  const { reportError } = options

  const { data, isPending, isSuccess, isError } = useQuery({
    queryKey: ['translations', { translationId }],
    queryFn: () => getTranslations({ reportError }),
    enabled: Boolean(translationId),
    initialData: {},
  })
  const translations = data ?? {}

  return { translations, isPending, isSuccess, isError, reloadTranslations }

  function reloadTranslations() {
    queryClient.invalidateQueries(({ queryKey: ['translations'] }))
  }

  /** @arg {{ reportError: (e: unknown) => void }} props */
  async function getTranslations({ reportError }) {
    try {
      const translations = /** @type {MultiLanguageDocument[]} */ (await client.fetch(
        groq`*[translationId == $translationId]`,
        { translationId }
      ))

      return Object.fromEntries(
        translations.map(translation => [
          translation.language ?? options.multiLanguage.defaultLanguage,
          translation
        ])
      )
    } catch (e) {
      reportError(e)
    }
  }
}

function useCloseChildPanes() {
  const paneRouter = usePaneRouter()
  const router = useRouter()

  return () => {
    router.navigate({ panes: paneRouter.routerPanesState.slice(0, paneRouter.groupIndex + 1) })
  }
}

/**
 * @arg {{
 *   original: MultiLanguageDocument,
 *   translations: Record<string, SanityDocument>,
 *   languages: Config['multiLanguage']['languages'],
 *   onTranslateFresh: (language: string) => void,
 *   onTranslateDuplicate: (language: string) => void,
 * }} props
 */
function Languages({ original, translations, languages, onTranslateFresh, onTranslateDuplicate }) {
  return (
    <ul className={styles.componentLanguages}>
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
                  {...{ language, languages }}
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

/** @arg {{ country: string, title: string, children: ReactNode }} props */
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

/** @arg {{ document: SanityDocument, children: ReactNode }} props */
function EditLink({ document, children }) {
  const { ChildLink } = usePaneRouter()

  return (
    <ChildLink
      key={document._id}
      childId={document._id}
      childParameters={{ type: document._type }}
      // @ts-expect-error
      style={{ color: 'inherit', textDecoration: 'none' }}
    >
      {children}
    </ChildLink>
  )
}

/**
 * @arg {{
 *   onClickDuplicate: () => void,
 *   onClickFresh: () => void,
 *   language: string,
 *   languages: Config['multiLanguage']['languages'],
 * }} props
 */
function TranslateActions({ onClickDuplicate, onClickFresh, language, languages }) {
  return (
    <Flex gap={3} align='center'>
      <Button onClick={onClickFresh} icon={ComposeIcon} tone='primary' mode='ghost' text='Create empty translation' style={{ width: '100%' }} />
      <Button onClick={onClickDuplicate} icon={DocumentsIcon} tone='primary' text={`Duplicate in ${languages[language].title}`} style={{ width: '100%' }} />
    </Flex>
  )
}

/**
 * @arg {{
 *   documents: SanityDocument[],
 *   onClose: () => void,
 *   onContinue: () => void,
 * }} props
 */
function MissingTranslationsDialog({ documents, onClose, onContinue }) {
  return (
    <Dialog
      id='missingTranslationsDialog'
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

/** @arg {{ document: SanityDocument }} props */
function Preview({ document }) {
  const schema = useSchema()
  const schemaType = React.useMemo(() => schema.get(document._type), [schema, document._type])
  const editState = useEditState(document._id.replace(/^drafts\./, ''), document._type)
  const { published, draft } = editState ?? {}

  if (!schemaType)
    throw new Error(`No schema found for document:\n${JSON.stringify(document, null, 2)}`)

  return (
    <Card
      shadow={1}
      tone='default'
      padding={2}
      radius={2}
    >
      <Flex gap={2} paddingX={2} align='center'>
        <Box flex={1}>
          <SanityPreview value={document} {...{ schemaType }} />
        </Box>
        <Box>
          <Inline space={4}>
            <StatusPublished published={Boolean(published)} />
            <StatusEdited edited={Boolean(draft)} />
          </Inline>
        </Box>
      </Flex>
    </Card>
  )
}

/** @arg {{ published: boolean }} props */
function StatusPublished({ published }) {
  return (
    <StatusBase
      tooltip={published ? 'Published' : 'Not published'}
      dimmed={!published}
      tone={published ? 'positive' : 'default'}
      icon={PublishIcon}
    />
  )
}

/** @arg {{ edited: boolean }} props */
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

/**
 * @arg {{
 *   tooltip: string,
 *   tone: CardTone,
 *   icon: JSX.ElementType,
 *   dimmed: boolean,
 * }} props
 */
function StatusBase({ tooltip, tone, dimmed, icon: Icon }) {
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
      {/* eslint-disable-next-line @kaliber/layout-class-name */}
      <Card className={styles.iconCard} data-dimmed={dimmed} style={{ background: 'transparent' }} {...{ tone }}>
        <Text size={1}>
          <Icon />
        </Text>
      </Card>
    </Tooltip>
  )
}

/** @arg {() => void} onDelete */
function useOnChildDocumentDeletedHack(onDelete) {
  const paneRouter = usePaneRouter()
  const onDeleteRef = React.useRef(onDelete)
  onDeleteRef.current = onDelete

  const [lastPane] = paneRouter.routerPanesState[paneRouter.groupIndex + 1] ?? [{ id: 'no-doc' }]
  const editState = useEditState(lastPane.id.replace(/^drafts\./, ''), lastPane.params?.type || 'no-type')
  const previousDocRef = React.useRef(editState.draft ?? editState.published)

  React.useEffect(
    () => {
      const doc = editState.draft ?? editState.published

      if (previousDocRef.current && !doc) onDeleteRef.current()

      previousDocRef.current = doc
    },
    [editState]
  )
}

/**
 * @arg {SanityDocument} original
 * @arg {string} language
 * @arg {{
 *   client: SanityClient,
 *   additionalFreshTranslationProperties(original: SanityDocument): Record<string, any>,
 *   schema: Schema,
 * }} config
 */
async function addFreshTranslation(original, language, { client, additionalFreshTranslationProperties, schema }) {
  const duplicateId = generateNewDocumentId(original, language, { schema })

  const result = await client.create({
    ...additionalFreshTranslationProperties(original),
    _type: original._type, _id: duplicateId, translationId: /** @type {string} */ (original.translationId), language
  })

  return { status: 'success', data: result }
}

/**
 * @arg {MultiLanguageDocument} original
 * @arg {string} language
 * @arg {{
 *   client: SanityClient,
 *   schema: Schema,
 * }} config
 */
async function addDuplicatedTranslation( original, language, { client, schema }) {
  const untranslatedReferences = await findUntranslatedReferences(original, language, { client, schema })

  if (untranslatedReferences.length) return untranslatedReferencesFound(untranslatedReferences)

  return /** @type const */ ({
    status: 'success',
    data: await createDuplicateTranslation({ client, original, language, schema })
  })

  /**
   * @arg {{
   *   title: string;
   *   translationId: string;
   *   _type: string;
   *   _id: string;
   * }[]} untranslatedReferences
  */
  async function untranslatedReferencesFound(untranslatedReferences) {
    const duplicate = /** @type {void | MultiLanguageDocument} */ (
      removeExcludedReferences(original, untranslatedReferences.map(x => x._id))
    )

    return /** @type const */ ({
      status: 'untranslatedReferencesFound',
      data: {
        references: untranslatedReferences,
        cleanDuplicate: duplicate,
        language
      }
    })
  }
}

/**
 * @arg {{
 *   client: SanityClient,
 *   original: MultiLanguageDocument,
 *   language: string,
 *   schema: Schema
 * }} props
 * @returns {Promise<MultiLanguageDocument>}
 */
async function createDuplicateTranslation({ client, original, language, schema }) {
  const { _id, _createdAt, _rev, _updatedAt, ...document } = original
  const { translationId } = document

  const [, duplicate] = await Promise.all([
    client.patch(_id).setIfMissing({ translationId }).commit(), // TODO: kan dit echt gebeuren? misschien als we van untranslated naar translated zouden gaan, is denk ik niet de bedoeling
    client.create({
      ...(await cloneAndPointReferencesToTranslatedDocument(document, language, { client, schema })),
      _id: generateNewDocumentId(original, language, { schema }),
      translationId,
      language
    })
  ])

  return /** @type {MultiLanguageDocument} */ (duplicate)
}

/**
 * @arg {SanityDocument} document
 * @arg {string} language
 * @arg {{
 *   client: SanityClient,
 *   schema: Schema,
 * }} config
 */
async function findUntranslatedReferences(document, language, { client, schema }) {
  // Because the referenceIds are _id's, read from their respective documents,
  // it's possible that they are prefixed with 'drafts.' and do not have a
  // published version (if they were created inline).
  const referenceIds = getReferences(document).map(x => x._ref)
    .flatMap(x => x.startsWith('drafts.') ? x : [x, 'drafts.' + x])

  const references = /** @type {{ title: string, translationId: string, _type: string, _id: string }[]} */ (
    await client.fetch(
      groq`*[_id in $ids] { title, translationId, _type, _id }`,
      { ids: referenceIds }
    )
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
  ).filter(isNotNull)

  return untranslatedReferences
}

/** @template T @arg {T} x @returns {x is Exclude<T, null>} */
function isNotNull(x) { return Boolean(x) }

/**
 * @arg {SanityDocument} doc
 * @arg {string} language
 * @arg {{ schema: Schema }} config
 */
function generateNewDocumentId(doc, language, { schema }) {
  const customIdGenerator = schema.get(doc._type)?.options?.kaliber?.multiLanguageNewDocumentId
  return customIdGenerator
    ? customIdGenerator({ currentId: doc._id, currentLanguage: doc?.language, newLanguage: language })
    : 'drafts.' + uuid.v4()
}

/**
 * @arg {any} data
 * @returns {{ _ref: string }[]}
 */
function getReferences(data) {
  if (!data || typeof data !== 'object') return []
  if (isReference(data)) return [data]

  return Object.values(data).flatMap(getReferences)
}

/**
 * @template T
 * @arg {any} data
 * @arg {string} language
 * @arg {{
 *   client: SanityClient,
 *   schema: Schema,
 * }} config
 * @returns {Promise<T | ArrayItem<T>[] | { [k: keyof T]: T[keyof T] }>}
 */
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

/**
 * @arg {{ _ref: string, _strengthenOnPublish?: boolean }} reference
 * @arg {string} language
 * @arg {{
 *   client: SanityClient,
 *   schema: Schema,
 * }} config
 */
async function pointToTranslatedDocument(reference, language, { client, schema }) {
  const referencedDoc = await client.fetch(
    groq`*[_id == $ref || _id == 'drafts.' + $ref][0] { _type, translationId }`,
    { ref: reference._ref }
  )

  if (!referencedDoc && reference._strengthenOnPublish)
    return { ...reference, _ref: uuid.v4() } // This document is created inline, but doesn't exist yet

  if (!typeHasLanguage({ schema, schemaType: referencedDoc._type }))
    return reference // This document is not translatable (e.g.: images)

  const ids = /** @type {string[]} */ (await client.fetch(
    groq`*[translationId == $translationId && language == $language]._id`,
    { translationId: referencedDoc.translationId, language }
  ))

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

/** @arg {any} x @returns {x is { _ref: string }} */
function isReference(x) { return Boolean(x) && typeof x === 'object' && x._ref }

/**
 * @template {string} K
 * @template V
 * @template R
 * @arg {Record<K, V>} obj
 * @arg {(value: V, index: number, array: [string, any][]) => R} asyncMapFn
 * @returns {Promise<Record<K, R>>}
 */
async function mapValuesAsync(obj, asyncMapFn) {
  return Object.entries(obj).reduce(
    async (resultPromise, [key, value], ...rest) => {
      const result = await resultPromise
      // @ts-ignore
      result[key] = await asyncMapFn(value, ...rest)
      return result
    },
    /** @type {Promise<Record<K, R>>} */ (Promise.resolve({}))
  )
}

/**
 * @template {{ [key: string | number | symbol]: any }} O
 * @template {(v: O[keyof O], k: keyof O, o: O) => any} F
 *
 * @param {O} o
 * @param {F} f
 * @returns {{ [key in keyof O]: ReturnType<F> }}
 */
export function mapValues(o, f) {
  // @ts-ignore
  return Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, f(v, k, o)])
  )
}

/**
 * @template T
 * @arg {T} data
 * @arg {string[]} exclude
 * @returns {T | ArrayItem<T>[] | { [k: keyof T]: T[keyof T] | void } | void}
 */
function removeExcludedReferences(data, exclude) {
  if (!data || typeof data !== 'object') return data
  if (isReference(data) && exclude.map(_id => _id.replace(/^drafts\./, '')).includes(data._ref)) return

  return Array.isArray(data)
    ? data.map(x => removeExcludedReferences(x, exclude)).filter(Boolean)
    : mapValues(data, x => removeExcludedReferences(x, exclude))
}
