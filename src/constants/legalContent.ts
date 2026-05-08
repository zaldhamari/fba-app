export interface PolicySection {
  id: string;
  title: string;
  body: string;
}

export interface LegalDocument {
  title: string;
  eyebrow: string;
  effectiveDate: string;
  intro: string;
  sections: PolicySection[];
  supportEmail: string;
  websiteUrl: string;
}

export type LegalDocumentType = 'privacy' | 'terms';

// ─── Privacy Policy ───────────────────────────────────────────────────────────

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  eyebrow: 'PRIVACY POLICY',
  effectiveDate: 'May 7, 2026',
  supportEmail: 'support@siftly.app',
  websiteUrl: 'https://siftly.app/privacy',

  intro:
    'Siftly is built on a simple principle: your data is yours. ' +
    'We collect only what we need to make the app work, store it locally on your device, ' +
    'and never sell or share it with advertisers. This document explains exactly what happens ' +
    'to your information when you use Siftly.',

  sections: [
    {
      id: 'collect',
      title: 'What We Collect',
      body:
        'Siftly does not require an account and does not collect personal information by default.\n\n' +
        'Information stored locally on your device:\n' +
        '• Research history and saved opportunities you create\n' +
        '• Your subscription tier and onboarding state\n' +
        '• Calculator inputs and saved results\n' +
        '• App preferences and settings\n\n' +
        'Information sent to our servers when you use AI features:\n' +
        '• The search term or product description you type\n' +
        '• Numerical inputs (price, weight, dimensions) for calculations\n\n' +
        'We do not collect your name, email address, location, contacts, or any other personal identifiers.',
    },
    {
      id: 'storage',
      title: 'How Your Data Is Stored',
      body:
        'All your research, saves, and preferences are stored locally on your device using secure AsyncStorage. ' +
        'This data never leaves your device unless you explicitly use the export or share features.\n\n' +
        'When you export or share a report, you control where it goes — Siftly only hands it to the system ' +
        'share sheet. We do not store copies of exports on our servers.\n\n' +
        'If you delete the app, all locally stored data is permanently removed.',
    },
    {
      id: 'api',
      title: 'AI Features & Our Backend',
      body:
        'Features powered by AI — including product analysis, brand creation, keyword research, ' +
        'and opportunity scoring — send your query to our secure backend hosted on Railway (US West).\n\n' +
        "Your query is processed by OpenAI's API (GPT-4o Mini) to generate the response. " +
        'We do not store your queries after the response is returned. ' +
        "OpenAI's data handling is governed by their own privacy policy at openai.com/privacy.\n\n" +
        'All API communication is encrypted in transit using TLS 1.2+.',
    },
    {
      id: 'purchases',
      title: 'In-App Purchases & Billing',
      body:
        'Subscription purchases (Builder, Operator) are processed entirely by Apple App Store or ' +
        'Google Play. Siftly never sees or stores your payment details.\n\n' +
        'Apple and Google provide us with your subscription status (active, expired, cancelled) ' +
        'so the app can unlock the appropriate features. No other billing information is shared with us.\n\n' +
        "To manage or cancel your subscription, go to your device's App Store or Play Store settings.",
    },
    {
      id: 'analytics',
      title: 'Analytics & Crash Reporting',
      body:
        'We may collect anonymous, aggregated usage data — such as which screens are visited most ' +
        'and how often certain features are used — to improve the product. This data cannot be ' +
        'linked to you individually.\n\n' +
        'If we use a crash reporting tool, it may capture device type, OS version, and a stack trace ' +
        'when the app crashes. It does not capture your research data or any content you have typed.',
    },
    {
      id: 'children',
      title: "Children's Privacy",
      body:
        'Siftly is designed for adults running or building commerce businesses. ' +
        'We do not knowingly collect information from anyone under the age of 13. ' +
        'If you believe a child has provided information through the app, please contact us ' +
        'and we will promptly delete it.',
    },
    {
      id: 'rights',
      title: 'Your Rights',
      body:
        'Because Siftly stores your data locally on your device, you have full control over it:\n\n' +
        '• Delete your data at any time by clearing app storage or deleting the app\n' +
        '• Export your saved opportunities via the Vault export feature\n' +
        "• Opt out of any analytics by adjusting your device's privacy settings\n\n" +
        'If you are in the European Economic Area, you have rights under GDPR including access, ' +
        'correction, and deletion. If you are in California, you have rights under CCPA. ' +
        'To exercise any of these rights, email us and we will respond within 30 days.',
    },
    {
      id: 'retention',
      title: 'Data Retention',
      body:
        'Local data on your device is retained until you delete the app or clear its storage.\n\n' +
        'Query data sent to our AI backend for processing is not retained after the response is delivered.\n\n' +
        'Subscription status records (from Apple/Google) are retained as long as you have an active ' +
        'or recent subscription, and deleted within 90 days of cancellation.',
    },
    {
      id: 'thirdparty',
      title: 'Third-Party Services',
      body:
        'Siftly uses the following third-party services:\n\n' +
        '• Railway — backend infrastructure hosting (US West). railway.app/legal/privacy\n' +
        '• OpenAI — AI language model for intelligent features. openai.com/privacy\n' +
        '• Apple App Store / Google Play — subscription billing and distribution\n\n' +
        'Each of these services has its own privacy policy. We choose providers that meet high ' +
        'standards for data security and privacy.',
    },
    {
      id: 'changes',
      title: 'Changes to This Policy',
      body:
        'When we make meaningful changes to this policy, we will update the effective date at the ' +
        'top of this screen. If changes significantly affect how your data is handled, we will ' +
        'notify you through the app.\n\n' +
        'Continued use of Siftly after changes are posted means you accept the updated policy.',
    },
    {
      id: 'contact',
      title: 'Contact',
      body:
        'Questions, requests, or concerns about your privacy? We respond to every message.\n\n' +
        'Email: support@siftly.app\n\n' +
        'We aim to respond within 2 business days.',
    },
  ],
};

