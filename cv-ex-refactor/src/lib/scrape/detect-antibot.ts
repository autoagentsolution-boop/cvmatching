const TITLE_SIGNATURES: RegExp[] = [
  /<title[^>]*>[^<]*just a moment/i,
  /<title[^>]*>[^<]*attention required/i,
  /<title[^>]*>[^<]*access denied/i,
  /<title[^>]*>[^<]*are you a (?:robot|human)/i,
  /<title[^>]*>[^<]*captcha/i,
  /<title[^>]*>[^<]*cloudflare/i,
];

const STRONG_BODY_SIGNATURES: RegExp[] = [
  /cf-challenge-form|cf-error-details|cf_chl_/i,
  /cdn-cgi\/challenge-platform/i,
  /g-recaptcha-response/i,
  /h-captcha-response/i,
];

export function detectAntibot(html: string): boolean {
  const head = html.slice(0, 8000);
  if (TITLE_SIGNATURES.some((rx) => rx.test(head))) return true;
  if (STRONG_BODY_SIGNATURES.some((rx) => rx.test(head))) return true;
  return false;
}
