import { auth, signIn } from '../../auth';
import { redirect } from 'next/navigation';
import { LoginCard } from './_components/LoginCard';

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect('/dashboard');
  }

  const handleSignIn = async () => {
    'use server';
    await signIn('google', { redirectTo: '/dashboard' });
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <LoginCard signIn={handleSignIn} />
    </div>
  );
}
