/** Page-first Decap configuration. Served statically at the existing /admin/config.yml URL. */
type Field = { name: string; label: string; widget: string; [key: string]: unknown };
type Row = [name: string, label: string, widget?: string];
const field = (name: string, label: string, widget = 'string', options: Record<string, unknown> = {}): Field => ({ name, label, widget, ...options });
const palette = [
  ['Website default', ''], ['Black', '#000000'], ['Charcoal', '#1B1B19'],
  ['Dark grey', '#444444'], ['Grey', '#77746E'], ['Light grey', '#C8C8C8'],
  ['White', '#FFFFFF'], ['ANDRO gold', '#B49B70'], ['Warm beige', '#D6C5AB'],
  ['Forest green', '#315C48'], ['Navy', '#263B53'],
].map(([label, value]) => ({ label, value }));
function photo(name: string, label: string, hint: string): Field {
  return field(name, label, 'object', {
    collapsed: false,
    hint: hint + ' This position is independent. Upload a replacement with a new filename to avoid overwriting a file used elsewhere.',
    fields: [field('src', 'Photo', 'image', { choose_url: true }), field('alt', 'Photo description (alt text)')],
  });
}
function formatting(name: string, label: string): Field {
  return field(name + 'Style', label + ' formatting', 'object', {
    collapsed: true, required: false,
    fields: [
      field('sizePx', 'Text size (px)', 'number', { required: false, value_type: 'int', min: 10, max: 120, hint: 'Leave blank for the website default.' }),
      field('color', 'Colour', 'select', { required: false, options: palette }),
      field('size', 'Existing relative size (%)', 'number', { required: false, value_type: 'int', min: 60, max: 180, hint: 'Existing percentage setting. Pixel size takes precedence.' }),
    ],
  });
}
const footer = () => field('footerImages', 'Footer images on this page', 'object', {
  collapsed: true,
  hint: 'Both images at the very bottom of this page. Changing them here does not change another page.',
  fields: [photo('logo', 'ANDRO footer logo', 'First footer image.'), photo('badge', 'Membership / safety badge', 'Second footer image. Only display a badge you are authorised to use.')],
});
const photos: Record<string, Array<[string, string, string]>> = {
  home: [
    ['hero', '01 - Main banner', 'Large image at the top of the homepage.'],
    ['constructionCard', '02 - Construction service card', 'Left service card linking to Construction.'],
    ['maintenanceCard', '03 - Maintenance service card', 'Right service card linking to Asset maintenance.'],
    ['feature', '04 - Quality / approach feature', 'Wide image behind Quality is in the details.'],
  ],
  construction: [
    ['hero', '01 - Main construction banner', 'Large image at the very top of Construction.'],
    ['residential', '02 - Residential construction photo header', 'Photo behind Residential construction and carpentry heading and description.'],
    ['serviceCarpentry', '03 - General carpentry row photo', 'Small photo on the right of General carpentry.'],
    ['serviceDecks', '04 - Decks and fencing row photo', 'Small photo on the right of Decks and fencing.'],
    ['serviceRenovations', '05 - Renovations and alterations row photo', 'Small photo on the right of Renovations and alterations.'],
    ['commercial', '06 - Commercial construction photo header', 'Photo behind Commercial construction and fit-outs heading and description.'],
    ['serviceCommercialCarpentry', '07 - Commercial carpentry and repairs row photo', 'Small photo to the right of Commercial carpentry and repairs.'],
    ['serviceCommercialFitouts', '08 - Commercial fit-outs and interior improvements row photo', 'Small photo to the right of Fit-outs and interior improvements.'],
    ['serviceCommercialRefurbishment', '09 - Commercial alterations and refurbishments row photo', 'Small photo to the right of Alterations and refurbishments.'],
    ['processLeft', '10 - Process photograph, left', 'Left photo in the Preparation makes a difference pair.'],
    ['processRight', '11 - Process photograph, right', 'Right photo in the Preparation makes a difference pair.'],
  ],
  maintenance: [
    ['hero', '01 - Main maintenance banner', 'Large image behind Look after what matters.'],
    ['closing', 'Closing property-care photo', 'Wide image below all the service cards, near the bottom.'],
  ],
  projects: [
    ['hero', '01 - Projects header background', 'Large full-width photo behind Every brief starts somewhere. This is independent of the Projects gallery photos and can be replaced whenever you like.'],
  ],
  about: [
    ['hero', '01 - About banner', 'Image behind Built on care. Grounded in craft.'],
    ['approach', '02 - Our approach photo', 'Wide image behind the craftsmanship heading.'],
  ],
};
const text: Record<string, Row[]> = {
  home: [
    ['title','Main headline'],['subtitle','Hero description','text'],['introHeading','Introduction heading'],['introText','Introduction text','text'],
    ['servicesHeading','Services heading'],['constructionCardTitle','Construction card title'],['constructionCardDescription','Construction card description','text'],
    ['maintenanceCardTitle','Maintenance card title'],['maintenanceCardDescription','Maintenance card description','text'],['featureHeading','Feature section heading'],
    ['philosophyHeading','Philosophy heading'],['philosophyText','Philosophy text','text'],['closingHeading','Bottom call-to-action heading'],
  ],
  construction: [
    ['description','Page description','text'],['introHeading','Introduction heading'],['introText','Introduction text','text'],
    ['residentialHeading','Residential photo header heading'],['residentialText','Residential introduction (above three service rows)','text'],['commercialHeading','Commercial photo header heading'],['commercialText','Commercial introduction (above three service rows)','text'],
    ['processHeading','Process heading'],['processText','Process description','text'],
  ],
  maintenance: [
    ['description','Page description','text'],['introHeading','Introduction heading'],['introText','Introduction text','text'],
    ['preventativeHeading','Preventative maintenance heading'],['preventativeText','Preventative maintenance description','text'],
    ['residentialHeading','Residential heading'],['residentialText','Residential description','text'],['commercialHeading','Commercial heading'],['commercialText','Commercial description','text'],
    ['assetHeading','Asset maintenance heading'],['assetText','Asset maintenance description','text'],['improvementsHeading','Repairs and improvements heading'],['improvementsText','Repairs and improvements description','text'],
  ],
  about: [
    ['description','Page description','text'],['heroIntro','Banner introduction','text'],['whoHeading','Who we are heading'],['whoText','Who we are description','text'],
    ['craftHeading','Craftsmanship heading'],['craftText','Craftsmanship description','text'],['visionHeading','Vision heading'],['visionText','Vision description','text'],
  ],
  projects: [
    ['heroEyebrow', '01 - Banner small label'],
    ['heroHeading', '02 - Main Projects banner heading', 'text'],
    ['heroDescription', '03 - Banner introduction paragraph', 'text'],
    ['galleryTip', '04 - Gallery instructions', 'text'],
    ['galleryNote', '05 - Paragraph below the project photos', 'text'],
    ['ctaHeading', '06 - Contact section heading', 'text'],
    ['ctaButtonText', '07 - Contact link wording'],
    ['metaTitle', 'Google and browser tab title'],
    ['metaDescription', 'Google search description', 'text'],
  ], contact: [],
};
const styled: Record<string, string[]> = {
  home: ['title','subtitle','introHeading','introText','servicesHeading','featureHeading','closingHeading','philosophyHeading','philosophyText'],
  construction: ['introHeading','introText'], maintenance: ['introHeading','introText'], about: ['whoHeading','whoText'],
  projects: ['heroEyebrow','heroHeading','heroDescription','galleryTip','galleryNote','ctaHeading','ctaButtonText'],
};
const services = field('services', 'Service photographs and descriptions', 'list', {
  label_singular: 'Maintenance service', collapsed: false, summary: '{{fields.number}} - {{fields.title}}',
  hint: 'The service cards between the banner and closing photo. Empty photo positions are included. Drag cards to reorder.',
  fields: [field('number','Display number'),field('title','Service title'),field('image','Service photo','image',{required:false}),field('imageAlt','Photo description (alt text)','string',{required:false}),
    field('caption','Photo caption','string',{required:false}),field('description','Service description','text')],
});
const projectCards = field('projects', 'Project gallery - photos, titles, categories and descriptions', 'list', {
  label_singular: 'Project photograph',
  collapsed: false,
  summary: '{{fields.title}}',
  hint: 'Photos appear on /projects/ and automatically scroll through the showcase on /construction/. Drag and drop to reorder both displays, then Publish. The fixed Construction banners and service photos are edited separately on the Construction page.',
  fields: [
    field('title', 'Project title'),
    field('image', 'Project photograph', 'image'),
    field('alt', 'Photo description (alt text)'),
    field('category', 'Category'),
    field('description', 'Hover description (shown when the mouse is over this photo)', 'text', {required: false, hint: 'Write a short custom description of the work. On mobile, visitors can tap the image to read it.'}),
  ],
});
const entries: Array<[string,string,string]> = [
  ['home','Home','/'],['construction','Construction','/construction/'],['maintenance','Asset maintenance','/property-maintenance/'],
  ['projects','Projects','/projects/'],['about','About','/about/'],['contact','Contact','/contact/'],
];
const pageFiles = entries.map(([name,label,path]) => {
  const fields: Field[] = [];
  // Put the Projects writing controls above the long photo gallery. Every
  // public-facing Projects section is now editable without scrolling past photos.
  const addTextFields = () => {
    for (const [key,title,widget] of text[name]) {
      fields.push(field(key,title,widget, name === 'projects' && key === 'heroHeading'
        ? { hint: 'Press Enter for a line break in the main banner heading.' }
        : name === 'projects' && key === 'ctaHeading'
          ? { hint: 'Press Enter for a line break in the bottom contact heading.' }
          : {}));
      if (styled[name]?.includes(key)) fields.push(formatting(key,title));
    }
  };
  if (name === 'projects') addTextFields();
  // Show the Construction landing video FIRST. It was previously buried below eleven image
  // controls, which made it difficult to find on mobile. This is the same Decap file
  // widget / heroVideo data field used for the Projects landing video.
  if (name === 'construction') {
    fields.push(field('heroVideo', 'LANDING BANNER VIDEO (MP4) - Built with purpose.', 'file', {
      required: false,
      hint: 'This is the FIRST banner at the top of /construction/, behind Built with purpose. Upload an MP4 here and click Publish, exactly as you do on the Projects page. The video plays automatically, silently and on repeat. Your main Construction banner photograph below remains the fallback. For fast mobile loading, use an optimised MP4 (ideally under 10 MB).',
    }));
  }
  if (photos[name]) fields.push(field('photos','Page photographs','object',{
    collapsed:false, hint:name === 'construction'
      ? 'The first Main construction banner photo is the fallback behind the landing VIDEO field above. All other photos belong to their own Construction sections and service rows.'
      : 'All fixed photograph positions on this page, including repeated pictures. Every position has its own photo and description.',
    fields:photos[name].map(([key,title,hint])=>photo(key,title,hint)),
  }));
  if (name === 'home' || name === 'about') {
    fields.push(field('heroVideo', name === 'home' ? '02 - Home header background video (MP4)' : '02 - About header background video (MP4)', 'file', {
      required: false,
      hint: 'The About header currently uses a genuine 1080p, 8-second MP4 rendered from your original photo, with subtle movement in the outdoor greenery. Upload a replacement MP4 if needed; the still photo remains the fallback. The Home hero keeps its original photo-only animation unless a Home video is added.',
    }));
  }
  if (name === 'maintenance') {
    fields.push(field('heroVideo', '02 - Maintenance landing background video (MP4)', 'file', {
      required: false,
      hint: 'Upload a muted, looping MP4 for the Look after what matters landing banner. For a seamless load, the Preview frame image field below should match the very first frame of your video.',
    }));
    fields.push(field('heroVideoPoster', '03 - Maintenance video first-frame preview (image)', 'image', {
      required: false,
      hint: 'Image shown while the video loads and used as its fallback. Use a screenshot of the FIRST frame of the same video so there is no flash of a different photo. For the current video, a matching frame was generated automatically.',
    }));
    fields.push(services);
  }
  if (name === 'projects') {
    fields.push(field('heroVideo', '02 - Projects landing background video (MP4)', 'file', {
      required: false,
      hint: 'The Projects landing banner plays silently on repeat. For seamless loading, upload a matching first-frame JPG in the video preview image field below.',
    }));
    fields.push(field('heroVideoPoster', '03 - Projects video first-frame preview (image)', 'image', {
      required: false,
      hint: 'Shown immediately while the video loads. Use a screenshot of the FIRST frame of the current video so the picture does not flash or jump as playback begins. A matching preview has been generated for the existing Projects MP4.',
    }));
    fields.push(projectCards);
  }
  if (name !== 'projects') addTextFields();
  fields.push(footer());
  return { name,label,file:'content/pages/'+name+'.json',preview_path:path,
    description:name === 'contact' ? 'Contact currently has no main-page photo. Its two footer images are here; the enquiry form is unchanged.' : 'All photographs and existing editable text for '+label+'. Changing a photo here affects this page only.',fields };
});
const overrides = Object.entries(styled).flatMap(([page,keys])=>keys.map(key=>field(page+'__'+key,page+' - '+key,'object',{
  collapsed:true,required:false,fields:[field('size','Size (%)','number',{required:false,value_type:'int',min:60,max:180}),field('color','Colour','color',{required:false,allowInput:true})],
})));
export const cmsConfig = {
  backend: { name:'github',repo:'alessandrostevensnz/astro-blog-starter-template',branch:'main',base_url:'https://andro.co.nz',auth_endpoint:'api/auth' },
  media_folder:'public/images',public_folder:'/images',
  collections:[
    {name:'pages',label:'Pages - photos and text',label_singular:'Page',delete:false,files:pageFiles},
    {name:'settings',label:'Website-wide appearance',delete:false,editor:{preview:false},files:[{
      name:'appearance',label:'Fonts and colours',file:'content/site-settings.json',fields:[field('typography','Website-wide fonts and colours','object',{
        collapsed:false,fields:[field('global','Default text appearance','object',{fields:[
          field('headingSize','Heading size (%)','number',{value_type:'int',min:70,max:150,default:100}),
          field('bodySize','Body size (%)','number',{value_type:'int',min:80,max:150,default:100}),
          field('headingColor','Heading colour','color',{default:'#1b1b19',allowInput:true}),field('bodyColor','Body colour','color',{default:'#77746e',allowInput:true}),
        ]}),field('overrides','Advanced text settings','object',{collapsed:true,required:false,fields:overrides})],
      })],
    }]},
  ],
};
