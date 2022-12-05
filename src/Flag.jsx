import React from 'react'
import Flags from 'country-flag-icons/react/3x2'
// import styles from './Flag.module.scss'
const styles = {}

export function   Flag({ country }) {
  const Flag = Flags[country]
  return Flag && <Flag className={styles.component} />
}
