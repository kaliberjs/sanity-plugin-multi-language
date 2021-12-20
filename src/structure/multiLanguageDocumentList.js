import S from '@sanity/desk-tool/structure-builder'
import { map } from 'rxjs/operators'
import React from 'react'
import * as rxjs from 'rxjs'
import pluginConfig from 'config:@kaliber/sanity-plugin-multi-language'
import * as uuid from 'uuid'
import { MultiLanguageDocumentList } from '../components/MultiLanguageDocumentList'
import { DocumentTitle } from '../components/DocumentTitle'

export function multiLanguageDocumentList(listBuilder) {
  const serializedListBuilder = listBuilder.serialize()

  const { schemaTypeName } = serializedListBuilder
  const emptyDoc = { _type: schemaTypeName }
  const document$ = new rxjs.BehaviorSubject(emptyDoc)

  const component = React.memo(React.forwardRef(MultiLanguageDocumentList))

  return {
    ...serializedListBuilder,
    type: 'component',
    component,
    key: serializedListBuilder.id, // override the key to prevent an unmount / mount cycle
    menuItems: [
      ...serializedListBuilder.menuItems,
      {
        intent: {
          type: 'create',
          // this will become a challenge if we allow the list to be displaying different languages,
          // in short: you can not use `intent` with dynamic values
          params: [{ type: schemaTypeName }, { language: pluginConfig.defaultLanguage }] },
      }
    ],
    document$,
    child: translationId => document$.pipe(
      map(_doc => {
        const docValid = _doc.translationId && _doc.translationId === translationId
        const doc = docValid ? _doc : { ...emptyDoc, translationId }
        const { language } = doc
        return getDocumentNode({ schemaType: doc._type, documentId: doc._id || uuid.v4() })
          .id(translationId)
          .initialValueTemplate(schemaTypeName, { translationId, language })
          .title(
            <DocumentTitle {...{ language, schemaTypeName, document$, translationId }}>
              {doc.title}{/* TODO: ophalen op basis van preview */}
            </DocumentTitle>
          )
      })
    )
  }
}

function getDocumentNode({ schemaType, documentId }) {
  const deskToolStructure = require('part:@sanity/desk-tool/structure?') // we can not import because we are part of the desk structure

  const userNode = deskToolStructure?.getDefaultDocumentNode({ schemaType, documentId })
  const userBuilder = userNode ?? (
    typeof userNode.serialize === 'function' ? userNode : S.document(userNode)
  )

  const builder = userBuilder ?? S.document()

  const builderWithDocumentId = documentId ? builder.documentId(documentId) : builder
  return builderWithDocumentId.schemaType(schemaType)
}
