import legacy from '../../content/site.json';
import home from '../../content/pages/home.json';
import construction from '../../content/pages/construction.json';
import maintenance from '../../content/pages/maintenance.json';
import about from '../../content/pages/about.json';
import projects from '../../content/pages/projects.json';
import contact from '../../content/pages/contact.json';
import settings from '../../content/site-settings.json';
import footerSettings from '../../content/site-footer.json';

export const site = {
  name: 'ANDRO',
  descriptor: 'Construction + Projects',
  legalName: 'Andro Construction Limited',
  established: '2020',
  location: 'Auckland, New Zealand',
  email: '',
};

// One source file per CMS page. Legacy content remains as a migration backup,
// not as a second editable source of the same photographs.
export const pageContent = { home, construction, maintenance, about, projects, contact };
export const siteContent = {
  ...legacy, home, construction, maintenance, about,
  projects: projects.projects,
  typography: settings.typography,
};

// Retained for older non-page consumers; the main pages use their own photos.
export const imagery = {
  hero: { ...legacy.images.hero, placeholder: true },
  construction: { ...legacy.images.construction, placeholder: false },
  home: { ...legacy.images.home, placeholder: false },
  exterior: { ...legacy.images.exterior, placeholder: false },
  maintenance: { ...legacy.images.maintenance, placeholder: false },
  detail: { ...legacy.images.detail, placeholder: true },
  commercialCavity: { ...legacy.images.commercialCavity, placeholder: false },
  commercialGib: { ...legacy.images.commercialGib, placeholder: false },
  commercial: { ...legacy.images.commercial, placeholder: false },
};

// One shared footer, edited in Website-wide settings under /admin.
export const siteFooter = footerSettings;

export const navigation = [
  { label: 'Construction', href: '/construction/' },
  { label: 'Asset maintenance', href: '/property-maintenance/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/contact/' },
];
