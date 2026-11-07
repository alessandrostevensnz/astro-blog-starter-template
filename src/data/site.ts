export const site = {
  name: 'ANDRO',
  descriptor: 'Construction + Projects',
  legalName: 'Andro Construction Limited',
  established: '2020',
  location: 'Auckland, New Zealand',
  // Set this to a verified company email when ready. The preview form does not send submissions.
  email: '',
};

// Supplied project photos are used for matching construction work; the interior photo is illustrative.
export const imagery = {
  hero: {
    src: '/images/Sunlit%20Scandinavian%20Apartment%20Living%20Space.png',
    alt: 'Sunlit Scandinavian-style apartment living space',
    placeholder: true,
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
    src: '/images/cladding.png',
    alt: 'Exterior cladding on a property',
    placeholder: false,
  },
  detail: {
    src: '/images/Bright%20Minimalist%20Living%20Room%20Retreat.png',
    alt: 'Beautiful bright minimalist living room interior',
    placeholder: true,
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