// ─── Terms of Service ─────────────────────────────────────────────────────────

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Terms of Service',
  eyebrow: 'TERMS OF SERVICE',
  effectiveDate: 'May 7, 2026',
  supportEmail: 'support@siftly.app',
  websiteUrl: 'https://siftly.app/terms',

  intro:
    'These Terms of Service govern your use of Siftly — the commerce intelligence platform. ' +
    'By downloading or using the app, you agree to these terms. ' +
    "If you don't agree, please don't use the app. We've written these in plain English " +
    'so they are actually readable.',

  sections: [
    {
      id: 'acceptance',
      title: 'Acceptance of Terms',
      body:
        'By accessing or using Siftly, you confirm that you are at least 18 years old, have the ' +
        'legal capacity to enter into a binding agreement, and agree to be bound by these Terms.\n\n' +
        'If you are using Siftly on behalf of a company or organisation, you represent that you ' +
        'have authority to bind that entity to these Terms.',
    },
    {
      id: 'service',
      title: 'What Siftly Provides',
      body:
        'Siftly is a commerce intelligence platform that provides:\n\n' +
        '• Market research and product opportunity signals\n' +
        '• AI-powered analysis, scoring, and recommendations\n' +
        '• Brand creation and keyword research tools\n' +
        '• Supplier sourcing and outreach assistance\n' +
        '• Profit modelling and launch planning tools\n\n' +
        'Siftly is an intelligence and planning tool. It does not guarantee business outcomes, ' +
        'sales results, or profit. All signals, scores, and AI-generated recommendations are ' +
        'informational and should be evaluated alongside your own research and judgement.',
    },
    {
      id: 'eligibility',
      title: 'Eligibility & Accounts',
      body:
        'Siftly does not require you to create an account. Your subscription status and app ' +
        'preferences are stored securely on your device.\n\n' +
        'You are responsible for maintaining the security of your device and ensuring that ' +
        'unauthorised individuals cannot access your Siftly data or subscription features.\n\n' +
        'You must be a legal resident or entity in a jurisdiction where using Siftly is lawful.',
    },
    {
      id: 'subscription',
      title: 'Subscriptions & Billing',
      body:
        'Siftly offers three tiers: Explorer (free), Builder, and Operator.\n\n' +
        'Paid subscriptions (Builder, Operator) are billed monthly or annually through the ' +
        'Apple App Store or Google Play. Prices are displayed before purchase.\n\n' +
        'Subscriptions auto-renew at the end of each billing period unless cancelled at least ' +
        '24 hours before the renewal date. To cancel, go to your device\'s App Store or ' +
        'Google Play subscription settings.\n\n' +
        'Refunds are subject to Apple\'s or Google\'s refund policies respectively. ' +
        'Siftly does not process refunds directly.\n\n' +
        'We reserve the right to change pricing with at least 30 days notice. ' +
        'Existing subscribers will be notified before any price change takes effect.',
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable Use',
      body:
        'You agree to use Siftly only for lawful purposes and in a way that does not infringe ' +
        'the rights of others. You must not:\n\n' +
        '• Attempt to reverse engineer, decompile, or extract source code from the app\n' +
        '• Use automated scripts or bots to access or scrape Siftly features\n' +
        '• Resell, sublicense, or redistribute Siftly data or AI outputs commercially\n' +
        '• Use Siftly in any way that could damage, overload, or impair our servers\n' +
        '• Attempt to gain unauthorised access to any part of our infrastructure\n' +
        '• Use the platform to conduct any activity that violates applicable laws\n\n' +
        'Violation of these terms may result in immediate suspension of your access without refund.',
    },
    {
      id: 'ai-content',
      title: 'AI-Generated Content',
      body:
        'Siftly uses large language models (OpenAI GPT-4o Mini) to generate analysis, ' +
        'recommendations, brand assets, and business insights.\n\n' +
        'AI-generated content is provided for informational purposes only. It is not financial, ' +
        'legal, investment, or professional business advice. You should not rely solely on ' +
        'AI-generated outputs when making significant business decisions.\n\n' +
        'AI outputs may occasionally be inaccurate, incomplete, or outdated. ' +
        'Siftly is not liable for decisions made based on AI-generated content.\n\n' +
        'You retain ownership of any content you input. AI outputs generated from your inputs ' +
        'are yours to use, subject to the restrictions in these Terms.',
    },
    {
      id: 'ip',
      title: 'Intellectual Property',
      body:
        'All original content in Siftly — including the app design, code, interface, branding, ' +
        'and non-AI features — is owned by or licensed to Siftly.\n\n' +
        'You are granted a limited, non-exclusive, non-transferable licence to use the app ' +
        'for your personal or business purposes in accordance with these Terms.\n\n' +
        'You may export, share, and use AI-generated outputs (brand names, listings, supplier emails) ' +
        'for your own commerce activities. You may not resell or redistribute Siftly outputs as ' +
        'a standalone product or service.',
    },
    {
      id: 'third-party',
      title: 'Third-Party Services & Links',
      body:
        'Siftly integrates with third-party services including OpenAI and Railway. ' +
        'Your use of these services through Siftly is also subject to their respective terms.\n\n' +
        'Siftly may surface links to external platforms such as Amazon, Alibaba, or supplier ' +
        'websites. We are not responsible for the content, accuracy, or practices of any ' +
        'third-party site or service.\n\n' +
        'Any transactions you enter into with third-party suppliers, marketplaces, or services ' +
        'are solely between you and that third party.',
    },
    {
      id: 'disclaimers',
      title: 'Disclaimer of Warranties',
      body:
        'Siftly is provided "as is" and "as available" without warranties of any kind, ' +
        'either express or implied.\n\n' +
        'We do not warrant that:\n' +
        '• The app will be uninterrupted, error-free, or secure\n' +
        '• Market data and AI signals will be accurate, complete, or current\n' +
        '• Results achieved by other users will be achievable by you\n' +
        '• The app will meet your specific business requirements\n\n' +
        'Commerce involves risk. Siftly helps you research and plan — it does not eliminate ' +
        'business risk or guarantee commercial success.',
    },
    {
      id: 'liability',
      title: 'Limitation of Liability',
      body:
        'To the maximum extent permitted by applicable law, Siftly and its operators shall not ' +
        'be liable for any indirect, incidental, special, consequential, or punitive damages — ' +
        'including loss of profits, data, goodwill, or business opportunity — arising from ' +
        'your use of or inability to use the app.\n\n' +
        "Our total liability to you for any claim arising from these Terms or your use of Siftly " +
        "shall not exceed the amount you paid us in the 12 months preceding the claim, " +
        "or $100 USD, whichever is greater.\n\n" +
        'Some jurisdictions do not allow limitations on liability. In those cases, ' +
        'our liability is limited to the greatest extent permitted by law.',
    },
    {
      id: 'termination',
      title: 'Termination',
      body:
        'You may stop using Siftly at any time by cancelling your subscription and deleting the app.\n\n' +
        'We may suspend or terminate your access at any time if we believe you have violated ' +
        'these Terms, without prior notice and without refund.\n\n' +
        'Upon termination, your right to use the app ceases immediately. ' +
        'Sections relating to IP, disclaimers, liability, and governing law survive termination.',
    },
    {
      id: 'governing-law',
      title: 'Governing Law',
      body:
        'These Terms are governed by and construed in accordance with applicable law. ' +
        'Any disputes arising from these Terms or your use of Siftly shall be resolved ' +
        'through good-faith negotiation first. If unresolved, disputes shall be subject ' +
        'to binding arbitration.\n\n' +
        'You agree that any claim must be brought in your individual capacity, ' +
        'not as a plaintiff or class member in any class action.',
    },
    {
      id: 'changes',
      title: 'Changes to These Terms',
      body:
        'We may update these Terms as the product evolves. When we do, we will update the ' +
        'effective date shown at the top of this screen.\n\n' +
        'For significant changes, we will provide notice through the app. ' +
        'Your continued use of Siftly after changes are posted constitutes your acceptance ' +
        'of the updated Terms.',
    },
    {
      id: 'contact',
      title: 'Contact',
      body:
        'Questions about these Terms? We are happy to clarify anything.\n\n' +
        'Email: support@siftly.app\n\n' +
        'We aim to respond within 2 business days.',
    },
  ],
};

// ─── Lookup helper ────────────────────────────────────────────────────────────

export const LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocument> = {
  privacy: PRIVACY_POLICY,
  terms:   TERMS_OF_SERVICE,
};
