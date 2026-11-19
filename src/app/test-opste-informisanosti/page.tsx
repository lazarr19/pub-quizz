import type { Metadata } from "next";
import Link from "next/link";
import NotifyForm from "@/components/toi/NotifyForm";

export const metadata: Metadata = {
  title: "Test opšte informisanosti - pitanja i rešenja online",
  description:
    "Besplatni probni testovi opšte informisanosti za prijemne ispite: pitanja i odgovori, tajmer i rešenja sa objašnjenjem. Reši online i vidi gde grešiš.",
  keywords: [
    "test opšte informisanosti",
    "test opšte informisanosti pitanja i odgovori",
    "test opšte informisanosti sa rešenjima",
    "test opšte informisanosti online",
    "pitanja za test opšte informisanosti",
    "zbirka pitanja iz opšte informisanosti",
    "priprema za test opšte informisanosti",
    "opšta informisanost prijemni",
    "test opšte informisanosti FON",
    "prijemni ispit opšta informisanost",
  ],
  alternates: {
    canonical: "/test-opste-informisanosti",
  },
  openGraph: {
    title: "Test opšte informisanosti - pitanja i rešenja - Ko Zna Zna",
    description:
      "Reši besplatan probni test opšte informisanosti i saznaj na kojim oblastima treba da poradiš pre prijemnog.",
    type: "website",
    locale: "sr_RS",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const tests = [
  {
    href: "/test-opste-informisanosti/fon-probni-test-1",
    faculty: "FON",
    title: "Probni test 1",
    meta: "30 pitanja · 45 minuta",
    free: true,
  },
];

const faqs = [
  {
    q: "Šta je test opšte informisanosti?",
    a: "Test iz opšte informisanosti je test sa pitanjima višestrukog izbora iz različitih oblasti koji se polaže na prijemnom ispitu na nekim fakultetima, među njima na FON-u i na Filozofskom fakultetu u Beogradu. Opšta informisanost ne traži posebnu literaturu, već znanje stečeno školovanjem i praćenjem sveta oko sebe.",
  },
  {
    q: "Koja pitanja se postavljaju na testu opšte informisanosti?",
    a: "Pitanja dolaze iz različitih oblasti: istorija, geografija, književnost, umetnost, nauka, jezik i aktuelna dešavanja. Zavisno od fakulteta, tu su i stručni pojmovi, na primer iz menadžmenta i informacionih tehnologija na FON-u.",
  },
  {
    q: "Kako izgleda test opšte informisanosti na FON-u?",
    a: "Prethodnih godina test je imao 30 pitanja. Uz svako pitanje ponuđeno je pet odgovora i opcija „Ne znam“, a samo jedan odgovor je tačan. Tačan odgovor nosi +1 bod, netačan −0,1, a „Ne znam“ 0 bodova. Pitanje bez odgovora se kažnjava, zato uvek označi bar „Ne znam“. Pravila se mogu menjati iz godine u godinu, pa tačne informacije proveri na sajtu fakulteta.",
  },
  {
    q: "Da li se isplati pogađati odgovor?",
    a: "Kada je kazna za pogrešan odgovor mala u odnosu na nagradu za tačan, isplati se. Na FON-u slučajno pogađanje među pet odgovora daje prosečno 0,2 × 1 − 0,8 × 0,1 = +0,12 bodova po pitanju, što je više od „Ne znam“ koje daje 0. Pogađanje se isplati čim je verovatnoća tačnog odgovora veća od oko 9% (0,1 / 1,1), a svaki odgovor koji isključiš tu verovatnoću povećava.",
  },
  {
    q: "Gde mogu da nađem test opšte informisanosti sa rešenjima?",
    a: "Ovde. Reši probni test online, a na kraju dobijaš rešenja i objašnjenje za svako pitanje, bez preuzimanja PDF-a. Testove iz prethodnih godina fakulteti obično objavljuju na svojim sajtovima.",
  },
  {
    q: "Imate li probne testove i za druge fakultete?",
    a: "Za sada je dostupan test u stilu FON-a. Pripremamo probne testove i za druge fakultete, na primer za Psihologiju. Ostavi email na ovoj strani i javićemo ti čim ih objavimo.",
  },
  {
    q: "Da li su ovo pitanja sa pravog testa?",
    a: "Ne. Pitanja su originalna, napisana u stilu testova opšte informisanosti, i nisu preuzeta sa prijemnog ispita. Ova strana nije povezana ni sa jednim fakultetom.",
  },
  {
    q: "Mogu li da rešim isti test više puta?",
    a: "Možeš, ali kad jednom vidiš rešenja, ponovni pokušaj pokazuje koliko pamtiš, a ne koliko znaš. Zato dodajemo nove testove.",
  },
];

export default function TestOpsteInformisanostiPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://koznazna.rs";

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Početna", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Test opšte informisanosti",
        item: `${siteUrl}/test-opste-informisanosti`,
      },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--background)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm"
          >
            ← Početna
          </Link>
          <span className="font-bold text-lg truncate">🎓 Test opšte informisanosti</span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-10">
        <div className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-balance">
            Test opšte informisanosti: pitanja i odgovori za prijemni
          </h1>
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            Reši besplatan probni test opšte informisanosti online i proveri
            koliko si spreman/spremna za prijemni ispit. Svaki test ima tajmer,
            pitanja višestrukog izbora i bodovanje kao na pravom ispitu. Radi
            bez registracije i na telefonu.
          </p>
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            Na kraju odmah dobijaš rezultat, pitanja sa rešenjima i
            objašnjenjem za svako pitanje, kao i pregled oblasti opšte
            informisanosti na kojima treba da poradiš.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="font-bold text-lg">Probni testovi opšte informisanosti</h2>
          <div className="space-y-3">
            {tests.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="flex items-center justify-between gap-4 bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/60 rounded-2xl p-5 transition-colors"
              >
                <div className="space-y-1">
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wide">
                    {t.faculty}
                  </p>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-xs text-[var(--muted)]">{t.meta}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {t.free && (
                    <span className="text-xs font-semibold text-[var(--success)] border border-[var(--success)]/40 rounded-full px-2.5 py-1">
                      Besplatno
                    </span>
                  )}
                  <span className="text-sm font-semibold text-[var(--accent-text)]">
                    Reši →
                  </span>
                </div>
              </Link>
            ))}
            <div className="border border-dashed border-[var(--border)] rounded-2xl p-5 space-y-3">
              <div className="space-y-1">
                <p className="font-semibold text-sm">Novi testovi stižu uskoro</p>
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  Ostavi email i javićemo ti kad objavimo novi probni test.
                </p>
              </div>
              <NotifyForm source="hub" />
            </div>
          </div>
        </section>

        <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold">Šta je test opšte informisanosti</h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Test opšte informisanosti proverava koliko znaš iz različitih oblasti
            ljudskog znanja i savremenog života. Polaže se na prijemnom ispitu
            na nekim fakultetima, a ne traži posebnu literaturu: oslanja se na
            znanje stečeno školovanjem i praćenjem sveta oko sebe.
          </p>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Pitanja opšte informisanosti obično pokrivaju istoriju, geografiju,
            književnost, umetnost, nauku i jezik, a zavisno od fakulteta i
            stručne pojmove iz struke.
          </p>
        </section>

        <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold">Priprema za test opšte informisanosti</h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Opšta informisanost se ne uči preko noći, zato je najbolja priprema
            redovno vežbanje širokog spektra pitanja za test opšte
            informisanosti, a ne učenje jedne knjige.
            Rešavaj probne testove pod uslovima kao na ispitu, pogledaj gde
            grešiš i vraćaj se pitanjima koja si pogrešio/la.
          </p>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Ako pitanje nisi učio/la, često ga možeš rešiti eliminacijom
            nemogućih odgovora, a pogađanje se uglavnom isplati kad su negativni
            bodovi mali.
          </p>
        </section>

        <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold">Test opšte informisanosti sa rešenjima</h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Kad završiš probni test, vidiš tačan odgovor i kratko objašnjenje za
            svako pitanje, direktno na ekranu i bez preuzimanja PDF-a. Možeš da
            prikažeš samo pitanja koja si pogrešio/la ili preskočio/la, a
            oblasti su poređane od one u kojoj si najslabiji/a.
          </p>
        </section>

        <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold">Test opšte informisanosti za FON</h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Prijemni ispit na Fakultetu organizacionih nauka sastoji se od
            testa opšte informisanosti. Prethodnih godina test je izgledao ovako:
          </p>
          <ul className="text-sm text-[var(--muted)] leading-relaxed space-y-1.5 list-disc pl-5">
            <li>30 pitanja, svako sa pet ponuđenih odgovora i opcijom „Ne znam“</li>
            <li>tačan odgovor +1, netačan −0,1, „Ne znam“ 0 bodova</li>
            <li>pitanje bez odgovora se kažnjava, pa uvek označi bar „Ne znam“</li>
            <li>45 minuta za rad</li>
          </ul>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Zadaci su često kratki i definicioni: pojmovi iz menadžmenta i
            organizacije (na primer autoritet, inovacija, virtuelne
            organizacije), informacionih tehnologija i osiguranja, pomešani sa
            pitanjima iz istorije, umetnosti, književnosti, fizike i jezika.
          </p>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Pravila se mogu menjati iz godine u godinu. Testove iz prethodnih
            godina i zvanične informacije o prijemnom ispitu pronaći ćeš na{" "}
            <a
              href="https://oas.fon.bg.ac.rs/"
              target="_blank"
              rel="noopener"
              className="text-[var(--accent-text)] underline underline-offset-2 hover:no-underline"
            >
              sajtu fakulteta
            </a>
            . Naš probni test prati ovaj format:
          </p>
          <Link
            href="/test-opste-informisanosti/fon-probni-test-1"
            className="inline-flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
          >
            Reši FON probni test 1
          </Link>
        </section>

        <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 text-center space-y-3">
          <h2 className="font-semibold">Zbirka pitanja iz opšte informisanosti</h2>
          <p className="text-sm text-[var(--muted)]">
            Ko Zna Zna ima zbirku od hiljada pitanja iz opšteg znanja, a
            aplikacija sama ponavlja pitanja koja pogrešiš. Besplatno je.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/login"
              className="inline-flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
            >
              Prijavi se
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center border border-[var(--border)] text-sm font-medium rounded-xl px-5 py-2.5 hover:border-[var(--accent)]/50 transition-colors"
            >
              Isprobaj demo
            </Link>
            <Link
              href="/kategorije"
              className="inline-flex items-center justify-center border border-[var(--border)] text-sm font-medium rounded-xl px-5 py-2.5 hover:border-[var(--accent)]/50 transition-colors"
            >
              Sve kategorije
            </Link>
            <Link
              href="/pub-kviz-pitanja"
              className="inline-flex items-center justify-center border border-[var(--border)] text-sm font-medium rounded-xl px-5 py-2.5 hover:border-[var(--accent)]/50 transition-colors"
            >
              Kviz pitanja i odgovori
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-bold text-lg">Česta pitanja o testu opšte informisanosti</h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <div
                key={f.q}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-2"
              >
                <h3 className="font-medium text-sm">{f.q}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Probni testovi su originalni i izrađeni u stilu testova opšte
          informisanosti. Nisu preuzeti sa prijemnog ispita i ova strana nije
          povezana ni sa jednim fakultetom.
        </p>
      </main>
    </div>
  );
}
