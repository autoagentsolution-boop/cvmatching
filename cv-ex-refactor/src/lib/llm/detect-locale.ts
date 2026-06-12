// Heuristic locale detector for CV/role text. Used by interview routes
// to resolve `locale === 'auto'` server-side BEFORE prompt build, so the
// LLM doesn't get to decide (it defaults to English when given the
// option — caught 2026-06-12 operator screenshot).
//
// Method: count Vietnamese diacritic characters vs total alpha chars.
// If ≥ 1.5% of alpha chars carry a Vietnamese diacritic, treat as 'vi'.
// 1.5% threshold is empirical — covers short technical CVs that quote
// English tooling alongside Vietnamese narrative, while not false-
// positiving on the occasional Spanish/French loanword.

const VI_DIACRITIC_RE =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/g;
const ALPHA_RE = /[\p{L}]/gu;

export type ResolvedLocale = 'vi' | 'en';

export function detectLocaleFromText(text: string | null | undefined): ResolvedLocale {
  if (!text) return 'vi'; // Vietnamese-first product default
  const alpha = text.match(ALPHA_RE)?.length ?? 0;
  if (alpha < 50) return 'vi'; // too little signal — default VN
  const diacritics = text.match(VI_DIACRITIC_RE)?.length ?? 0;
  return diacritics / alpha >= 0.015 ? 'vi' : 'en';
}
