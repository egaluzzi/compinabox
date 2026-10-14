# Gap-filled and new strings — for review before launch

Every message key is either **verbatim** from CONTENT.md or listed here. A test (`tests/messages.test.ts`)
enforces that: any string not listed below must appear in CONTENT.md. Esteban reviews this file before
launch (CLAUDE.md §11); the footer disclaimer and the "does this certify…?" FAQ answer (`footer.disclaimer`,
`faq.a5`) and the legal-basis lines (`landing.min*`) are liability-sensitive and need a native speaker / lawyer.

Source column: the locale/key the text was translated from, or "new UI string" where CONTENT.md has no source at all
(the worker wrote the English and translated it faithfully).

Row counts: en=198, es-AR=185, pt-BR=207, es-MX=195

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
