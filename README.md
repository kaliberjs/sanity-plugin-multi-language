# Kaliber Sanity Multi Language Plugin

Document level translations.

## Installation

```
> yarn add @kaliber/sanity-plugin-multi-language
```

`admin/sanity.json`

```json
{
  "plugins": [
    "@kaliber/sanity-plugin-multi-language",
    ...
  ],
  ...
}
```

## Usage

`admin/deskStructure.js`

```js
import { Translations, typeHasLanguage, multiLanguageDocumentList } from '@kaliber/sanity-plugin-multi-language'

export default function structure() {
  return S.list().title('Menu').items([
    S.listItem().title(`Pagina's`).child(
      multiLanguageDocumentList(
        S.documentTypeList('pagina').title(`Pagina's`)
      )
    )
  ])
}

export function getDefaultDocumentNode({ schemaType }) {
  return S.document().views([
    S.view.form(),
    ...(typeHasLanguage(schemaType) ? [S.view.component(Translations).title('Vertalingen')] : [])
  ])
}
```

`schema/documents/pagina.js`

```js
import { withMultipleLanguages } from '@kaliber/sanity-plugin-multi-language'

export const pagina = withMultipleLanguages()({
  type: 'document',
  name: 'pagina',
  title: 'Pagina',
  fields: [
    ...
  ],
})
```

## Development

```
> yarn
> yarn link
> yarn watch
```

```
admin/> yarn link @kaliber/sanity-plugin-multi-language
```

## Publish

```
yarn publish
git push
git push --tags
```
