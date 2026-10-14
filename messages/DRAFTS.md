# Gap-filled and new strings — for review before launch

Every message key is either **verbatim** from CONTENT.md or listed here. A test (`tests/messages.test.ts`)
enforces that: any string not listed below must appear in CONTENT.md. Esteban reviews this file before
launch (CLAUDE.md §11); the footer disclaimer and the "does this certify…?" FAQ answer (`footer.disclaimer`,
`faq.a5`) and the legal-basis lines (`landing.min*`) are liability-sensitive and need a native speaker / lawyer.

Source column: the locale/key the text was translated from, or "new UI string" where CONTENT.md has no source at all
(the worker wrote the English and translated it faithfully).

Row counts: en=59, es-AR=46, pt-BR=68, es-MX=56

| locale | key | translated from |
| :- | :- | :- |
| en | footer.terms | new UI string (no CONTENT.md source) |
| en | footer.privacy | new UI string (no CONTENT.md source) |
| en | footer.disclaimerLink | new UI string (no CONTENT.md source) |
| en | nav.pricing | new UI string (no CONTENT.md source) |
| en | nav.legalBasis | new UI string (no CONTENT.md source) |
| en | common.changeCountry | new UI string (no CONTENT.md source) |
| en | common.language | new UI string (no CONTENT.md source) |
| en | legal.draft | new UI string (no CONTENT.md source) |
| en | consent.text | new UI string (no CONTENT.md source) |
| en | consent.accept | new UI string (no CONTENT.md source) |
| en | consent.reject | new UI string (no CONTENT.md source) |
| en | waitlist.intro | new UI string (no CONTENT.md source) |
| en | waitlist.emailLabel | new UI string (no CONTENT.md source) |
| en | waitlist.countryLabel | new UI string (no CONTENT.md source) |
| en | waitlist.success | new UI string (no CONTENT.md source) |
| en | waitlist.invalid | new UI string (no CONTENT.md source) |
| en | waitlist.error | new UI string (no CONTENT.md source) |
| en | landing.metaTitle | es-AR |
| en | landing.metaDescription | es-AR |
| en | landing.hero | es-AR |
| en | landing.sub | es-AR |
| en | landing.ctaPrimary | es-AR |
| en | landing.ctaSecondary | es-AR |
| en | landing.whyTitle | es-AR |
| en | landing.why | es-AR |
| en | landing.minTitle | es-AR |
| en | landing.min | es-AR |
| en | landing.minNote | es-AR |
| en | landing.pricingCta | es-AR |
| en | landing.pricingLink | es-AR |
| en | landing.faq.q1 | es-AR |
| en | landing.faq.a1 | es-AR |
| en | landing.faq.q2 | es-AR |
| en | landing.faq.a2 | es-AR |
| en | howItWorks.s2t | es-AR |
| en | howItWorks.s2b | es-AR |
| en | howItWorks.s3t | es-AR |
| en | howItWorks.s3b | es-AR |
| en | howItWorks.s4t | es-AR |
| en | howItWorks.s4b | es-AR |
| en | howItWorks.s5t | es-AR |
| en | howItWorks.s5b | es-AR |
| en | faq.q1 | es-AR |
| en | faq.a1 | es-AR |
| en | faq.q2 | es-AR |
| en | faq.a2 | es-AR |
| en | faq.q3 | es-AR |
| en | faq.a3 | es-AR |
| en | faq.q4 | es-AR |
| en | faq.a4 | es-AR |
| en | faq.q5 | es-AR |
| en | faq.a5 | es-AR |
| en | pricing.planHeader | es-AR |
| en | pricing.includedTitle | new UI string (no CONTENT.md source) |
| en | pricing.trust | es-AR |
| en | pricing.tba | new UI string (no CONTENT.md source) |
| en | checkout.button | es-AR |
| en | checkout.title | new UI string (no CONTENT.md source) |
| en | checkout.unavailable | new UI string (no CONTENT.md source) |
| es-AR | meta.home.title | en |
| es-AR | meta.home.description | en |
| es-AR | home.hero | en |
| es-AR | home.sub | en |
| es-AR | home.cta | en |
| es-AR | home.argentina | en |
| es-AR | home.brazil | en |
| es-AR | home.mexico | en |
| es-AR | home.other | en |
| es-AR | home.whyTitle | en |
| es-AR | home.why | en |
| es-AR | home.getTitle | en |
| es-AR | home.item1 | en |
| es-AR | home.item2 | en |
| es-AR | home.item3 | en |
| es-AR | home.item4 | en |
| es-AR | home.item5 | en |
| es-AR | home.item6 | en |
| es-AR | home.item7 | en |
| es-AR | home.availability | en |
| es-AR | home.joinWaitlist | en |
| es-AR | footer.disclaimer | en |
| es-AR | footer.terms | new UI string (no CONTENT.md source) |
| es-AR | footer.privacy | new UI string (no CONTENT.md source) |
| es-AR | footer.disclaimerLink | new UI string (no CONTENT.md source) |
| es-AR | nav.pricing | new UI string (no CONTENT.md source) |
| es-AR | nav.legalBasis | new UI string (no CONTENT.md source) |
| es-AR | common.changeCountry | new UI string (no CONTENT.md source) |
| es-AR | common.language | new UI string (no CONTENT.md source) |
| es-AR | legal.draft | en (legal.draft) |
| es-AR | consent.text | en (consent.text) |
| es-AR | consent.accept | en (consent.accept) |
| es-AR | consent.reject | en (consent.reject) |
| es-AR | waitlist.intro | en (waitlist.intro) |
| es-AR | waitlist.emailLabel | new UI string (no CONTENT.md source) |
| es-AR | waitlist.countryLabel | new UI string (no CONTENT.md source) |
| es-AR | waitlist.success | en (waitlist.success) |
| es-AR | waitlist.invalid | en (waitlist.invalid) |
| es-AR | waitlist.error | en (waitlist.error) |
| es-AR | landing.whyTitle | es-AR (CONTENT.md heading is quoted without the closing '?') |
| es-AR | howItWorks.title | en |
| es-AR | faq.title | en |
| es-AR | pricing.includedTitle | new UI string (no CONTENT.md source) |
| es-AR | pricing.tba | new UI string (no CONTENT.md source) |
| es-AR | checkout.title | new UI string (no CONTENT.md source) |
| es-AR | checkout.unavailable | new UI string (no CONTENT.md source) |
| pt-BR | meta.home.title | en |
| pt-BR | meta.home.description | en |
| pt-BR | home.hero | en |
| pt-BR | home.sub | en |
| pt-BR | home.cta | en |
| pt-BR | home.argentina | en |
| pt-BR | home.brazil | en |
| pt-BR | home.mexico | en |
| pt-BR | home.other | en |
| pt-BR | home.whyTitle | en |
| pt-BR | home.why | en |
| pt-BR | home.getTitle | en |
| pt-BR | home.item1 | en |
| pt-BR | home.item2 | en |
| pt-BR | home.item3 | en |
| pt-BR | home.item4 | en |
| pt-BR | home.item5 | en |
| pt-BR | home.item6 | en |
| pt-BR | home.item7 | en |
| pt-BR | home.availability | en |
| pt-BR | home.joinWaitlist | en |
| pt-BR | footer.disclaimer | en |
| pt-BR | footer.terms | new UI string (no CONTENT.md source) |
| pt-BR | footer.privacy | new UI string (no CONTENT.md source) |
| pt-BR | footer.disclaimerLink | new UI string (no CONTENT.md source) |
| pt-BR | nav.pricing | new UI string (no CONTENT.md source) |
| pt-BR | nav.legalBasis | new UI string (no CONTENT.md source) |
| pt-BR | common.changeCountry | new UI string (no CONTENT.md source) |
| pt-BR | common.language | new UI string (no CONTENT.md source) |
| pt-BR | legal.draft | en (legal.draft) |
| pt-BR | consent.text | en (consent.text) |
| pt-BR | consent.accept | en (consent.accept) |
| pt-BR | consent.reject | en (consent.reject) |
| pt-BR | waitlist.intro | en (waitlist.intro) |
| pt-BR | waitlist.emailLabel | new UI string (no CONTENT.md source) |
| pt-BR | waitlist.countryLabel | new UI string (no CONTENT.md source) |
| pt-BR | waitlist.success | en (waitlist.success) |
| pt-BR | waitlist.invalid | en (waitlist.invalid) |
| pt-BR | waitlist.error | en (waitlist.error) |
| pt-BR | landing.ctaSecondary | es-AR |
| pt-BR | landing.pricingCta | es-AR |
| pt-BR | landing.pricingLink | es-AR |
| pt-BR | howItWorks.title | en |
| pt-BR | howItWorks.s1t | es-AR |
| pt-BR | howItWorks.s2t | es-AR |
| pt-BR | howItWorks.s2b | es-AR |
| pt-BR | howItWorks.s3t | es-AR |
| pt-BR | howItWorks.s3b | es-AR |
| pt-BR | howItWorks.s4t | es-AR |
| pt-BR | howItWorks.s4b | es-AR |
| pt-BR | howItWorks.s5t | es-AR |
| pt-BR | howItWorks.s5b | es-AR |
| pt-BR | faq.title | en |
| pt-BR | faq.q1 | es-AR |
| pt-BR | faq.a1 | es-AR |
| pt-BR | faq.q2 | es-AR |
| pt-BR | faq.a2 | es-AR |
| pt-BR | faq.q3 | es-AR |
| pt-BR | faq.a3 | es-AR |
| pt-BR | faq.q4 | es-AR |
| pt-BR | faq.a4 | es-AR |
| pt-BR | faq.q5 | es-AR |
| pt-BR | faq.a5 | es-AR |
| pt-BR | pricing.includedTitle | new UI string (no CONTENT.md source) |
| pt-BR | pricing.trust | es-AR |
| pt-BR | pricing.tba | new UI string (no CONTENT.md source) |
| pt-BR | checkout.title | new UI string (no CONTENT.md source) |
| pt-BR | checkout.unavailable | new UI string (no CONTENT.md source) |
| es-MX | meta.home.title | en |
| es-MX | meta.home.description | en |
| es-MX | home.hero | en |
| es-MX | home.sub | en |
| es-MX | home.cta | en |
| es-MX | home.argentina | en |
| es-MX | home.brazil | en |
| es-MX | home.mexico | en |
| es-MX | home.other | en |
| es-MX | home.whyTitle | en |
| es-MX | home.why | en |
| es-MX | home.getTitle | en |
| es-MX | home.item1 | en |
| es-MX | home.item2 | en |
| es-MX | home.item3 | en |
| es-MX | home.item4 | en |
| es-MX | home.item5 | en |
| es-MX | home.item6 | en |
| es-MX | home.item7 | en |
| es-MX | home.availability | en |
| es-MX | home.joinWaitlist | en |
| es-MX | footer.disclaimer | en |
| es-MX | footer.terms | new UI string (no CONTENT.md source) |
| es-MX | footer.privacy | new UI string (no CONTENT.md source) |
| es-MX | footer.disclaimerLink | new UI string (no CONTENT.md source) |
| es-MX | nav.pricing | new UI string (no CONTENT.md source) |
| es-MX | nav.legalBasis | new UI string (no CONTENT.md source) |
| es-MX | common.changeCountry | new UI string (no CONTENT.md source) |
| es-MX | common.language | new UI string (no CONTENT.md source) |
| es-MX | legal.draft | en (legal.draft) |
| es-MX | consent.text | en (consent.text) |
| es-MX | consent.accept | en (consent.accept) |
| es-MX | consent.reject | en (consent.reject) |
| es-MX | waitlist.intro | en (waitlist.intro) |
| es-MX | waitlist.emailLabel | new UI string (no CONTENT.md source) |
| es-MX | waitlist.countryLabel | new UI string (no CONTENT.md source) |
| es-MX | waitlist.success | en (waitlist.success) |
| es-MX | waitlist.invalid | en (waitlist.invalid) |
| es-MX | waitlist.error | en (waitlist.error) |
| es-MX | landing.pricingCta | es-AR |
| es-MX | landing.pricingLink | es-AR |
| es-MX | howItWorks.title | en |
| es-MX | howItWorks.s1t | es-AR |
| es-MX | howItWorks.s2t | es-AR |
| es-MX | howItWorks.s3b | es-AR |
| es-MX | howItWorks.s4t | es-AR |
| es-MX | howItWorks.s5t | es-AR |
| es-MX | faq.title | en |
| es-MX | faq.a2 | es-AR |
| es-MX | faq.a4 | es-AR |
| es-MX | faq.a5 | es-AR |
| es-MX | pricing.includedTitle | new UI string (no CONTENT.md source) |
| es-MX | pricing.trust | es-AR |
| es-MX | pricing.tba | new UI string (no CONTENT.md source) |
| es-MX | checkout.title | new UI string (no CONTENT.md source) |
| es-MX | checkout.unavailable | new UI string (no CONTENT.md source) |
