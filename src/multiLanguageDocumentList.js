import S from '@sanity/desk-tool/structure-builder'
import { liveDocuments } from '@kaliber/sanity-live-documents'
import { map, shareReplay } from 'rxjs/operators'
import React from 'react'
import * as rxjs from 'rxjs'
import { Title } from './Title'
import schema from 'part:@sanity/base/schema'
import {ComposeIcon} from '@sanity/icons'

export function multiLanguageDocumentList({ schemaType, id, titleField, spec = undefined }) {
  const type = schema.get(schemaType)
  /** @type {rxjs.Observable<any>} - you can remove this in your spare time */
  const documents$ = liveDocuments({ schemaType })
  const liveTranslationGroups = documents$
    .pipe(
      map(toTranslationGroups),
      shareReplay({ bufferSize:1, refCount: false })
    )
S.defaultInitialValueTemplateItems
  return liveTranslationGroups.pipe(
    map(translations =>
      S.list(spec).id(id)
        .items(
          translations.map(({ translations, translationId }) => {
            const [first] = translations

            const document$ = new rxjs.BehaviorSubject(first)

            const title = (
              <Title
                {...{ titleField, document$, translations }}
                onDocumentClick={doc => document$.next(doc)}
              />
            )
            const child = document$.pipe(
              map(doc => getDocumentNode({ schemaType, documentId: doc._id }).id(translationId))
            )
            /** @type {any} - you can remove this in your spare time */
            const listItem = { id: translationId, child, title, type: 'listItem' }
            return listItem
          })
        )
    ),
    shareReplay({ bufferSize: 1, refCount: false })
  )
}

function getDocumentNode({ schemaType, documentId }) {
  const deskToolStructure = require('part:@sanity/desk-tool/structure?') // we can not import because we are part of the desk structure

  const userNode = deskToolStructure?.getDefaultDocumentNode({ schemaType, documentId })
  const userBuilder = userNode ?? (
    typeof userNode.serialize === 'function' ? userNode : S.document(userNode)
  )

  const builder = userBuilder ?? S.document()
  return builder
    .documentId(documentId)
    .schemaType(schemaType)
}

function toTranslationGroups(a) {
  const byTranslationId = groupBy(a, x => x.translationId)

  const translationGroups = Object.entries(byTranslationId).map(
    ([translationId, translations]) => ({ translationId, translations: filterAndSort(translations) })
  )

  return translationGroups

}

function filterAndSort(translations) {
  const byLanguage = groupBy(translations, x => x.language)

  return Object.values(byLanguage)
    .map(translations => {
      const [lastUpdated] = translations.sort(lastUpdatedFirst)
      return lastUpdated
    })
    .sort(lastUpdatedFirst)
}

function lastUpdatedFirst(a, b) {
  const result = new Date(b._updatedAt).getTime() - new Date(a._updatedAt).getTime()
  return result
}

function groupBy(a, getGroupByValue) {
  return a.reduce(
    (result, x) => {
      const groupByValue = getGroupByValue(x)
      const target = result[groupByValue] || (result[groupByValue] = [])
      target.push(x)
      return result
    },
    {}
  )
}
