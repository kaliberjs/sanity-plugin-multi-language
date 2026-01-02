import type { SanityClient, CurrentUser, Schema } from 'sanity'

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
    sanityClient: SanityClient,
    currentUser: CurrentUser | null,
    schema: Schema
  }): Promise<string>
}

export type ArrayItem<T> =
  T extends (infer X)[] ? X : never
