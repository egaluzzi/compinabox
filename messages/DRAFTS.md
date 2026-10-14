# Gap-filled and new strings — for review before launch

Every message key is either **verbatim** from CONTENT.md or listed here. A test (`tests/messages.test.ts`)
enforces that: any string not listed below must appear in CONTENT.md. Esteban reviews this file before
launch (CLAUDE.md §11); the footer disclaimer and the "does this certify…?" FAQ answer (`footer.disclaimer`,
`faq.a5`) and the legal-basis lines (`landing.min*`) are liability-sensitive and need a native speaker / lawyer.

Source column: the locale/key the text was translated from, or "new UI string" where CONTENT.md has no source at all
(the worker wrote the English and translated it faithfully).

Row counts: en=119, es-AR=106, pt-BR=128, es-MX=116

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
| en | dashboard.title | new UI string (no CONTENT.md source) |
| en | dashboard.placeholder | new UI string (no CONTENT.md source) |
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
| es-AR | dashboard.title | en |
| es-AR | dashboard.placeholder | en |
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
| pt-BR | dashboard.title | en |
| pt-BR | dashboard.placeholder | en |
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
| es-MX | dashboard.title | en |
| es-MX | dashboard.placeholder | en |
| es-MX | email.signinSubject | en |
| es-MX | email.signinBody | en |
| es-MX | email.signinButton | en |
| es-MX | email.welcomeSubject | en |
| es-MX | email.welcomeBody | en |
| es-MX | email.welcomeButton | en |
