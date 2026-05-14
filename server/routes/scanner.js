import { Router } from 'express';
import pool from '../db.js';
import { evaluateJob, generateReportMarkdown, anthropicClient, MODEL } from '../lib/evaluation.js';

const router = Router();

const MAX_AUTO_EVALS = 20;

// ── Seed data ────────────────────────────────────────────────────────────────

const DEFAULT_COMPANIES = [
  // ── Greenhouse US ──────────────────────────────────────────────────────────
  // AI / ML
  { name: 'Anthropic',             api_type: 'greenhouse',    api_slug: 'anthropic' },
  { name: 'Hume AI',               api_type: 'greenhouse',    api_slug: 'humeai' },
  { name: 'Arize AI',              api_type: 'greenhouse',    api_slug: 'arizeai' },
  { name: 'Glean',                 api_type: 'greenhouse',    api_slug: 'gleanwork' },
  { name: 'Black Forest Labs',     api_type: 'greenhouse',    api_slug: 'blackforestlabs' },
  { name: 'Isomorphic Labs',       api_type: 'greenhouse',    api_slug: 'isomorphiclabs' },
  { name: 'OpenAI',                api_type: 'greenhouse',    api_slug: 'openai' },
  { name: 'Scale AI',              api_type: 'greenhouse',    api_slug: 'scaleai' },
  { name: 'Perplexity',            api_type: 'greenhouse',    api_slug: 'perplexity' },
  { name: 'Character AI',          api_type: 'greenhouse',    api_slug: 'character' },
  { name: 'Anyscale',              api_type: 'greenhouse',    api_slug: 'anyscale' },
  { name: 'Runway',                api_type: 'greenhouse',    api_slug: 'runwayml' },
  { name: 'Together AI',           api_type: 'greenhouse',    api_slug: 'togetherai' },
  { name: 'Wayve',                 api_type: 'greenhouse',    api_slug: 'wayve' },
  { name: 'Stability AI',          api_type: 'greenhouse',    api_slug: 'stabilityai' },
  { name: 'Shield AI',             api_type: 'greenhouse',    api_slug: 'shieldai' },
  { name: 'Recursion',             api_type: 'greenhouse',    api_slug: 'recursion' },
  { name: 'Benchling',             api_type: 'greenhouse',    api_slug: 'benchling' },
  // Cloud Infrastructure & DevOps
  { name: 'Cloudflare',            api_type: 'greenhouse',    api_slug: 'cloudflare' },
  { name: 'Datadog',               api_type: 'greenhouse',    api_slug: 'datadoghq' },
  { name: 'HashiCorp',             api_type: 'greenhouse',    api_slug: 'hashicorp' },
  { name: 'Harness',               api_type: 'greenhouse',    api_slug: 'harness' },
  { name: 'PagerDuty',             api_type: 'greenhouse',    api_slug: 'pagerduty' },
  { name: 'LaunchDarkly',          api_type: 'greenhouse',    api_slug: 'launchdarkly' },
  { name: 'New Relic',             api_type: 'greenhouse',    api_slug: 'newrelic' },
  { name: 'Snyk',                  api_type: 'greenhouse',    api_slug: 'snyk' },
  { name: 'Chronosphere',          api_type: 'greenhouse',    api_slug: 'chronosphere' },
  { name: 'Samsara',               api_type: 'greenhouse',    api_slug: 'samsara' },
  { name: 'Vercel',                api_type: 'greenhouse',    api_slug: 'vercel' },
  { name: 'Temporal',              api_type: 'greenhouse',    api_slug: 'temporal' },
  { name: 'RunPod',                api_type: 'greenhouse',    api_slug: 'runpod' },
  { name: 'Replit',                api_type: 'greenhouse',    api_slug: 'replit' },
  { name: 'Fastly',                api_type: 'greenhouse',    api_slug: 'fastly' },
  // Cybersecurity
  { name: 'CrowdStrike',           api_type: 'greenhouse',    api_slug: 'crowdstrike' },
  { name: 'Zscaler',               api_type: 'greenhouse',    api_slug: 'zscaler' },
  { name: 'SentinelOne',           api_type: 'greenhouse',    api_slug: 'sentinelone' },
  { name: 'Abnormal Security',     api_type: 'greenhouse',    api_slug: 'abnormalsecurity' },
  { name: 'Arctic Wolf',           api_type: 'greenhouse',    api_slug: 'arcticwolf' },
  { name: 'Lacework',              api_type: 'greenhouse',    api_slug: 'lacework' },
  { name: 'Orca Security',         api_type: 'greenhouse',    api_slug: 'orcasecurity' },
  { name: 'Axonius',               api_type: 'greenhouse',    api_slug: 'axonius' },
  { name: 'Exabeam',               api_type: 'greenhouse',    api_slug: 'exabeam' },
  { name: 'Hunters',               api_type: 'greenhouse',    api_slug: 'hunters' },
  { name: 'Cybereason',            api_type: 'greenhouse',    api_slug: 'cybereason' },
  // Data & Analytics
  { name: 'Amplitude',             api_type: 'greenhouse',    api_slug: 'amplitude' },
  { name: 'Braze',                 api_type: 'greenhouse',    api_slug: 'braze' },
  { name: 'Mixpanel',              api_type: 'greenhouse',    api_slug: 'mixpanel' },
  { name: 'Confluent',             api_type: 'greenhouse',    api_slug: 'confluent' },
  { name: 'Gong',                  api_type: 'greenhouse',    api_slug: 'gong' },
  { name: 'Highspot',              api_type: 'greenhouse',    api_slug: 'highspot' },
  { name: 'Outreach',              api_type: 'greenhouse',    api_slug: 'outreach' },
  { name: 'Speechmatics',          api_type: 'greenhouse',    api_slug: 'speechmatics' },
  // Fintech & Payments
  { name: 'Stripe',                api_type: 'greenhouse',    api_slug: 'stripe' },
  { name: 'Brex',                  api_type: 'greenhouse',    api_slug: 'brex' },
  { name: 'Marqeta',               api_type: 'greenhouse',    api_slug: 'marqeta' },
  { name: 'Affirm',                api_type: 'greenhouse',    api_slug: 'affirm' },
  { name: 'Plaid',                 api_type: 'greenhouse',    api_slug: 'plaid' },
  { name: 'Ramp',                  api_type: 'greenhouse',    api_slug: 'ramp' },
  { name: 'Chime',                 api_type: 'greenhouse',    api_slug: 'chime' },
  { name: 'Robinhood',             api_type: 'greenhouse',    api_slug: 'robinhood' },
  { name: 'Carta',                 api_type: 'greenhouse',    api_slug: 'carta' },
  { name: 'Mercury',               api_type: 'greenhouse',    api_slug: 'mercury' },
  { name: 'Gusto',                 api_type: 'greenhouse',    api_slug: 'gusto' },
  { name: 'Rippling',              api_type: 'greenhouse',    api_slug: 'rippling' },
  { name: 'Checkr',                api_type: 'greenhouse',    api_slug: 'checkr' },
  { name: 'Klaviyo',               api_type: 'greenhouse',    api_slug: 'klaviyo' },
  { name: 'Toast',                 api_type: 'greenhouse',    api_slug: 'toasttab' },
  { name: 'BILL',                  api_type: 'greenhouse',    api_slug: 'bill-com' },
  { name: 'Deel',                  api_type: 'greenhouse',    api_slug: 'deel' },
  { name: 'Remote',                api_type: 'greenhouse',    api_slug: 'remote' },
  // SaaS & Productivity
  { name: 'HubSpot',               api_type: 'greenhouse',    api_slug: 'hubspot' },
  { name: 'Asana',                 api_type: 'greenhouse',    api_slug: 'asana' },
  { name: 'Notion',                api_type: 'greenhouse',    api_slug: 'notion' },
  { name: 'monday.com',            api_type: 'greenhouse',    api_slug: 'mondaydotcom' },
  { name: 'Figma',                 api_type: 'greenhouse',    api_slug: 'figma' },
  { name: 'Miro',                  api_type: 'greenhouse',    api_slug: 'miro' },
  { name: 'Loom',                  api_type: 'greenhouse',    api_slug: 'loom' },
  { name: 'Coda',                  api_type: 'greenhouse',    api_slug: 'codahq' },
  { name: 'Box',                   api_type: 'greenhouse',    api_slug: 'box' },
  { name: 'Dropbox',               api_type: 'greenhouse',    api_slug: 'dropbox' },
  { name: 'Airtable',              api_type: 'greenhouse',    api_slug: 'airtable' },
  { name: 'Lattice',               api_type: 'greenhouse',    api_slug: 'lattice' },
  { name: 'Culture Amp',           api_type: 'greenhouse',    api_slug: 'cultureamp' },
  { name: 'Grammarly',             api_type: 'greenhouse',    api_slug: 'grammarly' },
  { name: 'Verkada',               api_type: 'greenhouse',    api_slug: 'verkada' },
  { name: 'Superhuman',            api_type: 'greenhouse',    api_slug: 'superhuman' },
  { name: 'Front',                 api_type: 'greenhouse',    api_slug: 'front' },
  { name: 'Attentive',             api_type: 'greenhouse',    api_slug: 'attentive' },
  { name: 'Procore',               api_type: 'greenhouse',    api_slug: 'procore' },
  { name: 'Sprinklr',              api_type: 'greenhouse',    api_slug: 'sprinklr' },
  { name: 'Squarespace',           api_type: 'greenhouse',    api_slug: 'squarespace' },
  { name: 'BigCommerce',           api_type: 'greenhouse',    api_slug: 'bigcommerce' },
  { name: 'Discord',               api_type: 'greenhouse',    api_slug: 'discord' },
  { name: 'Coursera',              api_type: 'greenhouse',    api_slug: 'coursera' },
  { name: 'Yotpo',                 api_type: 'greenhouse',    api_slug: 'yotpo' },
  { name: 'Intercom',              api_type: 'greenhouse',    api_slug: 'intercom' },
  { name: 'Zendesk',               api_type: 'greenhouse',    api_slug: 'zendesk' },
  { name: 'Celonis',               api_type: 'greenhouse',    api_slug: 'celonis' },
  { name: 'Contentful',            api_type: 'greenhouse',    api_slug: 'contentful' },
  { name: 'Amplemarket',           api_type: 'greenhouse',    api_slug: 'amplemarket' },
  // Consumer / Marketplace
  { name: 'Reddit',                api_type: 'greenhouse',    api_slug: 'reddit' },
  { name: 'Duolingo',              api_type: 'greenhouse',    api_slug: 'duolingo' },
  { name: 'Lyft',                  api_type: 'greenhouse',    api_slug: 'lyft' },
  { name: 'DoorDash',              api_type: 'greenhouse',    api_slug: 'doordash' },
  { name: 'Faire',                 api_type: 'greenhouse',    api_slug: 'faire' },
  { name: 'Flexport',              api_type: 'greenhouse',    api_slug: 'flexport' },
  { name: 'Instacart',             api_type: 'greenhouse',    api_slug: 'instacart' },
  { name: 'Roblox',                api_type: 'greenhouse',    api_slug: 'roblox' },
  // Identity / Comms / Networking
  { name: 'Okta',                  api_type: 'greenhouse',    api_slug: 'okta' },
  { name: 'Twilio',                api_type: 'greenhouse',    api_slug: 'twilio' },
  // Health / Bio
  { name: 'Oscar Health',          api_type: 'greenhouse',    api_slug: 'oscar' },
  { name: 'Devoted Health',        api_type: 'greenhouse',    api_slug: 'devotedhealth' },
  { name: 'Tempus',                api_type: 'greenhouse',    api_slug: 'tempus' },
  // ── Greenhouse EU ──────────────────────────────────────────────────────────
  { name: 'PolyAI',                api_type: 'greenhouse_eu', api_slug: 'polyai' },
  { name: 'Parloa',                api_type: 'greenhouse_eu', api_slug: 'parloa' },
  { name: 'Scandit',               api_type: 'greenhouse_eu', api_slug: 'scandit' },
  { name: 'Trade Republic',        api_type: 'greenhouse_eu', api_slug: 'traderepublicbank' },
  { name: 'Klarna',                api_type: 'greenhouse_eu', api_slug: 'klarna' },
  { name: 'Zalando',               api_type: 'greenhouse_eu', api_slug: 'zalando' },
  { name: 'Personio',              api_type: 'greenhouse_eu', api_slug: 'personio' },
  { name: 'Mambu',                 api_type: 'greenhouse_eu', api_slug: 'mambu' },
  { name: 'GoCardless',            api_type: 'greenhouse_eu', api_slug: 'gocardless' },
  { name: 'Monzo',                 api_type: 'greenhouse_eu', api_slug: 'monzo' },
  { name: 'Pleo',                  api_type: 'greenhouse_eu', api_slug: 'pleo' },
  { name: 'Paddle',                api_type: 'greenhouse_eu', api_slug: 'paddle' },
  { name: 'N26',                   api_type: 'greenhouse_eu', api_slug: 'n26' },
  { name: 'SumUp',                 api_type: 'greenhouse_eu', api_slug: 'sumup' },
  { name: 'Helsing',               api_type: 'greenhouse_eu', api_slug: 'helsing' },
  // ── Ashby ──────────────────────────────────────────────────────────────────
  { name: 'ElevenLabs',            api_type: 'ashby',         api_slug: 'elevenlabs' },
  { name: 'Deepgram',              api_type: 'ashby',         api_slug: 'deepgram' },
  { name: 'Vapi',                  api_type: 'ashby',         api_slug: 'vapi' },
  { name: 'Bland AI',              api_type: 'ashby',         api_slug: 'bland' },
  { name: 'Cohere',                api_type: 'ashby',         api_slug: 'cohere' },
  { name: 'LangChain',             api_type: 'ashby',         api_slug: 'langchain' },
  { name: 'Pinecone',              api_type: 'ashby',         api_slug: 'pinecone' },
  { name: 'n8n',                   api_type: 'ashby',         api_slug: 'n8n' },
  { name: 'Zapier',                api_type: 'ashby',         api_slug: 'zapier' },
  { name: 'Attio',                 api_type: 'ashby',         api_slug: 'attio' },
  { name: 'Aleph Alpha',           api_type: 'ashby',         api_slug: 'AlephAlpha' },
  { name: 'DeepL',                 api_type: 'ashby',         api_slug: 'DeepL' },
  { name: 'Synthesia',             api_type: 'ashby',         api_slug: 'synthesia' },
  { name: 'Lovable',               api_type: 'ashby',         api_slug: 'lovable' },
  { name: 'Groq',                  api_type: 'ashby',         api_slug: 'groq' },
  { name: 'Replicate',             api_type: 'ashby',         api_slug: 'replicate' },
  { name: 'Linear',                api_type: 'ashby',         api_slug: 'linear' },
  { name: 'Hex',                   api_type: 'ashby',         api_slug: 'hex' },
  { name: 'Descript',              api_type: 'ashby',         api_slug: 'descript' },
  { name: 'MotherDuck',            api_type: 'ashby',         api_slug: 'motherduck' },
  { name: 'dbt Labs',              api_type: 'ashby',         api_slug: 'dbtlabs' },
  { name: 'Monte Carlo',           api_type: 'ashby',         api_slug: 'montecarlodata' },
  { name: 'Hightouch',             api_type: 'ashby',         api_slug: 'hightouch' },
  { name: 'WorkOS',                api_type: 'ashby',         api_slug: 'workos' },
  { name: 'Neon',                  api_type: 'ashby',         api_slug: 'neon' },
  { name: 'Supabase',              api_type: 'ashby',         api_slug: 'supabase' },
  { name: 'Modal',                 api_type: 'ashby',         api_slug: 'modal' },
  { name: 'Airbyte',               api_type: 'ashby',         api_slug: 'airbyte' },
  { name: 'Retool',                api_type: 'ashby',         api_slug: 'retool' },
  { name: 'Cursor',                api_type: 'ashby',         api_slug: 'cursor' },
  { name: 'PostHog',               api_type: 'ashby',         api_slug: 'posthog' },
  { name: 'Fivetran',              api_type: 'ashby',         api_slug: 'fivetran' },
  // ── Lever ──────────────────────────────────────────────────────────────────
  { name: 'Mistral AI',            api_type: 'lever',         api_slug: 'mistral' },
  { name: 'Weights & Biases',      api_type: 'lever',         api_slug: 'wandb' },
  { name: 'Palantir',              api_type: 'lever',         api_slug: 'palantir' },
  { name: 'Qonto',                 api_type: 'lever',         api_slug: 'qonto' },
  { name: 'Spotify',               api_type: 'lever',         api_slug: 'spotify' },
  { name: 'Vinted',                api_type: 'lever',         api_slug: 'vinted' },
  { name: 'Hugging Face',          api_type: 'lever',         api_slug: 'huggingface' },
  { name: 'Anduril',               api_type: 'lever',         api_slug: 'anduril' },
  { name: 'Sourcegraph',           api_type: 'lever',         api_slug: 'sourcegraph' },
  { name: 'Grafana Labs',          api_type: 'lever',         api_slug: 'grafana' },
  { name: 'Pulumi',                api_type: 'lever',         api_slug: 'pulumi' },
  { name: 'Navan',                 api_type: 'lever',         api_slug: 'navan' },
  { name: 'Watershed',             api_type: 'lever',         api_slug: 'watershed' },
  { name: 'Cribl',                 api_type: 'lever',         api_slug: 'cribl' },
  { name: 'CoreWeave',             api_type: 'lever',         api_slug: 'coreweave' },
  { name: 'GitLab',                api_type: 'lever',         api_slug: 'gitlab' },
  { name: 'Canva',                 api_type: 'lever',         api_slug: 'canva' },
  { name: 'Chainalysis',           api_type: 'lever',         api_slug: 'chainalysis' },
  { name: 'Honeycomb',             api_type: 'lever',         api_slug: 'honeycombio' },
  { name: 'Aircall',               api_type: 'lever',         api_slug: 'aircall' },
  { name: 'Contentsquare',         api_type: 'lever',         api_slug: 'contentsquare' },
  { name: 'Dataiku',               api_type: 'lever',         api_slug: 'dataiku' },
  { name: 'Spendesk',              api_type: 'lever',         api_slug: 'spendesk' },
  { name: 'ngrok',                 api_type: 'lever',         api_slug: 'ngrok' },
  { name: 'Mattermost',            api_type: 'lever',         api_slug: 'mattermost' },
  { name: 'Payfit',                api_type: 'lever',         api_slug: 'payfit' },
  { name: 'Wrike',                 api_type: 'lever',         api_slug: 'wrike' },
  { name: 'Swile',                 api_type: 'lever',         api_slug: 'swile' },
  { name: 'Algolia',               api_type: 'lever',         api_slug: 'algolia' },
  { name: 'Pennylane',             api_type: 'lever',         api_slug: 'pennylane' },
  // ── Ashby (additional) ────────────────────────────────────────────────────
  { name: 'Vanta',                 api_type: 'ashby',         api_slug: 'vanta' },
  { name: 'Statsig',               api_type: 'ashby',         api_slug: 'statsig' },
  { name: 'Render',                api_type: 'ashby',         api_slug: 'render' },
  { name: 'Resend',                api_type: 'ashby',         api_slug: 'resend' },
  { name: 'Luma AI',               api_type: 'ashby',         api_slug: 'lumalabs' },
  { name: 'Braintrust',            api_type: 'ashby',         api_slug: 'braintrust' },
  // ── Greenhouse EU (additional) ────────────────────────────────────────────
  { name: 'Framer',                api_type: 'greenhouse_eu', api_slug: 'framer' },
  { name: 'Checkout.com',          api_type: 'greenhouse_eu', api_slug: 'checkout' },
  { name: 'Mollie',                api_type: 'greenhouse_eu', api_slug: 'mollie' },
  { name: 'Typeform',              api_type: 'greenhouse_eu', api_slug: 'typeform' },
  { name: 'Pitch',                 api_type: 'greenhouse_eu', api_slug: 'pitch' },
  { name: 'Oyster HR',             api_type: 'greenhouse_eu', api_slug: 'oysterhr' },
  { name: 'Sennder',               api_type: 'greenhouse_eu', api_slug: 'sennder' },
  { name: 'Staffbase',             api_type: 'greenhouse_eu', api_slug: 'staffbase' },
  // ── Greenhouse US (additional) ────────────────────────────────────────────
  // Dev tools & monitoring
  { name: 'Sentry',                api_type: 'greenhouse',    api_slug: 'getsentry' },
  { name: 'Buildkite',             api_type: 'greenhouse',    api_slug: 'buildkite' },
  { name: 'Netlify',               api_type: 'greenhouse',    api_slug: 'netlify' },
  { name: 'JFrog',                 api_type: 'greenhouse',    api_slug: 'jfrog' },
  { name: 'CircleCI',              api_type: 'greenhouse',    api_slug: 'circleci' },
  // Cybersecurity / Compliance
  { name: 'Rapid7',                api_type: 'greenhouse',    api_slug: 'rapid7' },
  { name: 'Illumio',               api_type: 'greenhouse',    api_slug: 'illumio' },
  { name: 'Tanium',                api_type: 'greenhouse',    api_slug: 'tanium' },
  { name: 'Drata',                 api_type: 'greenhouse',    api_slug: 'drata' },
  // Data / Analytics / Sales
  { name: 'mParticle',             api_type: 'greenhouse',    api_slug: 'mparticle' },
  { name: 'Pendo',                 api_type: 'greenhouse',    api_slug: 'pendo' },
  { name: 'Iterable',              api_type: 'greenhouse',    api_slug: 'iterable' },
  { name: 'Heap',                  api_type: 'greenhouse',    api_slug: 'heap' },
  { name: 'Clearbit',              api_type: 'greenhouse',    api_slug: 'clearbit' },
  { name: '6sense',                api_type: 'greenhouse',    api_slug: '6sense' },
  { name: 'Seismic',               api_type: 'greenhouse',    api_slug: 'seismic' },
  { name: 'ActiveCampaign',        api_type: 'greenhouse',    api_slug: 'activecampaign' },
  { name: 'UserTesting',           api_type: 'greenhouse',    api_slug: 'usertesting' },
  { name: 'FullStory',             api_type: 'greenhouse',    api_slug: 'fullstory' },
  { name: 'Clari',                 api_type: 'greenhouse',    api_slug: 'clari' },
  { name: 'Salesloft',             api_type: 'greenhouse',    api_slug: 'salesloft' },
  { name: 'Bombora',               api_type: 'greenhouse',    api_slug: 'bombora' },
  // Databases / Infrastructure
  { name: 'CockroachDB',           api_type: 'greenhouse',    api_slug: 'cockroachdb' },
  // Fintech / Insurtech
  { name: 'SoFi',                  api_type: 'greenhouse',    api_slug: 'sofi' },
  { name: 'Blend',                 api_type: 'greenhouse',    api_slug: 'blend' },
  { name: 'Coalition',             api_type: 'greenhouse',    api_slug: 'coalitioninc' },
  { name: 'EarnIn',                api_type: 'greenhouse',    api_slug: 'earnin' },
  // Healthcare
  { name: 'Headway',               api_type: 'greenhouse',    api_slug: 'headwayhq' },
  { name: 'Clover Health',         api_type: 'greenhouse',    api_slug: 'cloverhealth' },
  { name: 'Color Health',          api_type: 'greenhouse',    api_slug: 'color' },
  { name: 'Spring Health',         api_type: 'greenhouse',    api_slug: 'springhealth' },
  { name: 'Hims & Hers',           api_type: 'greenhouse',    api_slug: 'hims' },
  // Deep tech / Space
  { name: 'Relativity Space',      api_type: 'greenhouse',    api_slug: 'relativity' },
  { name: 'Planet Labs',           api_type: 'greenhouse',    api_slug: 'planet' },
  { name: 'Motive',                api_type: 'greenhouse',    api_slug: 'gomotive' },
  // SaaS / Marketplace / HR
  { name: 'Smartsheet',            api_type: 'greenhouse',    api_slug: 'smartsheet' },
  { name: 'Convoy',                api_type: 'greenhouse',    api_slug: 'convoy' },
  { name: 'Andela',                api_type: 'greenhouse',    api_slug: 'andela' },
  { name: 'Sendbird',              api_type: 'greenhouse',    api_slug: 'sendbird' },
  { name: 'Lob',                   api_type: 'greenhouse',    api_slug: 'lob' },
  { name: 'Gem',                   api_type: 'greenhouse',    api_slug: 'gem' },
  { name: 'Phenom',                api_type: 'greenhouse',    api_slug: 'phenom' },
  { name: 'Guru',                  api_type: 'greenhouse',    api_slug: 'getguru' },
  { name: 'TaskUs',                api_type: 'greenhouse',    api_slug: 'taskus' },
  { name: 'Better.com',            api_type: 'greenhouse',    api_slug: 'better' },
  { name: 'Opendoor',              api_type: 'greenhouse',    api_slug: 'opendoor' },
  { name: '10x Genomics',          api_type: 'greenhouse',    api_slug: '10xgenomics' },
];

