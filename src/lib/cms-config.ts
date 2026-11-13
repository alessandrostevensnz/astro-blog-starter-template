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
    ['commercial', '03 - Commercial construction photo header', 'Photo behind Commercial construction and fit-outs heading and description.'],
    ['serviceCommercialCarpentry', '04 - Commercial carpentry and repairs row photo', 'Small photo to the right of Commercial carpentry and repairs.'],
    ['serviceCommercialFitouts', '05 - Commercial fit-outs and interior improvements row photo', 'Small photo to the right of Fit-outs and interior improvements.'],
    ['serviceCommercialRefurbishment', '06 - Commercial alterations and refurbishments row photo', 'Small photo to the right of Alterations and refurbishments.'],
    ['processLeft', '07 - Process photograph, left', 'Left photo in the Preparation makes a difference pair.'],
    ['processRight', '08 - Process photograph, right', 'Right photo in the Preparation makes a difference pair.'],
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
    ['whoWeAre', '02 - Photo below Good people. Good work.', 'Portrait or worksite photo shown beneath the heading on the left of the About introduction. Upload the finished photo here; leave it blank to hide the photo until ready.'],
    ['approach', '03 - Our approach photo', 'Wide image behind the craftsmanship heading.'],
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
    ['residentialHeading','Residential photo header heading'],['residentialText','Residential introduction (above residential services)','text'],['commercialHeading','Commercial photo header heading'],['commercialText','Commercial introduction (above three service rows)','text'],
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
  ],
  contact: [
    ['heroEyebrow', '01 - Contact banner small label'],
    ['heroHeading', '02 - Contact banner heading', 'text'],
    ['heroDescription', '03 - Contact banner introduction', 'text'],
    ['sectionEyebrow', '04 - Contact section small label'],
    ['sectionHeading', '05 - Contact section heading', 'text'],
    ['sectionDescription', '06 - Contact section description', 'text'],
    ['contactEmail', 'Optional email address shown on Contact'],
    ['emailPrefix', '07 - Words before contact email'],
    ['nameLabel', '08 - Your name field label'],
    ['emailLabel', '09 - Email address field label'],
    ['serviceLabel', '10 - Service selection label'],
    ['servicePlaceholder', '11 - First service dropdown prompt'],
    ['messageLabel', '13 - Project message field label'],
    ['submitLabel', '14 - Send button wording'],
    ['formNotice', '15 - Note underneath the form', 'text'],
    ['sendingButton', '16 - Sending button wording'],
    ['sendingStatus', '17 - Message while sending', 'text'],
    ['successStatus', '18 - Success confirmation', 'text'],
    ['providerErrorFallback', '19 - Form error fallback text', 'text'],
    ['errorSuffix', '20 - Guidance when an error occurs', 'text'],
    ['genericError', '21 - Unexpected error message', 'text'],
    ['metaTitle', 'Google and browser tab title'],
    ['metaDescription', 'Google search description', 'text'],
  ],
};
const styled: Record<string, string[]> = {
  home: ['title','subtitle','introHeading','introText','servicesHeading','featureHeading','closingHeading','philosophyHeading','philosophyText'],
  construction: ['introHeading','introText'], maintenance: ['introHeading','introText'], about: ['whoHeading','whoText'],
  projects: ['heroEyebrow','heroHeading','heroDescription','galleryTip','galleryNote','ctaHeading','ctaButtonText'],
  contact: [
    'heroEyebrow','heroHeading','heroDescription','sectionEyebrow','sectionHeading',
    'sectionDescription','emailPrefix','nameLabel','emailLabel','serviceLabel',
    'messageLabel','submitLabel','formNotice',
  ],
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
      // All page headings and paragraphs accept Return. Decap's single-line
      // string input does not, so use a multiline widget for headings too.
      // This changes only the editor input, never the stored string value.
      const isMultiline = widget === 'text' || key === 'title' || /Heading$|CardTitle$/.test(key);
      const editorWidget = isMultiline ? 'text' : widget;
      const textHint = 'Press Return for a new line. Leave a blank line (Return twice) for a paragraph gap. Both the preview and published website preserve the spacing.';
      const options = name === 'contact' && key === 'contactEmail'
        ? { required: false, hint: 'Optional. Leave blank to hide the email link. Use a full address such as hello@example.com.' }
        : isMultiline ? { hint: textHint } : {};
      fields.push(field(key,title,editorWidget,options));
      if (styled[name]?.includes(key)) fields.push(formatting(key,title));
      if (name === 'construction' && key === 'residentialText') {
        fields.push(field('residentialHighlights', 'Residential - additional bullet points', 'list', {
          label_singular: 'Bullet point',
          required: false,
          hint: 'Optional short bullet points shown below the residential introduction. Use Add to create more, drag to reorder, or delete any point.',
          field: field('text', 'Bullet point', 'string'),
        }));
        fields.push(field('residentialServices', 'Residential services - edit or add service rows', 'list', {
          label_singular: 'Residential service',
          collapsed: false,
          summary: '{{fields.title}}',
          hint: 'The numbered General carpentry / Decks / Renovations rows on the public site. Edit any title, description or photo. Use Add to create new rows, drag to reorder, or remove a row. Photos are optional.',
          fields: [
            field('title', 'Service heading'),
            field('description', 'Description', 'text', { required: false }),
            field('bulletPoints', 'Optional bullet points under this service', 'list', {
              label_singular: 'Bullet point',
              required: false,
              field: field('text', 'Bullet point', 'string'),
              hint: 'Use Add to list specific types of work beneath this service description.',
            }),
            field('image', 'Service photograph (optional)', 'image', { required: false, choose_url: true }),
            field('imageAlt', 'Photo description (alt text)', 'string', { required: false }),
          ],
        }));
      }
      if (name === 'contact' && key === 'servicePlaceholder') {
        fields.push(field('serviceOptions', '12 - Service dropdown choices', 'list', {
          label_singular: 'Service choice', collapsed: true, min: 1,
          summary: '{{fields.label}}',
          hint: 'These are the choices in the Contact form. Editing a choice changes the wording sent with an enquiry, not the form submission service.',
          fields: [field('label', 'Service name')],
        }));
      }
    }
  };
  if (name === 'projects' || name === 'contact') addTextFields();
  // Show the Construction landing video FIRST. It was previously buried below eleven image
  // controls, which made it difficult to find on mobile. This is the same Decap file
  // widget / heroVideo data field used for the Projects landing video.
  if (name === 'construction') {
    fields.push(field('heroVideo', 'LANDING BANNER VIDEO (MP4) - Built with purpose.', 'file', {
      required: false,
      hint: 'This is the FIRST banner at the top of /construction/, behind Built with purpose. Upload an MP4 here and click Publish, exactly as you do on the Projects page. The video plays automatically, silently and on repeat. Your main Construction banner photograph below remains the fallback. For fast mobile loading, use an optimised MP4 (ideally under 10 MB).',
    }));
  }
  if (name === 'construction') addTextFields();
  if (photos[name]) fields.push(field('photos','Page photographs','object',{
    collapsed:false, hint:name === 'construction'
      ? 'Residential service row photographs are edited inside the Residential services list above. This panel controls the remaining fixed Construction banners and Commercial / Process photographs.'
      : 'All fixed photograph positions on this page, including repeated pictures. Every position has its own photo and description.',
    fields:photos[name].map(([key,title,hint])=>key === 'whoWeAre'
      ? field(key,title,'object',{
          collapsed:false,required:false,hint,
          fields:[field('src','Photo','image',{required:false,choose_url:true}),
                  field('alt','Photo description (alt text)','string',{required:false})],
        })
      : photo(key,title,hint)),
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
  if (name !== 'projects' && name !== 'contact' && name !== 'construction') addTextFields();
  fields.push(footer());
  return { name,label,file:'content/pages/'+name+'.json',preview_path:path,
    description:name === 'contact' ? 'Edit all Contact page headings, explanations, form wording and service choices. The form integration and footer images stay intact.' : 'All photographs and existing editable text for '+label+'. Changing a photo here affects this page only.',fields };
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
