# Gap-filled and new strings — for review before launch

Every message key is either **verbatim** from CONTENT.md or listed here. A test (`tests/messages.test.ts`)
enforces that: any string not listed below must appear in CONTENT.md. Esteban reviews this file before
launch (CLAUDE.md §11); the footer disclaimer and the "does this certify…?" FAQ answer (`footer.disclaimer`,
`faq.a5`) and the legal-basis lines (`landing.min*`) are liability-sensitive and need a native speaker / lawyer.

Source column: the locale/key the text was translated from, or "new UI string" where CONTENT.md has no source at all
(the worker wrote the English and translated it faithfully).

Row counts: see the table (phase 6 added 141 keys per locale)

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
| en | checkout.companyName | new UI string (no CONTENT.md source) |
| en | checkout.taxId | new UI string (no CONTENT.md source) |
| en | checkout.taxIdBr | new UI string (no CONTENT.md source) |
| en | checkout.billingEmail | new UI string (no CONTENT.md source) |
| en | checkout.price | new UI string (no CONTENT.md source) |
| en | checkout.testPrice | new UI string (no CONTENT.md source) |
| en | checkout.processing | new UI string (no CONTENT.md source) |
| en | checkout.errInvalidName | new UI string (no CONTENT.md source) |
| en | checkout.errInvalidTaxId | new UI string (no CONTENT.md source) |
| en | checkout.errInvalidEmail | new UI string (no CONTENT.md source) |
| en | checkout.errEmailInUse | new UI string (no CONTENT.md source) |
| en | checkout.errCountry | new UI string (no CONTENT.md source) |
| en | checkout.errGeneric | new UI string (no CONTENT.md source) |
| en | checkout.signInLink | new UI string (no CONTENT.md source) |
| en | checkout.returnTitle | new UI string (no CONTENT.md source) |
| en | checkout.returnPending | new UI string (no CONTENT.md source) |
| en | checkout.returnFailed | new UI string (no CONTENT.md source) |
| en | checkout.returnExpired | new UI string (no CONTENT.md source) |
| en | checkout.returnRetry | new UI string (no CONTENT.md source) |
| en | checkout.returnPaid | new UI string (no CONTENT.md source) |
| en | checkout.continue | new UI string (no CONTENT.md source) |
| en | checkout.fakeTitle | new UI string (no CONTENT.md source) |
| en | checkout.fakeNote | new UI string (no CONTENT.md source) |
| en | checkout.fakePay | new UI string (no CONTENT.md source) |
| en | checkout.fakeFail | new UI string (no CONTENT.md source) |
| en | login.title | new UI string (no CONTENT.md source) |
| en | login.emailLabel | new UI string (no CONTENT.md source) |
| en | login.submit | new UI string (no CONTENT.md source) |
| en | login.sent | new UI string (no CONTENT.md source) |
| en | login.invalid | new UI string (no CONTENT.md source) |
| en | login.error | new UI string (no CONTENT.md source) |
| en | onboarding.title | new UI string (no CONTENT.md source) |
| en | onboarding.intro | new UI string (no CONTENT.md source) |
| en | onboarding.companyName | new UI string (no CONTENT.md source) |
| en | onboarding.industry | new UI string (no CONTENT.md source) |
| en | onboarding.industryPlaceholder | new UI string (no CONTENT.md source) |
| en | onboarding.logo | new UI string (no CONTENT.md source) |
| en | onboarding.logoHint | new UI string (no CONTENT.md source) |
| en | onboarding.submit | new UI string (no CONTENT.md source) |
| en | onboarding.saved | new UI string (no CONTENT.md source) |
| en | onboarding.errLogo | new UI string (no CONTENT.md source) |
| en | onboarding.errGeneric | new UI string (no CONTENT.md source) |
| en | industry.technology | new UI string (no CONTENT.md source) |
| en | industry.manufacturing | new UI string (no CONTENT.md source) |
| en | industry.construction | new UI string (no CONTENT.md source) |
| en | industry.services | new UI string (no CONTENT.md source) |
| en | industry.retail | new UI string (no CONTENT.md source) |
| en | industry.health | new UI string (no CONTENT.md source) |
| en | industry.finance | new UI string (no CONTENT.md source) |
| en | industry.energy | new UI string (no CONTENT.md source) |
| en | industry.agribusiness | new UI string (no CONTENT.md source) |
| en | industry.other | new UI string (no CONTENT.md source) |
| en | email.signinSubject | new UI string (no CONTENT.md source) |
| en | email.signinBody | new UI string (no CONTENT.md source) |
| en | email.signinButton | new UI string (no CONTENT.md source) |
| en | email.welcomeSubject | new UI string (no CONTENT.md source) |
| en | email.welcomeBody | new UI string (no CONTENT.md source) |
| en | email.welcomeButton | new UI string (no CONTENT.md source) |
| es-AR | checkout.companyName | en |
| es-AR | checkout.taxId | en |
| es-AR | checkout.taxIdBr | en |
| es-AR | checkout.billingEmail | en |
| es-AR | checkout.price | en |
| es-AR | checkout.testPrice | en |
| es-AR | checkout.processing | en |
| es-AR | checkout.errInvalidName | en |
| es-AR | checkout.errInvalidTaxId | en |
| es-AR | checkout.errInvalidEmail | en |
| es-AR | checkout.errEmailInUse | en |
| es-AR | checkout.errCountry | en |
| es-AR | checkout.errGeneric | en |
| es-AR | checkout.signInLink | en |
| es-AR | checkout.returnTitle | en |
| es-AR | checkout.returnPending | en |
| es-AR | checkout.returnFailed | en |
| es-AR | checkout.returnExpired | en |
| es-AR | checkout.returnRetry | en |
| es-AR | checkout.returnPaid | en |
| es-AR | checkout.continue | en |
| es-AR | checkout.fakeTitle | en |
| es-AR | checkout.fakeNote | en |
| es-AR | checkout.fakePay | en |
| es-AR | checkout.fakeFail | en |
| es-AR | login.title | en |
| es-AR | login.emailLabel | en |
| es-AR | login.submit | en |
| es-AR | login.sent | en |
| es-AR | login.invalid | en |
| es-AR | login.error | en |
| es-AR | onboarding.title | en |
| es-AR | onboarding.intro | en |
| es-AR | onboarding.companyName | en |
| es-AR | onboarding.industry | en |
| es-AR | onboarding.industryPlaceholder | en |
| es-AR | onboarding.logo | en |
| es-AR | onboarding.logoHint | en |
| es-AR | onboarding.submit | en |
| es-AR | onboarding.saved | en |
| es-AR | onboarding.errLogo | en |
| es-AR | onboarding.errGeneric | en |
| es-AR | industry.technology | en |
| es-AR | industry.manufacturing | en |
| es-AR | industry.construction | en |
| es-AR | industry.services | en |
| es-AR | industry.retail | en |
| es-AR | industry.health | en |
| es-AR | industry.finance | en |
| es-AR | industry.energy | en |
| es-AR | industry.agribusiness | en |
| es-AR | industry.other | en |
| es-AR | email.signinSubject | en |
| es-AR | email.signinBody | en |
| es-AR | email.signinButton | en |
| es-AR | email.welcomeSubject | en |
| es-AR | email.welcomeBody | en |
| es-AR | email.welcomeButton | en |
| pt-BR | checkout.companyName | en |
| pt-BR | checkout.taxId | en |
| pt-BR | checkout.taxIdBr | en |
| pt-BR | checkout.billingEmail | en |
| pt-BR | checkout.price | en |
| pt-BR | checkout.testPrice | en |
| pt-BR | checkout.processing | en |
| pt-BR | checkout.errInvalidName | en |
| pt-BR | checkout.errInvalidTaxId | en |
| pt-BR | checkout.errInvalidEmail | en |
| pt-BR | checkout.errEmailInUse | en |
| pt-BR | checkout.errCountry | en |
| pt-BR | checkout.errGeneric | en |
| pt-BR | checkout.signInLink | en |
| pt-BR | checkout.returnTitle | en |
| pt-BR | checkout.returnPending | en |
| pt-BR | checkout.returnFailed | en |
| pt-BR | checkout.returnExpired | en |
| pt-BR | checkout.returnRetry | en |
| pt-BR | checkout.returnPaid | en |
| pt-BR | checkout.continue | en |
| pt-BR | checkout.fakeTitle | en |
| pt-BR | checkout.fakeNote | en |
| pt-BR | checkout.fakePay | en |
| pt-BR | checkout.fakeFail | en |
| pt-BR | login.title | en |
| pt-BR | login.emailLabel | en |
| pt-BR | login.submit | en |
| pt-BR | login.sent | en |
| pt-BR | login.invalid | en |
| pt-BR | login.error | en |
| pt-BR | onboarding.title | en |
| pt-BR | onboarding.intro | en |
| pt-BR | onboarding.companyName | en |
| pt-BR | onboarding.industry | en |
| pt-BR | onboarding.industryPlaceholder | en |
| pt-BR | onboarding.logo | en |
| pt-BR | onboarding.logoHint | en |
| pt-BR | onboarding.submit | en |
| pt-BR | onboarding.saved | en |
| pt-BR | onboarding.errLogo | en |
| pt-BR | onboarding.errGeneric | en |
| pt-BR | industry.technology | en |
| pt-BR | industry.manufacturing | en |
| pt-BR | industry.construction | en |
| pt-BR | industry.services | en |
| pt-BR | industry.retail | en |
| pt-BR | industry.health | en |
| pt-BR | industry.finance | en |
| pt-BR | industry.energy | en |
| pt-BR | industry.agribusiness | en |
| pt-BR | industry.other | en |
| pt-BR | email.signinSubject | en |
| pt-BR | email.signinBody | en |
| pt-BR | email.signinButton | en |
| pt-BR | email.welcomeSubject | en |
| pt-BR | email.welcomeBody | en |
| pt-BR | email.welcomeButton | en |
| es-MX | checkout.companyName | en |
| es-MX | checkout.taxId | en |
| es-MX | checkout.taxIdBr | en |
| es-MX | checkout.billingEmail | en |
| es-MX | checkout.price | en |
| es-MX | checkout.testPrice | en |
| es-MX | checkout.processing | en |
| es-MX | checkout.errInvalidName | en |
| es-MX | checkout.errInvalidTaxId | en |
| es-MX | checkout.errInvalidEmail | en |
| es-MX | checkout.errEmailInUse | en |
| es-MX | checkout.errCountry | en |
| es-MX | checkout.errGeneric | en |
| es-MX | checkout.signInLink | en |
| es-MX | checkout.returnTitle | en |
| es-MX | checkout.returnPending | en |
| es-MX | checkout.returnFailed | en |
| es-MX | checkout.returnExpired | en |
| es-MX | checkout.returnRetry | en |
| es-MX | checkout.returnPaid | en |
| es-MX | checkout.continue | en |
| es-MX | checkout.fakeTitle | en |
| es-MX | checkout.fakeNote | en |
| es-MX | checkout.fakePay | en |
| es-MX | checkout.fakeFail | en |
| es-MX | login.title | en |
| es-MX | login.emailLabel | en |
| es-MX | login.submit | en |
| es-MX | login.sent | en |
| es-MX | login.invalid | en |
| es-MX | login.error | en |
| es-MX | onboarding.title | en |
| es-MX | onboarding.intro | en |
| es-MX | onboarding.companyName | en |
| es-MX | onboarding.industry | en |
| es-MX | onboarding.industryPlaceholder | en |
| es-MX | onboarding.logo | en |
| es-MX | onboarding.logoHint | en |
| es-MX | onboarding.submit | en |
| es-MX | onboarding.saved | en |
| es-MX | onboarding.errLogo | en |
| es-MX | onboarding.errGeneric | en |
| es-MX | industry.technology | en |
| es-MX | industry.manufacturing | en |
| es-MX | industry.construction | en |
| es-MX | industry.services | en |
| es-MX | industry.retail | en |
| es-MX | industry.health | en |
| es-MX | industry.finance | en |
| es-MX | industry.energy | en |
| es-MX | industry.agribusiness | en |
| es-MX | industry.other | en |
| es-MX | email.signinSubject | en |
| es-MX | email.signinBody | en |
| es-MX | email.signinButton | en |
| es-MX | email.welcomeSubject | en |
| es-MX | email.welcomeBody | en |
| es-MX | email.welcomeButton | en |
| en | documents.title | new UI string (no CONTENT.md source) |
| en | documents.intro | new UI string (no CONTENT.md source) |
| en | documents.version | new UI string (no CONTENT.md source) |
| en | documents.generatedOn | new UI string (no CONTENT.md source) |
| en | documents.view | new UI string (no CONTENT.md source) |
| en | documents.download | new UI string (no CONTENT.md source) |
| en | documents.regenerate | new UI string (no CONTENT.md source) |
| en | documents.regenerateAll | new UI string (no CONTENT.md source) |
| en | documents.regenerateHint | new UI string (no CONTENT.md source) |
| en | documents.versions | new UI string (no CONTENT.md source) |
| en | documents.current | new UI string (no CONTENT.md source) |
| en | documents.backToList | new UI string (no CONTENT.md source) |
| en | documents.created | new UI string (no CONTENT.md source) |
| en | documents.unchanged | new UI string (no CONTENT.md source) |
| en | documents.pageOf | new UI string (no CONTENT.md source) |
| en | documents.languageNote | new UI string (no CONTENT.md source) |
| en | documents.empty | new UI string (no CONTENT.md source) |
| en | documents.errRegenerate | new UI string (no CONTENT.md source) |
| en | documents.types.codeOfConduct | new UI string (no CONTENT.md source) |
| en | documents.types.antiBribery | new UI string (no CONTENT.md source) |
| en | documents.types.giftsHospitality | new UI string (no CONTENT.md source) |
| en | documents.types.conflictsOfInterest | new UI string (no CONTENT.md source) |
| en | documents.types.thirdPartyPublicOfficials | new UI string (no CONTENT.md source) |
| en | documents.types.whistleblowerProtection | new UI string (no CONTENT.md source) |
| es-AR | documents.title | en |
| es-AR | documents.intro | en |
| es-AR | documents.version | en |
| es-AR | documents.generatedOn | en |
| es-AR | documents.view | en |
| es-AR | documents.download | en |
| es-AR | documents.regenerate | en |
| es-AR | documents.regenerateAll | en |
| es-AR | documents.regenerateHint | en |
| es-AR | documents.versions | en |
| es-AR | documents.current | en |
| es-AR | documents.backToList | en |
| es-AR | documents.created | en |
| es-AR | documents.unchanged | en |
| es-AR | documents.pageOf | en |
| es-AR | documents.languageNote | en |
| es-AR | documents.empty | en |
| es-AR | documents.errRegenerate | en |
| es-AR | documents.types.codeOfConduct | en |
| es-AR | documents.types.antiBribery | en |
| es-AR | documents.types.giftsHospitality | en |
| es-AR | documents.types.conflictsOfInterest | en |
| es-AR | documents.types.thirdPartyPublicOfficials | en |
| es-AR | documents.types.whistleblowerProtection | en |
| es-MX | documents.title | en |
| es-MX | documents.intro | en |
| es-MX | documents.version | en |
| es-MX | documents.generatedOn | en |
| es-MX | documents.view | en |
| es-MX | documents.download | en |
| es-MX | documents.regenerate | en |
| es-MX | documents.regenerateAll | en |
| es-MX | documents.regenerateHint | en |
| es-MX | documents.versions | en |
| es-MX | documents.current | en |
| es-MX | documents.backToList | en |
| es-MX | documents.created | en |
| es-MX | documents.unchanged | en |
| es-MX | documents.pageOf | en |
| es-MX | documents.languageNote | en |
| es-MX | documents.empty | en |
| es-MX | documents.errRegenerate | en |
| es-MX | documents.types.codeOfConduct | en |
| es-MX | documents.types.antiBribery | en |
| es-MX | documents.types.giftsHospitality | en |
| es-MX | documents.types.conflictsOfInterest | en |
| es-MX | documents.types.thirdPartyPublicOfficials | en |
| es-MX | documents.types.whistleblowerProtection | en |
| pt-BR | documents.title | en |
| pt-BR | documents.intro | en |
| pt-BR | documents.version | en |
| pt-BR | documents.generatedOn | en |
| pt-BR | documents.view | en |
| pt-BR | documents.download | en |
| pt-BR | documents.regenerate | en |
| pt-BR | documents.regenerateAll | en |
| pt-BR | documents.regenerateHint | en |
| pt-BR | documents.versions | en |
| pt-BR | documents.current | en |
| pt-BR | documents.backToList | en |
| pt-BR | documents.created | en |
| pt-BR | documents.unchanged | en |
| pt-BR | documents.pageOf | en |
| pt-BR | documents.languageNote | en |
| pt-BR | documents.empty | en |
| pt-BR | documents.errRegenerate | en |
| pt-BR | documents.types.codeOfConduct | en |
| pt-BR | documents.types.antiBribery | en |
| pt-BR | documents.types.giftsHospitality | en |
| pt-BR | documents.types.conflictsOfInterest | en |
| pt-BR | documents.types.thirdPartyPublicOfficials | en |
| pt-BR | documents.types.whistleblowerProtection | en |
| en | dashboard.title | new UI string (no CONTENT.md source) |
| en | dashboard.skipToContent | new UI string (no CONTENT.md source) |
| en | dashboard.navLabel | new UI string (no CONTENT.md source) |
| en | dashboard.signedInAs | new UI string (no CONTENT.md source) |
| en | dashboard.signOut | new UI string (no CONTENT.md source) |
| en | dashboard.logoAlt | new UI string (no CONTENT.md source) |
| en | dashboard.unavailable | new UI string (no CONTENT.md source) |
| en | dashboard.nav.overview | new UI string (no CONTENT.md source) |
| en | dashboard.nav.documents | new UI string (no CONTENT.md source) |
| en | dashboard.nav.employees | new UI string (no CONTENT.md source) |
| en | dashboard.nav.training | new UI string (no CONTENT.md source) |
| en | dashboard.nav.whistleblower | new UI string (no CONTENT.md source) |
| en | dashboard.nav.vendors | new UI string (no CONTENT.md source) |
| en | dashboard.nav.billing | new UI string (no CONTENT.md source) |
| en | dashboard.nav.settings | new UI string (no CONTENT.md source) |
| en | dashboard.overview.title | new UI string (no CONTENT.md source) |
| en | dashboard.overview.intro | new UI string (no CONTENT.md source) |
| en | dashboard.overview.documents | new UI string (no CONTENT.md source) |
| en | dashboard.overview.documentsCount | new UI string (no CONTENT.md source) |
| en | dashboard.overview.documentsDraft | new UI string (no CONTENT.md source) |
| en | dashboard.overview.employees | new UI string (no CONTENT.md source) |
| en | dashboard.overview.employeesCount | new UI string (no CONTENT.md source) |
| en | dashboard.overview.openCases | new UI string (no CONTENT.md source) |
| en | dashboard.overview.openCasesCount | new UI string (no CONTENT.md source) |
| en | dashboard.overview.completion | new UI string (no CONTENT.md source) |
| en | dashboard.overview.completionNote | new UI string (no CONTENT.md source) |
| en | dashboard.overview.binder | new UI string (no CONTENT.md source) |
| en | dashboard.overview.binderDownload | new UI string (no CONTENT.md source) |
| en | dashboard.overview.sections | new UI string (no CONTENT.md source) |
| en | dashboard.employees.empty | new UI string (no CONTENT.md source) |
| en | dashboard.employees.action | new UI string (no CONTENT.md source) |
| en | dashboard.training.empty | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.empty | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.empty | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.action | new UI string (no CONTENT.md source) |
| en | dashboard.billing.subscriptionLabel | new UI string (no CONTENT.md source) |
| en | dashboard.billing.subscription.active | new UI string (no CONTENT.md source) |
| en | dashboard.billing.history | new UI string (no CONTENT.md source) |
| en | dashboard.billing.empty | new UI string (no CONTENT.md source) |
| en | dashboard.billing.date | new UI string (no CONTENT.md source) |
| en | dashboard.billing.amount | new UI string (no CONTENT.md source) |
| en | dashboard.billing.status | new UI string (no CONTENT.md source) |
| en | dashboard.billing.paid | new UI string (no CONTENT.md source) |
| en | dashboard.settings.savedNotice | new UI string (no CONTENT.md source) |
| en | dashboard.settings.savedLink | new UI string (no CONTENT.md source) |
| en | dashboard.settings.currentLogo | new UI string (no CONTENT.md source) |
| en | dashboard.settings.noLogo | new UI string (no CONTENT.md source) |
| en | dashboard.settings.replaceLogo | new UI string (no CONTENT.md source) |
| en | dashboard.settings.save | new UI string (no CONTENT.md source) |
| en | dashboard.settings.account | new UI string (no CONTENT.md source) |
| en | dashboard.settings.readOnlyNote | new UI string (no CONTENT.md source) |
| en | dashboard.settings.taxId | new UI string (no CONTENT.md source) |
| en | dashboard.settings.country | new UI string (no CONTENT.md source) |
| en | dashboard.settings.adminEmail | new UI string (no CONTENT.md source) |
| en | dashboard.settings.countries.ar | new UI string (no CONTENT.md source) |
| en | dashboard.settings.countries.br | new UI string (no CONTENT.md source) |
| en | dashboard.settings.countries.mx | new UI string (no CONTENT.md source) |
| es-AR | dashboard.title | en |
| es-AR | dashboard.skipToContent | en |
| es-AR | dashboard.navLabel | en |
| es-AR | dashboard.signedInAs | en |
| es-AR | dashboard.signOut | en |
| es-AR | dashboard.logoAlt | en |
| es-AR | dashboard.unavailable | en |
| es-AR | dashboard.nav.overview | en |
| es-AR | dashboard.nav.documents | en |
| es-AR | dashboard.nav.employees | en |
| es-AR | dashboard.nav.training | en |
| es-AR | dashboard.nav.whistleblower | en |
| es-AR | dashboard.nav.vendors | en |
| es-AR | dashboard.nav.billing | en |
| es-AR | dashboard.nav.settings | en |
| es-AR | dashboard.overview.title | en |
| es-AR | dashboard.overview.intro | en |
| es-AR | dashboard.overview.documents | en |
| es-AR | dashboard.overview.documentsCount | en |
| es-AR | dashboard.overview.documentsDraft | en |
| es-AR | dashboard.overview.employees | en |
| es-AR | dashboard.overview.employeesCount | en |
| es-AR | dashboard.overview.openCases | en |
| es-AR | dashboard.overview.openCasesCount | en |
| es-AR | dashboard.overview.completion | en |
| es-AR | dashboard.overview.completionNote | en |
| es-AR | dashboard.overview.binder | en |
| es-AR | dashboard.overview.binderDownload | en |
| es-AR | dashboard.overview.sections | en |
| es-AR | dashboard.employees.empty | en |
| es-AR | dashboard.employees.action | en |
| es-AR | dashboard.training.empty | en |
| es-AR | dashboard.whistleblower.empty | en |
| es-AR | dashboard.vendors.empty | en |
| es-AR | dashboard.vendors.action | en |
| es-AR | dashboard.billing.subscriptionLabel | en |
| es-AR | dashboard.billing.subscription.active | en |
| es-AR | dashboard.billing.history | en |
| es-AR | dashboard.billing.empty | en |
| es-AR | dashboard.billing.date | en |
| es-AR | dashboard.billing.amount | en |
| es-AR | dashboard.billing.status | en |
| es-AR | dashboard.billing.paid | en |
| es-AR | dashboard.settings.savedNotice | en |
| es-AR | dashboard.settings.savedLink | en |
| es-AR | dashboard.settings.currentLogo | en |
| es-AR | dashboard.settings.noLogo | en |
| es-AR | dashboard.settings.replaceLogo | en |
| es-AR | dashboard.settings.save | en |
| es-AR | dashboard.settings.account | en |
| es-AR | dashboard.settings.readOnlyNote | en |
| es-AR | dashboard.settings.taxId | en |
| es-AR | dashboard.settings.country | en |
| es-AR | dashboard.settings.adminEmail | en |
| es-AR | dashboard.settings.countries.ar | en |
| es-AR | dashboard.settings.countries.br | en |
| es-AR | dashboard.settings.countries.mx | en |
| pt-BR | dashboard.title | en |
| pt-BR | dashboard.skipToContent | en |
| pt-BR | dashboard.navLabel | en |
| pt-BR | dashboard.signedInAs | en |
| pt-BR | dashboard.signOut | en |
| pt-BR | dashboard.logoAlt | en |
| pt-BR | dashboard.unavailable | en |
| pt-BR | dashboard.nav.overview | en |
| pt-BR | dashboard.nav.documents | en |
| pt-BR | dashboard.nav.employees | en |
| pt-BR | dashboard.nav.training | en |
| pt-BR | dashboard.nav.whistleblower | en |
| pt-BR | dashboard.nav.vendors | en |
| pt-BR | dashboard.nav.billing | en |
| pt-BR | dashboard.nav.settings | en |
| pt-BR | dashboard.overview.title | en |
| pt-BR | dashboard.overview.intro | en |
| pt-BR | dashboard.overview.documents | en |
| pt-BR | dashboard.overview.documentsCount | en |
| pt-BR | dashboard.overview.documentsDraft | en |
| pt-BR | dashboard.overview.employees | en |
| pt-BR | dashboard.overview.employeesCount | en |
| pt-BR | dashboard.overview.openCases | en |
| pt-BR | dashboard.overview.openCasesCount | en |
| pt-BR | dashboard.overview.completion | en |
| pt-BR | dashboard.overview.completionNote | en |
| pt-BR | dashboard.overview.binder | en |
| pt-BR | dashboard.overview.binderDownload | en |
| pt-BR | dashboard.overview.sections | en |
| pt-BR | dashboard.employees.empty | en |
| pt-BR | dashboard.employees.action | en |
| pt-BR | dashboard.training.empty | en |
| pt-BR | dashboard.whistleblower.empty | en |
| pt-BR | dashboard.vendors.empty | en |
| pt-BR | dashboard.vendors.action | en |
| pt-BR | dashboard.billing.subscriptionLabel | en |
| pt-BR | dashboard.billing.subscription.active | en |
| pt-BR | dashboard.billing.history | en |
| pt-BR | dashboard.billing.empty | en |
| pt-BR | dashboard.billing.date | en |
| pt-BR | dashboard.billing.amount | en |
| pt-BR | dashboard.billing.status | en |
| pt-BR | dashboard.billing.paid | en |
| pt-BR | dashboard.settings.savedNotice | en |
| pt-BR | dashboard.settings.savedLink | en |
| pt-BR | dashboard.settings.currentLogo | en |
| pt-BR | dashboard.settings.noLogo | en |
| pt-BR | dashboard.settings.replaceLogo | en |
| pt-BR | dashboard.settings.save | en |
| pt-BR | dashboard.settings.account | en |
| pt-BR | dashboard.settings.readOnlyNote | en |
| pt-BR | dashboard.settings.taxId | en |
| pt-BR | dashboard.settings.country | en |
| pt-BR | dashboard.settings.adminEmail | en |
| pt-BR | dashboard.settings.countries.ar | en |
| pt-BR | dashboard.settings.countries.br | en |
| pt-BR | dashboard.settings.countries.mx | en |
| es-MX | dashboard.title | en |
| es-MX | dashboard.skipToContent | en |
| es-MX | dashboard.navLabel | en |
| es-MX | dashboard.signedInAs | en |
| es-MX | dashboard.signOut | en |
| es-MX | dashboard.logoAlt | en |
| es-MX | dashboard.unavailable | en |
| es-MX | dashboard.nav.overview | en |
| es-MX | dashboard.nav.documents | en |
| es-MX | dashboard.nav.employees | en |
| es-MX | dashboard.nav.training | en |
| es-MX | dashboard.nav.whistleblower | en |
| es-MX | dashboard.nav.vendors | en |
| es-MX | dashboard.nav.billing | en |
| es-MX | dashboard.nav.settings | en |
| es-MX | dashboard.overview.title | en |
| es-MX | dashboard.overview.intro | en |
| es-MX | dashboard.overview.documents | en |
| es-MX | dashboard.overview.documentsCount | en |
| es-MX | dashboard.overview.documentsDraft | en |
| es-MX | dashboard.overview.employees | en |
| es-MX | dashboard.overview.employeesCount | en |
| es-MX | dashboard.overview.openCases | en |
| es-MX | dashboard.overview.openCasesCount | en |
| es-MX | dashboard.overview.completion | en |
| es-MX | dashboard.overview.completionNote | en |
| es-MX | dashboard.overview.binder | en |
| es-MX | dashboard.overview.binderDownload | en |
| es-MX | dashboard.overview.sections | en |
| es-MX | dashboard.employees.empty | en |
| es-MX | dashboard.employees.action | en |
| es-MX | dashboard.training.empty | en |
| es-MX | dashboard.whistleblower.empty | en |
| es-MX | dashboard.vendors.empty | en |
| es-MX | dashboard.vendors.action | en |
| es-MX | dashboard.billing.subscriptionLabel | en |
| es-MX | dashboard.billing.subscription.active | en |
| es-MX | dashboard.billing.history | en |
| es-MX | dashboard.billing.empty | en |
| es-MX | dashboard.billing.date | en |
| es-MX | dashboard.billing.amount | en |
| es-MX | dashboard.billing.status | en |
| es-MX | dashboard.billing.paid | en |
| es-MX | dashboard.settings.savedNotice | en |
| es-MX | dashboard.settings.savedLink | en |
| es-MX | dashboard.settings.currentLogo | en |
| es-MX | dashboard.settings.noLogo | en |
| es-MX | dashboard.settings.replaceLogo | en |
| es-MX | dashboard.settings.save | en |
| es-MX | dashboard.settings.account | en |
| es-MX | dashboard.settings.readOnlyNote | en |
| es-MX | dashboard.settings.taxId | en |
| es-MX | dashboard.settings.country | en |
| es-MX | dashboard.settings.adminEmail | en |
| es-MX | dashboard.settings.countries.ar | en |
| es-MX | dashboard.settings.countries.br | en |
| es-MX | dashboard.settings.countries.mx | en |
| en | report.title | es-AR (CONTENT.md §5, adapted) |
| en | report.intro | es-AR (CONTENT.md §5, adapted) |
| en | report.logoAlt | new UI string (no CONTENT.md source) |
| en | report.categoryLabel | es-AR (CONTENT.md §5, adapted) |
| en | report.categoryPlaceholder | new UI string (no CONTENT.md source) |
| en | report.categories.corruption_bribery | es-AR (CONTENT.md §5, adapted) |
| en | report.categories.conflict_of_interest | es-AR (CONTENT.md §5, adapted) |
| en | report.categories.fraud | es-AR (CONTENT.md §5, adapted) |
| en | report.categories.harassment | es-AR (CONTENT.md §5, adapted) |
| en | report.categories.other | es-AR (CONTENT.md §5, adapted) |
| en | report.descriptionLabel | es-AR (CONTENT.md §5, adapted) |
| en | report.descriptionHelp | new UI string (no CONTENT.md source) |
| en | report.evidenceLabel | es-AR (CONTENT.md §5, adapted) |
| en | report.evidenceHelp | new UI string (no CONTENT.md source) |
| en | report.contactQuestion | es-AR (CONTENT.md §5, adapted) |
| en | report.contactYes | es-AR (CONTENT.md §5, adapted) |
| en | report.contactNo | es-AR (CONTENT.md §5, adapted) |
| en | report.contactLabel | new UI string (no CONTENT.md source) |
| en | report.contactHelp | new UI string (no CONTENT.md source) |
| en | report.submit | new UI string (no CONTENT.md source) |
| en | report.submitting | new UI string (no CONTENT.md source) |
| en | report.confirmed | es-AR (CONTENT.md §5, adapted) |
| en | report.saveCode | new UI string (no CONTENT.md source) |
| en | report.statusLink | new UI string (no CONTENT.md source) |
| en | report.errors.category | new UI string (no CONTENT.md source) |
| en | report.errors.description | new UI string (no CONTENT.md source) |
| en | report.errors.contact | new UI string (no CONTENT.md source) |
| en | report.errors.too_many_files | new UI string (no CONTENT.md source) |
| en | report.errors.file_too_large | new UI string (no CONTENT.md source) |
| en | report.errors.file_type | new UI string (no CONTENT.md source) |
| en | report.errors.file_invalid | new UI string (no CONTENT.md source) |
| en | report.errors.rate_limited | new UI string (no CONTENT.md source) |
| en | report.errors.server_error | new UI string (no CONTENT.md source) |
| en | report.errors.network | new UI string (no CONTENT.md source) |
| en | report.status.title | new UI string (no CONTENT.md source) |
| en | report.status.intro | new UI string (no CONTENT.md source) |
| en | report.status.codeLabel | new UI string (no CONTENT.md source) |
| en | report.status.submit | new UI string (no CONTENT.md source) |
| en | report.status.checking | new UI string (no CONTENT.md source) |
| en | report.status.resultStatus | new UI string (no CONTENT.md source) |
| en | report.status.resultDate | new UI string (no CONTENT.md source) |
| en | report.status.notFound | new UI string (no CONTENT.md source) |
| en | report.status.back | new UI string (no CONTENT.md source) |
| en | report.statuses.new | new UI string (no CONTENT.md source) |
| en | report.statuses.under_review | new UI string (no CONTENT.md source) |
| en | report.statuses.closed | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.channelTitle | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.channelHelp | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.channelLabel | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.copy | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.copied | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.colReceived | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.colCategory | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.colStatus | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.colAction | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.view | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.back | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.resolvedOn | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.contact | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.anonymous | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.description | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.changeStatus | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.apply | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.evidence | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.evidenceNone | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.download | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.timeline | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.noNotes | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.noteLabel | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.addNote | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.statusMoved | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.cannotDecrypt | new UI string (no CONTENT.md source) |
| en | dashboard.whistleblower.error | new UI string (no CONTENT.md source) |
| en | email.reportSubject | new UI string (no CONTENT.md source) |
| en | email.reportBody | new UI string (no CONTENT.md source) |
| es-AR | report.title | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.intro | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.logoAlt | en |
| es-AR | report.categoryLabel | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.categoryPlaceholder | en |
| es-AR | report.categories.corruption_bribery | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.categories.conflict_of_interest | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.categories.fraud | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.categories.harassment | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.categories.other | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.descriptionLabel | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.descriptionHelp | en |
| es-AR | report.evidenceLabel | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.evidenceHelp | en |
| es-AR | report.contactQuestion | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.contactYes | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.contactNo | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.contactLabel | en |
| es-AR | report.contactHelp | en |
| es-AR | report.submit | en |
| es-AR | report.submitting | en |
| es-AR | report.confirmed | CONTENT.md §5 (with company-name placeholder) |
| es-AR | report.saveCode | en |
| es-AR | report.statusLink | en |
| es-AR | report.errors.category | en |
| es-AR | report.errors.description | en |
| es-AR | report.errors.contact | en |
| es-AR | report.errors.too_many_files | en |
| es-AR | report.errors.file_too_large | en |
| es-AR | report.errors.file_type | en |
| es-AR | report.errors.file_invalid | en |
| es-AR | report.errors.rate_limited | en |
| es-AR | report.errors.server_error | en |
| es-AR | report.errors.network | en |
| es-AR | report.status.title | en |
| es-AR | report.status.intro | en |
| es-AR | report.status.codeLabel | en |
| es-AR | report.status.submit | en |
| es-AR | report.status.checking | en |
| es-AR | report.status.resultStatus | en |
| es-AR | report.status.resultDate | en |
| es-AR | report.status.notFound | en |
| es-AR | report.status.back | en |
| es-AR | report.statuses.new | en |
| es-AR | report.statuses.under_review | en |
| es-AR | report.statuses.closed | en |
| es-AR | dashboard.whistleblower.channelTitle | en |
| es-AR | dashboard.whistleblower.channelHelp | en |
| es-AR | dashboard.whistleblower.channelLabel | en |
| es-AR | dashboard.whistleblower.copy | en |
| es-AR | dashboard.whistleblower.copied | en |
| es-AR | dashboard.whistleblower.colReceived | en |
| es-AR | dashboard.whistleblower.colCategory | en |
| es-AR | dashboard.whistleblower.colStatus | en |
| es-AR | dashboard.whistleblower.colAction | en |
| es-AR | dashboard.whistleblower.view | en |
| es-AR | dashboard.whistleblower.back | en |
| es-AR | dashboard.whistleblower.resolvedOn | en |
| es-AR | dashboard.whistleblower.contact | en |
| es-AR | dashboard.whistleblower.anonymous | en |
| es-AR | dashboard.whistleblower.description | en |
| es-AR | dashboard.whistleblower.changeStatus | en |
| es-AR | dashboard.whistleblower.apply | en |
| es-AR | dashboard.whistleblower.evidence | en |
| es-AR | dashboard.whistleblower.evidenceNone | en |
| es-AR | dashboard.whistleblower.download | en |
| es-AR | dashboard.whistleblower.timeline | en |
| es-AR | dashboard.whistleblower.noNotes | en |
| es-AR | dashboard.whistleblower.noteLabel | en |
| es-AR | dashboard.whistleblower.addNote | en |
| es-AR | dashboard.whistleblower.statusMoved | en |
| es-AR | dashboard.whistleblower.cannotDecrypt | en |
| es-AR | dashboard.whistleblower.error | en |
| es-AR | email.reportSubject | en |
| es-AR | email.reportBody | en |
| pt-BR | report.title | es-AR (CONTENT.md §5) |
| pt-BR | report.intro | es-AR (CONTENT.md §5) |
| pt-BR | report.logoAlt | en |
| pt-BR | report.categoryLabel | es-AR (CONTENT.md §5) |
| pt-BR | report.categoryPlaceholder | en |
| pt-BR | report.categories.corruption_bribery | es-AR (CONTENT.md §5) |
| pt-BR | report.categories.conflict_of_interest | es-AR (CONTENT.md §5) |
| pt-BR | report.categories.fraud | es-AR (CONTENT.md §5) |
| pt-BR | report.categories.harassment | es-AR (CONTENT.md §5) |
| pt-BR | report.categories.other | es-AR (CONTENT.md §5) |
| pt-BR | report.descriptionLabel | es-AR (CONTENT.md §5) |
| pt-BR | report.descriptionHelp | en |
| pt-BR | report.evidenceLabel | es-AR (CONTENT.md §5) |
| pt-BR | report.evidenceHelp | en |
| pt-BR | report.contactQuestion | es-AR (CONTENT.md §5) |
| pt-BR | report.contactYes | es-AR (CONTENT.md §5) |
| pt-BR | report.contactNo | es-AR (CONTENT.md §5) |
| pt-BR | report.contactLabel | en |
| pt-BR | report.contactHelp | en |
| pt-BR | report.submit | en |
| pt-BR | report.submitting | en |
| pt-BR | report.confirmed | es-AR (CONTENT.md §5) |
| pt-BR | report.saveCode | en |
| pt-BR | report.statusLink | en |
| pt-BR | report.errors.category | en |
| pt-BR | report.errors.description | en |
| pt-BR | report.errors.contact | en |
| pt-BR | report.errors.too_many_files | en |
| pt-BR | report.errors.file_too_large | en |
| pt-BR | report.errors.file_type | en |
| pt-BR | report.errors.file_invalid | en |
| pt-BR | report.errors.rate_limited | en |
| pt-BR | report.errors.server_error | en |
| pt-BR | report.errors.network | en |
| pt-BR | report.status.title | en |
| pt-BR | report.status.intro | en |
| pt-BR | report.status.codeLabel | en |
| pt-BR | report.status.submit | en |
| pt-BR | report.status.checking | en |
| pt-BR | report.status.resultStatus | en |
| pt-BR | report.status.resultDate | en |
| pt-BR | report.status.notFound | en |
| pt-BR | report.status.back | en |
| pt-BR | report.statuses.new | en |
| pt-BR | report.statuses.under_review | en |
| pt-BR | report.statuses.closed | en |
| pt-BR | dashboard.whistleblower.channelTitle | en |
| pt-BR | dashboard.whistleblower.channelHelp | en |
| pt-BR | dashboard.whistleblower.channelLabel | en |
| pt-BR | dashboard.whistleblower.copy | en |
| pt-BR | dashboard.whistleblower.copied | en |
| pt-BR | dashboard.whistleblower.colReceived | en |
| pt-BR | dashboard.whistleblower.colCategory | en |
| pt-BR | dashboard.whistleblower.colStatus | en |
| pt-BR | dashboard.whistleblower.colAction | en |
| pt-BR | dashboard.whistleblower.view | en |
| pt-BR | dashboard.whistleblower.back | en |
| pt-BR | dashboard.whistleblower.resolvedOn | en |
| pt-BR | dashboard.whistleblower.contact | en |
| pt-BR | dashboard.whistleblower.anonymous | en |
| pt-BR | dashboard.whistleblower.description | en |
| pt-BR | dashboard.whistleblower.changeStatus | en |
| pt-BR | dashboard.whistleblower.apply | en |
| pt-BR | dashboard.whistleblower.evidence | en |
| pt-BR | dashboard.whistleblower.evidenceNone | en |
| pt-BR | dashboard.whistleblower.download | en |
| pt-BR | dashboard.whistleblower.timeline | en |
| pt-BR | dashboard.whistleblower.noNotes | en |
| pt-BR | dashboard.whistleblower.noteLabel | en |
| pt-BR | dashboard.whistleblower.addNote | en |
| pt-BR | dashboard.whistleblower.statusMoved | en |
| pt-BR | dashboard.whistleblower.cannotDecrypt | en |
| pt-BR | dashboard.whistleblower.error | en |
| pt-BR | email.reportSubject | en |
| pt-BR | email.reportBody | en |
| es-MX | report.title | es-AR (CONTENT.md §5) |
| es-MX | report.intro | es-AR (CONTENT.md §5) |
| es-MX | report.logoAlt | en |
| es-MX | report.categoryLabel | es-AR (CONTENT.md §5) |
| es-MX | report.categoryPlaceholder | en |
| es-MX | report.categories.corruption_bribery | es-AR (CONTENT.md §5) |
| es-MX | report.categories.conflict_of_interest | es-AR (CONTENT.md §5) |
| es-MX | report.categories.fraud | es-AR (CONTENT.md §5) |
| es-MX | report.categories.harassment | es-AR (CONTENT.md §5) |
| es-MX | report.categories.other | es-AR (CONTENT.md §5) |
| es-MX | report.descriptionLabel | es-AR (CONTENT.md §5) |
| es-MX | report.descriptionHelp | en |
| es-MX | report.evidenceLabel | es-AR (CONTENT.md §5) |
| es-MX | report.evidenceHelp | en |
| es-MX | report.contactQuestion | es-AR (CONTENT.md §5) |
| es-MX | report.contactYes | es-AR (CONTENT.md §5) |
| es-MX | report.contactNo | es-AR (CONTENT.md §5) |
| es-MX | report.contactLabel | en |
| es-MX | report.contactHelp | en |
| es-MX | report.submit | en |
| es-MX | report.submitting | en |
| es-MX | report.confirmed | es-AR (CONTENT.md §5) |
| es-MX | report.saveCode | en |
| es-MX | report.statusLink | en |
| es-MX | report.errors.category | en |
| es-MX | report.errors.description | en |
| es-MX | report.errors.contact | en |
| es-MX | report.errors.too_many_files | en |
| es-MX | report.errors.file_too_large | en |
| es-MX | report.errors.file_type | en |
| es-MX | report.errors.file_invalid | en |
| es-MX | report.errors.rate_limited | en |
| es-MX | report.errors.server_error | en |
| es-MX | report.errors.network | en |
| es-MX | report.status.title | en |
| es-MX | report.status.intro | en |
| es-MX | report.status.codeLabel | en |
| es-MX | report.status.submit | en |
| es-MX | report.status.checking | en |
| es-MX | report.status.resultStatus | en |
| es-MX | report.status.resultDate | en |
| es-MX | report.status.notFound | en |
| es-MX | report.status.back | en |
| es-MX | report.statuses.new | en |
| es-MX | report.statuses.under_review | en |
| es-MX | report.statuses.closed | en |
| es-MX | dashboard.whistleblower.channelTitle | en |
| es-MX | dashboard.whistleblower.channelHelp | en |
| es-MX | dashboard.whistleblower.channelLabel | en |
| es-MX | dashboard.whistleblower.copy | en |
| es-MX | dashboard.whistleblower.copied | en |
| es-MX | dashboard.whistleblower.colReceived | en |
| es-MX | dashboard.whistleblower.colCategory | en |
| es-MX | dashboard.whistleblower.colStatus | en |
| es-MX | dashboard.whistleblower.colAction | en |
| es-MX | dashboard.whistleblower.view | en |
| es-MX | dashboard.whistleblower.back | en |
| es-MX | dashboard.whistleblower.resolvedOn | en |
| es-MX | dashboard.whistleblower.contact | en |
| es-MX | dashboard.whistleblower.anonymous | en |
| es-MX | dashboard.whistleblower.description | en |
| es-MX | dashboard.whistleblower.changeStatus | en |
| es-MX | dashboard.whistleblower.apply | en |
| es-MX | dashboard.whistleblower.evidence | en |
| es-MX | dashboard.whistleblower.evidenceNone | en |
| es-MX | dashboard.whistleblower.download | en |
| es-MX | dashboard.whistleblower.timeline | en |
| es-MX | dashboard.whistleblower.noNotes | en |
| es-MX | dashboard.whistleblower.noteLabel | en |
| es-MX | dashboard.whistleblower.addNote | en |
| es-MX | dashboard.whistleblower.statusMoved | en |
| es-MX | dashboard.whistleblower.cannotDecrypt | en |
| es-MX | dashboard.whistleblower.error | en |
| es-MX | email.reportSubject | en |
| es-MX | email.reportBody | en |
| en | email.inviteSubject | new UI string (no CONTENT.md source) |
| en | email.inviteBody | new UI string (no CONTENT.md source) |
| en | email.inviteButton | new UI string (no CONTENT.md source) |
| en | employee.title | new UI string (no CONTENT.md source) |
| en | employee.hello | new UI string (no CONTENT.md source) |
| en | employee.progress | new UI string (no CONTENT.md source) |
| en | employee.allDone | new UI string (no CONTENT.md source) |
| en | employee.documentsHeading | new UI string (no CONTENT.md source) |
| en | employee.docOpen | new UI string (no CONTENT.md source) |
| en | employee.docAccepted | new UI string (no CONTENT.md source) |
| en | employee.docOutdated | new UI string (no CONTENT.md source) |
| en | employee.docPending | new UI string (no CONTENT.md source) |
| en | employee.trainingHeading | new UI string (no CONTENT.md source) |
| en | employee.trainingStart | new UI string (no CONTENT.md source) |
| en | employee.trainingPending | new UI string (no CONTENT.md source) |
| en | employee.trainingDone | new UI string (no CONTENT.md source) |
| en | employee.trainingUnavailable | new UI string (no CONTENT.md source) |
| en | employee.trainingReview | new UI string (no CONTENT.md source) |
| en | employee.disclosureHeading | new UI string (no CONTENT.md source) |
| en | employee.disclosureOpen | new UI string (no CONTENT.md source) |
| en | employee.disclosureDone | new UI string (no CONTENT.md source) |
| en | employee.signOut | new UI string (no CONTENT.md source) |
| en | employee.back | new UI string (no CONTENT.md source) |
| en | employee.invalidTitle | new UI string (no CONTENT.md source) |
| en | employee.invalidBody | new UI string (no CONTENT.md source) |
| en | employee.startTitle | new UI string (no CONTENT.md source) |
| en | employee.startBody | new UI string (no CONTENT.md source) |
| en | employee.startButton | new UI string (no CONTENT.md source) |
| en | employee.docAcceptNotice | new UI string (no CONTENT.md source) |
| en | employee.docAccept | new UI string (no CONTENT.md source) |
| en | employee.docAlready | new UI string (no CONTENT.md source) |
| en | employee.docOutdatedTitle | new UI string (no CONTENT.md source) |
| en | employee.docOutdatedBody | new UI string (no CONTENT.md source) |
| en | employee.lessonOf | new UI string (no CONTENT.md source) |
| en | employee.lessonPrev | new UI string (no CONTENT.md source) |
| en | employee.lessonNext | new UI string (no CONTENT.md source) |
| en | employee.lessonQuiz | new UI string (no CONTENT.md source) |
| en | employee.scenario | new UI string (no CONTENT.md source) |
| en | employee.whatToDo | new UI string (no CONTENT.md source) |
| en | employee.quizTitle | new UI string (no CONTENT.md source) |
| en | employee.quizIntro | new UI string (no CONTENT.md source) |
| en | employee.quizSubmit | new UI string (no CONTENT.md source) |
| en | employee.quizUnanswered | new UI string (no CONTENT.md source) |
| en | employee.quizError | new UI string (no CONTENT.md source) |
| en | employee.quizPassed | new UI string (no CONTENT.md source) |
| en | employee.quizFailed | new UI string (no CONTENT.md source) |
| en | employee.quizCorrect | new UI string (no CONTENT.md source) |
| en | employee.quizIncorrect | new UI string (no CONTENT.md source) |
| en | employee.quizRetry | new UI string (no CONTENT.md source) |
| en | employee.disclosureIntro | new UI string (no CONTENT.md source) |
| en | employee.disclosureNone | new UI string (no CONTENT.md source) |
| en | employee.disclosureSome | new UI string (no CONTENT.md source) |
| en | employee.disclosureDetails | new UI string (no CONTENT.md source) |
| en | employee.disclosureSubmit | new UI string (no CONTENT.md source) |
| en | employee.disclosureAlready | new UI string (no CONTENT.md source) |
| en | employee.disclosureThanks | new UI string (no CONTENT.md source) |
| en | employee.disclosureError | new UI string (no CONTENT.md source) |
| en | dashboard.employees.importTitle | new UI string (no CONTENT.md source) |
| en | dashboard.employees.importHelp | new UI string (no CONTENT.md source) |
| en | dashboard.employees.importFile | new UI string (no CONTENT.md source) |
| en | dashboard.employees.importButton | new UI string (no CONTENT.md source) |
| en | dashboard.employees.importResult | new UI string (no CONTENT.md source) |
| en | dashboard.employees.invalidLine | new UI string (no CONTENT.md source) |
| en | dashboard.employees.invalidMore | new UI string (no CONTENT.md source) |
| en | dashboard.employees.reason.columns | new UI string (no CONTENT.md source) |
| en | dashboard.employees.reason.name_empty | new UI string (no CONTENT.md source) |
| en | dashboard.employees.reason.name_long | new UI string (no CONTENT.md source) |
| en | dashboard.employees.reason.email_invalid | new UI string (no CONTENT.md source) |
| en | dashboard.employees.fileError.too_large | new UI string (no CONTENT.md source) |
| en | dashboard.employees.fileError.too_many_rows | new UI string (no CONTENT.md source) |
| en | dashboard.employees.fileError.not_text | new UI string (no CONTENT.md source) |
| en | dashboard.employees.fileError.empty | new UI string (no CONTENT.md source) |
| en | dashboard.employees.fileError.bad_header | new UI string (no CONTENT.md source) |
| en | dashboard.employees.fileError.unterminated_quote | new UI string (no CONTENT.md source) |
| en | dashboard.employees.fileError.no_file | new UI string (no CONTENT.md source) |
| en | dashboard.employees.summary | new UI string (no CONTENT.md source) |
| en | dashboard.employees.summaryNone | new UI string (no CONTENT.md source) |
| en | dashboard.employees.colName | new UI string (no CONTENT.md source) |
| en | dashboard.employees.colEmail | new UI string (no CONTENT.md source) |
| en | dashboard.employees.colInvitation | new UI string (no CONTENT.md source) |
| en | dashboard.employees.colTraining | new UI string (no CONTENT.md source) |
| en | dashboard.employees.colDisclosure | new UI string (no CONTENT.md source) |
| en | dashboard.employees.colActions | new UI string (no CONTENT.md source) |
| en | dashboard.employees.docShort.codeOfConduct | new UI string (no CONTENT.md source) |
| en | dashboard.employees.docShort.antiBribery | new UI string (no CONTENT.md source) |
| en | dashboard.employees.docShort.giftsHospitality | new UI string (no CONTENT.md source) |
| en | dashboard.employees.docShort.conflictsOfInterest | new UI string (no CONTENT.md source) |
| en | dashboard.employees.docShort.thirdPartyPublicOfficials | new UI string (no CONTENT.md source) |
| en | dashboard.employees.docShort.whistleblowerProtection | new UI string (no CONTENT.md source) |
| en | dashboard.employees.invite.not_invited | new UI string (no CONTENT.md source) |
| en | dashboard.employees.invite.invited | new UI string (no CONTENT.md source) |
| en | dashboard.employees.invite.expired | new UI string (no CONTENT.md source) |
| en | dashboard.employees.invite.started | new UI string (no CONTENT.md source) |
| en | dashboard.employees.markDone | new UI string (no CONTENT.md source) |
| en | dashboard.employees.markOutdated | new UI string (no CONTENT.md source) |
| en | dashboard.employees.markPending | new UI string (no CONTENT.md source) |
| en | dashboard.employees.markUnavailable | new UI string (no CONTENT.md source) |
| en | dashboard.employees.sendInvite | new UI string (no CONTENT.md source) |
| en | dashboard.employees.resendInvite | new UI string (no CONTENT.md source) |
| en | dashboard.employees.sendPending | new UI string (no CONTENT.md source) |
| en | dashboard.employees.sendPendingHint | new UI string (no CONTENT.md source) |
| en | dashboard.employees.batchResult | new UI string (no CONTENT.md source) |
| en | dashboard.employees.inviteSent | new UI string (no CONTENT.md source) |
| en | dashboard.employees.inviteFailed | new UI string (no CONTENT.md source) |
| en | dashboard.employees.deactivate | new UI string (no CONTENT.md source) |
| en | dashboard.employees.reactivate | new UI string (no CONTENT.md source) |
| en | dashboard.employees.deactivated | new UI string (no CONTENT.md source) |
| en | dashboard.employees.showDeactivated | new UI string (no CONTENT.md source) |
| en | dashboard.employees.hideDeactivated | new UI string (no CONTENT.md source) |
| en | dashboard.employees.exportCsv | new UI string (no CONTENT.md source) |
| en | dashboard.employees.exportPdf | new UI string (no CONTENT.md source) |
| en | dashboard.employees.details | new UI string (no CONTENT.md source) |
| en | dashboard.employees.back | new UI string (no CONTENT.md source) |
| en | dashboard.employees.acksHeading | new UI string (no CONTENT.md source) |
| en | dashboard.employees.colDocument | new UI string (no CONTENT.md source) |
| en | dashboard.employees.colAccepted | new UI string (no CONTENT.md source) |
| en | dashboard.employees.colIp | new UI string (no CONTENT.md source) |
| en | dashboard.employees.noAcks | new UI string (no CONTENT.md source) |
| en | dashboard.employees.noIp | new UI string (no CONTENT.md source) |
| en | dashboard.employees.trainingHeading | new UI string (no CONTENT.md source) |
| en | dashboard.employees.trainingResult | new UI string (no CONTENT.md source) |
| en | dashboard.employees.trainingNone | new UI string (no CONTENT.md source) |
| en | dashboard.employees.disclosureHeading | new UI string (no CONTENT.md source) |
| en | dashboard.employees.disclosureNone | new UI string (no CONTENT.md source) |
| en | dashboard.employees.disclosureNothing | new UI string (no CONTENT.md source) |
| en | dashboard.employees.disclosureSomething | new UI string (no CONTENT.md source) |
| en | dashboard.employees.disclosureEntry | new UI string (no CONTENT.md source) |
| en | dashboard.employees.emailNotConfigured | new UI string (no CONTENT.md source) |
| en | dashboard.training.title | new UI string (no CONTENT.md source) |
| en | dashboard.training.moduleLine | new UI string (no CONTENT.md source) |
| en | dashboard.training.draft | new UI string (no CONTENT.md source) |
| en | dashboard.training.lessonsHeading | new UI string (no CONTENT.md source) |
| en | dashboard.training.rate | new UI string (no CONTENT.md source) |
| en | dashboard.training.unavailable | new UI string (no CONTENT.md source) |
| en | dashboard.training.resultsHeading | new UI string (no CONTENT.md source) |
| en | dashboard.training.notStarted | new UI string (no CONTENT.md source) |
| en | dashboard.training.passed | new UI string (no CONTENT.md source) |
| en | dashboard.training.attemptsNote | new UI string (no CONTENT.md source) |
| en | dashboard.overview.completionDetail | new UI string (no CONTENT.md source) |
| en | employee.pdf.title | new UI string (no CONTENT.md source) |
| en | employee.pdf.generatedOn | new UI string (no CONTENT.md source) |
| es-AR | email.inviteSubject | CONTENT.md §5 'Employee invitation email' (es-AR wording, with {company}/{name} placeholders) |
| es-AR | email.inviteBody | CONTENT.md §5 'Employee invitation email' (es-AR wording, with {company}/{name} placeholders) |
| es-AR | email.inviteButton | CONTENT.md §5 'Employee invitation email' (es-AR wording, with {company}/{name} placeholders) |
| es-AR | employee.title | en |
| es-AR | employee.hello | en |
| es-AR | employee.progress | en |
| es-AR | employee.allDone | en |
| es-AR | employee.documentsHeading | en |
| es-AR | employee.docOpen | en |
| es-AR | employee.docAccepted | en |
| es-AR | employee.docOutdated | en |
| es-AR | employee.docPending | en |
| es-AR | employee.trainingHeading | en |
| es-AR | employee.trainingStart | en |
| es-AR | employee.trainingPending | en |
| es-AR | employee.trainingDone | en |
| es-AR | employee.trainingUnavailable | en |
| es-AR | employee.trainingReview | en |
| es-AR | employee.disclosureHeading | en |
| es-AR | employee.disclosureOpen | en |
| es-AR | employee.disclosureDone | en |
| es-AR | employee.signOut | en |
| es-AR | employee.back | en |
| es-AR | employee.invalidTitle | en |
| es-AR | employee.invalidBody | en |
| es-AR | employee.startTitle | en |
| es-AR | employee.startBody | en |
| es-AR | employee.startButton | en |
| es-AR | employee.docAcceptNotice | en |
| es-AR | employee.docAccept | en |
| es-AR | employee.docAlready | en |
| es-AR | employee.docOutdatedTitle | en |
| es-AR | employee.docOutdatedBody | en |
| es-AR | employee.lessonOf | en |
| es-AR | employee.lessonPrev | en |
| es-AR | employee.lessonNext | en |
| es-AR | employee.lessonQuiz | en |
| es-AR | employee.scenario | en |
| es-AR | employee.whatToDo | en |
| es-AR | employee.quizTitle | en |
| es-AR | employee.quizIntro | en |
| es-AR | employee.quizSubmit | en |
| es-AR | employee.quizUnanswered | en |
| es-AR | employee.quizError | en |
| es-AR | employee.quizPassed | en |
| es-AR | employee.quizFailed | en |
| es-AR | employee.quizCorrect | en |
| es-AR | employee.quizIncorrect | en |
| es-AR | employee.quizRetry | en |
| es-AR | employee.disclosureIntro | en |
| es-AR | employee.disclosureNone | en |
| es-AR | employee.disclosureSome | en |
| es-AR | employee.disclosureDetails | en |
| es-AR | employee.disclosureSubmit | en |
| es-AR | employee.disclosureAlready | en |
| es-AR | employee.disclosureThanks | en |
| es-AR | employee.disclosureError | en |
| es-AR | dashboard.employees.importTitle | en |
| es-AR | dashboard.employees.importHelp | en |
| es-AR | dashboard.employees.importFile | en |
| es-AR | dashboard.employees.importButton | en |
| es-AR | dashboard.employees.importResult | en |
| es-AR | dashboard.employees.invalidLine | en |
| es-AR | dashboard.employees.invalidMore | en |
| es-AR | dashboard.employees.reason.columns | en |
| es-AR | dashboard.employees.reason.name_empty | en |
| es-AR | dashboard.employees.reason.name_long | en |
| es-AR | dashboard.employees.reason.email_invalid | en |
| es-AR | dashboard.employees.fileError.too_large | en |
| es-AR | dashboard.employees.fileError.too_many_rows | en |
| es-AR | dashboard.employees.fileError.not_text | en |
| es-AR | dashboard.employees.fileError.empty | en |
| es-AR | dashboard.employees.fileError.bad_header | en |
| es-AR | dashboard.employees.fileError.unterminated_quote | en |
| es-AR | dashboard.employees.fileError.no_file | en |
| es-AR | dashboard.employees.summary | en |
| es-AR | dashboard.employees.summaryNone | en |
| es-AR | dashboard.employees.colName | en |
| es-AR | dashboard.employees.colEmail | en |
| es-AR | dashboard.employees.colInvitation | en |
| es-AR | dashboard.employees.colTraining | en |
| es-AR | dashboard.employees.colDisclosure | en |
| es-AR | dashboard.employees.colActions | en |
| es-AR | dashboard.employees.docShort.codeOfConduct | en |
| es-AR | dashboard.employees.docShort.antiBribery | en |
| es-AR | dashboard.employees.docShort.giftsHospitality | en |
| es-AR | dashboard.employees.docShort.conflictsOfInterest | en |
| es-AR | dashboard.employees.docShort.thirdPartyPublicOfficials | en |
| es-AR | dashboard.employees.docShort.whistleblowerProtection | en |
| es-AR | dashboard.employees.invite.not_invited | en |
| es-AR | dashboard.employees.invite.invited | en |
| es-AR | dashboard.employees.invite.expired | en |
| es-AR | dashboard.employees.invite.started | en |
| es-AR | dashboard.employees.markDone | en |
| es-AR | dashboard.employees.markOutdated | en |
| es-AR | dashboard.employees.markPending | en |
| es-AR | dashboard.employees.markUnavailable | en |
| es-AR | dashboard.employees.sendInvite | en |
| es-AR | dashboard.employees.resendInvite | en |
| es-AR | dashboard.employees.sendPending | en |
| es-AR | dashboard.employees.sendPendingHint | en |
| es-AR | dashboard.employees.batchResult | en |
| es-AR | dashboard.employees.inviteSent | en |
| es-AR | dashboard.employees.inviteFailed | en |
| es-AR | dashboard.employees.deactivate | en |
| es-AR | dashboard.employees.reactivate | en |
| es-AR | dashboard.employees.deactivated | en |
| es-AR | dashboard.employees.showDeactivated | en |
| es-AR | dashboard.employees.hideDeactivated | en |
| es-AR | dashboard.employees.exportCsv | en |
| es-AR | dashboard.employees.exportPdf | en |
| es-AR | dashboard.employees.details | en |
| es-AR | dashboard.employees.back | en |
| es-AR | dashboard.employees.acksHeading | en |
| es-AR | dashboard.employees.colDocument | en |
| es-AR | dashboard.employees.colAccepted | en |
| es-AR | dashboard.employees.colIp | en |
| es-AR | dashboard.employees.noAcks | en |
| es-AR | dashboard.employees.noIp | en |
| es-AR | dashboard.employees.trainingHeading | en |
| es-AR | dashboard.employees.trainingResult | en |
| es-AR | dashboard.employees.trainingNone | en |
| es-AR | dashboard.employees.disclosureHeading | en |
| es-AR | dashboard.employees.disclosureNone | en |
| es-AR | dashboard.employees.disclosureNothing | en |
| es-AR | dashboard.employees.disclosureSomething | en |
| es-AR | dashboard.employees.disclosureEntry | en |
| es-AR | dashboard.employees.emailNotConfigured | en |
| es-AR | dashboard.training.title | en |
| es-AR | dashboard.training.moduleLine | en |
| es-AR | dashboard.training.draft | en |
| es-AR | dashboard.training.lessonsHeading | en |
| es-AR | dashboard.training.rate | en |
| es-AR | dashboard.training.unavailable | en |
| es-AR | dashboard.training.resultsHeading | en |
| es-AR | dashboard.training.notStarted | en |
| es-AR | dashboard.training.passed | en |
| es-AR | dashboard.training.attemptsNote | en |
| es-AR | dashboard.overview.completionDetail | en |
| es-AR | employee.pdf.title | en |
| es-AR | employee.pdf.generatedOn | en |
| pt-BR | email.inviteSubject | en |
| pt-BR | email.inviteBody | en |
| pt-BR | email.inviteButton | en |
| pt-BR | employee.title | en |
| pt-BR | employee.hello | en |
| pt-BR | employee.progress | en |
| pt-BR | employee.allDone | en |
| pt-BR | employee.documentsHeading | en |
| pt-BR | employee.docOpen | en |
| pt-BR | employee.docAccepted | en |
| pt-BR | employee.docOutdated | en |
| pt-BR | employee.docPending | en |
| pt-BR | employee.trainingHeading | en |
| pt-BR | employee.trainingStart | en |
| pt-BR | employee.trainingPending | en |
| pt-BR | employee.trainingDone | en |
| pt-BR | employee.trainingUnavailable | en |
| pt-BR | employee.trainingReview | en |
| pt-BR | employee.disclosureHeading | en |
| pt-BR | employee.disclosureOpen | en |
| pt-BR | employee.disclosureDone | en |
| pt-BR | employee.signOut | en |
| pt-BR | employee.back | en |
| pt-BR | employee.invalidTitle | en |
| pt-BR | employee.invalidBody | en |
| pt-BR | employee.startTitle | en |
| pt-BR | employee.startBody | en |
| pt-BR | employee.startButton | en |
| pt-BR | employee.docAcceptNotice | en |
| pt-BR | employee.docAccept | en |
| pt-BR | employee.docAlready | en |
| pt-BR | employee.docOutdatedTitle | en |
| pt-BR | employee.docOutdatedBody | en |
| pt-BR | employee.lessonOf | en |
| pt-BR | employee.lessonPrev | en |
| pt-BR | employee.lessonNext | en |
| pt-BR | employee.lessonQuiz | en |
| pt-BR | employee.scenario | en |
| pt-BR | employee.whatToDo | en |
| pt-BR | employee.quizTitle | en |
| pt-BR | employee.quizIntro | en |
| pt-BR | employee.quizSubmit | en |
| pt-BR | employee.quizUnanswered | en |
| pt-BR | employee.quizError | en |
| pt-BR | employee.quizPassed | en |
| pt-BR | employee.quizFailed | en |
| pt-BR | employee.quizCorrect | en |
| pt-BR | employee.quizIncorrect | en |
| pt-BR | employee.quizRetry | en |
| pt-BR | employee.disclosureIntro | en |
| pt-BR | employee.disclosureNone | en |
| pt-BR | employee.disclosureSome | en |
| pt-BR | employee.disclosureDetails | en |
| pt-BR | employee.disclosureSubmit | en |
| pt-BR | employee.disclosureAlready | en |
| pt-BR | employee.disclosureThanks | en |
| pt-BR | employee.disclosureError | en |
| pt-BR | dashboard.employees.importTitle | en |
| pt-BR | dashboard.employees.importHelp | en |
| pt-BR | dashboard.employees.importFile | en |
| pt-BR | dashboard.employees.importButton | en |
| pt-BR | dashboard.employees.importResult | en |
| pt-BR | dashboard.employees.invalidLine | en |
| pt-BR | dashboard.employees.invalidMore | en |
| pt-BR | dashboard.employees.reason.columns | en |
| pt-BR | dashboard.employees.reason.name_empty | en |
| pt-BR | dashboard.employees.reason.name_long | en |
| pt-BR | dashboard.employees.reason.email_invalid | en |
| pt-BR | dashboard.employees.fileError.too_large | en |
| pt-BR | dashboard.employees.fileError.too_many_rows | en |
| pt-BR | dashboard.employees.fileError.not_text | en |
| pt-BR | dashboard.employees.fileError.empty | en |
| pt-BR | dashboard.employees.fileError.bad_header | en |
| pt-BR | dashboard.employees.fileError.unterminated_quote | en |
| pt-BR | dashboard.employees.fileError.no_file | en |
| pt-BR | dashboard.employees.summary | en |
| pt-BR | dashboard.employees.summaryNone | en |
| pt-BR | dashboard.employees.colName | en |
| pt-BR | dashboard.employees.colEmail | en |
| pt-BR | dashboard.employees.colInvitation | en |
| pt-BR | dashboard.employees.colTraining | en |
| pt-BR | dashboard.employees.colDisclosure | en |
| pt-BR | dashboard.employees.colActions | en |
| pt-BR | dashboard.employees.docShort.codeOfConduct | en |
| pt-BR | dashboard.employees.docShort.antiBribery | en |
| pt-BR | dashboard.employees.docShort.giftsHospitality | en |
| pt-BR | dashboard.employees.docShort.conflictsOfInterest | en |
| pt-BR | dashboard.employees.docShort.thirdPartyPublicOfficials | en |
| pt-BR | dashboard.employees.docShort.whistleblowerProtection | en |
| pt-BR | dashboard.employees.invite.not_invited | en |
| pt-BR | dashboard.employees.invite.invited | en |
| pt-BR | dashboard.employees.invite.expired | en |
| pt-BR | dashboard.employees.invite.started | en |
| pt-BR | dashboard.employees.markDone | en |
| pt-BR | dashboard.employees.markOutdated | en |
| pt-BR | dashboard.employees.markPending | en |
| pt-BR | dashboard.employees.markUnavailable | en |
| pt-BR | dashboard.employees.sendInvite | en |
| pt-BR | dashboard.employees.resendInvite | en |
| pt-BR | dashboard.employees.sendPending | en |
| pt-BR | dashboard.employees.sendPendingHint | en |
| pt-BR | dashboard.employees.batchResult | en |
| pt-BR | dashboard.employees.inviteSent | en |
| pt-BR | dashboard.employees.inviteFailed | en |
| pt-BR | dashboard.employees.deactivate | en |
| pt-BR | dashboard.employees.reactivate | en |
| pt-BR | dashboard.employees.deactivated | en |
| pt-BR | dashboard.employees.showDeactivated | en |
| pt-BR | dashboard.employees.hideDeactivated | en |
| pt-BR | dashboard.employees.exportCsv | en |
| pt-BR | dashboard.employees.exportPdf | en |
| pt-BR | dashboard.employees.details | en |
| pt-BR | dashboard.employees.back | en |
| pt-BR | dashboard.employees.acksHeading | en |
| pt-BR | dashboard.employees.colDocument | en |
| pt-BR | dashboard.employees.colAccepted | en |
| pt-BR | dashboard.employees.colIp | en |
| pt-BR | dashboard.employees.noAcks | en |
| pt-BR | dashboard.employees.noIp | en |
| pt-BR | dashboard.employees.trainingHeading | en |
| pt-BR | dashboard.employees.trainingResult | en |
| pt-BR | dashboard.employees.trainingNone | en |
| pt-BR | dashboard.employees.disclosureHeading | en |
| pt-BR | dashboard.employees.disclosureNone | en |
| pt-BR | dashboard.employees.disclosureNothing | en |
| pt-BR | dashboard.employees.disclosureSomething | en |
| pt-BR | dashboard.employees.disclosureEntry | en |
| pt-BR | dashboard.employees.emailNotConfigured | en |
| pt-BR | dashboard.training.title | en |
| pt-BR | dashboard.training.moduleLine | en |
| pt-BR | dashboard.training.draft | en |
| pt-BR | dashboard.training.lessonsHeading | en |
| pt-BR | dashboard.training.rate | en |
| pt-BR | dashboard.training.unavailable | en |
| pt-BR | dashboard.training.resultsHeading | en |
| pt-BR | dashboard.training.notStarted | en |
| pt-BR | dashboard.training.passed | en |
| pt-BR | dashboard.training.attemptsNote | en |
| pt-BR | dashboard.overview.completionDetail | en |
| pt-BR | employee.pdf.title | en |
| pt-BR | employee.pdf.generatedOn | en |
| es-MX | email.inviteSubject | en |
| es-MX | email.inviteBody | en |
| es-MX | email.inviteButton | en |
| es-MX | employee.title | en |
| es-MX | employee.hello | en |
| es-MX | employee.progress | en |
| es-MX | employee.allDone | en |
| es-MX | employee.documentsHeading | en |
| es-MX | employee.docOpen | en |
| es-MX | employee.docAccepted | en |
| es-MX | employee.docOutdated | en |
| es-MX | employee.docPending | en |
| es-MX | employee.trainingHeading | en |
| es-MX | employee.trainingStart | en |
| es-MX | employee.trainingPending | en |
| es-MX | employee.trainingDone | en |
| es-MX | employee.trainingUnavailable | en |
| es-MX | employee.trainingReview | en |
| es-MX | employee.disclosureHeading | en |
| es-MX | employee.disclosureOpen | en |
| es-MX | employee.disclosureDone | en |
| es-MX | employee.signOut | en |
| es-MX | employee.back | en |
| es-MX | employee.invalidTitle | en |
| es-MX | employee.invalidBody | en |
| es-MX | employee.startTitle | en |
| es-MX | employee.startBody | en |
| es-MX | employee.startButton | en |
| es-MX | employee.docAcceptNotice | en |
| es-MX | employee.docAccept | en |
| es-MX | employee.docAlready | en |
| es-MX | employee.docOutdatedTitle | en |
| es-MX | employee.docOutdatedBody | en |
| es-MX | employee.lessonOf | en |
| es-MX | employee.lessonPrev | en |
| es-MX | employee.lessonNext | en |
| es-MX | employee.lessonQuiz | en |
| es-MX | employee.scenario | en |
| es-MX | employee.whatToDo | en |
| es-MX | employee.quizTitle | en |
| es-MX | employee.quizIntro | en |
| es-MX | employee.quizSubmit | en |
| es-MX | employee.quizUnanswered | en |
| es-MX | employee.quizError | en |
| es-MX | employee.quizPassed | en |
| es-MX | employee.quizFailed | en |
| es-MX | employee.quizCorrect | en |
| es-MX | employee.quizIncorrect | en |
| es-MX | employee.quizRetry | en |
| es-MX | employee.disclosureIntro | en |
| es-MX | employee.disclosureNone | en |
| es-MX | employee.disclosureSome | en |
| es-MX | employee.disclosureDetails | en |
| es-MX | employee.disclosureSubmit | en |
| es-MX | employee.disclosureAlready | en |
| es-MX | employee.disclosureThanks | en |
| es-MX | employee.disclosureError | en |
| es-MX | dashboard.employees.importTitle | en |
| es-MX | dashboard.employees.importHelp | en |
| es-MX | dashboard.employees.importFile | en |
| es-MX | dashboard.employees.importButton | en |
| es-MX | dashboard.employees.importResult | en |
| es-MX | dashboard.employees.invalidLine | en |
| es-MX | dashboard.employees.invalidMore | en |
| es-MX | dashboard.employees.reason.columns | en |
| es-MX | dashboard.employees.reason.name_empty | en |
| es-MX | dashboard.employees.reason.name_long | en |
| es-MX | dashboard.employees.reason.email_invalid | en |
| es-MX | dashboard.employees.fileError.too_large | en |
| es-MX | dashboard.employees.fileError.too_many_rows | en |
| es-MX | dashboard.employees.fileError.not_text | en |
| es-MX | dashboard.employees.fileError.empty | en |
| es-MX | dashboard.employees.fileError.bad_header | en |
| es-MX | dashboard.employees.fileError.unterminated_quote | en |
| es-MX | dashboard.employees.fileError.no_file | en |
| es-MX | dashboard.employees.summary | en |
| es-MX | dashboard.employees.summaryNone | en |
| es-MX | dashboard.employees.colName | en |
| es-MX | dashboard.employees.colEmail | en |
| es-MX | dashboard.employees.colInvitation | en |
| es-MX | dashboard.employees.colTraining | en |
| es-MX | dashboard.employees.colDisclosure | en |
| es-MX | dashboard.employees.colActions | en |
| es-MX | dashboard.employees.docShort.codeOfConduct | en |
| es-MX | dashboard.employees.docShort.antiBribery | en |
| es-MX | dashboard.employees.docShort.giftsHospitality | en |
| es-MX | dashboard.employees.docShort.conflictsOfInterest | en |
| es-MX | dashboard.employees.docShort.thirdPartyPublicOfficials | en |
| es-MX | dashboard.employees.docShort.whistleblowerProtection | en |
| es-MX | dashboard.employees.invite.not_invited | en |
| es-MX | dashboard.employees.invite.invited | en |
| es-MX | dashboard.employees.invite.expired | en |
| es-MX | dashboard.employees.invite.started | en |
| es-MX | dashboard.employees.markDone | en |
| es-MX | dashboard.employees.markOutdated | en |
| es-MX | dashboard.employees.markPending | en |
| es-MX | dashboard.employees.markUnavailable | en |
| es-MX | dashboard.employees.sendInvite | en |
| es-MX | dashboard.employees.resendInvite | en |
| es-MX | dashboard.employees.sendPending | en |
| es-MX | dashboard.employees.sendPendingHint | en |
| es-MX | dashboard.employees.batchResult | en |
| es-MX | dashboard.employees.inviteSent | en |
| es-MX | dashboard.employees.inviteFailed | en |
| es-MX | dashboard.employees.deactivate | en |
| es-MX | dashboard.employees.reactivate | en |
| es-MX | dashboard.employees.deactivated | en |
| es-MX | dashboard.employees.showDeactivated | en |
| es-MX | dashboard.employees.hideDeactivated | en |
| es-MX | dashboard.employees.exportCsv | en |
| es-MX | dashboard.employees.exportPdf | en |
| es-MX | dashboard.employees.details | en |
| es-MX | dashboard.employees.back | en |
| es-MX | dashboard.employees.acksHeading | en |
| es-MX | dashboard.employees.colDocument | en |
| es-MX | dashboard.employees.colAccepted | en |
| es-MX | dashboard.employees.colIp | en |
| es-MX | dashboard.employees.noAcks | en |
| es-MX | dashboard.employees.noIp | en |
| es-MX | dashboard.employees.trainingHeading | en |
| es-MX | dashboard.employees.trainingResult | en |
| es-MX | dashboard.employees.trainingNone | en |
| es-MX | dashboard.employees.disclosureHeading | en |
| es-MX | dashboard.employees.disclosureNone | en |
| es-MX | dashboard.employees.disclosureNothing | en |
| es-MX | dashboard.employees.disclosureSomething | en |
| es-MX | dashboard.employees.disclosureEntry | en |
| es-MX | dashboard.employees.emailNotConfigured | en |
| es-MX | dashboard.training.title | en |
| es-MX | dashboard.training.moduleLine | en |
| es-MX | dashboard.training.draft | en |
| es-MX | dashboard.training.lessonsHeading | en |
| es-MX | dashboard.training.rate | en |
| es-MX | dashboard.training.unavailable | en |
| es-MX | dashboard.training.resultsHeading | en |
| es-MX | dashboard.training.notStarted | en |
| es-MX | dashboard.training.passed | en |
| es-MX | dashboard.training.attemptsNote | en |
| es-MX | dashboard.overview.completionDetail | en |
| es-MX | employee.pdf.title | en |
| es-MX | employee.pdf.generatedOn | en |

