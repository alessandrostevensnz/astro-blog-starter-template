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
    ['hero', '01 - Main construction banner', 'Large image at the very top.'],
    ['serviceCarpentry', '02 - General carpentry row photo', 'Small photo on the right of General carpentry, below Residential construction.'],
    ['serviceDecks', '03 - Decks and fencing row photo', 'Small photo on the right of Decks and fencing.'],
    ['serviceRenovations', '04 - Renovations and alterations row photo', 'Small photo on the right of Renovations and alterations.'],
    ['residential', '05 - Residential construction photo header', 'Full-width Residential Construction banner with the heading and description over the image. The service photos below have their own controls.'],
    ['commercial', '06 - Commercial construction photo header', 'Full-width commercial header photo behind the heading and text. The title and description are editable in the Construction text fields below.'],
    ['processLeft', '07 - Process photograph, left', 'Left image in the Preparation makes a difference pair.'],
    ['processRight', '08 - Process photograph, right', 'Right image in the Preparation makes a difference pair.'],
  ],
  maintenance: [
    ['hero', '01 - Main maintenance banner', 'Large image behind Look after what matters.'],
    ['closing', 'Closing property-care photo', 'Wide image below all the service cards, near the bottom.'],
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
    ['residentialHeading','Residential photo header heading'],['residentialText','Residential photo header description','text'],['commercialHeading','Commercial heading'],['commercialText','Commercial description','text'],
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
  projects: [], contact: [],
};
const styled: Record<string, string[]> = {
  home: ['title','subtitle','introHeading','introText','servicesHeading','featureHeading','closingHeading','philosophyHeading','philosophyText'],
  construction: ['introHeading','introText'], maintenance: ['introHeading','introText'], about: ['whoHeading','whoText'],
};
const services = field('services', 'Service photographs and descriptions', 'list', {
  label_singular: 'Maintenance service', collapsed: false, summary: '{{fields.number}} - {{fields.title}}',
  hint: 'The service cards between the banner and closing photo. Empty photo positions are included. Drag cards to reorder.',
  fields: [field('number','Display number'),field('title','Service title'),field('image','Service photo','image',{required:false}),field('imageAlt','Photo description (alt text)','string',{required:false}),
    field('caption','Photo caption','string',{required:false}),field('description','Service description','text')],
});
const projectCards = field('projects', 'All Projects-page photographs', 'list', {
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
  if (photos[name]) fields.push(field('photos','Page photographs','object',{
    collapsed:false, hint:'All fixed photograph positions on this page, including repeated pictures. Every position has its own photo and description.',
    fields:photos[name].map(([key,title,hint])=>photo(key,title,hint)),
  }));
  if (name === 'maintenance') fields.push(services);
  if (name === 'projects') fields.push(projectCards);
  for (const [key,title,widget] of text[name]) {
    fields.push(field(key,title,widget));
    if (styled[name]?.includes(key)) fields.push(formatting(key,title));
  }
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
