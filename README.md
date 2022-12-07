# Kaliber Sanity Multi Language Plugin

Document level translations.

*Heads up:* this is the Sanity v3 branch of this plugin. It was tested with `v3.0.0-rc.3`.

## Installation

```
> yarn add @kaliber/sanity-plugin-multi-language
```

## Usage

`sanity.config.js`

```js
defineConfig({
  // ...

  plugins: [
    // ...
    deskTool({
      structure: deskStructure,
      defaultDocumentNode: buildDefaultDocumentNode(config)
    }),
    multiLanguage(config.multiLanguage),
  ],

  // ...
})
```

`deskStructure.js`

```js
import { translationsView } from '@kaliber/sanity-plugin-multi-language'

// ...

export function buildDefaultDocumentNode(config) {
  return (S, context) => {
    const views = [
      S.view.form(),
      translationsView(S, context, config.multiLanguage)
    ]

    return S.document().views(views.filter(Boolean))
  }
}
```

`schema/documents/page.js`

```js
export const page = {
  type: 'document',
  name: 'page',
  title: 'Page',
  options: {
    multiLanguage: true
  },
  // ...
}
```

### Config
_config.multiLanguage_
```js
{
  defaultLanguage: 'nl',
  languages: {
    nl: {
      title: 'Dutch',
      adjective: 'dutch',
      language: 'nl',
      icu: 'nl_NL'
    },
    en: {
      title: 'English',
      adjective: 'english',
      language: 'en',
      icu: 'en_US'
    }
  },
}
```

## Development

In this plugin:
```
> yarn link-watch
```

In your studio folder:
```
> npx yalc add @kaliber/sanity-plugin-multi-language
> npx yalc add @kaliber/sanity-plugin-multi-language --link 
> yarn
```

Then start your studio.

## Publish

```
yarn publish
git push
git push --tags
```
---
![](https://media.giphy.com/media/3orif0Pxk3I4WQj46k/giphy.gif)
