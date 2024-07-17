export type Config = {
  reportError(error: any): void,
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
