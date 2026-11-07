import content from '../../content/site.json';

export const site = {
  name: 'ANDRO',
  descriptor: 'Construction + Projects',
  legalName: 'Andro Construction Limited',
  established: '2020',
  location: 'Auckland, New Zealand',
  // Set this to a verified company email when ready. The preview form does not send submissions.
  email: '',
};

export const siteContent = content;

// Image paths, alt text and page copy are maintained in content/site.json and editable in /admin.
export const imagery = {
  hero: { ...content.images.hero, placeholder: true },
  construction: { ...content.images.construction, placeholder: false },
  home: { ...content.images.home, placeholder: false },
  exterior: { ...content.images.exterior, placeholder: false },
  maintenance: { ...content.images.maintenance, placeholder: false },
  detail: { ...content.images.detail, placeholder: true },
  commercialCavity: { ...content.images.commercialCavity, placeholder: false },
  commercialGib: { ...content.images.commercialGib, placeholder: false },
  commercial: { ...content.images.commercial, placeholder: false },
};

export const navigation = [
  { label: 'Construction', href: '/construction/' },
  { label: 'Asset maintenance', href: '/property-maintenance/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/contact/' },
];
