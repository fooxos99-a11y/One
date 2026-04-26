const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
const EASTERN_ARABIC_INDIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹"

export function normalizeDigitsToEnglish(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EASTERN_ARABIC_INDIC_DIGITS.indexOf(digit)))
}