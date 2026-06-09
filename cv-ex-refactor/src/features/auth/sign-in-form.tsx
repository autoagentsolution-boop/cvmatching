import { FcGoogle } from 'react-icons/fc';
import { MdAutoAwesome } from 'react-icons/md';
import { Button, Card } from '@/components/ui';
import { signInWithGoogle } from './sign-in-server-actions';

export function SignInForm() {
  return (
    <Card padding="lg">
      <header className="mb-8 flex flex-col items-center gap-2">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-on-primary">
          <MdAutoAwesome size={28} aria-hidden="true" />
        </div>
        <h1 className="text-center font-display text-headline-lg text-primary">
          Welcome to Resume Refactor
        </h1>
        <p className="text-center text-body-md text-on-surface-variant">
          Your AI-powered career assistant
        </p>
      </header>

      <form action={signInWithGoogle}>
        <Button variant="secondary" size="lg" fullWidth leadingIcon={<FcGoogle aria-hidden="true" />} type="submit">
          Continue with Google
        </Button>
      </form>
    </Card>
  );
}