const DEFAULT_KEYWORDS_POSITIVE = [
  'AI', 'ML', 'LLM', 'Agent', 'Agentic', 'GenAI', 'NLP', 'MLOps', 'LLMOps',
  'Voice AI', 'Conversational AI', 'Speech',
  'Platform Engineer', 'Solutions Architect', 'Solutions Engineer',
  'Forward Deployed', 'Customer Engineer', 'Integration Engineer',
  'Product Manager', 'Technical PM',
  'Automation', 'Low-Code', 'No-Code', 'GTM Engineer', 'RevOps',
  'Business Systems', 'Internal Tools',
];

const DEFAULT_KEYWORDS_NEGATIVE = [
  'Junior', 'Intern', 'iOS', 'Android', 'PHP', 'Ruby',
  'Embedded', 'Firmware', 'FPGA', 'Blockchain', 'Web3', 'Crypto',
];

// ── API URL builders ──────────────────────────────────────────────────────────

function buildApiUrl(api_type, api_slug) {
  switch (api_type) {
    case 'greenhouse':
      return `https://boards-api.greenhouse.io/v1/boards/${api_slug}/jobs`;
    case 'greenhouse_eu':
      return `https://boards-api.eu.greenhouse.io/v1/boards/${api_slug}/jobs`;
    case 'ashby':
      return `https://api.ashbyhq.com/posting-api/job-board/${api_slug}/jobPostings`;
    case 'lever':
      return `https://api.lever.co/v0/postings/${api_slug}?mode=json`;
    default:
      return null;
  }
}

