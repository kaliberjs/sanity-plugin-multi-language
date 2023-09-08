# Kaliber Sanity Multi Language Plugin

Document level translations.

## Installation

```
> yarn add @kaliber/sanity-plugin-multi-language
```

## Usage

`sanity.config.js`

```js
import { addFields as addMultiLanguageFields } from '@kaliber/sanity-plugin-multi-language'

defineConfig({
  plugins: [
    deskTool({
      defaultDocumentNode: (S, context) => {
        const getClient = context.getClient.bind(context)

        const views = [
          S.view.form(),
          typeHasLanguage(context) && S.view
            .component(Translations)
            .options({ multiLanguage, reportError })
            .title('Translations'),
          
        ].filter(Boolean)

        return S.document().views(views)
      }
    }),
  ],
  schema: {
      types: (prev, context) => prev
        .concat(schemaTypes)
        .map(addMultiLanguageFields({ multiLanguage: clientConfig.multiLanguage, reportError })),
    },
})
```


`schema/documents/page.js`

```js
export const page = {
  type: 'document',
  name: 'page',
  title: 'Page',
  options: {
    multiLanguage: true,
    ...
  },
  ...
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
> yarn
> yarn link
```

In your project:
```
> yarn link @kaliber/sanity-plugin-multi-language 
```

## Publish

```
yarn publish
git push
git push --tags
```
---
![](https://media.giphy.com/media/3orif0Pxk3I4WQj46k/giphy.gif)
