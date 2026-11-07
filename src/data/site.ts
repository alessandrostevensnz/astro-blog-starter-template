export const site = {
  name: 'ANDRO',
  descriptor: 'Construction + Projects',
  legalName: 'Andro Construction Limited',
  established: '2020',
  location: 'Auckland, New Zealand',
  // Set this to a verified company email when ready. The preview form does not send submissions.
  email: '',
};

// Supplied imagery in public/images. Interior images are illustrative; commercial site photos show construction details.
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
    src: '/images/Bright%20Minimalist%20Living%20Room%20Retreat.png',
    alt: 'Bright minimalist living room',
    placeholder: true,
  },
  exterior: {
    src: '/images/Bright%20Wainscoted%20Hallway%20with%20Open%20Door.png',
    alt: 'Bright wainscoted hallway with an open door',
    placeholder: true,
  },
  maintenance: {
    src: '/images/Modern%20Warm-Toned%20Bathroom%20Retreat.png',
    alt: 'Modern warm-toned bathroom interior',
    placeholder: true,
  },
  detail: {
    src: '/images/Bright%20Minimalist%20Kitchen%20with%20Fruit%20Bowl.png',
    alt: 'Bright minimalist kitchen with a fruit bowl',
    placeholder: true,
  },
  commercialCavity: {
    src: '/images/Commercial%20cavity.png',
    alt: 'Commercial wall cavity during construction',
    placeholder: false,
  },
  commercialGib: {
    src: '/images/comerrical%20GIB.png',
    alt: 'Commercial interior lining installation',
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