// ── Fetch jobs from a single company ─────────────────────────────────────────

async function fetchCompanyJobs(company) {
  const url = buildApiUrl(company.api_type, company.api_slug);
  if (!url) return [];

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'CareerOps/1.0' },
    });
    if (!res.ok) {
      console.warn(`[scanner] ${company.api_type}/${company.api_slug} → HTTP ${res.status} — skipping`);
      return [];
    }
    const data = await res.json();

    if (company.api_type === 'greenhouse' || company.api_type === 'greenhouse_eu') {
      return (data.jobs || []).map(j => ({
        title: j.title || '',
        url: j.absolute_url || '',
        location: j.location?.name || '',
        company: company.name,
        api_type: company.api_type,
      }));
    }

    if (company.api_type === 'ashby') {
      return (data.jobPostings || []).map(j => ({
        title: j.title || '',
        url: j.jobUrl || '',
        location: j.isRemote ? 'Remote' : (j.locationName || ''),
        company: company.name,
        api_type: company.api_type,
      }));
    }

    if (company.api_type === 'lever') {
      const jobs = Array.isArray(data) ? data : [];
      return jobs.map(j => ({
        title: j.text || '',
        url: j.hostedUrl || '',
        location: j.categories?.location || (j.workplaceType === 'remote' ? 'Remote' : ''),
        company: company.name,
        api_type: company.api_type,
      }));
    }

    return [];
  } catch (err) {
    console.warn(`[scanner] ${company.api_type}/${company.api_slug} → ${err.message ?? 'fetch error'} — skipping`);
    return [];
  }
}

