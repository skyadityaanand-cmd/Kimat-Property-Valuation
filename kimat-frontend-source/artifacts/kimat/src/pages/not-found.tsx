import { ArrowLeft, Home, MapPin } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-accent">
          <MapPin className="h-6 w-6" />
        </div>
        <p className="font-mono-app text-[10px] uppercase tracking-[.2em] text-muted-foreground">404 / wrong turn</p>
        <h1 className="mt-5 text-5xl font-bold tracking-[-.06em] text-primary sm:text-7xl">
          This address<br /><span className="display-serif font-medium italic text-foreground">isn’t on our map.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-sm text-sm leading-6 text-muted-foreground">The page you’re looking for may have moved. Let’s take you back to the useful part.</p>
        <Link href="/" className="focus-ring mx-auto mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5" data-testid="link-back-home">
          <ArrowLeft className="h-4 w-4" /> Back to search <Home className="ml-1 h-4 w-4 text-accent" />
        </Link>
      </div>
    </main>
  );
}