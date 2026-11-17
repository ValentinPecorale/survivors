import { config, fields, singleton } from '@keystatic/core'

const intro = (label: string, path: `src/content/sections/${string}`, extra: Record<string, ReturnType<typeof fields.text> | ReturnType<typeof fields.array>> = {}) => singleton({
  label,
  path,
  format: { data: 'json' },
  schema: {
    heading: fields.text({ label: 'Heading', validation: { isRequired: true } }),
    text: fields.text({ label: 'Text', multiline: true, validation: { isRequired: true }, description: 'The text flows into two columns on desktop and one column on mobile.' }),
    ...extra,
  },
})

export default config({
  storage: { kind: 'local' },
  singletons: {
    about: intro('About — opening frame + words', 'src/content/sections/about', {
      whatLabel: fields.text({ label: 'Second frame · label', validation: { isRequired: true } }),
      whatText: fields.text({ label: 'Second frame · text', multiline: true, validation: { isRequired: true } }),
      words: fields.array(fields.text({ label: 'Word', validation: { isRequired: true } }), {
        label: 'Highlight words',
        description: 'Typed one at a time in the pinned second frame: scrolling deletes the current word letter by letter, then types the next. The gradient hugs the text. The last word, fully typed, ends the section.',
        itemLabel: props => props.value,
      }),
      whoLabel: fields.text({ label: 'Third frame · label', validation: { isRequired: true } }),
      whoText: fields.text({ label: 'Third frame · text', multiline: true, validation: { isRequired: true } }),
      whoTag: fields.text({ label: 'Third frame · closing line', validation: { isRequired: true } }),
      clients: fields.array(fields.text({ label: 'Client', validation: { isRequired: true } }), {
        label: 'Client list',
        description: 'The names in the skull frame, top to bottom. Hovering one turns it white and brings it in front of the skull.',
        itemLabel: props => props.value,
      }),
    }),
    services: intro('Services — opening frame', 'src/content/sections/services'),
    work: intro('Work — opening frame', 'src/content/sections/work'),
  },
})
