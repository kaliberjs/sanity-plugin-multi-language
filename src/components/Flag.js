import Flags from 'country-flag-icons/react/3x2'
import styles from './Flag.css'

export function Flag({ country }) {
  const Flag = Flags[country]
  // eslint-disable-next-line @kaliber/layout-class-name
  return Flag && <Flag className={styles.component} />
}
