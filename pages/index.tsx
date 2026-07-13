import { Button, Link, Spacer } from "@nextui-org/react";
import { Meta } from "../src/Meta";
import { ResumeActiveGame } from "../src/ResumeActiveGame";

export default function Home() {
  return (
    <>
      <Meta
        title="Jumbled Doubles"
        description="Fair random doubles play for any activity that's played in teams of two."
        path="/"
      />
      <section className="container">
        <Spacer y={1} />
        <div className="flex flex-col">
          <ResumeActiveGame />
          <h2 className="text-4xl font-semibold mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-500 to-pink-500 to-60%">
              Jumble&nbsp;
            </span>
            your social play.
          </h2>
          <p>
            Fairly shuffle doubles games so that you play with and against
            everyone.
          </p>
          <Spacer y={4} />
          <div className="border-l-4 border-[#d52b1e] bg-red-50 rounded-r-lg px-4 py-3 text-sm">
            <p>
              <span className="font-bold">🇨🇦 The Canadian edition.</span> A
              new, enhanced version of the original{" "}
              <Link
                color="primary"
                className="text-sm"
                href="https://jumbleddoubles.com"
              >
                Jumbled Doubles
              </Link>{" "}
              by Ted Morin, rebuilt with:
            </p>
            <ul className="list-disc list-inside mt-1">
              <li>
                A smarter shuffler — fewer repeat partners, fairer sit-outs,
                and no replayed matchups
              </li>
              <li>
                Fixed teams — link two players (🔗) so they always play
                together
              </li>
              <li>Live editing — rename players and courts mid-game</li>
            </ul>
          </div>
          <Spacer y={8} />
          <h3 className="text-xl font-semibold mb-2">Why jumble?</h3>
          <p className="mb-1">
            Social play can be hard to do <b>fairly.</b>
          </p>
          <p className="mb-1">
            Using Jumbled Doubles, you can ensure an even distribution of sit
            outs, partners, and opponents across any number of courts.
          </p>
          <p>
            It's an alternative to a round-robin format (fixed partnerships) and
            ladder courts (more competitive).
          </p>

          <Link href="/new">
            <Button color="primary" className="mt-4">
              Start shufflin'
            </Button>
          </Link>

          <Spacer y={8} />

          <h3 className="text-xl font-semibold mb-2">Compatible sports</h3>
          <p>
            This site is for any sport or activity where you play in teams of
            two:
          </p>
          <ul className="list-disc my-3 list-inside">
            <li>🥒 Pickleball</li>
            <li>🎾 Tennis</li>
            <li>🏓 Table tennis (ping-pong)</li>
            <li>🏸 Badminton</li>
            <li>🎾 Padel</li>
            <li>🏐 Roundnet (spike ball)</li>
            <li>🃏 Card games (Bridge, Euchre, etc.)</li>
          </ul>

          <Spacer y={8} />

          <h3 className="text-xl font-semibold mb-2">Feedback</h3>
          <p>
            If you find <span className="text-danger font-bold">problems</span>{" "}
            or have <span className="text-secondary font-bold">feedback</span>,
            open an issue on{" "}
            <Link
              color="primary"
              href="https://github.com/javaisbetterthanpython/jumbled-doubles/issues"
            >
              GitHub
            </Link>
          </p>
        </div>
        <Spacer y={10} />
      </section>
    </>
  );
}
