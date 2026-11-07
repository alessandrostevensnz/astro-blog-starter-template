export const site = {
  name: 'ANDRO',
  descriptor: 'Construction + Projects',
  legalName: 'Andro Construction Limited',
  established: '2020',
  location: 'Auckland, New Zealand',
  // Set this to a verified company email when ready. The preview form does not send submissions.
  email: '',
};

// Temporary editorial images only. These are illustrative stock photos, not ANDRO project photography.
// Swap the src values for owned project images in one place when they are available.
export const imagery = {
  hero: {
    src: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2400&q=85',
    alt: 'Illustrative contemporary residential architecture',
    placeholder: true,
  },
  construction: {
    src: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1600&q=85',
    alt: 'Illustrative construction site with structural framing',
    placeholder: true,
  },
  home: {
    src: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=85',
    alt: 'Illustrative contemporary home interior',
    placeholder: true,
  },
  exterior: {
    src: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1600&q=85',
    alt: 'Illustrative residential exterior and garden',
    placeholder: true,
  },
  maintenance: {
    src: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=85',
    alt: 'Illustrative building detail for property maintenance',
    placeholder: true,
  },
  detail: {
    src: 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=2000&q=85',
    alt: 'Illustrative architectural material detail',
    placeholder: true,
  },
};

export const navigation = [
  { label: 'Construction', href: '/construction/' },
  { label: 'Asset maintenance', href: '/property-maintenance/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/contact/' },
];