// ── Keyword filtering ─────────────────────────────────────────────────────────

function matchesKeywords(title, positiveKws, negativeKws) {
  const t = title.toLowerCase();
  const hasNegative = negativeKws.some(kw => t.includes(kw.toLowerCase()));
  if (hasNegative) return false;
  if (positiveKws.length === 0) return true;
  return positiveKws.some(kw => t.includes(kw.toLowerCase()));
}

// ── Build a minimal job description for evaluation ────────────────────────────

function buildJobDescription(job) {
  const lines = [
    `${job.title} at ${job.company}`,
    job.location ? `Location: ${job.location}` : '',
    '',
    `This is a ${job.title} role at ${job.company}.`,
    `Full job posting: ${job.url}`,
    '',
    'Note: This listing was discovered via automated portal scanning.',
    'The AI evaluation below is based on the role title and company context.',
    'Review the full posting for complete requirements before applying.',
  ].filter(l => l !== undefined);
  return lines.join('\n');
}

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function ensureCompaniesSeeded(userId) {
  // Only seed once per user — check the flag in scanner_config.
  // If the user later deletes all companies, we respect that choice and don't re-seed.
  const { rows: cfg } = await pool.query(
    'SELECT companies_seeded FROM scanner_config WHERE user_id = $1',
    [userId]
  );
  if (cfg.length > 0 && cfg[0].companies_seeded) return;

  const { rows } = await pool.query(
    'SELECT COUNT(*) AS cnt FROM scanner_companies WHERE user_id = $1',
    [userId]
  );
  if (parseInt(rows[0].cnt, 10) === 0) {
    for (const c of DEFAULT_COMPANIES) {
      await pool.query(
        'INSERT INTO scanner_companies (user_id, name, api_type, api_slug, enabled) VALUES ($1,$2,$3,$4,TRUE)',
        [userId, c.name, c.api_type, c.api_slug]
      );
    }
    // Mark as seeded so future company deletions don't trigger re-seeding
    await pool.query(
      'UPDATE scanner_config SET companies_seeded = TRUE WHERE user_id = $1',
      [userId]
    );
  }
}

