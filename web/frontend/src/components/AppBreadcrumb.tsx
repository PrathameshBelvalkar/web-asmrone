import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './ui/breadcrumb';
import { useCrumbState } from '../lib/crumbs';

/** Breadcrumb trail set by the current page. Falls back to "Home" when a page sets none. */
export function AppBreadcrumb() {
  const { items } = useCrumbState();
  const trail = items.length ? items : [{ label: 'Home', to: '/' }];
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {trail.map((crumb, i) => {
          const last = i === trail.length - 1;
          // Earlier steps hide on phones to leave room for the page name.
          const hideOnPhone = !last ? 'hidden sm:flex' : 'flex';
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              {/* Only the page name shrinks (and truncates); earlier steps keep their width. */}
              <BreadcrumbItem className={`${hideOnPhone} ${last ? 'min-w-0' : 'shrink-0'}`}>
                {last || !crumb.to ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator className="hidden sm:flex" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
