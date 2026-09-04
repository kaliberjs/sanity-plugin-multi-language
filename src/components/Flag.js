import Flags from 'country-flag-icons/react/3x2'

export function Flag({ country }) {
  const Flag = Flags[country]
  return Flag && <Flag style={{ width: '1.5em', height: '1em' }} />
}
