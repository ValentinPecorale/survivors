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
      words: fields.array(fields.text({ label: 'Word', validation: { isRequired: true } }), {
        label: 'Highlight words',
        description: 'Shown one at a time in the pinned second frame: each rises from the bottom, and the gradient hugs it once it is centred. The last one ends the section.',
        itemLabel: props => props.value,
      }),
    }),
    services: intro('Services — opening frame', 'src/content/sections/services'),
    work: intro('Work — opening frame', 'src/content/sections/work'),
  },
})
