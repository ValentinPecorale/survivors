import { config, fields, singleton } from '@keystatic/core'

const intro = (label: string, path: `src/content/sections/${string}`, extra: Record<string, ReturnType<typeof fields.text>> = {}) => singleton({
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
    about: intro('About — opening frame + highlight', 'src/content/sections/about', {
      highlight: fields.text({ label: 'Highlight word', description: 'Shown centred in the second frame, over the chrome gradient.' }),
    }),
    services: intro('Services — opening frame', 'src/content/sections/services'),
    work: intro('Work — opening frame', 'src/content/sections/work'),
  },
})
