declare module 'sanity' {
  interface DocumentOptions {
    kaliber?: {
      multiLanguage?: boolean,
    },
  }
}

export {} // make sure typescript treats this type definition file as a module
