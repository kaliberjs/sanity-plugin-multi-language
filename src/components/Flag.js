import Flags from 'country-flag-icons/react/3x2'
import styles from './Flag.css'
/** @typedef {keyof Flags} Country */

/** @arg {{ country: string }} props */
export function Flag({ country }) {
  if (!isKnownCountry(country))
    return null

  const Flag = Flags[country]
  // eslint-disable-next-line @kaliber/layout-class-name
  return <Flag className={styles.component} />
}

/** @arg {string} x @returns {x is keyof Flags} */
function isKnownCountry(x) { return x in Flags }