## Phase 7 — vendor questionnaire and screening (all new UI strings; pt-BR is primary, es-AR and es-MX share one neutral Spanish text)

| locale | key | translated from |
| :- | :- | :- |
| pt-BR | dashboard.vendors.intro | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.name | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.country | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.taxId | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.contactName | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.contactEmail | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.addButton | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.added | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.formError.name_required | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.formError.name_long | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.formError.country_invalid | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.formError.tax_id_long | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.formError.contact_name_long | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.formError.email_invalid | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.colName | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.colCountry | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.colQuestionnaire | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.colScreening | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.colActions | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.qState.not_sent | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.qState.sent | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.qState.expired | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.qState.submitted | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenState.never | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenState.no_match | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenState.possible_match | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenState.error | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.onDate | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.send | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.resend | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.noEmail | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.sendResult.sent | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.sendResult.failed | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.sendResult.notconfigured | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.sendResult.no_email | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.sendResult.archived | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.archive | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.unarchive | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.showArchived | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.hideArchived | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.archivedBadge | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.detailsLink | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.back | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.profile | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.none | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screen | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.rescreen | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenUnavailable | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenResult.cooldown | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenResult.cap | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenResult.archived | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenResult.unavailable | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenResult.no_match | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenResult.possible_match | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screenResult.error | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.disclaimer | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.answersHeading | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.noAnswers | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.latestAnswer | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.olderAnswers | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.answeredOn | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.respondent | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.ownership | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.pep | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.sanctions | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.antibribery | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.detailsLabel | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.yes | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.no | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.cannotDecrypt | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screeningsHeading | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.noScreenings | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.screeningMeta | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.matchLine | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.entityId | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.errorCode | new UI string (no CONTENT.md source) |
| pt-BR | dashboard.vendors.matchesNote | new UI string (no CONTENT.md source) |
| pt-BR | vendor.title | new UI string (no CONTENT.md source) |
| pt-BR | vendor.intro | new UI string (no CONTENT.md source) |
| pt-BR | vendor.notLegal | new UI string (no CONTENT.md source) |
| pt-BR | vendor.respondentName | new UI string (no CONTENT.md source) |
| pt-BR | vendor.respondentRole | new UI string (no CONTENT.md source) |
| pt-BR | vendor.ownership | new UI string (no CONTENT.md source) |
| pt-BR | vendor.ownershipHelp | new UI string (no CONTENT.md source) |
| pt-BR | vendor.pep | new UI string (no CONTENT.md source) |
| pt-BR | vendor.sanctions | new UI string (no CONTENT.md source) |
| pt-BR | vendor.antibribery | new UI string (no CONTENT.md source) |
| pt-BR | vendor.details | new UI string (no CONTENT.md source) |
| pt-BR | vendor.yes | new UI string (no CONTENT.md source) |
| pt-BR | vendor.no | new UI string (no CONTENT.md source) |
| pt-BR | vendor.submit | new UI string (no CONTENT.md source) |
| pt-BR | vendor.submitting | new UI string (no CONTENT.md source) |
| pt-BR | vendor.errorSummary | new UI string (no CONTENT.md source) |
| pt-BR | vendor.error.required | new UI string (no CONTENT.md source) |
| pt-BR | vendor.error.too_long | new UI string (no CONTENT.md source) |
| pt-BR | vendor.error.choice | new UI string (no CONTENT.md source) |
| pt-BR | vendor.networkError | new UI string (no CONTENT.md source) |
| pt-BR | vendor.thanksTitle | new UI string (no CONTENT.md source) |
| pt-BR | vendor.thanksBody | new UI string (no CONTENT.md source) |
| pt-BR | vendor.invalidTitle | new UI string (no CONTENT.md source) |
| pt-BR | vendor.invalidBody | new UI string (no CONTENT.md source) |
| pt-BR | email.vendorSubject | new UI string (no CONTENT.md source) |
| pt-BR | email.vendorBody | new UI string (no CONTENT.md source) |
| pt-BR | email.vendorButton | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.intro | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.name | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.country | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.taxId | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.contactName | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.contactEmail | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.addButton | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.added | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.formError.name_required | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.formError.name_long | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.formError.country_invalid | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.formError.tax_id_long | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.formError.contact_name_long | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.formError.email_invalid | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.colName | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.colCountry | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.colQuestionnaire | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.colScreening | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.colActions | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.qState.not_sent | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.qState.sent | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.qState.expired | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.qState.submitted | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenState.never | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenState.no_match | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenState.possible_match | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenState.error | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.onDate | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.send | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.resend | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.noEmail | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.sendResult.sent | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.sendResult.failed | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.sendResult.notconfigured | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.sendResult.no_email | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.sendResult.archived | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.archive | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.unarchive | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.showArchived | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.hideArchived | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.archivedBadge | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.detailsLink | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.back | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.profile | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.none | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screen | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.rescreen | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenUnavailable | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenResult.cooldown | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenResult.cap | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenResult.archived | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenResult.unavailable | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenResult.no_match | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenResult.possible_match | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screenResult.error | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.disclaimer | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.answersHeading | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.noAnswers | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.latestAnswer | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.olderAnswers | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.answeredOn | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.respondent | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.ownership | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.pep | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.sanctions | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.antibribery | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.detailsLabel | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.yes | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.no | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.cannotDecrypt | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screeningsHeading | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.noScreenings | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.screeningMeta | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.matchLine | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.entityId | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.errorCode | new UI string (no CONTENT.md source) |
| en | dashboard.vendors.matchesNote | new UI string (no CONTENT.md source) |
| en | vendor.title | new UI string (no CONTENT.md source) |
| en | vendor.intro | new UI string (no CONTENT.md source) |
| en | vendor.notLegal | new UI string (no CONTENT.md source) |
| en | vendor.respondentName | new UI string (no CONTENT.md source) |
| en | vendor.respondentRole | new UI string (no CONTENT.md source) |
| en | vendor.ownership | new UI string (no CONTENT.md source) |
| en | vendor.ownershipHelp | new UI string (no CONTENT.md source) |
| en | vendor.pep | new UI string (no CONTENT.md source) |
| en | vendor.sanctions | new UI string (no CONTENT.md source) |
| en | vendor.antibribery | new UI string (no CONTENT.md source) |
| en | vendor.details | new UI string (no CONTENT.md source) |
| en | vendor.yes | new UI string (no CONTENT.md source) |
| en | vendor.no | new UI string (no CONTENT.md source) |
| en | vendor.submit | new UI string (no CONTENT.md source) |
| en | vendor.submitting | new UI string (no CONTENT.md source) |
| en | vendor.errorSummary | new UI string (no CONTENT.md source) |
| en | vendor.error.required | new UI string (no CONTENT.md source) |
| en | vendor.error.too_long | new UI string (no CONTENT.md source) |
| en | vendor.error.choice | new UI string (no CONTENT.md source) |
| en | vendor.networkError | new UI string (no CONTENT.md source) |
| en | vendor.thanksTitle | new UI string (no CONTENT.md source) |
| en | vendor.thanksBody | new UI string (no CONTENT.md source) |
| en | vendor.invalidTitle | new UI string (no CONTENT.md source) |
| en | vendor.invalidBody | new UI string (no CONTENT.md source) |
| en | email.vendorSubject | new UI string (no CONTENT.md source) |
| en | email.vendorBody | new UI string (no CONTENT.md source) |
| en | email.vendorButton | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.intro | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.name | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.country | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.taxId | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.contactName | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.contactEmail | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.addButton | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.added | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.formError.name_required | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.formError.name_long | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.formError.country_invalid | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.formError.tax_id_long | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.formError.contact_name_long | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.formError.email_invalid | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.colName | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.colCountry | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.colQuestionnaire | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.colScreening | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.colActions | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.qState.not_sent | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.qState.sent | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.qState.expired | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.qState.submitted | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenState.never | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenState.no_match | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenState.possible_match | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenState.error | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.onDate | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.send | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.resend | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.noEmail | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.sendResult.sent | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.sendResult.failed | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.sendResult.notconfigured | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.sendResult.no_email | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.sendResult.archived | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.archive | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.unarchive | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.showArchived | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.hideArchived | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.archivedBadge | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.detailsLink | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.back | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.profile | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.none | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screen | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.rescreen | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenUnavailable | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenResult.cooldown | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenResult.cap | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenResult.archived | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenResult.unavailable | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenResult.no_match | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenResult.possible_match | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screenResult.error | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.disclaimer | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.answersHeading | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.noAnswers | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.latestAnswer | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.olderAnswers | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.answeredOn | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.respondent | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.ownership | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.pep | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.sanctions | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.antibribery | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.detailsLabel | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.yes | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.no | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.cannotDecrypt | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screeningsHeading | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.noScreenings | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.screeningMeta | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.matchLine | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.entityId | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.errorCode | new UI string (no CONTENT.md source) |
| es-AR | dashboard.vendors.matchesNote | new UI string (no CONTENT.md source) |
| es-AR | vendor.title | new UI string (no CONTENT.md source) |
| es-AR | vendor.intro | new UI string (no CONTENT.md source) |
| es-AR | vendor.notLegal | new UI string (no CONTENT.md source) |
| es-AR | vendor.respondentName | new UI string (no CONTENT.md source) |
| es-AR | vendor.respondentRole | new UI string (no CONTENT.md source) |
| es-AR | vendor.ownership | new UI string (no CONTENT.md source) |
| es-AR | vendor.ownershipHelp | new UI string (no CONTENT.md source) |
| es-AR | vendor.pep | new UI string (no CONTENT.md source) |
| es-AR | vendor.sanctions | new UI string (no CONTENT.md source) |
| es-AR | vendor.antibribery | new UI string (no CONTENT.md source) |
| es-AR | vendor.details | new UI string (no CONTENT.md source) |
| es-AR | vendor.yes | new UI string (no CONTENT.md source) |
| es-AR | vendor.no | new UI string (no CONTENT.md source) |
| es-AR | vendor.submit | new UI string (no CONTENT.md source) |
| es-AR | vendor.submitting | new UI string (no CONTENT.md source) |
| es-AR | vendor.errorSummary | new UI string (no CONTENT.md source) |
| es-AR | vendor.error.required | new UI string (no CONTENT.md source) |
| es-AR | vendor.error.too_long | new UI string (no CONTENT.md source) |
| es-AR | vendor.error.choice | new UI string (no CONTENT.md source) |
| es-AR | vendor.networkError | new UI string (no CONTENT.md source) |
| es-AR | vendor.thanksTitle | new UI string (no CONTENT.md source) |
| es-AR | vendor.thanksBody | new UI string (no CONTENT.md source) |
| es-AR | vendor.invalidTitle | new UI string (no CONTENT.md source) |
| es-AR | vendor.invalidBody | new UI string (no CONTENT.md source) |
| es-AR | email.vendorSubject | new UI string (no CONTENT.md source) |
| es-AR | email.vendorBody | new UI string (no CONTENT.md source) |
| es-AR | email.vendorButton | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.intro | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.name | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.country | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.taxId | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.contactName | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.contactEmail | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.addButton | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.added | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.formError.name_required | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.formError.name_long | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.formError.country_invalid | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.formError.tax_id_long | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.formError.contact_name_long | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.formError.email_invalid | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.colName | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.colCountry | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.colQuestionnaire | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.colScreening | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.colActions | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.qState.not_sent | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.qState.sent | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.qState.expired | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.qState.submitted | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenState.never | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenState.no_match | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenState.possible_match | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenState.error | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.onDate | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.send | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.resend | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.noEmail | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.sendResult.sent | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.sendResult.failed | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.sendResult.notconfigured | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.sendResult.no_email | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.sendResult.archived | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.archive | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.unarchive | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.showArchived | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.hideArchived | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.archivedBadge | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.detailsLink | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.back | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.profile | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.none | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screen | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.rescreen | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenUnavailable | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenResult.cooldown | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenResult.cap | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenResult.archived | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenResult.unavailable | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenResult.no_match | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenResult.possible_match | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screenResult.error | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.disclaimer | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.answersHeading | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.noAnswers | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.latestAnswer | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.olderAnswers | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.answeredOn | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.respondent | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.ownership | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.pep | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.sanctions | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.antibribery | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.detailsLabel | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.yes | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.no | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.cannotDecrypt | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screeningsHeading | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.noScreenings | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.screeningMeta | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.matchLine | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.entityId | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.errorCode | new UI string (no CONTENT.md source) |
| es-MX | dashboard.vendors.matchesNote | new UI string (no CONTENT.md source) |
| es-MX | vendor.title | new UI string (no CONTENT.md source) |
| es-MX | vendor.intro | new UI string (no CONTENT.md source) |
| es-MX | vendor.notLegal | new UI string (no CONTENT.md source) |
| es-MX | vendor.respondentName | new UI string (no CONTENT.md source) |
| es-MX | vendor.respondentRole | new UI string (no CONTENT.md source) |
| es-MX | vendor.ownership | new UI string (no CONTENT.md source) |
| es-MX | vendor.ownershipHelp | new UI string (no CONTENT.md source) |
| es-MX | vendor.pep | new UI string (no CONTENT.md source) |
| es-MX | vendor.sanctions | new UI string (no CONTENT.md source) |
| es-MX | vendor.antibribery | new UI string (no CONTENT.md source) |
| es-MX | vendor.details | new UI string (no CONTENT.md source) |
| es-MX | vendor.yes | new UI string (no CONTENT.md source) |
| es-MX | vendor.no | new UI string (no CONTENT.md source) |
| es-MX | vendor.submit | new UI string (no CONTENT.md source) |
| es-MX | vendor.submitting | new UI string (no CONTENT.md source) |
| es-MX | vendor.errorSummary | new UI string (no CONTENT.md source) |
| es-MX | vendor.error.required | new UI string (no CONTENT.md source) |
| es-MX | vendor.error.too_long | new UI string (no CONTENT.md source) |
| es-MX | vendor.error.choice | new UI string (no CONTENT.md source) |
| es-MX | vendor.networkError | new UI string (no CONTENT.md source) |
| es-MX | vendor.thanksTitle | new UI string (no CONTENT.md source) |
| es-MX | vendor.thanksBody | new UI string (no CONTENT.md source) |
| es-MX | vendor.invalidTitle | new UI string (no CONTENT.md source) |
| es-MX | vendor.invalidBody | new UI string (no CONTENT.md source) |
| es-MX | email.vendorSubject | new UI string (no CONTENT.md source) |
| es-MX | email.vendorBody | new UI string (no CONTENT.md source) |
| es-MX | email.vendorButton | new UI string (no CONTENT.md source) |
