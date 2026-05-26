# Phase 02 — Authentication

## Context

- **Brainstorm:** [../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md](../reports/brainstorm-260525-2340-cv-ex-refactor-phase1.md)
- **Priority:** P0 (blocks Phase 06, 07)
- **Status:** pending
- **Depends on:** Phase 01
- **Estimated effort:** 3-4 hours

## Overview

Auth.js v5 + Google OAuth. Session JWT-based, không cần DB. Auth chỉ bắt buộc khi user dùng shared API key. BYOK guest skip auth hoàn toàn.

**Login page UI**: Implement theo Stitch design (`CVEXRefactor/stitch_ai_resume_optimizer/trang_ng_nh_p/screen.png` + `code.html`).
- "Welcome to ResumeRefine" + "Your AI-powered career assistant"
- "Continue with Google" button (Google logo + text)
- ~~Email field~~ → **bỏ** (defer Phase 2 magic link). Skip OR divider + email input entirely.
- "← Enter as Guest" link → redirect `/` (BYOK mode)
- Footer: Terms / Privacy
- Bottom-left badge: "94% Success Rate" (giữ visual, làm placeholder text)

## Key Insights

- **Auth.js v5** (NextAuth v5) ổn định production cho App Router
- JWT session strategy = stateless, không cần DB cho Phase 1
- Google OAuth callback URL: `{NEXTAUTH_URL}/api/auth/callback/google`
- `auth()` helper từ server component/route handler để check session
- `useSession()` client hook cho UI state

## Requirements

### Functional
- Google sign-in button → OAuth flow → JWT cookie
- Session readable từ server route handler (cho /api/analyze quota check)
- Sign-out button
- User name + avatar hiển thị khi logged in
- Login KHÔNG bắt buộc cho BYOK flow (kiểm tra tại Phase 06)

### Non-functional
- HttpOnly secure cookie cho session
- CSRF protection (Auth.js built-in)
- Callback URL whitelist đúng cho local + production

## Architecture

```
Browser
   │
   ├─ Click "Sign in with Google"
   │
   ▼
/api/auth/signin?provider=google
   │
   ├─ Redirect Google OAuth consent
   │
   ▼
Google → /api/auth/callback/google?code=...
   │
   ├─ Auth.js exchanges code → tokens
   │
   ▼
JWT set as HttpOnly cookie
   │
   ▼
Redirect to / (homepage)
```

## Related Code Files

### Create
- `src/auth.ts` — Auth.js v5 config (top-level)
- `src/middleware.ts` — Tùy chọn, không bảo vệ route nào toàn cục Phase 1
- `src/app/api/auth/[...nextauth]/route.ts` — handlers re-export
- `src/components/auth/sign-in-button.tsx` — client component
- `src/components/auth/user-menu.tsx` — avatar + sign out
- `src/lib/get-session.ts` — server helper wrap `auth()`

### Modify
- `src/lib/env.ts` — đã có `GOOGLE_CLIENT_*`, `NEXTAUTH_SECRET`
- `src/app/layout.tsx` — wrap với `SessionProvider`

## Implementation Steps