async function ensureConfigSeeded(userId) {
  const { rows } = await pool.query(
    'SELECT id FROM scanner_config WHERE user_id = $1',
    [userId]
  );
  if (rows.length === 0) {
    await pool.query(
      `INSERT INTO scanner_config (user_id, keywords_positive, keywords_negative)
       VALUES ($1, $2, $3)`,
      [userId, DEFAULT_KEYWORDS_POSITIVE, DEFAULT_KEYWORDS_NEGATIVE]
    );
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/scanner/companies
router.get('/companies', async (req, res) => {
  try {
    await ensureCompaniesSeeded(req.user.id);
    const { rows } = await pool.query(
      'SELECT * FROM scanner_companies WHERE user_id = $1 ORDER BY name ASC',
      [req.user.id]
    );
    res.json({ companies: rows });
  } catch (err) {
    console.error('scanner/companies GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scanner/companies
router.post('/companies', async (req, res) => {
  const { name, api_type, api_slug } = req.body;
  if (!name || !api_type || !api_slug) {
    return res.status(400).json({ error: 'name, api_type, api_slug required' });
  }
  const validTypes = ['greenhouse', 'greenhouse_eu', 'ashby', 'lever'];
  if (!validTypes.includes(api_type)) {
    return res.status(400).json({ error: `api_type must be one of: ${validTypes.join(', ')}` });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO scanner_companies (user_id, name, api_type, api_slug, enabled)
       VALUES ($1,$2,$3,$4,TRUE) RETURNING *`,
      [req.user.id, name.trim(), api_type, api_slug.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/scanner/companies/:id
router.patch('/companies/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, api_type, api_slug, enabled } = req.body;
  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM scanner_companies WHERE id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Company not found' });

    const fields = [];
    const vals = [];
    let idx = 1;
    if (name !== undefined)      { fields.push(`name=$${idx++}`);      vals.push(name); }
    if (api_type !== undefined) {
      const validTypes = ['greenhouse', 'greenhouse_eu', 'ashby', 'lever'];
      if (!validTypes.includes(api_type)) {
        return res.status(400).json({ error: `api_type must be one of: ${validTypes.join(', ')}` });
      }
      fields.push(`api_type=$${idx++}`);
      vals.push(api_type);
    }
    if (api_slug !== undefined)  { fields.push(`api_slug=$${idx++}`);  vals.push(api_slug); }
    if (enabled !== undefined)   { fields.push(`enabled=$${idx++}`);   vals.push(enabled); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE scanner_companies SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`,
      vals
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/scanner/companies/:id
router.delete('/companies/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM scanner_companies WHERE id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Company not found' });
    res.json({ deleted: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scanner/config
router.get('/config', async (req, res) => {
  try {
    await ensureConfigSeeded(req.user.id);
    const { rows } = await pool.query(
      'SELECT * FROM scanner_config WHERE user_id=$1',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/scanner/config
router.put('/config', async (req, res) => {
  const { keywords_positive, keywords_negative } = req.body;
  if (!Array.isArray(keywords_positive) || !Array.isArray(keywords_negative)) {
    return res.status(400).json({ error: 'keywords_positive and keywords_negative must be arrays' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO scanner_config (user_id, keywords_positive, keywords_negative)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE
         SET keywords_positive=$2, keywords_negative=$3, updated_at=NOW()
       RETURNING *`,
      [req.user.id, keywords_positive, keywords_negative]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scanner/runs
router.get('/runs', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, companies_scanned, total_fetched, new_found, matches_evaluated,
              status, started_at, finished_at, created_at
       FROM scanner_runs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`,
      [req.user.id]
    );
    res.json({ runs: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scanner/runs/:id
router.get('/runs/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM scanner_runs WHERE id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    const run = rows[0];
    res.json({
      ...run,
      results: run.results_json ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scanner/run  — fetch + filter + dedupe + auto-evaluate
// Body (optional): { cv_content: string }  — overrides the saved CV for this run
router.post('/run', async (req, res) => {
  const userId = req.user.id;
  const startedAt = new Date();

  try {
    await ensureCompaniesSeeded(userId);
    await ensureConfigSeeded(userId);

    // Load keyword config
    const { rows: configRows } = await pool.query(
      'SELECT keywords_positive, keywords_negative FROM scanner_config WHERE user_id=$1',
      [userId]
    );
    const config = configRows[0];
    const posKws = config?.keywords_positive ?? DEFAULT_KEYWORDS_POSITIVE;
    const negKws = config?.keywords_negative ?? DEFAULT_KEYWORDS_NEGATIVE;

    // Use pasted CV from request body if provided, otherwise fall back to saved CV
    let cvContent = null;
    if (req.body?.cv_content && req.body.cv_content.trim().length >= 50) {
      cvContent = req.body.cv_content.trim();
    } else {
      const { rows: cvRows } = await pool.query(
        'SELECT content_md FROM cvs WHERE user_id=$1',
        [userId]
      );
      cvContent = cvRows[0]?.content_md ?? null;
    }
    const canEvaluate = cvContent && cvContent.trim().length >= 50;

    // Load enabled companies
    const { rows: companies } = await pool.query(
      'SELECT * FROM scanner_companies WHERE user_id=$1 AND enabled=TRUE ORDER BY name ASC',
      [userId]
    );
    if (companies.length === 0) {
      return res.status(400).json({ error: 'No companies enabled. Enable at least one company in the Companies tab.' });
    }

    // Load already-seen URLs for this user
    const { rows: seenRows } = await pool.query(
      'SELECT job_url FROM scanner_seen_urls WHERE user_id=$1',
      [userId]
    );
    const seenUrls = new Set(seenRows.map(r => r.job_url));

    // Fetch from all companies concurrently in batches of 6
    const BATCH_SIZE = 6;
    const allJobs = [];
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(c => fetchCompanyJobs(c)));
      results.forEach(jobs => allJobs.push(...jobs));
    }

    // Filter by keywords
    const relevant = allJobs.filter(j => j.url && matchesKeywords(j.title, posKws, negKws));

    // Separate new vs already-seen
    const newJobs = relevant.filter(j => !seenUrls.has(j.url));

    // Mark new URLs as seen immediately (before evaluation, so parallel tabs don't duplicate)
    for (const job of newJobs) {
      try {
        await pool.query(
          `INSERT INTO scanner_seen_urls (user_id, job_url, job_title, company)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [userId, job.url, job.title.slice(0, 499), job.company]
        );
      } catch { /* ignore duplicates */ }
    }

    // ── Auto-evaluate up to MAX_AUTO_EVALS new jobs ──────────────────────────
    const toEvaluate = canEvaluate ? newJobs.slice(0, MAX_AUTO_EVALS) : [];
    const results = newJobs.map(job => ({ ...job, application_id: null, score: null, recommendation: null }));

    let evaluated = 0;
    for (const job of toEvaluate) {
      try {
        const jobDescription = buildJobDescription(job);
        const evaluation = await evaluateJob(jobDescription, cvContent);
        const reportMd = await generateReportMarkdown(evaluation);

        const globalScore = evaluation.score?.global;
        const keywords = evaluation.keywords || [];

        const { rows: appRows } = await pool.query(
          `INSERT INTO applications
             (user_id, company, role, score, status, url, report_md,
              archetype, tldr, remote, comp_score, keywords, evaluation_json)
           VALUES ($1,$2,$3,$4,'Evaluated',$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING id`,
          [
            userId,
            evaluation.company || job.company,
            evaluation.role || job.title,
            globalScore !== undefined ? parseFloat(globalScore) : null,
            job.url,
            reportMd,
            evaluation.archetype || null,
            evaluation.block_a?.tldr || null,
            evaluation.block_a?.remote || null,
            evaluation.score?.comp !== undefined ? parseFloat(evaluation.score.comp) : null,
            keywords.length > 0 ? keywords : null,
            JSON.stringify(evaluation),
          ]
        );

        const applicationId = appRows[0].id;
        evaluated++;

        // Update result entry with evaluation data
        const resultIdx = results.findIndex(r => r.url === job.url);
        if (resultIdx >= 0) {
          results[resultIdx] = {
            ...results[resultIdx],
            application_id: applicationId,
            score: globalScore ?? null,
            recommendation: evaluation.recommendation ?? null,
          };
        }
      } catch (evalErr) {
        console.error(`Scanner eval error for ${job.title} @ ${job.company}:`, evalErr.message);
        // Non-fatal — continue with remaining jobs
      }
    }

    // Save run record
    const finishedAt = new Date();
    const { rows: runRows } = await pool.query(
      `INSERT INTO scanner_runs
         (user_id, companies_scanned, total_fetched, new_found, matches_evaluated,
          status, started_at, finished_at, results_json)
       VALUES ($1,$2,$3,$4,$5,'completed',$6,$7,$8)
       RETURNING *`,
      [
        userId,
        companies.length,
        allJobs.length,
        newJobs.length,
        evaluated,
        startedAt,
        finishedAt,
        JSON.stringify(results),
      ]
    );
    const run = runRows[0];

    res.json({
      run_id: run.id,
      companies_scanned: run.companies_scanned,
      total_fetched: run.total_fetched,
      new_found: run.new_found,
      matches_evaluated: run.matches_evaluated,
      status: run.status,
      started_at: run.started_at,
      finished_at: run.finished_at,
      results,
      created_at: run.created_at,
      cv_missing: !canEvaluate,
    });
  } catch (err) {
    console.error('scanner/run error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/scanner/history  — reset seen URLs and runs
router.delete('/history', async (req, res) => {
  try {
    await pool.query('DELETE FROM scanner_seen_urls WHERE user_id=$1', [req.user.id]);
    await pool.query('DELETE FROM scanner_runs WHERE user_id=$1', [req.user.id]);
    res.json({ reset: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI Company Discovery ───────────────────────────────────────────────────────

// Exa helpers (scoped to scanner — discovers companies rather than specific jobs)
const EXA_BASE_URL = 'https://api.exa.ai';

function exaDiscoverHeaders() {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error('EXA_API_KEY is not configured.');
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
}

async function exaDiscoverSearch(query, domains) {
  try {
    const res = await fetch(`${EXA_BASE_URL}/search`, {
      method: 'POST',
      headers: exaDiscoverHeaders(),
      body: JSON.stringify({
        query,
        numResults: 10,
        includeDomains: domains,
        type: 'neural',
        category: 'job posting',
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { results: [] };
    return res.json();
  } catch {
    return { results: [] };
  }
}

// Parse ATS type + slug from a job board URL
function parseAtsFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    const slug = parts[0];
    if (slug.length < 2 || slug.length > 80) return null;

    if (host === 'boards.greenhouse.io') return { api_type: 'greenhouse', api_slug: slug };
    if (host === 'boards.eu.greenhouse.io') return { api_type: 'greenhouse_eu', api_slug: slug };
    if (host === 'jobs.lever.co') return { api_type: 'lever', api_slug: slug };
    if (host === 'jobs.ashbyhq.com') return { api_type: 'ashby', api_slug: slug };
  } catch {}
  return null;
}

// POST /api/scanner/discover  — AI-powered company discovery via Claude + Exa
// Body (optional): { cv_content: string }
router.post('/discover', async (req, res) => {
  const userId = req.user.id;

  try {
    // Resolve CV
    let cvContent = '';
    const bodyCV = req.body?.cv_content;
    if (bodyCV && typeof bodyCV === 'string' && bodyCV.trim().length >= 50) {
      cvContent = bodyCV.trim();
    } else {
      const { rows } = await pool.query('SELECT content_md FROM cvs WHERE user_id=$1', [userId]);
      cvContent = rows[0]?.content_md?.trim() ?? '';
    }
    if (cvContent.length < 50) {
      return res.status(400).json({ error: 'No CV found. Please paste your resume before running discovery.', code: 'NO_CV' });
    }

    // Get existing company slugs so we can exclude them
    const { rows: existing } = await pool.query(
      'SELECT api_slug FROM scanner_companies WHERE user_id=$1',
      [userId]
    );
    const existingSlugs = new Set(existing.map(r => r.api_slug.toLowerCase()));

    // Step 1: Ask Claude to generate Exa search queries based on the CV
    const queryGenPrompt = `You are a career assistant. Based on the candidate CV below, generate 9 diverse Exa neural search queries to discover relevant tech companies that have open job postings on Greenhouse, Lever, or Ashby job boards.

Focus on different angles:
- 3 queries for roles the candidate is strongest for (be specific about role + tech stack)
- 3 queries for company types/sectors that would be a great match
- 3 queries targeting growth-stage or public tech companies that would value this background

CV (first 2000 chars):
${cvContent.slice(0, 2000)}

Return ONLY a JSON array of 9 search query strings. No markdown, no explanation.
Example: ["senior ML engineer AI startup 2025 greenhouse jobs", "platform engineer fintech scale-up hiring lever", ...]`;

    const queryMsg = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: 'You are a career assistant. Respond ONLY with a valid JSON array of strings.',
      messages: [{ role: 'user', content: queryGenPrompt }],
    });

    let queries = [];
    try {
      const raw = queryMsg.content[0]?.text || '';
      const match = raw.match(/\[[\s\S]*\]/);
      queries = JSON.parse(match ? match[0] : raw);
      if (!Array.isArray(queries)) queries = [];
    } catch {
      queries = [];
    }
    if (queries.length === 0) {
      return res.status(500).json({ error: 'Failed to generate search queries.' });
    }

    // Step 2: Run Exa searches against ATS domains in parallel
    const ATS_DOMAINS = [
      'boards.greenhouse.io',
      'boards.eu.greenhouse.io',
      'jobs.lever.co',
      'jobs.ashbyhq.com',
    ];

    const searchResults = await Promise.allSettled(
      queries.map(q => exaDiscoverSearch(q, ATS_DOMAINS))
    );

    // Collect and deduplicate parsed ATS entries
    const seen = new Set();
    const candidates = [];
    for (const r of searchResults) {
      if (r.status !== 'fulfilled' || !Array.isArray(r.value?.results)) continue;
      for (const item of r.value.results) {
        const parsed = parseAtsFromUrl(item.url || '');
        if (!parsed) continue;
        const key = `${parsed.api_type}:${parsed.api_slug.toLowerCase()}`;
        if (seen.has(key)) continue;
        if (existingSlugs.has(parsed.api_slug.toLowerCase())) continue;
        seen.add(key);
        candidates.push(parsed);
      }
    }

    if (candidates.length === 0) {
      return res.json({ companies: [] });
    }

    // Cap to 40 candidates before sending to Claude for ranking
    const toRank = candidates.slice(0, 40);

    // Step 3: Ask Claude to identify company names and rank by CV fit
    const rankPrompt = `You are a career strategist. Given a candidate CV and a list of ATS job board slugs, identify the real company name for each slug and rank them by how good a fit they would be for the candidate.

CV (first 2500 chars):
${cvContent.slice(0, 2500)}

ATS slugs to evaluate (each is a unique company's job board):
${toRank.map((c, i) => `${i + 1}. slug="${c.api_slug}" ats="${c.api_type}"`).join('\n')}

Rules:
- Map each slug to its real company name (e.g. "datadoghq" → "Datadog", "mondaydotcom" → "monday.com")
- If you don't recognise a slug, make your best guess or use the slug as the name
- Rank ALL entries by fit score 1–100 (based on how well the company would suit this candidate's background)
- Write a concise 1-sentence fit reason grounded in the CV
- Return ONLY a JSON array sorted by fit_score descending

Schema:
[{"slug":"...", "api_type":"...", "name":"...", "fit_score":85, "fit_reason":"..."}]

Return ONLY the JSON array. No markdown, no explanation.`;

    const rankMsg = await anthropicClient.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: 'You are a career strategist. Respond ONLY with a valid JSON array.',
      messages: [{ role: 'user', content: rankPrompt }],
    });

    let ranked = [];
    try {
      const raw = rankMsg.content[0]?.text || '';
      const match = raw.match(/\[[\s\S]*\]/);
      ranked = JSON.parse(match ? match[0] : raw);
      if (!Array.isArray(ranked)) ranked = [];
    } catch {
      ranked = [];
    }

    // Build a lookup of the Exa-parsed candidates to constrain Claude's output
    // — this prevents hallucinated or invalid slugs from entering the watchlist
    const parsedLookup = new Map(
      toRank.map(c => [`${c.api_type}:${c.api_slug.toLowerCase()}`, c])
    );
    const ALLOWED_API_TYPES = new Set(['greenhouse', 'greenhouse_eu', 'ashby', 'lever']);

    const normalised = ranked
      .filter(c => c && c.slug && c.api_type && c.name)
      .filter(c => ALLOWED_API_TYPES.has(String(c.api_type)))
      .filter(c => parsedLookup.has(`${String(c.api_type)}:${String(c.slug).toLowerCase()}`))
      .filter(c => !existingSlugs.has(String(c.slug).toLowerCase()))
      .map(c => ({
        name: String(c.name).slice(0, 100),
        api_type: String(c.api_type),
        api_slug: String(c.slug).slice(0, 80),
        fit_score: Math.min(100, Math.max(0, Number(c.fit_score) || 50)),
        fit_reason: String(c.fit_reason || '').slice(0, 300),
      }))
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 30);

    res.json({ companies: normalised });

  } catch (err) {
    console.error('scanner/discover error:', err);
    res.status(500).json({ error: err.message || 'Discovery failed. Please try again.' });
  }
});

export default router;
