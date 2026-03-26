import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RevealSection, RevealChildren } from "./landing-animations";

export const metadata: Metadata = {
  title: "Ko Zna Zna (KZZ) - Priprema za kvizove i testove opšteg znanja",
  description:
    "Besplatna online platforma za pripremu za Slagalicu, Poteru, pub kvizove i prijemne ispite iz opšteg znanja. Vežbaj hiljade pitanja, prati napredak i postani kviz šampion!",
  keywords: [
    "kviz",
    "opšte znanje",
    "slagalica",
    "potera",
    "pub kviz",
    "prijemni ispit",
    "test znanja",
    "Srbija",
    "Ko Zna Zna",
    "KZZ",
    "kviz trener",
    "kviz priprema",
    "opšta kultura",
    "opšte obrazovanje",
    "kviz pitanja",
    "test opšte kulture",
  ],
  openGraph: {
    title: "Ko Zna Zna - Tvoja priprema za kvizove",
    description:
      "Vežbaj hiljade pitanja iz opšteg znanja. Pripremi se za Slagalicu, Poteru, pub kvizove i fakultetske prijemne ispite.",
    type: "website",
    locale: "sr_RS",
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
};

const features = [
  {
    icon: "📺",
    title: "Slagalica, Potera & TV kvizovi",
    description:
      "Pitanja iz kategorija koje se pojavljuju u najpopularnijim kviz emisijama u Srbiji. Vežbaj kao da si u studiju!",
  },
  {
    icon: "🍺",
    title: "Pub kvizovi",
    description:
      "Spremi se za kviz veče u omiljenom kafiću. Širok spektar tema - od istorije do pop kulture.",
  },
  {
    icon: "🎓",
    title: "Prijemni ispiti",
    description:
      "Obavezan test opšteg znanja za mnoge fakultete? KZZ te priprema sa pitanjima koja se zaista pojavljuju na ispitima.",
  },
  {
    icon: "📊",
    title: "Praćenje napretka",
    description:
      "Detaljne statistike po kategorijama, procenat tačnosti i pregled grešaka - sve na jednom mestu.",
  },
  {
    icon: "🏆",
    title: "Takmičenje sa drugima",
    description:
      "Rang lista, streak izazovi i uporedne statistike. Motiviši se takmičenjem sa prijateljima!",
  },
  {
    icon: "🔄",
    title: "Režim grešaka",
    description:
      "Ponavlja samo pitanja koja si pogrešno odgovorio. Najefikasniji način za učenje.",
  },
];

const stats = [
  { value: "1000+", label: "Pitanja" },
  { value: "10+", label: "Kategorija" },
  { value: "∞", label: "Pokušaja" },
];

const faqs = [
  {
    q: "Da li je Ko Zna Zna besplatno?",
    a: "Da, platforma je potpuno besplatna. Napravi nalog i odmah kreni sa vežbanjem.",
  },
  {
    q: "Koja pitanja se nalaze na platformi?",
    a: "Pitanja pokrivaju širok spektar tema - geografija, istorija, nauka, sport, umetnost, pop kultura i još mnogo toga. Redovno dodajemo nova pitanja.",
  },
  {
    q: "Da li mi KZZ može pomoći za Slagalicu ili Poteru?",
    a: "Apsolutno! Pitanja su organizovana po kategorijama koje se pojavljuju u popularnim TV kviz emisijama u Srbiji.",
  },
  {
    q: "Može li mi pomoći za prijemni ispit iz opšteg znanja?",
    a: "Da, mnogi fakulteti u Srbiji zahtevaju test opšteg znanja. KZZ sadrži pitanja koja se redovno pojavljuju na ovim ispitima.",
  },
  {
    q: "Kako funkcioniše režim grešaka?",
    a: "Režim grešaka pamti sva pitanja na koja si pogrešno odgovorio i prikazuje ih ponovo. Tako najbrže učiš i popravljaš slabe tačke.",
  },
  {
    q: "Da li mogu da predložim pitanje?",
    a: "Da! Svaki korisnik može predložiti nova pitanja koja admin pregleda i odobrava za bazu.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Ko Zna Zna",
  alternateName: "KZZ",
  description:
    "Besplatna online platforma za pripremu za Slagalicu, Poteru, pub kvizove i prijemne ispite iz opšteg znanja.",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  inLanguage: "sr",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "RSD",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Image
              src="/kzz-logo.png"
              alt="KZZ"
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
            />{" "}
            <span>KZZ</span>
          </div>
          <Link
            href="/login"
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl px-5 py-2 transition-colors"
          >
            Prijavi se
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-16 pb-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <span className="inline-block bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-semibold px-4 py-1.5 rounded-full border border-[var(--accent)]/20 animate-fade-in">
            Besplatna platforma za vežbanje
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-balance animate-fade-in-up">
            Ko Zna <span className="text-[var(--accent)]">Zna</span>
          </h1>
          <p
            className="text-lg sm:text-xl text-[var(--muted)] max-w-lg mx-auto text-balance animate-fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            Pripremi se za Slagalicu, Poteru, pub kvizove i prijemne ispite iz
            opšteg znanja - sve na jednom mestu.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            <Link
              href="/login"
              className="w-full sm:w-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-8 py-4 text-sm transition-colors hover:scale-105 active:scale-95 transform"
            >
              Započni vežbanje →
            </Link>
            <Link
              href="/demo"
              className="w-full sm:w-auto bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--foreground)] font-semibold rounded-xl px-8 py-4 text-sm transition-colors hover:scale-105 active:scale-95 transform"
            >
              Probaj demo ▶
            </Link>
          </div>

          {/* Hero image */}
          <div
            className="mt-10 max-w-xl mx-auto animate-scale-in"
            style={{ animationDelay: "0.35s" }}
          >
            <Image
              src="/hero.png"
              alt="Ko Zna Zna - screenshot aplikacije za vežbanje kviz pitanja iz opšteg znanja"
              width={576}
              height={400}
              priority
              className="w-full rounded-2xl border border-[var(--border)]"
            />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <RevealSection className="border-y border-[var(--border)] bg-[var(--card)]">
        <div className="max-w-3xl mx-auto grid grid-cols-3 divide-x divide-[var(--border)]">
          {stats.map((s) => (
            <div key={s.label} className="text-center py-8 px-4">
              <div className="text-3xl sm:text-4xl font-bold text-[var(--accent)]">
                {s.value}
              </div>
              <div className="text-sm text-[var(--muted)] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* Use cases / Why KZZ */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <RevealSection className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold">
              Zašto <span className="text-[var(--accent)]">KZZ</span>?
            </h2>
            <p className="text-[var(--muted)] mt-3 max-w-md mx-auto text-balance">
              Jedna platforma, sve što ti treba za pripremu. Bez obzira da li
              ideš na kviz veče ili polažeš prijemni.
            </p>
          </RevealSection>

          <RevealChildren className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--accent)]/30 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
                <p className="text-[var(--muted)] text-sm leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </RevealChildren>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-[var(--card)] border-y border-[var(--border)]">
        <div className="max-w-3xl mx-auto text-center">
          <RevealSection>
            <h2 className="text-2xl sm:text-3xl font-bold mb-12">
              Kako funkcioniše?
            </h2>
          </RevealSection>

          <RevealChildren className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Napravi nalog",
                desc: "Registruj se za par sekundi i odmah kreni sa vežbanjem.",
              },
              {
                step: "2",
                title: "Izaberi kategorije",
                desc: "Odaberi teme koje želiš da vežbaš - od geografije do sporta.",
              },
              {
                step: "3",
                title: "Vežbaj i napreduj",
                desc: "Odgovaraj na pitanja, prati statistiku i poboljšavaj rezultate.",
              },
            ].map((item) => (
              <div key={item.step} className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mx-auto text-[var(--accent)] font-bold text-lg">
                  {item.step}
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-[var(--muted)]">{item.desc}</p>
              </div>
            ))}
          </RevealChildren>
        </div>
      </section>

      {/* Testimonial / Social proof */}
      <RevealSection className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-2xl sm:text-3xl font-bold">Šta kažu korisnici</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 text-left hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-lg">
                  🎓
                </div>
                <div>
                  <div className="font-medium text-sm">Marko N.</div>
                  <div className="text-xs text-[var(--muted)]">
                    Student, priprema za prijemni
                  </div>
                </div>
              </div>
              <p className="text-sm text-[var(--muted)] leading-relaxed italic">
                &ldquo;Zahvaljujući KZZ platformi položio sam test opšteg znanja
                iz prvog pokušaja! Režim grešaka mi je bio najkorisniji, počeo
                sam da grešim manje i učim brže.&rdquo;
              </p>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 text-left hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-lg">
                  🍺
                </div>
                <div>
                  <div className="font-medium text-sm">Jelena D.</div>
                  <div className="text-xs text-[var(--muted)]">
                    Pub kviz entuzijasta
                  </div>
                </div>
              </div>
              <p className="text-sm text-[var(--muted)] leading-relaxed italic">
                &ldquo;Naš tim je konačno počeo da pobeđuje na kviz večerima!
                Vežbamo zajedno na KZZ pre svakog pub kviza. Čak razmišljam da
                se prijavim za Slagalicu!&rdquo;
              </p>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* FAQ */}
      <section className="py-16 px-4 bg-[var(--card)] border-y border-[var(--border)]">
        <div className="max-w-2xl mx-auto">
          <RevealSection className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">
              Često postavljana pitanja
            </h2>
          </RevealSection>

          <RevealChildren className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group bg-[var(--background)] border border-[var(--border)] rounded-xl overflow-hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer px-5 py-4 text-sm font-medium hover:bg-[var(--card-hover)] transition-colors list-none">
                  {faq.q}
                  <svg
                    className="w-4 h-4 text-[var(--muted)] shrink-0 ml-3 transition-transform duration-200 group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="px-5 pb-4 text-sm text-[var(--muted)] leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </RevealChildren>
        </div>
      </section>

      {/* CTA */}
      <RevealSection className="py-16 px-4">
        <div className="max-w-lg mx-auto bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 sm:p-12 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold">
            Spreman da testiraš znanje?
          </h2>
          <p className="text-[var(--muted)] text-sm">
            Pridruži se korisnicima koji već vežbaju na KZZ platformi. Potpuno
            besplatno.
          </p>
          <Link
            href="/login"
            className="inline-block bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-8 py-4 text-sm transition-all hover:scale-105 active:scale-95 transform"
          >
            Kreiraj nalog besplatno →
          </Link>
        </div>
      </RevealSection>

      {/* Kontakt */}
      <RevealSection className="py-16 px-4">
        <div className="max-w-lg mx-auto text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold">Kontakt</h2>
          <p className="text-[var(--muted)] text-sm">
            Imaš pitanje, predlog ili povratnu informaciju? Javi nam se!
          </p>
          <a
            href="mailto:radojevic.laza@gmail.com"
            className="inline-flex items-center gap-2 text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium text-sm transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            radojevic.laza@gmail.com
          </a>
        </div>
      </RevealSection>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <Image
              src="/kzz-logo.png"
              alt="KZZ"
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
            />{" "}
            <span className="font-semibold text-[var(--foreground)]">
              Ko Zna Zna
            </span>
          </div>
          <p>&copy; {new Date().getFullYear()} KZZ. Sva prava zadržana.</p>
        </div>
      </footer>
    </div>
  );
}
