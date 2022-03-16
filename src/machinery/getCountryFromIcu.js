export function getCountryFromIcu(icu) {
  const [, country] = icu.split('_')
  return country
}