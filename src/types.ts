export type Config = {
  reportError(error: any): void,
  languageFieldTitle?: string,
  translationIdFieldTitle?: string,
  multiLanguage: {
    languages: {
      [language: string]: {
        icu: string,
        title: string,
      }
    },
    defaultLanguage: string,
  },
  additionalFreshTranslationProperties?(doc: any): Object,
  getDefaultLanguage?(params: {
    sanityClient: import('sanity').SanityClient,
    currentUser: import('sanity').CurrentUser,
    schema: import('sanity').Schema
  }): Promise<string>
}
