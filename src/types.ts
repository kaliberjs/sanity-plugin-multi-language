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
  getDefaultLanguage?(params: { sanityClient: import('sanity').SanityClient, currentUser: import('sanity').CurrentUser }): Promise<string>
}
