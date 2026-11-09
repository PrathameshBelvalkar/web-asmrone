import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';
import { useCrumbs } from '../lib/crumbs';

export function NotFoundPage() {
  useCrumbs([{ label: 'Home', to: '/' }, { label: 'Not found' }]);
  return (
    <EmptyState icon={Compass} title="Page not found" action={
      <Link to="/" className="inline-flex h-10 items-center rounded-full border border-input px-5 text-sm text-foreground hover:bg-accent">Back to home</Link>
    } />
  );
}
