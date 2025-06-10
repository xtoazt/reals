import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/auth');
  return null; // redirect() is a server component feature, no need to return JSX
}