1. **Tạo Google OAuth client** tại [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Application type: Web
   - Authorized redirect URI:
     - `http://localhost:3000/api/auth/callback/google` (dev)
     - `https://<your-vercel-domain>/api/auth/callback/google` (prod, thêm sau)
   - Copy Client ID + Client Secret vào `.env.local`

2. **Tạo `src/auth.ts`**
   ```ts
   import NextAuth from 'next-auth';
   import Google from 'next-auth/providers/google';
   import { env } from '@/lib/env';

   export const { handlers, auth, signIn, signOut } = NextAuth({
     providers: [
       Google({
         clientId: env.GOOGLE_CLIENT_ID,
         clientSecret: env.GOOGLE_CLIENT_SECRET,
       }),
     ],
     session: { strategy: 'jwt' },
     secret: env.NEXTAUTH_SECRET,
     pages: { signIn: '/sign-in' },
     callbacks: {
       async jwt({ token, user }) {
         if (user) {
           token.id = user.id ?? user.email ?? '';
         }
         return token;
       },
       async session({ session, token }) {
         if (token.id) session.user.id = String(token.id);
         return session;
       },
     },
   });
   ```

3. **Tạo `src/app/api/auth/[...nextauth]/route.ts`**
   ```ts
   export { GET, POST } from '@/auth';
   ```
   Wait — Auth.js v5 export style:
   ```ts
   import { handlers } from '@/auth';
   export const { GET, POST } = handlers;
   ```

4. **Tạo `src/lib/get-session.ts`**
   ```ts
   import { auth } from '@/auth';
   import type { Session } from 'next-auth';

   export async function getSession(): Promise<Session | null> {
     return auth();
   }
   ```

5. **Tạo `src/components/auth/sign-in-button.tsx`** (server component dùng action)
   ```tsx
   import { signIn } from '@/auth';

   export function SignInButton() {
     return (
       <form action={async () => { 'use server'; await signIn('google'); }}>
         <button type="submit" className="btn-primary">
           Đăng nhập với Google
         </button>
       </form>
     );
   }
   ```

6. **Tạo `src/components/auth/user-menu.tsx`**
   ```tsx
   import { auth, signOut } from '@/auth';

   export async function UserMenu() {
     const session = await auth();
     if (!session?.user) return null;
     return (
       <div className="flex items-center gap-2">
         {session.user.image && (
           <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" />
         )}
         <span className="text-sm">{session.user.name}</span>
         <form action={async () => { 'use server'; await signOut(); }}>
           <button type="submit" className="text-xs text-muted">Sign out</button>
         </form>
       </div>
     );
   }
   ```

7. **Tạo `src/app/sign-in/page.tsx`** trang đăng nhập tối giản
   ```tsx
   import { SignInButton } from '@/components/auth/sign-in-button';
   import { auth } from '@/auth';
   import { redirect } from 'next/navigation';

   export default async function SignInPage() {
     const session = await auth();
     if (session) redirect('/');
     return (
       <main className="grid min-h-screen place-items-center">
         <div className="w-full max-w-sm rounded-panel border bg-white p-8 text-center shadow-panel">
           <h1 className="mb-2 text-2xl font-bold">CV-EX Refactor</h1>
           <p className="mb-6 text-sm text-muted">
             Đăng nhập để dùng shared API key. Hoặc dùng key của bạn không cần đăng nhập.
           </p>
           <SignInButton />
         </div>
       </main>
     );
   }
   ```

8. **Update `src/app/layout.tsx`** thêm `UserMenu` vào header (sẽ refactor lại ở Phase 03).

9. **Type augmentation cho session.user.id** — tạo `src/types/next-auth.d.ts`:
   ```ts
   import 'next-auth';
   declare module 'next-auth' {
     interface Session {
       user: { id: string; name?: string | null; email?: string | null; image?: string | null };
     }
   }
   ```

10. **Smoke test**
    - Start dev
    - Visit `/sign-in` → click Google → consent → redirect về `/`
    - Verify cookie `authjs.session-token` set
    - Sign out → cookie xóa

## Todo List

- [ ] Tạo Google OAuth client trên Cloud Console
- [ ] Add `GOOGLE_CLIENT_ID/SECRET`, `NEXTAUTH_SECRET` vào `.env.local`
- [ ] Tạo `src/auth.ts` config
- [ ] Tạo `src/app/api/auth/[...nextauth]/route.ts`
- [ ] Tạo `src/lib/get-session.ts`
- [ ] Tạo `SignInButton` + `UserMenu` components
- [ ] Tạo `/sign-in` page
- [ ] Type augmentation `next-auth.d.ts`
- [ ] Smoke test: login flow + cookie + sign out
- [ ] Verify `auth()` callable từ Route Handler (test trong /api/health-auth nếu cần)

## Success Criteria

- ✅ Click "Đăng nhập với Google" → OAuth flow hoàn tất → quay về `/` với cookie
- ✅ `auth()` từ server component trả `Session` đúng với `user.id`
- ✅ Sign out xóa cookie
- ✅ Truy cập `/sign-in` khi đã login → auto redirect `/`
- ✅ `pnpm tsc --noEmit` không error sau type augmentation
- ✅ Cookie là `HttpOnly`, `Secure` trong production (verify via DevTools)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Auth.js v5 breaking change trước GA | Med | High | Pin exact version, monitor changelog |
| Callback URL mismatch khi deploy | High | Med | Document trong README, thêm prod URL Phase 08 |
| Session JWT size growth | Low | Low | Chỉ store id, không store profile data |

## Security Considerations

- **JWT secret 32+ chars random** — generate bằng `openssl rand -base64 32`
- **HttpOnly + Secure cookie** — Auth.js default, verify trong production
- **Callback URL whitelist nghiêm ngặt** — chỉ thêm khi cần
- **Không log session token** đầy đủ
- Phase 1 KHÔNG persist user data — chỉ JWT runtime. No PII storage.

## Next Steps

- Phase 06 (LLM endpoints) sẽ dùng `getSession()` để gate shared-key path
- Phase 07 (Quota) dùng `session.user.id` làm KV key
