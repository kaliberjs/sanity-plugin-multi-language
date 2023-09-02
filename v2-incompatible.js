const { showIncompatiblePluginDialog } = require('@sanity/incompatible-plugin')
const { name, version } = require('./package.json')

export default showIncompatiblePluginDialog({
  name,
  versions: {
    v3: version,
    v2: undefined,
  },
})
