export const site = {
  name: 'ANDRO',
  descriptor: 'Construction + Projects',
  legalName: 'Andro Construction Limited',
  established: '2020',
  location: 'Auckland, New Zealand',
  // Set this to a verified company email when ready. The preview form does not send submissions.
  email: '',
};

// Supplied project photos are used for matching construction work; interior renders remain illustrative.
export const imagery = {
  hero: {
    src: '/images/residential%20house%20with%20trees.png',
    alt: 'Residential house set among trees',
    placeholder: false,
  },
  construction: {
    src: '/images/commercial%20framing.png',
    alt: 'Commercial construction framing',
    placeholder: false,
  },
  home: {
    src: '/images/Residential%20framing.png',
    alt: 'Residential building framing during construction',
    placeholder: false,
  },
  exterior: {
    src: '/images/residential%20house%20with%20trees.png',
    alt: 'Residential house exterior among trees',
    placeholder: false,
  },
  maintenance: {
    src: '/images/fence.png',
    alt: 'Fence construction and exterior boundary work',
    placeholder: false,
  },
  detail: {
    src: '/images/ballustrade.png',
    alt: 'Balustrade detail',
    placeholder: false,
  },
  commercialCavity: {
    src: '/images/Commercial%20cavity.png',
    alt: 'Commercial wall cavity during construction',
    placeholder: false,
  },
  commercialGib: {
    src: '/images/comerrical%20GIB.png',
    alt: 'Commercial GIB interior lining installation',
    placeholder: false,
  },
  commercial: {
    src: '/images/commercial.png',
    alt: 'Commercial construction project',
    placeholder: false,
  },
};

export const navigation = [
  { label: 'Construction', href: '/construction/' },
  { label: 'Asset maintenance', href: '/property-maintenance/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/contact/' },
];
