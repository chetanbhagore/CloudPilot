import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  '': 'Overview',
  'connect': 'Connect Cloud',
  'discover': 'Discovery & Findings',
  'deploy': 'Deploy Center',
  'passport': 'Safety Passport™',
  'approve': 'Remediation Approvals',
  'audit': 'Audit Ledger',
  'settings': 'Settings',
  'contact': 'Contact & Support',
  'privacy': 'Privacy Policy',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Don't render on login or root overview if not needed, but on root render Home
  const items = [
    { label: 'Home', path: '/' },
    ...pathnames.map((segment, index) => {
      const url = `/${pathnames.slice(0, index + 1).join('/')}`;
      const label = ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      return { label, path: url };
    }),
  ];

  if (items.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--text-tertiary)',
        padding: '8px 0',
        marginBottom: 8,
      }}
    >
      <ol
        itemScope
        itemType="https://schema.org/BreadcrumbList"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={item.path}
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {index === 0 ? (
                <Link
                  to={item.path}
                  itemProp="item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: isLast ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    textDecoration: 'none',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--apple-blue)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = isLast ? 'var(--text-primary)' : 'var(--text-tertiary)')}
                >
                  <Home size={13} />
                  <span itemProp="name">{item.label}</span>
                </Link>
              ) : isLast ? (
                <span
                  itemProp="name"
                  aria-current="page"
                  style={{
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.path}
                  itemProp="item"
                  style={{
                    color: 'var(--text-tertiary)',
                    textDecoration: 'none',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--apple-blue)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <span itemProp="name">{item.label}</span>
                </Link>
              )}
              <meta itemProp="position" content={String(index + 1)} />

              {!isLast && (
                <ChevronRight size={12} color="var(--border-strong)" style={{ flexShrink: 0 }} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
